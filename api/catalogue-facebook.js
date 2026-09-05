// api/catalogue-facebook.js
// Flux de catalogue Facebook (Meta) : liste automatiquement tous les livres EN LIGNE
// au format CSV que Facebook comprend. A brancher comme "flux de donnees" dans un catalogue Meta.
// URL publique : https://carrybooks.com/api/catalogue-facebook
import { createClient } from "@supabase/supabase-js";

function slugify(str) {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// Echappement CSV : entoure de guillemets et double les guillemets internes
function csv(v) {
  const s = (v == null ? "" : String(v)).replace(/\r?\n|\r/g, " ").trim();
  return '"' + s.replace(/"/g, '""') + '"';
}

export default async function handler(req, res) {
  try {
    const supa = createClient(
      process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: livres } = await supa
      .from("books")
      .select("id, title, summary, price, cover, author, category, status")
      .eq("status", "actif")
      .order("id", { ascending: false });

    const base = "https://carrybooks.com";
    const entetes = ["id", "title", "description", "availability", "condition", "price", "link", "image_link", "brand", "product_type", "google_product_category", "fb_product_category"];
    const lignes = [entetes.join(",")];

    (livres || []).forEach((b) => {
      if (!b.title || !b.cover) return; // il faut au moins un titre et une image
      const desc = (b.summary && b.summary.trim()) ? b.summary : b.title;
      const img = String(b.cover).startsWith("http") ? b.cover : (base + "/" + String(b.cover).replace(/^\//, ""));
      const lien = base + "/livre/" + slugify(b.title);
      const prix = (Number(b.price) || 0) + " XAF";
      const marque = b.author && b.author.trim() ? b.author : "CarryBooks";
      lignes.push([
        csv(b.id),
        csv(b.title),
        csv(desc),
        csv("in stock"),
        csv("new"),
        csv(prix),
        csv(lien),
        csv(img),
        csv(marque),
        csv(b.category || "Autres"),
        csv("Media > Books"),
        csv("Books"),
      ].join(","));
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600"); // rafraichi chaque heure
    res.setHeader("Content-Disposition", "inline; filename=catalogue-carrybooks.csv");
    return res.status(200).send("\uFEFF" + lignes.join("\n"));
  } catch (e) {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.status(500).send("Erreur: " + (e && e.message ? e.message : String(e)));
  }
}
