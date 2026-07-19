// api/paydunya-notify.js
// IPN PayDunya (équivalent du webhook CamPay).
// PayDunya appelle cette URL quand un paiement change de statut.
// On re-confirme le paiement auprès de PayDunya (source de vérité, anti-spoof),
// puis on enregistre l'achat dans Supabase (mêmes tables que CamPay).
//
// Variables d'environnement : PAYDUNYA_MASTER_KEY, PAYDUNYA_PRIVATE_KEY,
//   PAYDUNYA_TOKEN, PAYDUNYA_MODE, + Supabase (déjà présentes).

import { createClient } from "@supabase/supabase-js";

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
      console.log("[PAYDUNYA-NOTIFY] Achat enregistré (invité)");
      return res.status(200).json({ ok: true, handled: "guest" });
    }
  } catch (e) {
    console.error("[PAYDUNYA-NOTIFY] Exception:", e);
    return res.status(200).json({ ok: true, error: e.message });
  }
}
