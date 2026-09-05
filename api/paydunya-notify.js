// api/paydunya-notify.js
// IPN PayDunya (équivalent du webhook CamPay).
// PayDunya appelle cette URL quand un paiement change de statut.
// On re-confirme le paiement auprès de PayDunya (source de vérité, anti-spoof),
// puis on enregistre l'achat dans Supabase (mêmes tables que CamPay).
//
// Variables d'environnement : PAYDUNYA_MASTER_KEY, PAYDUNYA_PRIVATE_KEY,
//   PAYDUNYA_TOKEN, PAYDUNYA_MODE, + Supabase (déjà présentes).

import { createClient } from "@supabase/supabase-js";

// 📧 Email a l'auteur quand son livre est vendu
async function sendAuthorSaleEmail(supabaseAdmin, { bookId, amount }) {
  try {
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) return;
    const EMAIL_FROM = process.env.EMAIL_FROM || "CarryBooks <onboarding@resend.dev>";
    const { data: bk } = await supabaseAdmin.from("books").select("title, auteur_id").eq("id", bookId).limit(1);
    if (!bk || !bk[0] || !bk[0].auteur_id) return;
    const titre = bk[0].title || "ton livre";
    const { data: au } = await supabaseAdmin.from("auteurs").select("email, nom_complet, code_source").eq("id", bk[0].auteur_id).limit(1);
    if (!au || !au[0] || !au[0].email) return;
    const nom = (au[0].nom_complet || "").split(" ")[0] || "";
    const part = Math.round(Number(amount || 0) * 0.5);
    const html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#fff8ec;border-radius:12px;"><div style="text-align:center;font-size:34px;">🎉</div><h2 style="color:#1a1208;text-align:center;margin:8px 0;">Bingo !!!</h2><p style="color:#444;font-size:15px;line-height:1.6;text-align:center;">Bonne nouvelle${nom ? ", " + nom : ""} !<br/>Ton livre <b>${titre}</b> vient d\u2019\u00eatre vendu sur CarryBooks.</p><div style="background:#c9a84c;color:#1a1208;font-weight:bold;font-size:18px;text-align:center;padding:12px;border-radius:10px;margin:16px 0;">+ ${part.toLocaleString("fr-FR")} FCFA</div><p style="color:#666;font-size:13px;text-align:center;">Retrouve tes gains dans ton espace auteur.</p><p style="color:#999;font-size:12px;text-align:center;margin-top:18px;">CarryBooks \u2764\ufe0f</p></div>`;
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": "Bearer " + RESEND_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ from: EMAIL_FROM, to: au[0].email, subject: "🎉 Ton livre \"" + titre + "\" a \u00e9t\u00e9 vendu !", html }),
    });
  } catch (e) { console.error("[PAYDUNYA-AUTEUR-EMAIL]", e.message); }
}

export default async function handler(req, res) {
  // Toujours répondre 200 pour éviter les renvois en boucle de PayDunya.
  try {
    const MODE = (process.env.PAYDUNYA_MODE || "test").toLowerCase();
    const BASE = MODE === "live"
      ? "https://app.paydunya.com/api/v1"
      : "https://app.paydunya.com/sandbox-api/v1";
    const MASTER = process.env.PAYDUNYA_MASTER_KEY;
    const PRIVATE = process.env.PAYDUNYA_PRIVATE_KEY;
    const TOKEN = process.env.PAYDUNYA_TOKEN;

    // --- Récupérer le token de facture depuis le corps de l'IPN (JSON, urlencoded, plat ou imbriqué) ---
    let body = req.body || {};
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch (e) {
        const params = new URLSearchParams(body);
        body = {};
        for (const [k, v] of params) body[k] = v;
      }
    }
    function pick(obj, paths) {
      for (const p of paths) if (obj[p] !== undefined && obj[p] !== "") return obj[p];
      return undefined;
    }
    let invoiceToken =
      (body.data && body.data.invoice && body.data.invoice.token) ||
      (body.invoice && body.invoice.token) ||
      pick(body, ["data[invoice][token]", "invoice_token", "token"]);
    if (!invoiceToken) {
      for (const k of Object.keys(body)) {
        if (k.toLowerCase().indexOf("token") !== -1 && body[k]) { invoiceToken = body[k]; break; }
      }
    }

    console.log("[PAYDUNYA-NOTIFY] Reçu. token:", invoiceToken);
    if (!invoiceToken) return res.status(200).json({ ok: true, ignored: "pas de token" });

    // --- Confirmation autoritaire auprès de PayDunya ---
    const confRes = await fetch(BASE + "/checkout-invoice/confirm/" + invoiceToken, {
      headers: {
        "Content-Type": "application/json",
        "PAYDUNYA-MASTER-KEY": MASTER,
        "PAYDUNYA-PRIVATE-KEY": PRIVATE,
        "PAYDUNYA-TOKEN": TOKEN,
      },
    });
    const conf = await confRes.json();
    const status = conf && conf.status;
    console.log("[PAYDUNYA-NOTIFY] Statut confirmé:", status);

    if (status !== "completed") {
      return res.status(200).json({ ok: true, status: status || "inconnu" });
    }

    // --- Données de la commande (renvoyées par PayDunya) ---
    const cd = (conf && conf.custom_data) || {};
    const bookId = cd.book_id;
    const userId = cd.user_id && cd.user_id !== "" ? cd.user_id : null;
    const extRef = cd.external_reference;
    const referrerCode = cd.referrer_code && cd.referrer_code !== "" ? cd.referrer_code : null;
    const phone = cd.phone || (conf.customer && conf.customer.phone) || "";
    const amount = Math.round(Number((conf.invoice && conf.invoice.total_amount) || cd.amount || 0));

    if (!bookId || !extRef) {
      console.warn("[PAYDUNYA-NOTIFY] custom_data incomplet:", JSON.stringify(cd));
      return res.status(200).json({ ok: true, ignored: "custom_data incomplet" });
    }

    const supabaseAdmin = createClient(
      process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    if (userId) {
      // Achat utilisateur connecté → table purchases (idempotent par external_reference)
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
        referrer_code: referrerCode,
      }]);
      if (error) {
        console.error("[PAYDUNYA-NOTIFY] insert purchases:", error);
        return res.status(200).json({ ok: false, error: error.message });
      }
      await sendAuthorSaleEmail(supabaseAdmin, { bookId, amount });
      console.log("[PAYDUNYA-NOTIFY] Achat enregistré (utilisateur)");
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
        referrer_code: referrerCode,
      }]);
      if (error) {
        console.error("[PAYDUNYA-NOTIFY] insert guest_purchases:", error);
        return res.status(200).json({ ok: false, error: error.message });
      }
      await sendAuthorSaleEmail(supabaseAdmin, { bookId, amount });
      console.log("[PAYDUNYA-NOTIFY] Achat enregistré (invité)");
      return res.status(200).json({ ok: true, handled: "guest" });
    }
  } catch (e) {
    console.error("[PAYDUNYA-NOTIFY] Exception:", e);
    return res.status(200).json({ ok: true, error: e.message });
  }
}
