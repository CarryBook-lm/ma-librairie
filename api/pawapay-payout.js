// api/pawapay-payout.js
// Versement automatique d'un retrait auteur vers son Mobile Money, via PawaPay (tous pays actifs).
// Sécurisé : seul l'admin (Landrine) peut le déclencher (JWT Supabase vérifié).
//
// 20/09 — CORRECTIF IMPORTANT : le retrait n'est plus marqué « payé » sur la seule
// acceptation de PawaPay. Vécu le 20/09 : portefeuille Cameroun à 3 929 XAF pour un
// versement de 5 000 XAF -> PawaPay accepte la demande puis la passe en FAILED une
// seconde plus tard (notre endpoint ne reçoit pas le retour d'information des payouts),
// et le site affichait quand même « ✅ Versement envoyé » + retrait payé. Un auteur
// pouvait donc être compté payé sans avoir rien reçu.
//
// NOUVELLE REGLE :
//   - on enregistre le payoutId AVANT toute chose (traçabilité + anti-double-paiement) ;
//   - on interroge PawaPay jusqu'à obtenir un statut DEFINITIF (quelques secondes) ;
//   - COMPLETED -> retrait « payé » ;
//   - FAILED / REJECTED -> le retrait RESTE « en attente », avec le motif affiché ;
//   - encore en cours -> reste « en attente », et un nouveau clic sur le même retrait
//     RELIT le versement déjà lancé au lieu d'en créer un second.
import { createClient } from "@supabase/supabase-js";

// Pays -> indicatif + devise (pour construire le numéro international si besoin)
const PAYS_INFO = {
  "Cameroun": { dial: "237", cur: "XAF" },
  "Côte d'Ivoire": { dial: "225", cur: "XOF" },
  "Cote d'Ivoire": { dial: "225", cur: "XOF" },
  "Sénégal": { dial: "221", cur: "XOF" }, "Senegal": { dial: "221", cur: "XOF" },
  "Bénin": { dial: "229", cur: "XOF" }, "Benin": { dial: "229", cur: "XOF" },
  "Gabon": { dial: "241", cur: "XAF" },
  "Congo (Brazzaville)": { dial: "242", cur: "XAF" },
  "Congo (RDC)": { dial: "243", cur: "CDF" },
  "Rwanda": { dial: "250", cur: "RWF" },
  "Kenya": { dial: "254", cur: "KES" },
  "Mozambique": { dial: "258", cur: "MZN" },
  "Ouganda": { dial: "256", cur: "UGX" },
  "Sierra Leone": { dial: "232", cur: "SLE" },
  "Zambie": { dial: "260", cur: "ZMW" },
};
// Devise par pays ISO3 (réponse predict-provider)
const CUR_BY_ISO = { CMR: "XAF", COG: "XAF", GAB: "XAF", CIV: "XOF", SEN: "XOF", BEN: "XOF", COD: "CDF", RWA: "RWF", KEN: "KES", MOZ: "MZN", UGA: "UGX", SLE: "SLE", ZMB: "ZMW" };
const DEFAUTS_TAUX = { CDF: 4.5, RWF: 2.13, KES: 0.21, MZN: 0.104, UGX: 6.1, SLE: 0.037, ZMW: 0.043 };

// Statuts PawaPay : ACCEPTED, ENQUEUED, PROCESSING, IN_RECONCILIATION (en cours)
//                   COMPLETED, FAILED (définitifs)
const FINAUX = ["COMPLETED", "FAILED"];

const dodo = (ms) => new Promise((r) => setTimeout(r, ms));

function motifEchec(o) {
  const f = o && o.failureReason;
  if (!f) return "";
  const code = f.failureCode ? " (" + f.failureCode + ")" : "";
  return (f.failureMessage || "Versement refusé") + code;
}

