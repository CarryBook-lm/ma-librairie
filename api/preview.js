// =============================================================
// 🎯 OPEN GRAPH PREVIEW - CarryBooks
// Edge Function Vercel qui sert un beau HTML aux bots
// (Facebook, WhatsApp, Twitter, Telegram, Google...)
// Les humains sont redirigés vers l'app React.
// =============================================================

import { createClient } from "@supabase/supabase-js";

// Liste des User-Agents de bots qui veulent l'aperçu OG
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

export default async function handler(req, res) {
  const userAgent = req.headers["user-agent"] || "";
  const isBotVisit = isBot(userAgent);

  // Récupérer slug + type via query params (transmis par vercel.json rewrites)
  const slug = (req.query.slug || "").toString();
  const type = (req.query.type || "book").toString(); // "book" ou "article"

  if (!slug) {
    res.status(400).send("Missing slug");
    return;
  }

  // === HUMAIN ? Redirection immédiate vers l'app React ===
  // L'app interceptera ?book=slug et ouvrira la fiche détail
  if (!isBotVisit) {
    res.setHeader("Location", `https://carrybooks.com/?book=${encodeURIComponent(slug)}`);
    res.status(302).end();
    return;
  }

  // === BOT ? On lui sert le HTML avec OG meta tags ===
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  let book = null;
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    // On récupère tous les actifs et on matche le slug côté Node (Postgres n'a pas de slugify natif simple)
    const { data: books } = await supabase
      .from("books")
      .select("id, title, author, price, cover, category, summary, product_type")
      .eq("status", "actif")
      .limit(2000);

    if (books && books.length > 0) {
      book = books.find(b => slugify(b.title) === slug);
    }
  } catch (e) {
    console.error("Erreur Supabase preview:", e);
  }

  // Fallback : OG par défaut si livre non trouvé
  if (!book) {
    const fallbackHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>CarryBooks</title>
<meta property="og:type" content="website">
<meta property="og:title" content="CarryBooks">
<meta property="og:description" content="CarryBooks - Ta librairie numérique camerounaise. Lis. Apprends. Évolue.">
<meta property="og:image" content="https://i.ibb.co/JWGkYdsx/LOGO-CARRYBOOKS.jpg">
<meta property="og:url" content="https://carrybooks.com">
<meta property="og:site_name" content="CarryBooks">
<meta name="twitter:card" content="summary_large_image">
</head>
<body>
<h1>CarryBooks</h1>
<p>Découvre tous nos livres et produits sur <a href="https://carrybooks.com">carrybooks.com</a></p>
</body>
</html>`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    res.status(200).send(fallbackHtml);
    return;
  }

  // Construire les meta tags OG
  const title = escapeHtml(book.title || "Livre CarryBooks");
  const author = escapeHtml(book.author || "CarryBooks");
  const rawDesc = book.summary
    ? book.summary.replace(/\s+/g, " ").substring(0, 200).trim()
    : `Découvre "${book.title}" par ${book.author || "CarryBooks"}. ${book.price > 0 ? `Disponible pour ${book.price.toLocaleString("fr-FR")} FCFA.` : "Téléchargement gratuit."}`;
  const description = escapeHtml(rawDesc);
  const cover = book.cover || "https://i.ibb.co/JWGkYdsx/LOGO-CARRYBOOKS.jpg";
  const urlPath = book.product_type === "article" ? "article" : "livre";
  const url = `https://carrybooks.com/${urlPath}/${slug}`;
  const priceLabel = book.price > 0 ? `${book.price.toLocaleString("fr-FR")} FCFA` : "Gratuit";
  const ogType = book.product_type === "article" ? "product" : "book";

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — ${author} | CarryBooks</title>
<meta name="description" content="${description}">

<!-- Open Graph (Facebook, WhatsApp, LinkedIn, Telegram...) -->
<meta property="og:type" content="${ogType}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:image" content="${escapeHtml(cover)}">
<meta property="og:image:width" content="600">
<meta property="og:image:height" content="900">
<meta property="og:image:alt" content="Couverture de ${title}">
<meta property="og:url" content="${escapeHtml(url)}">
<meta property="og:site_name" content="CarryBooks">
<meta property="og:locale" content="fr_FR">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${escapeHtml(cover)}">

<!-- Prix (Product) -->
<meta property="product:price:amount" content="${book.price || 0}">
<meta property="product:price:currency" content="XAF">
<meta property="og:price:amount" content="${book.price || 0}">
<meta property="og:price:currency" content="XAF">

<!-- Auteur (Book) -->
<meta property="book:author" content="${author}">

<!-- Schema.org JSON-LD pour Google -->
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

<!-- Redirection humain au cas où -->
<meta http-equiv="refresh" content="0; url=https://carrybooks.com/?book=${encodeURIComponent(slug)}">
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
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
  res.status(200).send(html);
}
