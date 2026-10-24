// api/stats-vitrine.js
// Nombre de lecteurs d'une vitrine = nombre d'achats de livres de l'auteur
// (achats avec compte + achats sans compte).
//   GET /api/stats-vitrine?code=<code_source>  ->  { lecteurs: 123 }
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  const code = String((req.query && req.query.code) || "").trim();
  try {
    if (!/^[A-Za-z0-9_-]{2,40}$/.test(code)) return res.status(200).json({ lecteurs: null });
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) return res.status(200).json({ lecteurs: null });
    const supa = createClient(url, key);
    const { data: a } = await supa.from("auteurs").select("id, banni").eq("code_source", code).limit(1);
    if (!a || !a[0] || a[0].banni) return res.status(200).json({ lecteurs: null });
    const { data: livres } = await supa.from("books").select("id").eq("auteur_id", a[0].id).limit(5000);
    const ids = (livres || []).map(b => b.id);
    let total = 0;
    for (let i = 0; i < ids.length; i += 150) {
      const lot = ids.slice(i, i + 150);
      const [p, g] = await Promise.all([
        supa.from("purchases").select("id", { count: "exact", head: true }).in("book_id", lot),
        supa.from("guest_purchases").select("id", { count: "exact", head: true }).in("book_id", lot),
      ]);
      total += (p.count || 0) + (g.count || 0);
    }
    return res.status(200).json({ lecteurs: total });
  } catch (e) {
    return res.status(200).json({ lecteurs: null });
  }
}
