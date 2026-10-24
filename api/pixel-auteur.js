// api/pixel-auteur.js
// Donne l'ID du pixel Facebook (Meta) d'un auteur, pour que le site le declenche
// sur SA vitrine et sur SES livres.
//   GET /api/pixel-auteur?id=<auteur_id>        ou        ?code=<code_source>
//   -> { pixel: "1234567890123456" }  ou  { pixel: "" }
// Un ID de pixel n'est pas un secret (il est visible dans le code de n'importe
// quel site) : on ne renvoie que lui, valide, jamais d'autres champs de l'auteur.
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "public, s-maxage=120, stale-while-revalidate=600");
  const id = String((req.query && req.query.id) || "").trim();
  const code = String((req.query && req.query.code) || "").trim();
  const vide = () => res.status(200).json({ pixel: "" });
  try {
    if (!id && !code) return vide();
    if (id && !/^\d{1,12}$/.test(id)) return vide();
    if (code && !/^[A-Za-z0-9_-]{2,40}$/.test(code)) return vide();
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) return vide();
    const supa = createClient(url, key);
    let q = supa.from("auteurs").select("pixel_meta, banni").limit(1);
    q = id ? q.eq("id", id) : q.eq("code_source", code);
    const { data } = await q;
    const a = data && data[0];
    if (!a || a.banni) return vide();
    const p = String(a.pixel_meta || "").replace(/\s+/g, "");
    return res.status(200).json({ pixel: /^\d{10,20}$/.test(p) ? p : "" });
  } catch (e) {
    return vide();
  }
}
