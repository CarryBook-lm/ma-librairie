// api/pawapay-config.js — VERIFICATION (lecture seule) de la config PawaPay
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  try {
    const TOKEN = process.env.PAWAPAY_TOKEN;
    if (!TOKEN) return res.status(500).json({ error: "PAWAPAY_TOKEN manquant" });
    const r = await fetch("https://api.pawapay.io/v2/active-conf", {
      method: "GET",
      headers: { "Authorization": "Bearer " + TOKEN, "Content-Type": "application/json" },
    });
    const raw = await r.text();
    let data; try { data = JSON.parse(raw); } catch (e) { data = raw; }
    if (!r.ok) return res.status(200).json({ ok: false, status: r.status, reponse: data });
    // Resume : pour chaque pays, quelles OPERATIONS sont dispo (DEPOSIT / PAYOUT / REFUND)
    const resume = [];
    try {
      (data.countries || []).forEach(c => {
        const ops = new Set();
        (c.providers || []).forEach(p => {
          (p.currencies || []).forEach(cur => {
            Object.keys(cur.operationTypes || {}).forEach(o => ops.add(o));
          });
        });
        resume.push({ pays: c.country, operations: Array.from(ops) });
      });
    } catch (e) {}
    const payoutPays = resume.filter(x => x.operations.includes("PAYOUT")).map(x => x.pays);
    return res.status(200).json({ ok: true, PAYOUT_ACTIF: payoutPays.length > 0, pays_avec_payout: payoutPays, resume });
  } catch (e) {
    return res.status(200).json({ ok: false, error: String(e && e.message || e) });
  }
}
