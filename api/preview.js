// =============================================================
// 🎯 OPEN GRAPH PREVIEW - CarryBooks
// Edge Function Vercel qui sert un beau HTML aux bots
// =============================================================

import { createClient } from "@supabase/supabase-js";

const BOT_AGENTS = [
  "facebookexternalhit", "Facebot", "Twitterbot", "WhatsApp",
  "Slackbot", "TelegramBot", "LinkedInBot", "Pinterest",
  "Discordbot", "Googlebot", "bingbot", "Applebot",
  "redditbot", "DuckDuckBot", "YandexBot", "Baiduspider",
  "vkShare", "W3C_Validator", "Embedly", "Mastodon",
  "Threads", "TikTokBot",
];

function isBot(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();

  // 🎯 CAS SPÉCIAL WhatsApp : 
  //   - Bot WhatsApp (pour les OG previews) → UA = "WhatsApp/2.21.x" (sans Mozilla)
  //   - Navigateur in-app WhatsApp (humain) → UA contient "Mozilla" + "WhatsApp"
  // On ne traite WhatsApp comme bot QUE si Mozilla est absent
  if (ua.includes("whatsapp")) {
    return !ua.includes("mozilla");
  }

  // 🎯 CAS SPÉCIAL Facebook : pareil
  //   - Bot Facebook → "facebookexternalhit"
  //   - Navigateur in-app Facebook → contient "FBAN" ou "FBAV"
  if (ua.includes("fban") || ua.includes("fbav")) {
    return false; // navigateur in-app Facebook = humain
  }

  return BOT_AGENTS.some(bot => ua.includes(bot.toLowerCase()));
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function slugify(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 80);
}

// Variante : supprime apostrophes/quotes avant de slugifier
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

