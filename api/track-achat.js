// api/track-achat.js
// API Conversions (serveur) declenchee a la confirmation d'un achat.
// SECURISE SANS SECRET EXPOSE : on verifie que l'achat existe VRAIMENT en base
// (guest_purchases ou purchases) avant d'envoyer l'evenement a Meta.
// event_id = "pur_" + reference -> DOIT etre identique au pixel navigateur
// pour que Meta deduplique (compte 1 seule vente).
//
// 15/09 : correspondance enrichie (note Meta 4,8/10) :
//  - fbp / fbc lus aussi dans les COOKIES de la requete (meme domaine) si la
//    page ne les a pas transmis -> Meta signalait un fbc vide cote serveur
//  - external_id (telephone hache), pays (code ISO 2 lettres), prenom du lecteur
//  - chaque enrichissement est dans son propre try/catch : il ne doit JAMAIS
//    empecher l'envoi de l'achat
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const API = "https://graph.facebook.com/v21.0";
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Code pays enregistre en base (ISO 3 lettres) -> format Meta (ISO 2, minuscules)
const ISO3_ISO2 = {
  CMR: "cm", CIV: "ci", SEN: "sn", BEN: "bj", GAB: "ga", COG: "cg", COD: "cd",
  TCD: "td", CAF: "cf", TGO: "tg", BFA: "bf", MLI: "ml", NER: "ne",
  RWA: "rw", KEN: "ke", MOZ: "mz", UGA: "ug", SLE: "sl", ZMB: "zm",
};

function hacher(v) {
  v = String(v || "").trim();
  if (!v) return null;
  return crypto.createHash("sha256").update(v).digest("hex");
}
function normTel(tel) {
  let d = String(tel || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length <= 9) d = "237" + d; // defaut Cameroun
  return d;
}
function normTexte(t) {
  return String(t || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
function lireCookie(req, nom) {
  const brut = String(req.headers.cookie || "");
  const morceau = brut.split(";").map((s) => s.trim()).find((s) => s.startsWith(nom + "="));
  if (!morceau) return "";
  try { return decodeURIComponent(morceau.slice(nom.length + 1)); } catch { return ""; }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST attendu" });
  try {
    const { reference, book_id, phone, fbp, fbc } = req.body || {};
    if (!reference) return res.status(400).json({ error: "reference requise" });

    // Anti-faux evenements : l'achat doit exister en base
    let found = null;
    let table = "";
    const { data: g } = await supabaseAdmin.from("guest_purchases").select("book_id, amount").eq("reference", reference).limit(1);
    if (g && g.length) { found = g[0]; table = "guest_purchases"; }
    if (!found) {
      const { data: p } = await supabaseAdmin.from("purchases").select("book_id, amount").eq("reference", reference).limit(1);
      if (p && p.length) { found = p[0]; table = "purchases"; }
    }
    if (!found) return res.status(404).json({ error: "achat introuvable" });

    const PIXEL = process.env.META_PIXEL_ID;
    const TOKEN = process.env.META_ACCESS_TOKEN;
    if (!PIXEL || !TOKEN) return res.status(500).json({ error: "config Meta manquante" });

    const amount = Number(found.amount) || 0;
    const bid = String(book_id || found.book_id || "");

    const u = {};
    const tel = normTel(phone);
    if (tel) {
      u.ph = [hacher(tel)];
      u.external_id = [hacher(tel)];
    }

    // fbp / fbc : d'abord ce que la page envoie, sinon les cookies du navigateur
    const vFbp = fbp || lireCookie(req, "_fbp");
    const vFbc = fbc || lireCookie(req, "_fbc");
    if (vFbp) u.fbp = vFbp;
    if (vFbc) u.fbc = vFbc;

    const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim();
    if (ip) u.client_ip_address = ip;
    if (req.headers["user-agent"]) u.client_user_agent = req.headers["user-agent"];

    // Pays de la vente (colonne pays, code ISO 3) -> facultatif
    try {
      const { data: pz } = await supabaseAdmin.from(table).select("pays").eq("reference", reference).limit(1);
      const iso2 = pz && pz.length ? ISO3_ISO2[String(pz[0].pays || "").toUpperCase()] : "";
      if (iso2) u.country = [hacher(iso2)];
    } catch (e) { /* sans gravite */ }

    // Prenom du lecteur (table lecteurs, retrouve par les 9 derniers chiffres) -> facultatif
    try {
      const local9 = tel.slice(-9);
      if (local9.length === 9) {
        const { data: lz } = await supabaseAdmin.from("lecteurs").select("prenom").ilike("telephone", "%" + local9).limit(1);
        const prenom = lz && lz.length ? normTexte(lz[0].prenom) : "";
        if (prenom) u.fn = [hacher(prenom)];
      }
    } catch (e) { /* sans gravite */ }

    const evt = {
      event_name: "Purchase",
      event_time: Math.floor(Date.now() / 1000),
      event_id: "pur_" + reference,
      action_source: "website",
      user_data: u,
      custom_data: {
        value: amount,
        currency: "XAF",
        content_type: "product",
        content_ids: [bid],
        contents: [{ id: bid, quantity: 1, item_price: amount }],
        num_items: 1,
      },
    };
    const source = req.headers["referer"];
    if (source) evt.event_source_url = source;

    const r = await fetch(`${API}/${PIXEL}/events?access_token=${TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: [evt] }),
    });
    const j = await r.json();
    if (!r.ok) return res.status(502).json({ error: "Meta a refuse", detail: j });
    return res.status(200).json({ ok: true });
  } catch (e) {
    // Une vente vaut plus qu'une mesure : jamais bloquant cote appelant.
    return res.status(500).json({ error: String(e && e.message) });
  }
}
