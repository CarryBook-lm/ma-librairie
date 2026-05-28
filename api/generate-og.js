// =============================================================
// 🏭 GENERATE-OG - CarryBooks
// Pré-génère les images composite (5:4) et les stocke dans Supabase Storage
// Usage :
//   /api/generate-og?slug=le-guide-...       → un seul livre
//   /api/generate-og?all=1                    → tous les livres actifs
//   /api/generate-og?all=1&force=1            → régénère même ceux déjà faits
// =============================================================

import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "edge" };

function slugify(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 80);
}

const BUCKET = "og-images";

export default async function handler(req) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug") || "";
  const all = url.searchParams.get("all") === "1";
  const force = url.searchParams.get("force") === "1";

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: "Supabase non configuré" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Récupérer les livres à traiter
  let query = supabase
    .from("books")
    .select("id, title, og_image, status, product_type")
    .eq("status", "actif");

  const { data: books, error } = await query.limit(5000);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Filtrer selon le mode
  let toProcess = [];
  if (slug) {
    toProcess = books.filter((b) => slugify(b.title) === slug);
  } else if (all) {
    let candidates = force ? books : books.filter((b) => !b.og_image);
    // Par défaut : livres numériques seulement (exclure articles physiques).
    // Ajouter &articles=1 pour inclure aussi les articles physiques.
    const includeArticles = url.searchParams.get("articles") === "1";
    if (!includeArticles) {
      candidates = candidates.filter(
        (b) => b.product_type !== "article" && b.product_type !== "papier"
      );
    }
    toProcess = candidates;
  } else {
    return new Response(
      JSON.stringify({ error: "Préciser ?slug=... ou ?all=1" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const results = [];
  // Limiter à 8 livres par appel pour éviter le timeout (relancer si besoin)
  const batch = toProcess.slice(0, 8);

  for (const book of batch) {
    try {
      const bookSlug = slugify(book.title);
      // 1. Générer l'image via /api/og (réutilise le générateur existant)
      const ogUrl = `${url.origin}/api/og?slug=${encodeURIComponent(bookSlug)}`;
      const imgResp = await fetch(ogUrl);
      if (!imgResp.ok) {
        results.push({ title: book.title, status: "erreur_génération", code: imgResp.status });
        continue;
      }
      const buffer = await imgResp.arrayBuffer();

      // 2. Upload dans Supabase Storage
      const fileName = `${book.id}.png`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(fileName, buffer, {
          contentType: "image/png",
          upsert: true,
          cacheControl: "31536000",
        });
      if (upErr) {
        results.push({ title: book.title, status: "erreur_upload", detail: upErr.message });
        continue;
      }

      // 3. Récupérer l'URL publique
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
      const publicUrl = pub.publicUrl;

      // 4. Mettre à jour books.og_image
      const { error: updErr } = await supabase
        .from("books")
        .update({ og_image: publicUrl })
        .eq("id", book.id);
      if (updErr) {
        results.push({ title: book.title, status: "erreur_update", detail: updErr.message });
        continue;
      }

      results.push({ title: book.title, status: "✅ ok", url: publicUrl });
    } catch (e) {
      results.push({ title: book.title, status: "exception", detail: String(e) });
    }
  }

  const remaining = toProcess.length - batch.length;

  return new Response(
    JSON.stringify(
      {
        traités: batch.length,
        restants: remaining,
        message:
          remaining > 0
            ? `Il reste ${remaining} livres. Relance /api/generate-og?all=1 pour continuer.`
            : "Tous les livres demandés sont traités ✅",
        détails: results,
      },
      null,
      2
    ),
    {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    }
  );
}