export default async function handler(req, res) {
  const userAgent = req.headers["user-agent"] || "";
  const isBotVisit = isBot(userAgent);

  const slug = (req.query.slug || "").toString();
  const type = (req.query.type || "book").toString();

  // 🐛 DEBUG endpoint : /api/preview?debug=1
  if (req.query.debug === "1") {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    let testResult = "Non teste (pas de credentials)";
    try {
      if (supabaseUrl && (serviceKey || anonKey)) {
        const sb = createClient(supabaseUrl, serviceKey || anonKey);
        const { data, error, count } = await sb
          .from("books")
          .select("title", { count: "exact" })
          .eq("status", "actif")
          .limit(3);
        if (error) testResult = "ERREUR Supabase : " + error.message;
        else testResult = `OK ${count} livres actifs. Exemples : ${(data || []).map(b => b.title).join(" | ")}`;
      }
    } catch (e) {
      testResult = "EXCEPTION : " + e.message;
    }
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.status(200).send(
`=== DIAGNOSTIC PREVIEW ===
SUPABASE_URL: ${supabaseUrl ? "PRESENT" : "MANQUANT"}
SUPABASE_SERVICE_ROLE_KEY: ${serviceKey ? "PRESENT" : "MANQUANT"}
SUPABASE_ANON_KEY: ${anonKey ? "PRESENT" : "MANQUANT"}
Connexion DB: ${testResult}
User-Agent: ${userAgent}
Detecte comme bot: ${isBotVisit}
`
    );
    return;
  }

  if (!slug) {
    res.status(400).send("Missing slug");
    return;
  }

  // === HUMAIN ? Redirection vers l'app React ===
  if (!isBotVisit) {
    // 🎯 PRÉSERVER les query params (notamment ?ref= pour parrainage)
    const extraParams = Object.entries(req.query)
      .filter(([key]) => key !== "type" && key !== "slug")
      .map(([key, val]) => `&${encodeURIComponent(key)}=${encodeURIComponent(val)}`)
      .join("");
    res.setHeader("Location", `https://carrybooks.com/?book=${encodeURIComponent(slug)}${extraParams}`);
    res.status(302).end();
    return;
  }

  // === BOT ? On lui sert le HTML avec OG meta tags ===
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY 
    || process.env.SUPABASE_ANON_KEY 
    || process.env.VITE_SUPABASE_ANON_KEY;

  let book = null;
  try {
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data: books } = await supabase
        .from("books")
        .select("id, title, author, price, cover, category, summary, product_type")
        .eq("status", "actif")
        .limit(5000);

      if (books && books.length > 0) {
        book = books.find(b => slugify(b.title) === slug || slugifyAlt(b.title) === slug);
      }
    }
  } catch (e) {
    console.error("Erreur Supabase preview:", e);
  }

  // 🎯 IMAGE OG = couverture du livre directement (image statique, ultra-rapide, fiable)
  // (au lieu de /api/og qui génère à la volée et timeout sur Facebook/WhatsApp)
  const ogImageUrl = (book && book.cover) ? book.cover : "https://i.ibb.co/JWGkYdsx/LOGO-CARRYBOOKS.jpg";

  // Fallback si livre non trouve
  if (!book) {
    const fallbackHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>CarryBooks</title>
<meta property="og:type" content="website">
<meta property="og:title" content="CarryBooks">
<meta property="og:description" content="CarryBooks - Ta librairie numerique camerounaise.">
<meta property="og:image" content="https://i.ibb.co/JWGkYdsx/LOGO-CARRYBOOKS.jpg">
<meta property="og:url" content="https://carrybooks.com">
<meta property="og:site_name" content="CarryBooks">
<meta name="twitter:card" content="summary_large_image">
</head>
<body><h1>CarryBooks</h1></body>
</html>`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.status(200).send(fallbackHtml);
    return;
  }

  // Meta tags OG personnalises
  const title = escapeHtml(book.title || "Livre CarryBooks");
  const author = escapeHtml(book.author || "CarryBooks");
  const rawDesc = book.summary
    ? book.summary.replace(/\s+/g, " ").substring(0, 200).trim()
    : `Decouvre "${book.title}" par ${book.author || "CarryBooks"}. ${book.price > 0 ? `Disponible pour ${book.price.toLocaleString("fr-FR")} FCFA.` : "Telechargement gratuit."}`;
  const description = escapeHtml(rawDesc);
  const cover = book.cover || "https://i.ibb.co/JWGkYdsx/LOGO-CARRYBOOKS.jpg";
  const urlPath = book.product_type === "article" ? "article" : "livre";
  const url = `https://carrybooks.com/${urlPath}/${slug}`;
  const priceLabel = book.price > 0 ? `${book.price.toLocaleString("fr-FR")} FCFA` : "Gratuit";
  const ogType = book.product_type === "article" ? "product" : "book";

  // ⚠️ PAS DE meta http-equiv="refresh" car Facebook le suit et lit la page d'accueil !
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — ${author} | CarryBooks</title>
<meta name="description" content="${description}">

<meta property="og:type" content="${ogType}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:image" content="${escapeHtml(ogImageUrl)}">
<meta property="og:image:secure_url" content="${escapeHtml(ogImageUrl)}">
<meta property="og:image:alt" content="${title} — CarryBooks">
<meta property="og:url" content="${escapeHtml(url)}">
<meta property="og:site_name" content="CarryBooks">
<meta property="og:locale" content="fr_FR">

<!-- Format LARGE pour grandes vignettes mobile -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${escapeHtml(ogImageUrl)}">

<meta property="product:price:amount" content="${book.price || 0}">
<meta property="product:price:currency" content="XAF">
<meta property="og:price:amount" content="${book.price || 0}">
<meta property="og:price:currency" content="XAF">
<meta property="book:author" content="${author}">

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "${ogType === "product" ? "Product" : "Book"}",
  "name": "${title.replace(/"/g, "\\\"")}",
  "author": { "@type": "Person", "name": "${author.replace(/"/g, "\\\"")}" },
  "image": "${cover}",
  "description": "${description.replace(/"/g, "\\\"")}",
  "offers": {
    "@type": "Offer",
    "price": "${book.price || 0}",
    "priceCurrency": "XAF",
    "availability": "https://schema.org/InStock",
    "url": "${url}"
  }
}
</script>
</head>
<body>
<h1>${title}</h1>
<p>par ${author}</p>
<p>${description}</p>
<p><strong>${priceLabel}</strong></p>
<p><img src="${escapeHtml(cover)}" alt="${title}" style="max-width:300px"></p>
<p><a href="https://carrybooks.com/?book=${encodeURIComponent(slug)}">Voir sur CarryBooks</a></p>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.status(200).send(html);
}
