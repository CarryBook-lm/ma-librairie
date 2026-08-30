// api/pawapay-config.js
// Endpoint de VERIFICATION (lecture seule) : interroge PawaPay pour savoir
// ce qui est active sur le compte (deposits, payouts, pays, operateurs).
// AUCUN argent ne bouge. A supprimer apres verification si besoin.

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  try {
    const TOKEN = process.env.PAWAPAY_TOKEN;
    if (!TOKEN) return res.status(500).json({ error: "PAWAPAY_TOKEN manquant dans Vercel" });

    const r = await fetch("https://api.pawapay.io/v2/active-conf", {
      method: "GET",
      headers: { "Authorization": "Bearer " + TOKEN, "Content-Type": "application/json" },
    });
    const raw = await r.text();
    let data; try { data = JSON.parse(raw); } catch (e) { data = raw; }

    if (!r.ok) {
      return res.status(200).json({ ok: false, status: r.status, reponse: data });
    }

    // On resume : pour chaque pays, quelles operations (DEPOSIT / PAYOUT) sont dispo
    const resume = [];
    try {
      const countries = (data && data.countries) || [];
      countries.forEach(c => {
        const ops = new Set();
        const provs = (c.providers || []);
        provs.forEach(p => {
          (p.operationTypes ? Object.keys(p.operationTypes) : []).forEach(o => ops.add(o));
          if (Array.isArray(p.operationTypes)) p.operationTypes.forEach(o => ops.add(o));
        });
        resume.push({ pays: c.country, operations: Array.from(ops), operateurs: provs.map(p => p.provider || p.correspondent) });
      });
    } catch (e) {}

    return res.status(200).json({ ok: true, resume, brut: data });
  } catch (e) {
    return res.status(200).json({ ok: false, error: String(e && e.message || e) });
  }
}
