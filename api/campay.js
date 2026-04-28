export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { action, reference } = req.body;

    // Obtenir token
    const tokenRes = await fetch("https://www.campay.net/api/token/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: process.env.VITE_CAMPAY_USERNAME,
        password: process.env.VITE_CAMPAY_PASSWORD
      })
    });
    const tokenData = await tokenRes.json();
    const token = tokenData.token;
    if (!token) return res.status(400).json({ error: "Token non obtenu" });

    if (action === "collect") {
      const { amount, phone, description, external_reference } = req.body;
      const payRes = await fetch("https://www.campay.net/api/collect/", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Token " + token },
        body: JSON.stringify({ amount: String(amount), currency: "XAF", from: phone, description, external_reference })
      });
      const payData = await payRes.json();
      return res.status(200).json(payData);
    }

    if (action === "check") {
      const checkRes = await fetch("https://www.campay.net/api/transaction/" + reference + "/", {
        headers: { "Authorization": "Token " + token }
      });
      const checkData = await checkRes.json();
      return res.status(200).json(checkData);
    }

    return res.status(400).json({ error: "Action inconnue" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}