// Lit le statut d'un versement déjà lancé. Renvoie { statut, motif } ou null si illisible.
async function lireVersement(TOKEN, payoutId) {
  try {
    const r = await fetch("https://api.pawapay.io/v2/payouts/" + payoutId, {
      headers: { "Authorization": "Bearer " + TOKEN },
    });
    const j = await r.json();
    if (!r.ok) return null;
    const d = (j && j.data) || null;
    if (!d) return null;
    return { statut: d.status || "", motif: motifEchec(d) };
  } catch (e) { return null; }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "POST") return res.status(405).json({ error: "POST requis" });
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { retrait_id, token } = body;
    if (!retrait_id) return res.status(400).json({ error: "retrait_id requis" });
    const TOKEN = process.env.PAWAPAY_TOKEN;
    if (!TOKEN) return res.status(500).json({ error: "PAWAPAY_TOKEN manquant" });

    const supa = createClient(
      process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Sécurité admin
    try {
      const { data: u } = await supa.auth.getUser(token || "");
      if (!u || !u.user || u.user.id !== "f8b0dcd2-bf6e-443f-b2ea-a03db4e979dc") {
        return res.status(403).json({ error: "Non autorisé" });
      }
    } catch (e) { return res.status(403).json({ error: "Non autorisé" }); }

    // Charger le retrait
    const { data: rq } = await supa.from("retraits").select("*").eq("id", retrait_id).limit(1);
    const r = rq && rq[0];
    if (!r) return res.status(404).json({ error: "Retrait introuvable" });
    if (r.statut !== "en_attente") return res.status(400).json({ error: "Ce retrait est déjà traité." });

    // --- ANTI-DOUBLE-PAIEMENT : un versement a déjà été lancé pour ce retrait ---
    // On le RELIT au lieu d'en créer un second.
    if (r.reference) {
      const etat = await lireVersement(TOKEN, r.reference);
      if (etat && etat.statut === "COMPLETED") {
        await supa.from("retraits").update({ statut: "paye", paid_at: new Date().toISOString() }).eq("id", r.id);
        return res.status(200).json({ ok: true, payoutId: r.reference, status: "COMPLETED", message: "Versement déjà arrivé : retrait marqué payé." });
      }
      if (etat && etat.statut === "FAILED") {
        // On libère la référence pour autoriser une nouvelle tentative.
        await supa.from("retraits").update({ reference: null }).eq("id", r.id);
        return res.status(200).json({ ok: false, error: "Le versement précédent a ÉCHOUÉ : " + (etat.motif || "motif non communiqué par PawaPay") + ". Le retrait reste en attente, tu peux réessayer." });
      }
      if (etat) {
        return res.status(200).json({ ok: false, enCours: true, payoutId: r.reference, status: etat.statut, error: "⏳ Un versement est DÉJÀ EN COURS pour ce retrait (" + etat.statut + "). N'en relance pas un autre : reclique sur ce bouton dans quelques minutes pour connaître le résultat." });
      }
      return res.status(200).json({ ok: false, error: "Un versement a déjà été lancé pour ce retrait (référence " + r.reference + ") mais PawaPay ne répond pas. Vérifie son statut dans ton tableau de bord PawaPay avant toute nouvelle tentative." });
    }

    // Récupérer le pays de l'auteur (pour l'indicatif si le numéro est local)
    const { data: au } = await supa.from("auteurs").select("pays, kyc_pays_residence, kyc_paiement_phone, telephone").eq("id", r.auteur_id).limit(1);
    const auteur = (au && au[0]) || {};
    const paysNom = auteur.pays || auteur.kyc_pays_residence || "";
    const info = PAYS_INFO[paysNom] || null;

    // Construire le numéro international
    let digits = String(r.phone || auteur.kyc_paiement_phone || auteur.telephone || "").replace(/[^\d]/g, "").replace(/^0+/, "");
    if (info && info.dial && !digits.startsWith(info.dial)) digits = info.dial + digits;

    // 1) Prédire l'opérateur (valide aussi le numéro)
    let predict;
    try {
      const pr = await fetch("https://api.pawapay.io/v2/predict-provider", {
        method: "POST",
        headers: { "Authorization": "Bearer " + TOKEN, "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: digits }),
      });
      predict = await pr.json();
      if (!pr.ok || !predict || !predict.provider) {
        return res.status(200).json({ ok: false, error: "Numéro non reconnu par PawaPay : " + (predict && (predict.failureMessage || predict.message) || JSON.stringify(predict)) });
      }
    } catch (e) { return res.status(200).json({ ok: false, error: "Erreur predict-provider : " + (e && e.message) }); }

    const provider = predict.provider;
    const phoneNumber = predict.phoneNumber || digits;
    const isoPays = predict.country || "";
    let devise = CUR_BY_ISO[isoPays] || (info && info.cur) || "XAF";

    // 2) Montant : le retrait est en FCFA. XAF/XOF = tel quel ; sinon conversion via taux (reglages).
    const prixFcfa = Math.round(Number(r.montant) || 0);
    let montant = prixFcfa;
    if (devise !== "XAF" && devise !== "XOF") {
      let taux = DEFAUTS_TAUX[devise] || 1;
      try {
        const { data: rg } = await supa.from("reglages").select("valeur").eq("cle", "taux_xaf_" + devise.toLowerCase()).limit(1);
        if (rg && rg[0] && rg[0].valeur) taux = Number(rg[0].valeur) || taux;
      } catch (e) {}
      montant = Math.round(prixFcfa * taux);
    }
    if (montant < 1) return res.status(200).json({ ok: false, error: "Montant trop faible après conversion." });

    // 3) Initier le payout
    const payoutId = (globalThis.crypto && globalThis.crypto.randomUUID) ? globalThis.crypto.randomUUID() : ("xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => { const v = Math.random() * 16 | 0; return (c === "x" ? v : (v & 0x3 | 0x8)).toString(16); }));

    // On écrit la référence AVANT l'envoi : si la fonction est coupée juste après,
    // le payoutId n'est pas perdu et un second clic relira ce versement au lieu
    // d'en lancer un autre. Le retrait RESTE « en attente » à ce stade.
    await supa.from("retraits").update({ reference: payoutId }).eq("id", r.id);

    let pay;
    try {
      const pr2 = await fetch("https://api.pawapay.io/v2/payouts", {
        method: "POST",
        headers: { "Authorization": "Bearer " + TOKEN, "Content-Type": "application/json" },
        body: JSON.stringify({
          payoutId,
          amount: String(montant),
          currency: devise,
          recipient: { type: "MMO", accountDetails: { phoneNumber, provider } },
          customerMessage: "CarryBooks",
        }),
      });
      pay = await pr2.json();
      if (!pr2.ok) {
        await supa.from("retraits").update({ reference: null }).eq("id", r.id);
        return res.status(200).json({ ok: false, error: (pay && (motifEchec(pay) || pay.message)) || ("Échec payout (HTTP " + pr2.status + ")") });
      }
    } catch (e) {
      // La référence est conservée : l'envoi est peut-être parti malgré l'erreur réseau.
      return res.status(200).json({ ok: false, error: "Erreur payout : " + (e && e.message) + ". Le retrait reste en attente — vérifie la référence " + payoutId + " dans PawaPay avant de réessayer." });
    }

    let statut = (pay && pay.status) || "";
    if (statut === "REJECTED" || (pay && pay.failureReason)) {
      await supa.from("retraits").update({ reference: null }).eq("id", r.id);
      return res.status(200).json({ ok: false, error: "Versement REFUSÉ par PawaPay : " + (motifEchec(pay) || "motif non communiqué") + ". Le retrait reste en attente." });
    }

    // 4) On attend un statut DEFINITIF (l'échec du 20/09 est tombé en 1 seconde).
    //    Pauses courtes pour rester sous la limite de temps de la fonction Vercel.
    let motif = "";
    for (const pause of [1200, 2000, 2500]) {
      if (FINAUX.indexOf(statut) !== -1) break;
      await dodo(pause);
      const etat = await lireVersement(TOKEN, payoutId);
      if (etat && etat.statut) { statut = etat.statut; motif = etat.motif || motif; }
    }

    if (statut === "COMPLETED") {
      await supa.from("retraits").update({ statut: "paye", paid_at: new Date().toISOString(), reference: payoutId }).eq("id", r.id);
      return res.status(200).json({ ok: true, payoutId, provider, devise, montant, status: statut });
    }

    if (statut === "FAILED") {
      // Le retrait RESTE en attente, et la référence est libérée pour réessayer.
      await supa.from("retraits").update({ reference: null }).eq("id", r.id);
      return res.status(200).json({
        ok: false,
        status: statut,
        error: "❌ Le versement a ÉCHOUÉ : " + (motif || "motif non communiqué par PawaPay")
          + ". Rien n'a été envoyé et le retrait reste EN ATTENTE. Cause la plus fréquente : le portefeuille "
          + devise + " de PawaPay n'a pas assez de solde (Finances > Wallets, puis Top ups).",
      });
    }

    // Ni réussi ni échoué : on ne ment pas, on laisse en attente.
    return res.status(200).json({
      ok: false,
      enCours: true,
      payoutId, provider, devise, montant, status: statut || "INCONNU",
      error: "⏳ Versement LANCÉ mais pas encore confirmé (" + (statut || "statut inconnu")
        + "). Le retrait reste EN ATTENTE pour ne pas afficher un paiement non arrivé. Reclique sur « Payer via PawaPay » dans quelques minutes : le système relira CE versement, il n'en lancera pas un second.",
    });
  } catch (e) {
    return res.status(200).json({ ok: false, error: String(e && e.message || e) });
  }
}
