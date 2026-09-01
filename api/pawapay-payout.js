// api/pawapay-payout.js
// Versement automatique d'un retrait auteur vers son Mobile Money, via PawaPay (tous pays actifs).
// Sécurisé : seul l'admin (Landrine) peut le déclencher (JWT Supabase vérifié).
import { createClient } from "@supabase/supabase-js";

// Pays -> indicatif + devise (pour construire le numéro international si besoin)
const PAYS_INFO = {
  "Cameroun": { dial: "237", cur: "XAF" },
  "Côte d'Ivoire": { dial: "225", cur: "XOF" },
  "Cote d'Ivoire": { dial: "225", cur: "XOF" },
  "Sénégal": { dial: "221", cur: "XOF" }, "Senegal": { dial: "221", cur: "XOF" },
  "Bénin": { dial: "229", cur: "XOF" }, "Benin": { dial: "229", cur: "XOF" },
  "Gabon": { dial: "241", cur: "XAF" },
  "Congo (Brazzaville)": { dial: "242", cur: "XAF" },
  "Congo (RDC)": { dial: "243", cur: "CDF" },
  "Rwanda": { dial: "250", cur: "RWF" },
  "Kenya": { dial: "254", cur: "KES" },
  "Mozambique": { dial: "258", cur: "MZN" },
  "Ouganda": { dial: "256", cur: "UGX" },
  "Sierra Leone": { dial: "232", cur: "SLE" },
  "Zambie": { dial: "260", cur: "ZMW" },
};
// Devise par pays ISO3 (réponse predict-provider)
const CUR_BY_ISO = { CMR: "XAF", COG: "XAF", GAB: "XAF", CIV: "XOF", SEN: "XOF", BEN: "XOF", COD: "CDF", RWA: "RWF", KEN: "KES", MOZ: "MZN", UGA: "UGX", SLE: "SLE", ZMB: "ZMW" };
const DEFAUTS_TAUX = { CDF: 4.5, RWF: 2.13, KES: 0.21, MZN: 0.104, UGX: 6.1, SLE: 0.037, ZMW: 0.043 };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "POST") return res.status(405).json({ error: "POST requis" });
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { retrait_id, token } = body;
    if (!retrait_id) return res.status(400).json({ error: "retrait_id requis" });
    const TOKEN = process.env.PAWAPAY_TOKEN;
    if (!TOKEN) return res.status(500).json({ error: "PAWAPAY_TOKEN manquant" });

    const supa = createClient(
      process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Sécurité admin
    try {
      const { data: u } = await supa.auth.getUser(token || "");
      if (!u || !u.user || u.user.id !== "f8b0dcd2-bf6e-443f-b2ea-a03db4e979dc") {
        return res.status(403).json({ error: "Non autorisé" });
      }
    } catch (e) { return res.status(403).json({ error: "Non autorisé" }); }

    // Charger le retrait
    const { data: rq } = await supa.from("retraits").select("*").eq("id", retrait_id).limit(1);
    const r = rq && rq[0];
    if (!r) return res.status(404).json({ error: "Retrait introuvable" });
    if (r.statut !== "en_attente") return res.status(400).json({ error: "Ce retrait est déjà traité." });

    // Récupérer le pays de l'auteur (pour l'indicatif si le numéro est local)
    const { data: au } = await supa.from("auteurs").select("pays, kyc_pays_residence, kyc_paiement_phone, telephone").eq("id", r.auteur_id).limit(1);
    const auteur = (au && au[0]) || {};
    const paysNom = auteur.pays || auteur.kyc_pays_residence || "";
    const info = PAYS_INFO[paysNom] || null;

    // Construire le numéro international
    let digits = String(r.phone || auteur.kyc_paiement_phone || auteur.telephone || "").replace(/[^\d]/g, "").replace(/^0+/, "");
    if (info && info.dial && !digits.startsWith(info.dial)) digits = info.dial + digits;

    // 1) Prédire l'opérateur (valide aussi le numéro)
    let predict;
    try {
      const pr = await fetch("https://api.pawapay.io/v2/predict-provider", {
        method: "POST",
        headers: { "Authorization": "Bearer " + TOKEN, "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: digits }),
      });
      predict = await pr.json();
      if (!pr.ok || !predict || !predict.provider) {
        return res.status(200).json({ ok: false, error: "Numéro non reconnu par PawaPay : " + (predict && (predict.failureMessage || predict.message) || JSON.stringify(predict)) });
      }
    } catch (e) { return res.status(200).json({ ok: false, error: "Erreur predict-provider : " + (e && e.message) }); }

    const provider = predict.provider;
    const phoneNumber = predict.phoneNumber || digits;
    const isoPays = predict.country || "";
    let devise = CUR_BY_ISO[isoPays] || (info && info.cur) || "XAF";

    // 2) Montant : le retrait est en FCFA. XAF/XOF = tel quel ; sinon conversion via taux (reglages).
    const prixFcfa = Math.round(Number(r.montant) || 0);
    let montant = prixFcfa;
    if (devise !== "XAF" && devise !== "XOF") {
      let taux = DEFAUTS_TAUX[devise] || 1;
      try {
        const { data: rg } = await supa.from("reglages").select("valeur").eq("cle", "taux_xaf_" + devise.toLowerCase()).limit(1);
        if (rg && rg[0] && rg[0].valeur) taux = Number(rg[0].valeur) || taux;
      } catch (e) {}
      montant = Math.round(prixFcfa * taux);
    }
    if (montant < 1) return res.status(200).json({ ok: false, error: "Montant trop faible après conversion." });

    // 3) Initier le payout
    const payoutId = (globalThis.crypto && globalThis.crypto.randomUUID) ? globalThis.crypto.randomUUID() : ("xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => { const v = Math.random() * 16 | 0; return (c === "x" ? v : (v & 0x3 | 0x8)).toString(16); }));
    let pay;
    try {
      const pr2 = await fetch("https://api.pawapay.io/v2/payouts", {
        method: "POST",
        headers: { "Authorization": "Bearer " + TOKEN, "Content-Type": "application/json" },
        body: JSON.stringify({
          payoutId,
          amount: String(montant),
          currency: devise,
          recipient: { type: "MMO", accountDetails: { phoneNumber, provider } },
          customerMessage: "CarryBooks",
        }),
      });
      pay = await pr2.json();
      if (!pr2.ok) return res.status(200).json({ ok: false, error: (pay && (pay.failureReason && pay.failureReason.failureMessage || pay.message)) || ("Échec payout (HTTP " + pr2.status + ")") });
    } catch (e) { return res.status(200).json({ ok: false, error: "Erreur payout : " + (e && e.message) }); }

    const statut = pay && pay.status ? pay.status : "";
    if (statut === "REJECTED" || (pay && pay.failureReason)) {
      return res.status(200).json({ ok: false, error: (pay.failureReason && pay.failureReason.failureMessage) || "Versement refusé par PawaPay." });
    }

    // ACCEPTED (ou en cours) -> on marque payé, avec la référence payoutId
    await supa.from("retraits").update({ statut: "paye", paid_at: new Date().toISOString(), reference: payoutId }).eq("id", r.id);
    return res.status(200).json({ ok: true, payoutId, provider, devise, montant, status: statut });
  } catch (e) {
    return res.status(200).json({ ok: false, error: String(e && e.message || e) });
  }
}
