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

    const bookId = meta.book_id;
    const userId = meta.user_id && meta.user_id !== "guest" ? meta.user_id : null;
    const extRef = meta.ext_ref || ("PP_" + depositId);
    const referrerCode = meta.referrer_code && meta.referrer_code !== "" ? meta.referrer_code : null;
    const phone = meta.phone || "";
    // On enregistre le montant en FCFA (le prix d'origine), pas le montant converti.
    const amount = Math.round(Number(meta.prix_fcfa || dep.amount || 0));

    if (!bookId) {
      console.warn("[PAWAPAY-NOTIFY] metadata incomplet:", JSON.stringify(meta));
      return res.status(200).json({ ok: true, ignored: "metadata incomplet" });
    }

    const supabaseAdmin = createClient(
      process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

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
        referrer_code: referrerCode,
      }]);
      if (error) {
        console.error("[PAWAPAY-NOTIFY] insert purchases:", error);
        return res.status(200).json({ ok: false, error: error.message });
      }
      console.log("[PAWAPAY-NOTIFY] Achat enregistré (utilisateur)");
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
        console.error("[PAWAPAY-NOTIFY] insert guest_purchases:", error);
        return res.status(200).json({ ok: false, error: error.message });
      }
      console.log("[PAWAPAY-NOTIFY] Achat enregistré (invité)");
      return res.status(200).json({ ok: true, handled: "guest" });
    }
  } catch (e) {
    console.error("[PAWAPAY-NOTIFY] Exception:", e);
    return res.status(200).json({ ok: true, error: e.message });
  }
}
