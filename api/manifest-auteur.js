// api/manifest-auteur.js
// Un manifeste PWA PAR AUTEUR : son nom de vitrine, son logo, sa couleur.
// Chrome installe une application separee pour chaque auteur grace au champ "id"
// et a "start_url" qui pointe sur sa vitrine.
//   https://carrybooks.com/api/manifest-auteur?code=ABC123
// Sans logo enregistre, on retombe sur les icones CarryBooks : l'application
// porte quand meme le nom de l'auteur et s'ouvre sur sa vitrine.

import { createClient } from "@supabase/supabase-js";

const ICONE_192 = "https://carrybooks.com/icon-192.png";
const ICONE_512 = "https://carrybooks.com/icon-512.png";
const OR = "#c9a84c";

function couleurValide(c) {
  return typeof c === "string" && /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(String(c).trim());
}

export default async function handler(req, res) {
  const code = String((req.query && req.query.code) || "").trim();

  let a = null;
  try {
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
      || process.env.SUPABASE_ANON_KEY
      || process.env.VITE_SUPABASE_ANON_KEY;
    if (code && url && key) {
      const supabase = createClient(url, key);
      const { data } = await supabase
        .from("auteurs_public")
        .select("nom_complet, code_source, couleur, vitrine_nom, vitrine_logo, vitrine_logo_192, banni")
        .eq("code_source", code)
        .limit(1);
      if (data && data[0] && !data[0].banni) a = data[0];
    }
  } catch (e) {
    console.error("[MANIFEST-AUTEUR]", e.message);
  }

  // Auteur introuvable : on renvoie le manifeste CarryBooks normal.
  if (!a) {
    res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.status(200).send(JSON.stringify({
      id: "/",
      name: "CarryBooks",
      short_name: "CarryBooks",
      start_url: "/",
      scope: "/",
      display: "standalone",
      background_color: "#f5f0e8",
      theme_color: OR,
      icons: [
        { src: ICONE_192, sizes: "192x192", type: "image/png", purpose: "any" },
        { src: ICONE_512, sizes: "512x512", type: "image/png", purpose: "any" },
      ],
    }, null, 2));
    return;
  }

  const nom = (a.vitrine_nom && String(a.vitrine_nom).trim())
    ? String(a.vitrine_nom).trim()
    : (String(a.nom_complet || "Librairie").trim());
  const court = nom.length > 12 ? nom.substring(0, 12).trim() : nom;
  const couleur = couleurValide(a.couleur) ? String(a.couleur).trim() : OR;
  const chemin = "/auteur/" + encodeURIComponent(a.code_source);

  // Les logos sont fabriques a l'envoi, en 512x512 et 192x192 exactement :
  // Chrome refuse d'installer si la taille annoncee ne correspond pas a l'image.
  const i512 = a.vitrine_logo || null;
  const i192 = a.vitrine_logo_192 || a.vitrine_logo || null;
  const icons = (i512 && i192)
    ? [
        { src: i192, sizes: "192x192", type: "image/png", purpose: "any" },
        { src: i512, sizes: "512x512", type: "image/png", purpose: "any" },
      ]
    : [
        { src: ICONE_192, sizes: "192x192", type: "image/png", purpose: "any" },
        { src: ICONE_512, sizes: "512x512", type: "image/png", purpose: "any" },
      ];

  const manifeste = {
    id: chemin,
    name: nom,
    short_name: court,
    description: nom + " — livres a lire et a telecharger. Propulse par CarryBooks.",
    start_url: chemin,
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f0e8",
    theme_color: couleur,
    lang: "fr",
    categories: ["books", "education", "shopping"],
    icons: icons,
  };

  res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.status(200).send(JSON.stringify(manifeste, null, 2));
}
