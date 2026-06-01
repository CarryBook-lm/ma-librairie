// api/meta-feed.js
// Flux produits (catalogue) au format CSV pour Meta Commerce Manager.
// Catalogues séparés via ?type= :
//   ?type=numerique  -> livres numériques (numerique, mixte, audio)
//   ?type=papier     -> livres physiques (CarryColor)
//   ?type=article    -> produits physiques beauté/bien-être (CarryShop)
//   ?type=carrycare  -> les 4 diagnostics CarryCare
//   (vide)           -> tout
// Meta va chercher l'URL chaque jour pour rester synchronisé avec Supabase.

import { createClient } from "@supabase/supabase-js";

// Image partagée pour les diagnostics CarryCare (déjà hébergée sur le site)
const CARRYCARE_IMG = "https://carrybooks.com/pdf-pub-carrycare.jpeg";

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

function csv(value) {
  const s = (value === null || value === undefined) ? "" : String(value);
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export default async function handler(req, res) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    res.status(500).send("Configuration Supabase manquante.");
    return;
  }

  const type = String((req.query && req.query.type) || "").toLowerCase();

  function buildRow(id, title, description, availability, price, link, image, productType) {
    return [
      csv(id),
      csv(title),
      csv(description),
      csv(availability),
      csv("new"),
      csv(Number(price).toFixed(2) + " XAF"),
      csv(link),
      csv(image),
      csv("CarryBooks"),
      csv(productType),
    ].join(",");
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: books, error } = await supabase
      .from("books")
      .select("id, title, author, category, price, paper_price, cover, product_type, stock, status");

    if (error) {
      res.status(500).send("Erreur Supabase : " + error.message);
      return;
    }

    // Prix CarryCare depuis sub_settings (avec valeurs par défaut)
    let quizPrice = 500;       // Santé et Poids (Ligne)
    let carrycarePrice = 1000; // Facial / Corporel / Capillaire
    try {
      const { data: s } = await supabase.from("sub_settings").select("*").limit(1);
      if (s && s.length > 0) {
        if (s[0].quiz_price !== undefined && s[0].quiz_price !== null) quizPrice = s[0].quiz_price;
        if (s[0].carrycare_price !== undefined && s[0].carrycare_price !== null) carrycarePrice = s[0].carrycare_price;
      }
    } catch (e) { /* on garde les valeurs par défaut */ }

    const header = [
      "id", "title", "description", "availability", "condition",
      "price", "link", "image_link", "brand", "product_type",
    ];
    const rows = [header.join(",")];

    // --- Produits de la table books (livres + physiques) ---
    if (type !== "carrycare") {
      for (const b of books || []) {
        if (b.status === "inactif") continue;

        const pt = String(b.product_type || "").toLowerCase();
        const isPapier = (pt === "papier");
        const isArticle = (pt === "article");
        const isNumerique = (!isPapier && !isArticle);

        if (type === "numerique" && !isNumerique) continue;
        if (type === "papier" && !isPapier) continue;
        if (type === "article" && !isArticle) continue;

        const price = (isPapier || isArticle)
          ? (Number(b.paper_price) || Number(b.price) || 0)
          : (Number(b.price) || Number(b.paper_price) || 0);

        if (!b.title || !b.cover || price <= 0) continue;

        const slug = slugify(b.title);
        const link = "https://carrybooks.com/livre/" + slug;

        let description = b.title;
        if (b.author) description += " par " + b.author;
        if (b.category) description += " - " + b.category;
        description += ". Disponible sur CarryBooks, ta librairie numerique africaine.";

        const availability = (typeof b.stock === "number" && b.stock === 0) ? "out of stock" : "in stock";
        let typeLabel = "Livre numerique";
        if (isPapier) typeLabel = "Livre papier";
        else if (isArticle) typeLabel = "Produit";
        const productType = b.category || typeLabel;

        rows.push(buildRow(b.id, b.title, description, availability, price, link, b.cover, productType));
      }
    }

    // --- Diagnostics CarryCare (inclus si type vide ou type=carrycare) ---
    if (type === "" || type === "carrycare") {
      const ccDiagnostics = [
        { id: "cc-facial", title: "Diagnostic CarryCare - Beaute Faciale", page: "diagnostic-facial", price: carrycarePrice, desc: "Diagnostic beaute personnalise de ta peau du visage, avec une routine adaptee. A but educatif." },
        { id: "cc-corporel", title: "Diagnostic CarryCare - Soin du Corps", page: "diagnostic-corporel", price: carrycarePrice, desc: "Diagnostic personnalise pour la peau de ton corps, avec conseils et routine adaptee. A but educatif." },
        { id: "cc-capillaire", title: "Diagnostic CarryCare - Cheveux", page: "diagnostic-capillaire", price: carrycarePrice, desc: "Diagnostic capillaire personnalise selon ton type de cheveux, avec une routine adaptee. A but educatif." },
        { id: "cc-ligne", title: "Diagnostic CarryCare - Sante et Poids", page: "garde-la-ligne", price: quizPrice, desc: "Bilan personnalise de tes besoins et conseils nutritionnels adaptes a ton profil. A but educatif, ne remplace pas un avis medical." },
        { id: "cc-pack", title: "Pack CarryCare - Tous les diagnostics", page: "carrycare", price: (carrycarePrice * 3 + quizPrice), desc: "Accede a tous les diagnostics CarryCare : visage, corps, cheveux et sante. Des conseils personnalises pour ton bien-etre, a but educatif." },
      ];
      for (const d of ccDiagnostics) {
        if (!d.price || d.price <= 0) continue;
        const link = "https://carrybooks.com/" + d.page;
        const description = d.desc + " Sur CarryBooks, paiement Mobile Money.";
        rows.push(buildRow(d.id, d.title, description, "in stock", d.price, link, CARRYCARE_IMG, "Diagnostic CarryCare"));
      }
    }

    // BOM UTF-8 (\uFEFF) pour forcer la lecture correcte des accents
    const csvText = "\uFEFF" + rows.join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("Content-Disposition", "inline; filename=carrybooks-meta-feed.csv");
    res.status(200).send(Buffer.from(csvText, "utf8"));
  } catch (e) {
    res.status(500).send("Erreur : " + (e.message || e));
  }
}
