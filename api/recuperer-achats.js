// api/recuperer-achats.js
// Guichet securise : recupere les livres achetes par un numero (via service_role,
// donc contourne proprement la RLS sans exposer la table a tout le monde).
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { phone } = req.body || {};
    if (!phone) return res.status(400).json({ error: "Numero requis." });
    const local = String(phone).replace(/\D/g, "").slice(-7);
    if (local.length < 6) return res.status(400).json({ error: "Numero invalide." });

    // Cherche dans guest_purchases (achats invites)
    const { data: guest, error: e1 } = await supabaseAdmin
      .from("guest_purchases")
      .select("book_id, created_at, amount")
      .ilike("phone", "%" + local + "%")
      .order("created_at", { ascending: false });
    if (e1) return res.status(500).json({ error: e1.message });

    // Cherche aussi dans purchases (comptes) au cas ou
    let acc = [];
    try {
      const { data: p } = await supabaseAdmin
        .from("purchases")
        .select("book_id, created_at, amount")
        .ilike("phone", "%" + local + "%")
        .order("created_at", { ascending: false });
      acc = p || [];
    } catch (e) {}

    const all = [...(guest || []), ...acc];
    const ids = [...new Set(all.map(d => d.book_id).filter(Boolean))];
    return res.status(200).json({ ok: true, ids, purchases: all });
  } catch (e) {
    return res.status(500).json({ error: (e && e.message) || "Erreur serveur." });
  }
}
