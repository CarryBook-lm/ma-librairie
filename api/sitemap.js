// =============================================================
// 📋 SITEMAP.XML - CarryBooks
// Liste tous les livres et articles pour Google Search Console
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

function escapeXml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export default async function handler(req, res) {
  // ⚠️ Côté serveur Vercel, les variables VITE_* sont VIDES
  // On utilise SUPABASE_SERVICE_ROLE_KEY (la même que campay.js qui marche déjà)
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY 
    || process.env.SUPABASE_ANON_KEY 
    || process.env.VITE_SUPABASE_ANON_KEY;

  const urls = [
    { loc: "https://carrybooks.com/", priority: 1.0, changefreq: "daily" },
    { loc: "https://carrybooks.com/?go=carryshop", priority: 0.9, changefreq: "daily" },
    { loc: "https://carrybooks.com/?go=carrycolor", priority: 0.9, changefreq: "daily" },
    { loc: "https://carrybooks.com/?go=carrycare", priority: 0.9, changefreq: "weekly" },
  ];

  try {
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data: books, error } = await supabase
        .from("books")
        .select("title, product_type, updated_at, created_at")
        .eq("status", "actif")
        .limit(5000);

      if (error) {
        console.error("Sitemap Supabase error:", error.message);
      } else if (books && books.length > 0) {
        for (const b of books) {
          const slug = slugify(b.title);
          if (!slug) continue;
          const urlPath = b.product_type === "article" ? "article" : "livre";
          const lastmodDate = b.updated_at || b.created_at;
          urls.push({
            loc: `https://carrybooks.com/${urlPath}/${slug}`,
            priority: b.product_type === "article" ? 0.6 : 0.7,
            changefreq: "weekly",
            lastmod: lastmodDate ? new Date(lastmodDate).toISOString().split("T")[0] : null,
          });
        }
      }
    } else {
      console.error("Sitemap: missing Supabase credentials");
    }
  } catch (e) {
    console.error("Sitemap exception:", e.message);
  }

  const xmlUrls = urls
    .map(u => {
      let xml = "  <url>\n";
      xml += `    <loc>${escapeXml(u.loc)}</loc>\n`;
      if (u.lastmod) xml += `    <lastmod>${u.lastmod}</lastmod>\n`;
      xml += `    <changefreq>${u.changefreq}</changefreq>\n`;
      xml += `    <priority>${u.priority}</priority>\n`;
      xml += "  </url>";
      return xml;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlUrls}
</urlset>`;

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=7200");
  res.status(200).send(xml);
}
