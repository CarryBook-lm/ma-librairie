// api/ikeepay-payin.js — ACHAT DIRECT PAR MOBILE MONEY via iKeePay (Côte d'Ivoire, Sénégal, Bénin, Burkina Faso).
//
// Le lecteur a choisi son opérateur et tapé son numéro dans CarryBooks. Ici :
//   1. on lit le PRIX DU LIVRE DANS LA BASE (jamais celui envoyé par le téléphone) ;
//   2. on enregistre le paiement « en attente » dans ikeepay_paiements ;
//   3. on appelle POST https://api.ikeepay.com/h2h-payin avec la clé secrète ;
//   4. iKeePay pousse la demande de code secret sur le téléphone du lecteur.
// Le livre n'est donné QUE par le webhook vérifié, ou par la réponse d'iKeePay à notre
// question (action « etat » ci-dessous). Jamais sur la seule réponse de /h2h-payin.
//
// Deux actions :
//   { action: "payer", book_id, operator, numero, otp?, phone, pays, access_token?, promo_id?, referrer_code?, author_src? }
//   { action: "etat",  jeton }   → "attente" | "reussi" | "echec"
// Le « jeton » est un identifiant au hasard, propre à ce paiement : c'est lui que le
// téléphone connaît, pas l'identifiant envoyé à iKeePay.
//
// Variable Vercel : IKEEPAY_SECRET_KEY.

