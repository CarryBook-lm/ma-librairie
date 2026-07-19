// api/geo.js
// Détecte le pays du visiteur à partir des en-têtes fournis par Vercel.
// Gratuit, aucune clé, aucun service externe.
// Renvoie { country: "CM", is_cameroon: true/false }.

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");

  try {
    // Vercel ajoute automatiquement le pays du visiteur dans cet en-tête.
    const h = req.headers || {};
    const country =
      h["x-vercel-ip-country"] ||
      h["x-country"] ||
      h["cf-ipcountry"] ||
      "";

    const code = String(country).toUpperCase();

    return res.status(200).json({
      country: code || null,
      is_cameroon: code === "CM",
      // Si le pays est inconnu (VPN, en-tête absent), on ne force rien :
      // le front pourra proposer le choix manuel.
      detected: !!code,
    });
  } catch (e) {
    return res.status(200).json({ country: null, is_cameroon: null, detected: false, error: e.message });
  }
}
