// api/pawapay-notify.js
// Webhook PawaPay (callback). PawaPay appelle cette URL quand un paiement change
// de statut. On re-confirme le paiement auprès de PawaPay (source de vérité,
// anti-spoof), puis on enregistre l'achat dans Supabase (mêmes tables que CamPay
// / PayDunya : purchases pour les connectés, guest_purchases pour les invités).
//
// URL configurée dans PawaPay (Checkouts + Deposits + Refunds) :
//   https://carrybooks.com/api/pawapay-notify
//
// Variables d'environnement : PAWAPAY_TOKEN + Supabase (déjà présents).

import { createClient } from "@supabase/supabase-js";

// Email admin de nouvelle vente (via Resend) — memes variables que CamPay
async function sendSaleEmail(supabaseAdmin, opts) {
  const { bookId, amount, phone, quiz, kind } = opts || {};
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "carrybooks.com@gmail.com";
  const EMAIL_FROM = process.env.EMAIL_FROM || "CarryBooks <onboarding@resend.dev>";
  if (!RESEND_API_KEY) { console.warn("[PAWAPAY-EMAIL] RESEND_API_KEY manquante"); return; }
  let titre = kind === "carrycare" ? ("Diagnostic " + (quiz || "CarryCare")) : ("Livre #" + bookId);
  try {
    if (kind !== "carrycare" && bookId) {
      const { data } = await supabaseAdmin.from("books").select("title").eq("id", bookId).limit(1);
      if (data && data[0] && data[0].title) titre = data[0].title;
    }
  } catch (e) {}
  const html = '<div style="font-family:Arial,sans-serif;color:#1a1208">' +
    '<h2 style="color:#c9a84c">Nouvelle vente (PawaPay)</h2>' +
    '<p style="font-size:16px"><b>' + titre + '</b></p>' +
    '<p>Montant : <b>' + amount + ' FCFA</b></p>' +
    '<p>Telephone : ' + (phone || "-") + '</p>' +
    '<p>Paiement : PawaPay (Mobile Money international)</p></div>';
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": "Bearer " + RESEND_API_KEY, "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ from: EMAIL_FROM, to: ADMIN_EMAIL, subject: "Vente PawaPay - " + titre, html }),
    });
    const d = await r.json().catch(() => ({}));
    console.log("[PAWAPAY-EMAIL] envoye:", d.id || JSON.stringify(d));
  } catch (e) { console.error("[PAWAPAY-EMAIL] erreur:", e.message); }
}

// 📧 Email a l'AUTEUR quand son livre est vendu (motivation)
async function sendAuthorSaleEmail(supabaseAdmin, { auteurId, titre, partAuteur }) {
  try {
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY || !auteurId) return;
    const EMAIL_FROM = process.env.EMAIL_FROM || "CarryBooks <onboarding@resend.dev>";
    const { data: au } = await supabaseAdmin.from("auteurs").select("email, nom_complet").eq("id", auteurId).limit(1);
    if (!au || !au[0] || !au[0].email) return;
    const nom = (au[0].nom_complet || "").split(" ")[0] || "";
    const html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#fff8ec;border-radius:12px;"><div style="text-align:center;font-size:34px;">🎉</div><h2 style="color:#1a1208;text-align:center;margin:8px 0;">Bingo !!!</h2><p style="color:#444;font-size:15px;line-height:1.6;text-align:center;">Bonne nouvelle${nom ? ", " + nom : ""} !<br/>Ton livre <b>${titre}</b> vient d\u2019\u00eatre vendu sur CarryBooks.</p><div style="background:#c9a84c;color:#1a1208;font-weight:bold;font-size:18px;text-align:center;padding:12px;border-radius:10px;margin:16px 0;">+ ${Number(partAuteur||0).toLocaleString("fr-FR")} FCFA</div><p style="color:#666;font-size:13px;text-align:center;">Retrouve tes gains dans ton espace auteur.</p><p style="color:#999;font-size:12px;text-align:center;margin-top:18px;">CarryBooks \u2764\ufe0f</p></div>`;
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": "Bearer " + RESEND_API_KEY, "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ from: EMAIL_FROM, to: au[0].email, subject: "🎉 Ton livre \"" + titre + "\" a \u00e9t\u00e9 vendu !", html }),
    });
  } catch (e) { console.error("[PAWAPAY-AUTEUR-EMAIL]", e.message); }
}

