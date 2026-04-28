export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { action, reference, amount, phone, description, external_reference } = req.body;

    const tokenRes = await fetch("https://www.campay.net/api/token/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: process.env.VITE_CAMPAY_USERNAME,
        password: process.env.VITE_CAMPAY_PASSWORD
      })
    });

    const tokenText = await tokenRes.text();
    console.log("Token response:", tokenText);
    const tokenData = JSON.parse(tokenText);
    const token = tokenData.token;
    if (!token) return res.status(400).json({ error: "Token non obtenu", details: tokenData });

    if (action === "collect") {
      const payRes = await fetch("https://www.campay.net/api/collect/", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Token " + token },
        body: JSON.stringify({ amount: String(amount), currency: "XAF", from: phone, description, external_reference })
      });
      const payText = await payRes.text();
      console.log("Collect response:", payText);
      return res.status(200).json(JSON.parse(payText));
    }

    if (action === "check") {
      const checkRes = await fetch("https://www.campay.net/api/transaction/" + reference + "/", {
        headers: { "Authorization": "Token " + token }
      });
      const checkText = await checkRes.text();
      console.log("Check response:", checkText);
      return res.status(200).json(JSON.parse(checkText));
    }

    return res.status(400).json({ error: "Action inconnue" });
  } catch (e) {
    console.error("Error:", e.message);
    return res.status(500).json({ error: e.message });
  }
}