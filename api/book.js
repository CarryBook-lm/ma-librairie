// =============================================================
// 🎯 API : un SEUL livre par slug (affichage instantané)
// Permet d'afficher la fiche produit dès l'arrivée sur /livre/:slug
// sans attendre le chargement complet du catalogue côté navigateur.
// Le matching slug est fait côté serveur (rapide, proche de la DB).
// =============================================================

import { createClient } from "@supabase/supabase-js";

function slugify(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 80);
}

function slugifyAlt(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 80);
}

// Mêmes colonnes légères que fetchBooks() côté app (sans content/images)
const LIGHT_COLUMNS = "id, title, author, price, original_price, cover, category, subcategory, summary, status, product_type, stock, can_read, can_download, featured, exclude_from_subscription, audio_access_mode, audio_url, paper_pages, paper_description, paper_stock, paper_price, allow_oversell, extract_pages, pdf_url, excerpt_pdf_url, created_at";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  // Cache CDN : un même livre cliqué plusieurs fois ne re-scanne pas la DB
  res.setHeader("Cache-Control", "public, max-age=30, s-maxage=300, stale-while-revalidate=600");

  const slug = (req.query.slug || "").toString().trim();
  if (!slug) {
    res.status(400).json({ error: "slug requis" });
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_ANON_KEY
    || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    res.status(500).json({ error: "Configuration Supabase manquante" });
    return;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Cas 1 : slug = identifiant numérique → accès direct (ultra rapide)
    if (/^\d+$/.test(slug)) {
      const { data } = await supabase
        .from("books")
        .select(LIGHT_COLUMNS)
        .eq("id", slug)
        .eq("status", "actif")
        .maybeSingle();
      res.status(200).json({ book: data || null });
      return;
    }

    // Cas 2 : slug texte → on charge juste (id, title) pour trouver le bon livre,
    // puis on récupère les colonnes légères de CE livre uniquement.
    const { data: idx } = await supabase
      .from("books")
      .select("id, title")
      .eq("status", "actif")
      .limit(5000);

    let match = null;
    if (idx && idx.length > 0) {
      match = idx.find((b) => slugify(b.title) === slug || slugifyAlt(b.title) === slug);
    }

    if (!match) {
      res.status(200).json({ book: null });
      return;
    }

    const { data: book } = await supabase
      .from("books")
      .select(LIGHT_COLUMNS)
      .eq("id", match.id)
      .maybeSingle();

    res.status(200).json({ book: book || null });
  } catch (e) {
    console.error("[API/book] Erreur:", e);
    res.status(500).json({ error: e.message });
  }
}
