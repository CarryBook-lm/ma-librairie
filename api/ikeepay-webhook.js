// api/ikeepay-webhook.js — iKeePay prévient qu'un paiement CarryBooks a changé d'état.
// Adresse à déclarer chez iKeePay (espace Business → Clés API → Webhook) :
//     https://carrybooks.com/api/ikeepay-webhook
//
// LE FICHIER LE PLUS SENSIBLE : s'il donnait un livre sur simple demande, n'importe qui
// pourrait s'en offrir. On ne donne donc RIEN sans l'une de ces deux preuves :
//   1. la SIGNATURE d'iKeePay (HMAC SHA-256 du message avec la clé secrète) ;
//   2. à défaut, la CONFIRMATION d'iKeePay : on leur repose la question avec notre clé.
// Sans preuve : rien n'est donné, l'appel est refusé.
// Le même avis peut arriver plusieurs fois : le livre n'est jamais donné deux fois.
//
// Copié de Yolli (api/ikeepay-webhook.js), adapté aux tables de CarryBooks.

import crypto from "crypto";
import { admin, cleIkeepay, pick, etatChezIkeepay, donnerLeLivre } from "./_ikeepay-commun.js";

function corpsBrut(req) {
  return new Promise((resolve) => {
    if (!req.readable) {
      if (typeof req.rawBody === "string") return resolve(req.rawBody);
      if (Buffer.isBuffer(req.rawBody)) return resolve(req.rawBody.toString("utf8"));
      if (typeof req.body === "string") return resolve(req.body);
      if (req.body && typeof req.body === "object") { try { return resolve(JSON.stringify(req.body)); } catch (e) {} }
      return resolve("");
    }
    const morceaux = [];
    req.on("data", (c) => morceaux.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", () => resolve(Buffer.concat(morceaux).toString("utf8")));
    req.on("error", () => resolve(""));
  });
}

// Comparaison à durée constante : on ne laisse pas deviner la signature octet par octet.
function memeTexte(a, b) {
  const x = Buffer.from(String(a || ""), "utf8");
  const y = Buffer.from(String(b || ""), "utf8");
  if (x.length !== y.length || x.length === 0) return false;
  try { return crypto.timingSafeEqual(x, y); } catch (e) { return false; }
}

// Signature HMAC SHA-256 : en hexadécimal ou en base64, parfois préfixée « sha256= ».
function signatureValide(brut, recue) {
  const cle = cleIkeepay();
  if (!cle || !brut || !recue) return false;
  const donnee = String(recue).trim().replace(/^sha256=/i, "").trim();
  const h = crypto.createHmac("sha256", cle).update(brut, "utf8").digest();
  return memeTexte(donnee.toLowerCase(), h.toString("hex")) || memeTexte(donnee, h.toString("base64"));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(200).json({ ok: true, ignore: "non-POST" });
  if (!cleIkeepay()) { console.error("[IKEEPAY-WEBHOOK] IKEEPAY_SECRET_KEY absente"); return res.status(500).json({ ok: false }); }

  const brut = await corpsBrut(req);
  let body = {};
  try { body = JSON.parse(brut || "{}") || {}; } catch (e) { body = {}; }
  const t = body.data || body.transaction || body;

  try {
    const statut = String(pick(t, "status", "payment.status", "state") || "").toLowerCase();
    const ENCOURS = ["pending", "initiated", "processing", "created"];
    const TERMINES = ["failed", "fail", "refund", "cancel", "declin", "expired", "reject", "error"];
    const enCours = ENCOURS.some((x) => statut.includes(x));
    const echoue = !enCours && TERMINES.some((x) => statut.includes(x));
    if (enCours) return res.status(200).json({ ok: true, ignore: "statut " + statut });

    // Notre identifiant de paiement, renvoyé par iKeePay (external_reference en paiement direct)
    const id = String(pick(t, "external_reference", "order_id", "orderId", "metadata.order_id", "merchant_reference") ||
                      pick(body, "external_reference", "order_id", "orderId") || "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      console.warn("[IKEEPAY-WEBHOOK] sans référence", (brut || "").slice(0, 300));
      return res.status(200).json({ ok: true, ignore: "sans reference" });
    }

    const supa = admin();
    const { data: lignes } = await supa.from("ikeepay_paiements").select("id, statut").eq("id", id).limit(1);
    if (!lignes || !lignes.length) {
      // Pas un paiement CarryBooks (le compte iKeePay est partagé avec Yolli) : on l'ignore.
      return res.status(200).json({ ok: true, ignore: "inconnu de CarryBooks" });
    }
    if (lignes[0].statut === "reussi") return res.status(200).json({ ok: true, deja: true });

    // LES DEUX PORTES
    const sig = req.headers["x-ikeepay-signature"] || req.headers["ikeepay-signature"] || req.headers["x-signature"] || "";
    let preuve = signatureValide(brut, sig) ? "signature" : "";
    // Signé mais sans statut clair (ni réussite ni échec) : on pose quand même la question à iKeePay.
    if (preuve === "signature" && !echoue && !/completed|complete|success|succeed|paid|approved/.test(statut)) preuve = "";
    let refIkeepay = pick(t, "provider_reference", "ikeepay_ref", "reference", "transaction_reference", "transactionId", "id") || null;
    let confirme = null;
    if (!preuve) {
      confirme = await etatChezIkeepay(id);
      if (confirme && (confirme.statut === "reussi" || confirme === "echec")) preuve = "verification";
    }
    if (!preuve) {
      console.error("[IKEEPAY-WEBHOOK] ni signature ni confirmation — rien n’est donné.", "signature :", String(sig).slice(0, 80) || "(aucune)");
      return res.status(401).json({ ok: false, erreur: "SIGNATURE" });
    }

    // Avec la vérification, c'est la réponse d'iKeePay qui fait foi, pas le corps reçu.
    const estEchec = preuve === "verification" ? confirme === "echec" : echoue;
    if (estEchec) {
      const motif = String(pick(t, "message", "reason", "error", "failure_reason") || statut || "failed").slice(0, 195);
      await supa.from("ikeepay_paiements").update({ statut: "echec", raison: motif, maj_at: new Date().toISOString() }).eq("id", id).eq("statut", "attente");
      return res.status(200).json({ ok: true, echec: true });
    }
    if (preuve === "verification" && confirme && confirme.ref) refIkeepay = confirme.ref;

    await donnerLeLivre(supa, id, refIkeepay);
    return res.status(200).json({ ok: true, preuve });
  } catch (e) {
    // 500 : iKeePay réessaiera. Le livre n'est jamais donné deux fois.
    console.error("[IKEEPAY-WEBHOOK]", String((e && e.message) || e));
    return res.status(500).json({ ok: false });
  }
}

// La signature se calcule sur le message EXACT reçu : on lit le corps brut nous-mêmes.
export const config = { api: { bodyParser: false } };