// Brique 5b : enregistre la commission auteur (70% via son lien, 50% sinon)
async function recordAuthorSale(supabaseAdmin, { bookId, amount, extRef, authorSrc }) {
  try {
    if (!bookId || !amount) return;
    const { data: bk } = await supabaseAdmin.from("books").select("auteur_id").eq("id", bookId).limit(1);
    const auteurId = bk && bk[0] ? bk[0].auteur_id : null;
    if (!auteurId) return; // livre sans auteur (classiques) -> pas de commission
    const { data: va } = await supabaseAdmin.from("ventes_auteurs").select("id").eq("reference", extRef).limit(1);
    if (va && va.length > 0) return; // deja enregistre (anti-doublon)
    const { data: au } = await supabaseAdmin.from("auteurs").select("code_source").eq("id", auteurId).limit(1);
    const codeSource = au && au[0] ? au[0].code_source : null;
    const viaLien = authorSrc && codeSource && String(authorSrc).toLowerCase() === String(codeSource).toLowerCase();
    const taux = viaLien ? 70 : 50;
    const partAuteur = Math.round(amount * taux / 100);
    const { error } = await supabaseAdmin.from("ventes_auteurs").insert([{
      auteur_id: auteurId, book_id: bookId, reference: extRef,
      montant_total: amount, taux_auteur: taux, part_auteur: partAuteur,
      part_carrybooks: amount - partAuteur, source: viaLien ? "auteur" : "carrybooks",
    }]);
    if (error) console.error("[PAWAPAY-AUTEUR] insert ventes_auteurs:", error.message);
    else {
      console.log("[PAWAPAY-AUTEUR] commission enregistree:", taux + "% =", partAuteur, "FCFA");
      let titre = "ton livre";
      try { const { data: bt } = await supabaseAdmin.from("books").select("title").eq("id", bookId).limit(1); if (bt && bt[0] && bt[0].title) titre = bt[0].title; } catch (e) {}
      await sendAuthorSaleEmail(supabaseAdmin, { auteurId, titre, partAuteur });
    }
  } catch (e) { console.error("[PAWAPAY-AUTEUR] exception:", e.message); }
}

