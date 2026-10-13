// api/catalogue-homoromance.js
// Flux de catalogue Facebook (Meta) POUR HOMOROMANCE : meme principe que
// api/catalogue-facebook.js (CarryBooks), mais limite aux livres visibles sur homoromance.com
// (categorie HomoRomance, mode texte, auteure Johanna Morisson) et avec des liens homoromance.com.
// URL publique : https://carrybooks.com/api/catalogue-homoromance
// (le meme code sert les 2 domaines : https://homoromance.com/api/catalogue-homoromance marche aussi)
import { createClient } from "@supabase/supabase-js";

const CAT_HOMOROMANCE = "HomoRomance";
const AUTEUR_UNIQUE_HR = "johanna morisson"; // meme regle que src/App.jsx

function slugify(str) {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function normNom(x) {
  return String(x || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

function csv(v) {
  const s = (v == null ? "" : String(v)).replace(/\r?\n|\r/g, " ").trim();
  return '"' + s.replace(/"/g, '""') + '"';
}

export default async function handler(req, res) {
  try {
    const supa = createClient(
      process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: livres } = await supa
      .from("books")
      .select("id, title, summary, price, cover, author, category, status, exclu_catalogue, masque, exclusif_vitrine, pdf_url, audio_url")
      .eq("status", "actif")
      .eq("category", CAT_HOMOROMANCE)
      .neq("exclu_catalogue", true)
      .order("id", { ascending: false });

    const base = "https://homoromance.com";
    const entetes = ["id", "title", "description", "availability", "condition", "price", "link", "image_link", "brand", "product_type", "google_product_category", "fb_product_category"];
    const lignes = [entetes.join(",")];

    (livres || []).forEach((b) => {
      if (!b.title || !b.cover) return;
      if (b.masque || b.exclusif_vitrine) return;
      // Memes regles que surCarryBooks() sur homoromance.com : texte uniquement, Johanna Morisson uniquement
      if ((b.pdf_url && String(b.pdf_url).trim() !== "") || (b.audio_url && String(b.audio_url).trim() !== "")) return;
      if (normNom(b.author) !== AUTEUR_UNIQUE_HR) return;

      const desc = (b.summary && b.summary.trim()) ? b.summary : b.title;
      const img = String(b.cover).startsWith("http") ? b.cover : (base + "/" + String(b.cover).replace(/^\//, ""));
      const lien = base + "/livre/" + slugify(b.title);
      const prix = (Number(b.price) || 0) + " XAF";
      lignes.push([
        csv(b.id),
        csv(b.title),
        csv(desc),
        csv("in stock"),
        csv("new"),
        csv(prix),
        csv(lien),
        csv(img),
        csv("Johanna Morisson"),
        csv("Romans HomoRomance"),
        csv("Media > Books"),
        csv("Books"),
      ].join(","));
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("Content-Disposition", "inline; filename=catalogue-homoromance.csv");
    return res.status(200).send("﻿" + lignes.join("\n"));
  } catch (e) {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.status(500).send("Erreur: " + (e && e.message ? e.message : String(e)));
  }
}
