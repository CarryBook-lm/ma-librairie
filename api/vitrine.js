// api/vitrine.js
// Sert la page /auteur/:code.
//
// DEUX BUTS :
//  1) Les robots (WhatsApp, Facebook, Google...) recoivent un HTML avec l'apercu
//     au nom de l'auteur : son nom de vitrine, son logo, son nombre de livres.
//     Avant, le partage d'un lien vitrine affichait "CarryBooks".
//  2) Les humains recoivent la vraie application, mais avec le manifeste de
//     l'auteur injecte dans l'en-tete. Chrome propose alors d'installer SON
//     application, avec SON nom et SON icone, qui s'ouvre sur SA vitrine.
//
// On ne peut pas rediriger les humains (comme le fait api/preview.js) : une
// redirection ferait perdre le manifeste personnalise.

import { createClient } from "@supabase/supabase-js";

const BOT_AGENTS = [
  "facebookexternalhit", "Facebot", "Twitterbot", "WhatsApp",
  "Slackbot", "TelegramBot", "LinkedInBot", "Pinterest",
  "Discordbot", "Googlebot", "bingbot", "Applebot",
  "redditbot", "DuckDuckBot", "YandexBot", "Baiduspider",
  "vkShare", "W3C_Validator", "Embedly", "Mastodon",
  "Threads", "TikTokBot",
];

const LOGO_CB = "https://i.ibb.co/JWGkYdsx/LOGO-CARRYBOOKS.jpg";
const OR = "#c9a84c";

function isBot(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  // WhatsApp : le robot d'apercu n'a pas "mozilla", le navigateur interne si.
  if (ua.includes("whatsapp")) return !ua.includes("mozilla");
  // Navigateur interne de Facebook = un humain.
  if (ua.includes("fban") || ua.includes("fbav")) return false;
  return BOT_AGENTS.some(b => ua.includes(b.toLowerCase()));
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

function couleurValide(c) {
  return typeof c === "string" && /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(String(c).trim());
}

export default async function handler(req, res) {
  const code = String((req.query && req.query.code) || "").trim();
  const userAgent = req.headers["user-agent"] || "";
  const robot = isBot(userAgent);

  const host = req.headers["x-forwarded-host"] || req.headers.host || "carrybooks.com";
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0];
  const base = proto + "://" + host;

  // --- L'auteur ---
  let a = null;
  let nbLivres = 0;
  try {
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
      || process.env.SUPABASE_ANON_KEY
      || process.env.VITE_SUPABASE_ANON_KEY;
    if (code && url && key) {
      const supabase = createClient(url, key);
      const { data } = await supabase
        .from("auteurs_public")
        .select("id, nom_complet, bio, pays, code_source, photo_url, couleur, vitrine_nom, vitrine_logo, vitrine_logo_192, banni")
        .eq("code_source", code)
        .limit(1);
      if (data && data[0] && !data[0].banni) {
        a = data[0];
        const { count } = await supabase
          .from("books")
          .select("id", { count: "exact", head: true })
          .eq("auteur_id", a.id)
          .eq("status", "actif");
        nbLivres = count || 0;
      }
    }
  } catch (e) {
    console.error("[VITRINE]", e.message);
  }

  const nom = a
    ? ((a.vitrine_nom && String(a.vitrine_nom).trim()) ? String(a.vitrine_nom).trim() : String(a.nom_complet || "").trim())
    : "CarryBooks";
  const couleur = (a && couleurValide(a.couleur)) ? String(a.couleur).trim() : OR;
  const image = (a && (a.vitrine_logo || a.photo_url)) || LOGO_CB;
  const icone192 = (a && (a.vitrine_logo_192 || a.vitrine_logo)) || (base + "/icon-192.png");
  const lien = base + "/auteur/" + encodeURIComponent(code);
  const desc = a
    ? ((a.bio && String(a.bio).replace(/\s+/g, " ").trim().substring(0, 180))
        || (nom + " — " + nbLivres + " livre" + (nbLivres > 1 ? "s" : "") + " a lire et a telecharger. Paiement Mobile Money."))
    : "CarryBooks — ta librairie numerique africaine.";

  // ===================== ROBOTS : l'apercu de partage =====================
  if (robot) {
    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(nom)} | CarryBooks</title>
<meta name="description" content="${escapeHtml(desc)}">
<meta property="og:type" content="profile">
<meta property="og:title" content="${escapeHtml(nom)}">
<meta property="og:description" content="${escapeHtml(desc)}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta property="og:image:secure_url" content="${escapeHtml(image)}">
<meta property="og:image:alt" content="${escapeHtml(nom)}">
<meta property="og:url" content="${escapeHtml(lien)}">
<meta property="og:site_name" content="CarryBooks">
<meta property="og:locale" content="fr_FR">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(nom)}">
<meta name="twitter:description" content="${escapeHtml(desc)}">
<meta name="twitter:image" content="${escapeHtml(image)}">
</head>
<body>
<h1>${escapeHtml(nom)}</h1>
<p>${escapeHtml(desc)}</p>
<p><img src="${escapeHtml(image)}" alt="${escapeHtml(nom)}" style="max-width:300px"></p>
<p><a href="${escapeHtml(lien)}">Voir la vitrine sur CarryBooks</a></p>
</body>
</html>`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.status(200).send(html);
    return;
  }

  // ============ HUMAINS : l'application, avec le manifeste de l'auteur ============
  let page = "";
  try {
    const r = await fetch(base + "/index.html", { headers: { "User-Agent": "carrybooks-vitrine" } });
    page = await r.text();
  } catch (e) {
    console.error("[VITRINE] index.html:", e.message);
  }

  // Si on n'a pas pu lire l'application, on renvoie au moins l'accueil.
  if (!page || page.indexOf("</head>") === -1) {
    res.setHeader("Location", "/?auteur=" + encodeURIComponent(code));
    res.status(302).end();
    return;
  }

  // On retire le manifeste, la couleur de theme, l'icone Apple et le titre
  // d'origine, sinon le navigateur garderait ceux de CarryBooks.
  page = page
    .replace(/<link[^>]+rel=["']manifest["'][^>]*>/gi, "")
    .replace(/<meta[^>]+name=["']theme-color["'][^>]*>/gi, "")
    .replace(/<link[^>]+rel=["']apple-touch-icon["'][^>]*>/gi, "")
    .replace(/<title>[\s\S]*?<\/title>/i, "");

  const injection = `
<title>${escapeHtml(nom)} | CarryBooks</title>
<link rel="manifest" href="/api/manifest-auteur?code=${encodeURIComponent(code)}">
<meta name="theme-color" content="${escapeHtml(couleur)}">
<link rel="apple-touch-icon" href="${escapeHtml(icone192)}">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="${escapeHtml(nom)}">
<meta name="description" content="${escapeHtml(desc)}">
<meta property="og:type" content="profile">
<meta property="og:title" content="${escapeHtml(nom)}">
<meta property="og:description" content="${escapeHtml(desc)}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta property="og:url" content="${escapeHtml(lien)}">
<meta property="og:site_name" content="CarryBooks">
</head>`;

  page = page.replace("</head>", injection);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.status(200).send(page);
}
