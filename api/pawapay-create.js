// api/pawapay-create.js
// Crée une session de paiement PawaPay (Payment Page v2) et renvoie le redirectUrl.
// Utilisé pour l'international (Mobile Money multi-pays). Le Cameroun peut aussi
// passer par ici (XAF) ; CamPay reste dispo par ailleurs.
//
// Variable d'environnement Vercel requise : PAWAPAY_TOKEN (token de PRODUCTION)
// (Supabase déjà présent pour lire le taux XAF->CDF)
//
// Devises : XAF (Cameroun, Gabon, Tchad, RCA, Congo-Brazza) et XOF (Bénin,
// Côte d'Ivoire, Sénégal, Togo, Burkina, Mali, Niger, Guinée-Bissau) ont la même
// valeur que le FCFA -> on envoie le montant tel quel.
// RDC (CDF) : on convertit le prix FCFA en CDF avec le taux fixe de la table reglages.

import { createClient } from "@supabase/supabase-js";

// Pays supportés -> devise + indicatif. (province francophone + marché africain)
const PAYS = {
  CMR: { cur: "XAF" }, // Cameroun
  GAB: { cur: "XAF" }, // Gabon
  TCD: { cur: "XAF" }, // Tchad
  CAF: { cur: "XAF" }, // Centrafrique
  COG: { cur: "XAF" }, // Congo-Brazzaville
  BEN: { cur: "XOF" }, // Bénin
  CIV: { cur: "XOF" }, // Côte d'Ivoire
  SEN: { cur: "XOF" }, // Sénégal
  TGO: { cur: "XOF" }, // Togo
  BFA: { cur: "XOF" }, // Burkina Faso
  MLI: { cur: "XOF" }, // Mali
  NER: { cur: "XOF" }, // Niger
  COD: { cur: "CDF" }, // RD Congo (conversion via taux)
};

function uuidv4() {
  // UUID v4 simple (suffisant pour un depositId unique)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

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

    const { amount, book_id, book_title, user_id, phone, country, referrer_code } = body;
    if (!amount || !book_id) {
      return res.status(400).json({ error: "amount et book_id requis" });
    }

    const TOKEN = process.env.PAWAPAY_TOKEN;
    if (!TOKEN) {
      return res.status(500).json({ error: "PAWAPAY_TOKEN manquant (variable d'environnement Vercel)" });
    }

    // Pays -> devise
    const iso = String(country || "").toUpperCase();
    const conf = PAYS[iso];
    if (!conf) {
      return res.status(400).json({ error: "Pays non pris en charge par PawaPay pour l'instant", country: iso });
    }

    const prixFcfa = Math.round(Number(amount)); // prix affiché (FCFA)
    let montant = prixFcfa;
    let devise = conf.cur;

    // Conversion CDF pour la RDC (taux fixe modifiable dans l'admin)
    if (conf.cur === "CDF") {
      let taux = 4.5;
      try {
        const supa = createClient(
          process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY,
          { auth: { autoRefreshToken: false, persistSession: false } }
        );
        const { data } = await supa.from("reglages").select("valeur").eq("cle", "taux_xaf_cdf").limit(1);
        if (data && data[0] && data[0].valeur) taux = Number(data[0].valeur) || 4.5;
      } catch (e) { /* taux par défaut */ }
      montant = Math.round(prixFcfa * taux);
    }

    const depositId = uuidv4();
    const title = book_title || ("Livre #" + book_id);

    // On garde la trace de la commande dans la référence + les métadonnées.
    // extRef sert d'identifiant unique côté CarryBooks (anti-doublon dans le notify).
    const extRef = "PP_" + book_id + "_" + (user_id || "guest") + "_" + Date.now();

    const returnUrl =
      "https://www.carrybooks.com/?pawapay=return&book=" + encodeURIComponent(book_id);

    // Payment Page v2 : on fixe le montant et la devise ; le client choisit son
    // opérateur Mobile Money sur la page PawaPay.
    const payload = {
      depositId: depositId,
      returnUrl: returnUrl,
      amount: String(montant),
      currency: devise,
      reason: ("Achat " + title).slice(0, 22), // 4-22 caractères
      metadata: [
        { book_id: String(book_id) },
        { user_id: user_id ? String(user_id) : "guest" },
        { ext_ref: extRef },
        { referrer_code: referrer_code ? String(referrer_code) : "" },
        { phone: phone ? String(phone) : "" },
        { prix_fcfa: String(prixFcfa) },
      ],
    };

    const ppRes = await fetch("https://api.pawapay.io/v2/paymentpage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + TOKEN,
      },
      body: JSON.stringify(payload),
    });

    const data = await ppRes.json().catch(() => ({}));

    // La réponse contient redirectUrl si tout va bien.
    const redirectUrl = data.redirectUrl || (data.data && data.data.redirectUrl);
    if (!redirectUrl) {
      console.error("[PAWAPAY-CREATE] Pas de redirectUrl:", JSON.stringify(data));
      return res.status(502).json({ error: "PawaPay n'a pas renvoyé de lien de paiement", details: data });
    }

    return res.status(200).json({ redirectUrl: redirectUrl, depositId: depositId });
  } catch (e) {
    console.error("[PAWAPAY-CREATE] Exception:", e);
    return res.status(500).json({ error: e.message });
  }
}
