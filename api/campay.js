// Fonction serverless Vercel : /api/campay
// Gère collect (recevoir) ET withdraw (envoyer)

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const CAMPAY_TOKEN = process.env.CAMPAY_TOKEN;
  if (!CAMPAY_TOKEN) {
    return res.status(500).json({ error: "Token CamPay manquant" });
  }

  const { action, ...params } = req.body;

  try {
    let url, body;

    if (action === "collect") {
      // Recevoir un paiement (achat livre, abo, quiz, carrycare)
      url = "https://www.campay.net/api/collect/";
      body = {
        amount: String(params.amount),
        currency: "XAF",
        from: params.phone,
        description: params.description,
        external_reference: params.external_reference,
      };
    } else if (action === "check") {
      // Vérifier le statut d'une transaction
      const checkUrl = `https://www.campay.net/api/transaction/${params.reference}/`;
      const checkRes = await fetch(checkUrl, {
        headers: { Authorization: "Token " + CAMPAY_TOKEN },
      });
      const checkData = await checkRes.json();
      return res.status(200).json(checkData);
    } else if (action === "withdraw") {
      // ENVOYER un paiement (récompense parrainage)
      url = "https://www.campay.net/api/withdraw/";
      body = {
        amount: String(params.amount),
        currency: "XAF",
        to: params.phone,
        description: params.description,
        external_reference: params.external_reference,
      };
    } else {
      return res.status(400).json({ error: "Action inconnue" });
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Token " + CAMPAY_TOKEN,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    console.error("Erreur CamPay:", err);
    return res.status(500).json({ error: err.message });
  }
}
