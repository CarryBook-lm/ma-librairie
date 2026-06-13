// =============================================================
// 🔔 WEBHOOK CamPay  — /api/campay-notify
// CamPay appelle cette URL dès qu'un paiement atteint son statut final
// (SUCCESSFUL / FAILED), MÊME si le client a fermé la page.
// → règle le cas "débité mais rien débloqué" quand l'opérateur (Orange/MTN)
//   confirme APRÈS le délai d'attente du navigateur.
//
// SÉCURITÉ : on ne fait JAMAIS confiance au POST tel quel. On revérifie le
// statut directement auprès de CamPay avec notre token avant d'enregistrer.
//
// Réutilise les actions idempotentes existantes record_purchase /
// record_guest_purchase de /api/campay → zéro double enregistrement.
// =============================================================

export default async function handler(req, res) {
  // CamPay envoie un POST. On répond toujours 200 pour éviter les renvois en boucle.
  if (req.method !== "POST") {
    return res.status(200).json({ ok: true, ignored: "non-POST" });
  }

  try {
    // Body peut arriver en objet (JSON) ou en chaîne — on gère les deux.
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    body = body || {};

    const reference = body.reference || "";
    const externalReference = body.external_reference || "";
    const phone = body.phone_number || body.phone || "";

    console.log("[CAMPAY-NOTIFY] Reçu:", JSON.stringify({ reference, externalReference, status: body.status }));

    if (!reference) {
      return res.status(200).json({ ok: true, ignored: "pas de reference" });
    }

    // 🔒 REVÉRIFICATION directe auprès de CamPay (anti-spoof)
    const CAMPAY_TOKEN = process.env.CAMPAY_TOKEN;
    if (!CAMPAY_TOKEN) {
      console.error("[CAMPAY-NOTIFY] CAMPAY_TOKEN manquant");
      return res.status(200).json({ ok: true, error: "token manquant" });
    }

    let verified = null;
    try {
      const vRes = await fetch("https://www.campay.net/api/transaction/" + reference + "/", {
        headers: { Authorization: "Token " + CAMPAY_TOKEN },
      });
      verified = await vRes.json();
    } catch (e) {
      console.error("[CAMPAY-NOTIFY] Échec vérification CamPay:", e.message);
      // On répond 200 : CamPay réessaiera plus tard.
      return res.status(200).json({ ok: true, retry: true });
    }

    if (!verified || verified.status !== "SUCCESSFUL") {
      console.log("[CAMPAY-NOTIFY] Statut non SUCCESSFUL (" + (verified && verified.status) + ") → ignoré");
      return res.status(200).json({ ok: true, status: verified && verified.status });
    }

    const extRef = externalReference || verified.external_reference || "";
    const amount = Math.round(parseFloat(verified.amount || body.amount || "0")) || 0;
    const buyerPhone = phone || verified.phone_number || "";

    // Base URL pour rappeler nos propres actions /api/campay (déjà éprouvées + idempotentes)
    const host = req.headers["x-forwarded-host"] || req.headers.host || "carrybooks.com";
    const proto = (req.headers["x-forwarded-proto"] || "https").split(",")[0];
    const apiBase = proto + "://" + host;

    async function callCampay(payload) {
      const r = await fetch(apiBase + "/api/campay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return r.json().catch(() => ({}));
    }

    // ===== ROUTAGE par external_reference =====
    // LIVRES : "CB_<bookId>_<userId|guest>_<timestamp>"
    if (extRef.startsWith("CB_")) {
      const segs = extRef.split("_");
      const bookId = segs[1];
      const userSeg = segs[2];

      if (userSeg && userSeg !== "guest") {
        // Achat utilisateur connecté → record_purchase (idempotent)
        const result = await callCampay({
          action: "record_purchase",
          reference,
          user_id: userSeg,
          book_id: bookId,
          amount,
          phone: buyerPhone,
          external_reference: extRef,
          referrer_code: null,
        });
        console.log("[CAMPAY-NOTIFY] record_purchase:", JSON.stringify(result));
        return res.status(200).json({ ok: true, handled: "book_user", result });
      } else {
        // Achat invité → record_guest_purchase (idempotent)
        const result = await callCampay({
          action: "record_guest_purchase",
          reference,
          book_id: bookId,
          amount,
          phone: buyerPhone,
          external_reference: extRef,
          type: "book",
          referrer_code: null,
        });
        console.log("[CAMPAY-NOTIFY] record_guest_purchase:", JSON.stringify(result));
        return res.status(200).json({ ok: true, handled: "book_guest", result });
      }
    }

    // AUTRES (CarryCare, abonnements, quiz, panier…) : à brancher en phase 2.
    // Pour l'instant on log seulement, sans rien casser.
    console.log("[CAMPAY-NOTIFY] external_reference non géré (phase 2):", extRef);
    return res.status(200).json({ ok: true, handled: "logged_only", extRef });
  } catch (err) {
    console.error("[CAMPAY-NOTIFY] Exception:", err);
    // Toujours 200 pour éviter les renvois infinis de CamPay.
    return res.status(200).json({ ok: true, error: err.message });
  }
}
