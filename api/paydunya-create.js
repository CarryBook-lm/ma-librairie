// api/paydunya-create.js
// Crée une facture de paiement PayDunya et renvoie le lien de paiement.
// Utilisé pour les clients HORS Cameroun (le Cameroun reste sur CamPay).
//
// Variables d'environnement Vercel requises :
//   PAYDUNYA_MASTER_KEY, PAYDUNYA_PRIVATE_KEY, PAYDUNYA_TOKEN
//   PAYDUNYA_MODE = "test" (par défaut) ou "live"

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST uniquement" });

  try {
    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    body = body || {};

    const { amount, book_id, book_title, user_id, phone, email, name, referrer_code } = body;
    if (!amount || !book_id) {
      return res.status(400).json({ error: "amount et book_id requis" });
    }

    const MODE = (process.env.PAYDUNYA_MODE || "test").toLowerCase();
    const BASE = MODE === "live"
      ? "https://app.paydunya.com/api/v1"
      : "https://app.paydunya.com/sandbox-api/v1";

    const MASTER = process.env.PAYDUNYA_MASTER_KEY;
    const PRIVATE = process.env.PAYDUNYA_PRIVATE_KEY;
    const TOKEN = process.env.PAYDUNYA_TOKEN;
    if (!MASTER || !PRIVATE || !TOKEN) {
      return res.status(500).json({ error: "Clés PayDunya manquantes (variables d'environnement Vercel)" });
    }

    const amt = Math.round(Number(amount));
    // Référence unique : PD_<bookId>_<userId|guest>_<timestamp>
    const extRef = "PD_" + book_id + "_" + (user_id || "guest") + "_" + Date.now();
    const title = book_title || ("Livre #" + book_id);

    const payload = {
      invoice: {
        items: {
          item_0: {
            name: title,
            quantity: 1,
            unit_price: String(amt),
            total_price: String(amt),
            description: "Livre numérique CarryBooks",
          },
        },
        total_amount: amt,
        description: "Achat " + title + " sur CarryBooks",
      },
      store: {
        name: "CarryBooks",
        tagline: "Lis. Apprends. Évolue.",
        website_url: "https://www.carrybooks.com",
      },
      actions: {
        cancel_url: "https://www.carrybooks.com/",
        return_url: "https://www.carrybooks.com/?paydunya_return=1",
        callback_url: "https://www.carrybooks.com/api/paydunya-notify",
      },
      // Ces données nous reviennent à la confirmation → on sait quoi débloquer
      custom_data: {
        book_id: String(book_id),
        user_id: user_id ? String(user_id) : "",
        external_reference: extRef,
        phone: phone ? String(phone) : "",
        email: email ? String(email) : "",
        name: name ? String(name) : "",
        referrer_code: referrer_code ? String(referrer_code) : "",
        source: "carrybooks",
      },
    };

    const pdRes = await fetch(BASE + "/checkout-invoice/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "PAYDUNYA-MASTER-KEY": MASTER,
        "PAYDUNYA-PRIVATE-KEY": PRIVATE,
        "PAYDUNYA-TOKEN": TOKEN,
      },
      body: JSON.stringify(payload),
    });
    const data = await pdRes.json();

    if (data && data.response_code === "00" && data.response_text) {
      return res.status(200).json({
        success: true,
        url: data.response_text,   // lien de paiement PayDunya
        token: data.token,
        external_reference: extRef,
        mode: MODE,
      });
    }

    console.error("[PAYDUNYA-CREATE] Échec:", JSON.stringify(data));
    return res.status(400).json({
      success: false,
      error: (data && data.response_text) || "Création de la facture échouée",
      details: data,
    });
  } catch (e) {
    console.error("[PAYDUNYA-CREATE] Exception:", e);
    return res.status(500).json({ success: false, error: e.message });
  }
}
