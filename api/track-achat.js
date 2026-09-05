// api/track-achat.js
// API Conversions (serveur) declenchee a la confirmation d'un achat.
// SECURISE SANS SECRET EXPOSE : on verifie que l'achat existe VRAIMENT en base
// (guest_purchases ou purchases) avant d'envoyer l'evenement a Meta.
// event_id = "pur_" + reference -> DOIT etre identique au pixel navigateur
// pour que Meta deduplique (compte 1 seule vente).
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const API = "https://graph.facebook.com/v21.0";
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

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

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST attendu" });
  try {
    const { reference, book_id, phone, fbp, fbc } = req.body || {};
    if (!reference) return res.status(400).json({ error: "reference requise" });

    // Anti-faux evenements : l'achat doit exister en base
    let found = null;
    const { data: g } = await supabaseAdmin.from("guest_purchases").select("book_id, amount").eq("reference", reference).limit(1);
    if (g && g.length) found = g[0];
    if (!found) {
      const { data: p } = await supabaseAdmin.from("purchases").select("book_id, amount").eq("reference", reference).limit(1);
      if (p && p.length) found = p[0];
    }
    if (!found) return res.status(404).json({ error: "achat introuvable" });

    const PIXEL = process.env.META_PIXEL_ID;
    const TOKEN = process.env.META_ACCESS_TOKEN;
    if (!PIXEL || !TOKEN) return res.status(500).json({ error: "config Meta manquante" });

    const amount = Number(found.amount) || 0;
    const bid = String(book_id || found.book_id || "");

    const u = {};
    const tel = normTel(phone);
    if (tel) u.ph = [hacher(tel)];
    if (fbp) u.fbp = fbp;
    if (fbc) u.fbc = fbc;
    const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim();
    if (ip) u.client_ip_address = ip;
    if (req.headers["user-agent"]) u.client_user_agent = req.headers["user-agent"];

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
        contents: [{ id: bid, quantity: 1, item_price: amount }],
        num_items: 1,
      },
    };

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
