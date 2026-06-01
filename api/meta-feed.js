// api/meta-feed.js
// Génère automatiquement un flux produits (catalogue) au format CSV pour Meta.
// Meta (Commerce Manager) ira chercher cette URL chaque jour pour synchroniser
// le catalogue avec les livres présents dans Supabase.
// URL publique : https://carrybooks.com/api/meta-feed

import { createClient } from "@supabase/supabase-js";

// Même logique de slug que l'app (pour construire les liens /livre/:slug)
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

// Échappement CSV : entoure de guillemets si nécessaire et double les guillemets internes
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

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: books, error } = await supabase
      .from("books")
      .select("id, title, author, category, price, paper_price, cover, product_type, stock");

    if (error) {
      res.status(500).send("Erreur Supabase : " + error.message);
      return;
    }

    // En-tête CSV (champs requis + recommandés par Meta)
    const header = [
      "id",
      "title",
      "description",
      "availability",
      "condition",
      "price",
      "link",
      "image_link",
      "brand",
      "product_type",
    ];

    const rows = [header.join(",")];

    for (const b of books || []) {
      // On exige au minimum un titre, une couverture et un prix exploitable
      const price = Number(b.price) || Number(b.paper_price) || 0;
      if (!b.title || !b.cover || price <= 0) continue;

      const slug = slugify(b.title);
      const link = "https://carrybooks.com/livre/" + slug;

      const descParts = [b.title];
      if (b.author) descParts.push("par " + b.author);
      let description = descParts.join(" ");
      if (b.category) description += " — " + b.category;
      description += ". Disponible sur CarryBooks, ta librairie numérique africaine.";

      const availability = (typeof b.stock === "number" && b.stock === 0) ? "out of stock" : "in stock";
      const productType = b.category || (b.product_type === "numerique" ? "Livre numérique" : "Livre");

      const row = [
        csv(b.id),
        csv(b.title),
        csv(description),
        csv(availability),
        csv("new"),
        csv(price.toFixed(2) + " XAF"),
        csv(link),
        csv(b.cover),
        csv("CarryBooks"),
        csv(productType),
      ];
      rows.push(row.join(","));
    }

    const csvText = rows.join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("Content-Disposition", "inline; filename=carrybooks-meta-feed.csv");
    res.status(200).send(csvText);
  } catch (e) {
    res.status(500).send("Erreur : " + (e.message || e));
  }
}