import crypto from "crypto";
import { admin, cleIkeepay, IKEEPAY_API, PAYS_IKP, etatChezIkeepay, marquerEchec, donnerLeLivre, rattraper } from "./_ikeepay-commun.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, erreur: "METHODE" });
  if (!cleIkeepay()) return res.status(500).json({ ok: false, erreur: "CONFIG", message: "Le paiement n’est pas encore configuré. Réessaie plus tard." });

  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  b = b || {};
  const supa = admin();
  let paiementId = null;

  try {
    // ================= OÙ EN EST MON PAIEMENT ? =================
    if (String(b.action || "") === "etat") {
      const jeton = String(b.jeton || "");
      if (!/^[a-f0-9]{32}$/.test(jeton)) return res.status(400).json({ ok: false, erreur: "JETON" });
      const { data } = await supa.from("ikeepay_paiements").select("id, statut, created_at, verifie_at, raison").eq("jeton", jeton).limit(1);
      const p = data && data[0];
      if (!p) return res.status(404).json({ ok: false, erreur: "INCONNU" });
      if (p.statut === "reussi") return res.status(200).json({ ok: true, statut: "reussi" });
      if (p.statut === "echec") return res.status(200).json({ ok: true, statut: "echec", raison: p.raison || "" });
      // Encore en attente. Après 15 secondes, on va demander à iKeePay lui-même —
      // au plus une fois toutes les 10 secondes, pour ne pas les harceler.
      const age = Date.now() - new Date(p.created_at).getTime();
      const dernier = p.verifie_at ? Date.now() - new Date(p.verifie_at).getTime() : Infinity;
      if (age > 15000 && dernier > 10000) {
        await supa.from("ikeepay_paiements").update({ verifie_at: new Date().toISOString() }).eq("id", p.id);
        const st = await etatChezIkeepay(p.id);
        if (st && st.statut === "reussi") {
          await donnerLeLivre(supa, p.id, st.ref);
          return res.status(200).json({ ok: true, statut: "reussi" });
        }
        if (st === "echec") {
          await marquerEchec(supa, p.id, "verify failed");
          return res.status(200).json({ ok: true, statut: "echec" });
        }
      }
      // Au passage, on revérifie UN vieux paiement resté en attente (avis d'iKeePay perdu,
      // lecteur parti) : un lecteur payé finit toujours par recevoir son livre.
      await rattraper(supa, 1);
      return res.status(200).json({ ok: true, statut: "attente", depuis: Math.round(age / 1000) });
    }

    // ================= LANCER UN PAIEMENT =================
    // Uniquement les 4 pays. Le Cameroun reste sur CamPay (le mode test du 07/11 est retiré).
    const P = PAYS_IKP[String(b.pays || "").trim()];
    if (!P) return res.status(400).json({ ok: false, erreur: "PAYS", message: "Le paiement direct n’est pas ouvert dans ton pays." });

    const op = String(b.operator || "").toUpperCase().trim();
    if (P.ops.indexOf(op) < 0) return res.status(400).json({ ok: false, erreur: "OPERATEUR", message: "Choisis ton opérateur Mobile Money." });

    // Le numéro : chiffres seulement, préfixé de l'indicatif s'il ne l'a pas déjà.
    // ⚠️ ON NE TOUCHE PAS AU ZÉRO INITIAL : en Côte d'Ivoire et au Bénin il fait partie du
    //    numéro (exemple d'iKeePay : 2250700000000 = 225 + 0700000000).
    let num = String(b.numero || "").replace(/\D/g, "").replace(/^00+/, "");
    if (num.indexOf(P.dial) === 0 && num.length > P.dial.length + 5) num = num.slice(P.dial.length);
    if (num.length < 6 || num.length > 14) return res.status(400).json({ ok: false, erreur: "NUMERO", message: "Écris ton numéro Mobile Money en entier." });
    const complet = P.dial + num;

    // Orange Burkina : un code que le lecteur génère lui-même avec *144*4*6*montant#
    const otp = String(b.otp || "").replace(/\D/g, "");
    if (P.iso === "BF" && op === "ORANGE" && otp.length < 4) {
      return res.status(400).json({ ok: false, erreur: "OTP", message: "Écris le code Orange Money reçu avec *144*4*6*montant#." });
    }

    // Qui paie : vérifié auprès de Supabase, jamais cru sur parole.
    let userId = null, email = "";
    const tok = String(b.access_token || "");
    if (tok) {
      try { const { data } = await supa.auth.getUser(tok); if (data && data.user) { userId = data.user.id; email = data.user.email || ""; } } catch (e) {}
    }

    // LE PRIX VIENT DE LA BASE.
    const bookId = Number(b.book_id || 0);
    if (!bookId) return res.status(400).json({ ok: false, erreur: "LIVRE" });
    const { data: bk } = await supa.from("books").select("id, price, status, masque").eq("id", bookId).limit(1);
    const livre = bk && bk[0];
    if (!livre || !(Number(livre.price) > 0)) return res.status(400).json({ ok: false, erreur: "LIVRE", message: "Ce livre n’est pas en vente." });
    let montant = Math.round(Number(livre.price));
    // Code promo : revérifié ici (actif, pas expiré, pas épuisé)
    let promoId = null;
    if (b.promo_id) {
      try {
        const { data: pr } = await supa.from("promo_codes").select("id, discount_pct, active, expires_at, uses_max, uses_count").eq("id", b.promo_id).limit(1);
        const promo = pr && pr[0];
        const valide = promo && promo.active && !(promo.expires_at && new Date(promo.expires_at) < new Date())
          && !(promo.uses_max && (promo.uses_count || 0) >= promo.uses_max);
        if (valide) { montant = montant - Math.round(montant * Number(promo.discount_pct || 0) / 100); promoId = String(promo.id); }
      } catch (e) {}
    }
    // Orange Burkina n'accepte que des multiples de 100 : on arrondit à la centaine inférieure.
    if (P.iso === "BF" && op === "ORANGE") montant = Math.floor(montant / 100) * 100;
    if (montant < 100) return res.status(400).json({ ok: false, erreur: "MONTANT", message: "Montant trop faible pour un paiement Mobile Money." });

    // Garde-fou : pas plus de 4 demandes en 10 minutes vers un même numéro
    // (sinon n'importe qui pourrait inonder un téléphone de demandes de code).
    const { count } = await supa.from("ikeepay_paiements").select("id", { count: "exact", head: true })
      .eq("numero_paiement", complet).gt("created_at", new Date(Date.now() - 10 * 60000).toISOString());
    if ((count || 0) >= 4) return res.status(429).json({ ok: false, erreur: "ATTENDS", message: "Trop de tentatives sur ce numéro. Attends quelques minutes puis réessaie." });

    const jeton = crypto.randomBytes(16).toString("hex");
    const { data: cree, error: eIns } = await supa.from("ikeepay_paiements").insert([{
      jeton, statut: "attente", book_id: bookId, user_id: userId,
      phone: String(b.phone || "").trim() || ("+" + complet), numero_paiement: complet,
      pays: P.iso3, operateur: op, montant, devise: P.devise || "XOF", promo_id: promoId,
      referrer_code: b.referrer_code ? String(b.referrer_code).slice(0, 60) : null,
      author_src: b.author_src ? String(b.author_src).slice(0, 60) : null,
    }]).select("id").limit(1);
    if (eIns || !cree || !cree[0]) throw new Error("enregistrement : " + (eIns ? eIns.message : "vide"));
    paiementId = cree[0].id;

    const corps = {
      amount: montant, currency: P.devise || "XOF", country: P.iso, phoneNumber: complet, operator: op,
      external_reference: paiementId, customer_email: email || "",
    };
    if (otp) corps.otp = otp;

    const r = await fetch(IKEEPAY_API + "/h2h-payin", {
      method: "POST",
      headers: { "x-api-key": cleIkeepay(), "Content-Type": "application/json" },
      body: JSON.stringify(corps),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error("[IKEEPAY-PAYIN] refusé", r.status, JSON.stringify(d).slice(0, 400));
      await marquerEchec(supa, paiementId, "h2h " + r.status + " " + JSON.stringify(d).slice(0, 150));
      const m = String((d && (d.message || d.error)) || "");
      return res.status(400).json({ ok: false, erreur: "IKEEPAY", message: m ? m.slice(0, 180) : "Le paiement n’a pas pu démarrer. Vérifie ton numéro et réessaie." });
    }

    // Wave et Orange peuvent renvoyer une page à ouvrir au lieu de pousser la demande sur le téléphone.
    const lien = (d && (d.payment_link || (d.data && d.data.payment_link))) || null;

    return res.status(200).json({ ok: true, jeton, montant, devise: P.devise || "XOF", lien });
  } catch (e) {
    const m = String((e && e.message) || e);
    console.error("[IKEEPAY-PAYIN]", m.slice(0, 300));
    if (paiementId) await marquerEchec(supa, paiementId, m);
    return res.status(500).json({ ok: false, erreur: "ERREUR", message: "Le paiement n’a pas pu démarrer. Réessaie dans un moment." });
  }
}