export default async function handler(req, res) {
  // Toujours répondre 200 pour éviter les renvois en boucle de PawaPay.
  try {
    let body = req.body || {};
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }

    // Le callback PawaPay contient le depositId. Selon les versions, il peut être
    // à la racine ou sous data. On récupère de façon robuste.
    const depositId =
      body.depositId ||
      (body.data && body.data.depositId) ||
      body.depositID ||
      null;

    console.log("[PAWAPAY-NOTIFY] Reçu. depositId:", depositId);
    if (!depositId) {
      return res.status(200).json({ ok: true, ignored: "pas de depositId" });
    }

    const TOKEN = process.env.PAWAPAY_TOKEN;

    // --- Confirmation autoritaire auprès de PawaPay ---
    // On interroge l'API pour connaître le vrai statut (ne pas se fier au corps reçu).
    const confRes = await fetch("https://api.pawapay.io/v2/deposits/" + depositId, {
      headers: { "Authorization": "Bearer " + TOKEN },
    });
    const conf = await confRes.json().catch(() => ({}));

    // La réponse peut être un objet ou une liste selon l'API. On normalise.
    const dep = Array.isArray(conf) ? conf[0] : (conf.data || conf);
    const status = dep && (dep.status || dep.depositStatus);
    console.log("[PAWAPAY-NOTIFY] Statut confirmé:", status);

    // Statut final réussi = COMPLETED
    if (status !== "COMPLETED") {
      return res.status(200).json({ ok: true, status: status || "inconnu" });
    }

    // --- Récupérer les métadonnées de la commande ---
    // metadata est une liste d'objets [{book_id:...},{user_id:...},...]
    const metaArr = dep.metadata || [];
    const meta = {};
    if (Array.isArray(metaArr)) {
      for (const m of metaArr) {
        if (m && typeof m === "object") {
          for (const k of Object.keys(m)) {
            if (k !== "isPII") meta[k] = m[k];
          }
        }
      }
    } else if (metaArr && typeof metaArr === "object") {
      Object.assign(meta, metaArr);
    }

    const kind = meta.kind || "book";
    const bookId = meta.book_id;
    const quizType = meta.quiz_type || "";
    const userId = meta.user_id && meta.user_id !== "guest" ? meta.user_id : null;
    const extRef = meta.ext_ref || ("PP_" + depositId);
    const referrerCode = meta.referrer_code && meta.referrer_code !== "" ? meta.referrer_code : null;
    const authorSrc = meta.author_src && meta.author_src !== "" ? meta.author_src : "";
    const paysVente = meta.pays && meta.pays !== "" ? meta.pays : null;
    const phone = meta.phone || "";
    // On enregistre le montant en FCFA (le prix d'origine), pas le montant converti.
    const amount = Math.round(Number(meta.prix_fcfa || dep.amount || 0));

    const supabaseAdmin = createClient(
      process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ===================== DIAGNOSTIC CARRYCARE =====================
    // Le diagnostic complet a été pré-enregistré dans carrycare_pending par
    // pawapay-create. On le lit et on crée la ligne finale carrycare_results.
    if (kind === "carrycare") {
      // Idempotence : déjà enregistré ?
      const { data: dejaCC } = await supabaseAdmin
        .from("carrycare_results").select("id").eq("external_reference", extRef).limit(1);
      if (dejaCC && dejaCC.length > 0) {
        return res.status(200).json({ ok: true, duplicate: true, handled: "carrycare" });
      }
      // Récupérer le diagnostic pré-enregistré
      const { data: pend } = await supabaseAdmin
        .from("carrycare_pending").select("*").eq("external_reference", extRef).limit(1);
      const p = pend && pend[0] ? pend[0] : null;
      if (!p) {
        console.warn("[PAWAPAY-NOTIFY] carrycare_pending introuvable:", extRef);
        return res.status(200).json({ ok: true, ignored: "pending carrycare introuvable" });
      }
      const { error: errCC } = await supabaseAdmin.from("carrycare_results").insert([{
        external_reference: extRef,
        quiz_type: p.quiz_type || quizType || "body",
        amount: p.amount != null ? p.amount : amount,
        phone: p.phone || phone || "",
        result_data: p.result_data || {},
        user_id: p.user_id || userId || null,
        referrer_code: p.referrer_code || referrerCode || null,
      }]);
      if (errCC) {
        console.error("[PAWAPAY-NOTIFY] insert carrycare_results:", errCC);
        return res.status(200).json({ ok: false, error: errCC.message });
      }
      // Nettoyage du pending (non bloquant)
      try { await supabaseAdmin.from("carrycare_pending").delete().eq("external_reference", extRef); } catch (e) {}
      console.log("[PAWAPAY-NOTIFY] Diagnostic CarryCare enregistré");
      await sendSaleEmail(supabaseAdmin, { kind: "carrycare", amount: (p.amount != null ? p.amount : amount), phone: p.phone || phone, quiz: p.quiz_type || quizType });
      return res.status(200).json({ ok: true, handled: "carrycare" });
    }
    // =================== FIN DIAGNOSTIC CARRYCARE ===================

    if (!bookId) {
      console.warn("[PAWAPAY-NOTIFY] metadata incomplet:", JSON.stringify(meta));
      return res.status(200).json({ ok: true, ignored: "metadata incomplet" });
    }

    if (userId) {
      // Achat utilisateur connecté → purchases (idempotent par external_reference)
      const { data: existing } = await supabaseAdmin
        .from("purchases").select("id").eq("external_reference", extRef).limit(1);
      if (existing && existing.length > 0) {
        return res.status(200).json({ ok: true, duplicate: true });
      }
      const { error } = await supabaseAdmin.from("purchases").insert([{
        user_id: userId,
        book_id: bookId,
        amount,
        phone,
        external_reference: extRef,
        type: "sale",
        pays: paysVente,
        referrer_code: referrerCode,
      }]);
      if (error) {
        console.error("[PAWAPAY-NOTIFY] insert purchases:", error);
        return res.status(200).json({ ok: false, error: error.message });
      }
      console.log("[PAWAPAY-NOTIFY] Achat enregistré (utilisateur)");
      await sendSaleEmail(supabaseAdmin, { kind: "book", bookId, amount, phone });
      await recordAuthorSale(supabaseAdmin, { bookId, amount, extRef, authorSrc });
      return res.status(200).json({ ok: true, handled: "user" });
    } else {
      // Invité → guest_purchases (idempotent par reference)
      const { data: existing } = await supabaseAdmin
        .from("guest_purchases").select("id").eq("reference", extRef).limit(1);
      if (existing && existing.length > 0) {
        return res.status(200).json({ ok: true, duplicate: true });
      }
      const { error } = await supabaseAdmin.from("guest_purchases").insert([{
        phone: String(phone || "").trim(),
        book_id: bookId,
        amount,
        reference: extRef,
        external_reference: extRef,
        type: "book",
        pays: paysVente,
        referrer_code: referrerCode,
      }]);
      if (error) {
        console.error("[PAWAPAY-NOTIFY] insert guest_purchases:", error);
        return res.status(200).json({ ok: false, error: error.message });
      }
      console.log("[PAWAPAY-NOTIFY] Achat enregistré (invité)");
      await sendSaleEmail(supabaseAdmin, { kind: "book", bookId, amount, phone });
      await recordAuthorSale(supabaseAdmin, { bookId, amount, extRef, authorSrc });
      return res.status(200).json({ ok: true, handled: "guest" });
    }
  } catch (e) {
    console.error("[PAWAPAY-NOTIFY] Exception:", e);
    return res.status(200).json({ ok: true, error: e.message });
  }
}
