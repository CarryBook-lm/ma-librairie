// =============================================================
// 🎯 OPEN GRAPH PREVIEW - CarryCare (pages diagnostics)
// Accessible via /partage/:page (namespace dédié au partage,
// comme /livre/:slug pour les livres). Ne touche PAS aux vraies
// pages /carrycare, /diagnostic-facial, etc. qui restent servies
// normalement par l'app React.
//   - BOT (Facebook/WhatsApp) → HTML avec image OG dédiée
//   - HUMAIN → redirection vers la vraie page (en gardant ?ref=)
// =============================================================

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
  if (ua.includes("whatsapp")) {
    return !ua.includes("mozilla");
  }
  if (ua.includes("fban") || ua.includes("fbav")) {
    return false;
  }
  return BOT_AGENTS.some((bot) => ua.includes(bot.toLowerCase()));
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

// 🎨 Les 5 pages CarryCare : vraie page + image dédiée + titre + description
const PAGES = {
  "carrycare": {
    path: "/carrycare",
    image: "https://i.ibb.co/BV6YvMgC/CARRYCARE.jpg",
    title: "CarryCare — Ton diagnostic beaute personnalise",
    description: "Votre beaute. Votre diagnostic. Vos resultats. Decouvre CarryCare et recois un accompagnement 100% personnalise. -50% pour les 100 premieres inscrites !",
  },
  "diagnostic-facial": {
    path: "/diagnostic-facial",
    image: "https://i.ibb.co/F4byLJqj/FACIAL.jpg",
    title: "Beaute Faciale — Diagnostic peau personnalise | CarryCare",
    description: "Analyse de ta peau en profondeur et routine sur-mesure. Resultats clairs en quelques minutes. -50% pour les 100 premieres inscrites !",
  },
  "diagnostic-corporel": {
    path: "/diagnostic-corporel",
    image: "https://i.ibb.co/TMLXQVQv/CORPOREL.jpg",
    title: "Beaute Corporelle — Diagnostic corps personnalise | CarryCare",
    description: "Analyse complete de ta peau et conseils adaptes a tes besoins. Resultats clairs en quelques minutes. -50% pour les 100 premieres inscrites !",
  },
  "diagnostic-capillaire": {
    path: "/diagnostic-capillaire",
    image: "https://i.ibb.co/B5qMv4yc/CAPILLAIRE.jpg",
    title: "Beaute Capillaire — Diagnostic cheveux personnalise | CarryCare",
    description: "Analyse approfondie de tes cheveux et routine personnalisee. Resultats clairs en quelques minutes. -50% pour les 100 premieres inscrites !",
  },
  "garde-la-ligne": {
    path: "/garde-la-ligne",
    image: "https://i.ibb.co/vv4Dy9kx/SANTE-ET-POIDS.jpg",
    title: "Sante et Poids — Plan nutrition personnalise | CarryCare",
    description: "Plan nutrition 100% personnalise pour perdre du poids et garder la ligne. Energie, bien-etre et sante au quotidien. -50% pour les 100 premieres inscrites !",
  },
};

export default async function handler(req, res) {
  const userAgent = req.headers["user-agent"] || "";
  const isBotVisit = isBot(userAgent);

  const page = (req.query.page || "carrycare").toString();
  const cfg = PAGES[page] || PAGES["carrycare"];

  // === HUMAIN ? Redirection vers la VRAIE page (en preservant ?ref=) ===
  if (!isBotVisit) {
    const extraParams = Object.entries(req.query)
      .filter(([key]) => key !== "page")
      .map(([key, val]) => `${encodeURIComponent(key)}=${encodeURIComponent(val)}`)
      .join("&");
    const suffix = extraParams ? `?${extraParams}` : "";
    res.setHeader("Location", `https://carrybooks.com${cfg.path}${suffix}`);
    res.status(302).end();
    return;
  }

  // === BOT ? HTML avec les OG meta tags ===
  const title = escapeHtml(cfg.title);
  const description = escapeHtml(cfg.description);
  const image = escapeHtml(cfg.image);
  const url = escapeHtml("https://carrybooks.com" + cfg.path);

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<meta name="description" content="${description}">

<meta property="og:type" content="website">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:image" content="${image}">
<meta property="og:image:secure_url" content="${image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${title}">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="CarryBooks">
<meta property="og:locale" content="fr_FR">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${image}">
</head>
<body>
<h1>${title}</h1>
<p>${description}</p>
<p><img src="${image}" alt="${title}" style="max-width:600px"></p>
<p><a href="${url}">Decouvrir sur CarryBooks</a></p>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.status(200).send(html);
}
