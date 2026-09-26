// api/formation-acces.js
// Les liens d'acces d'une formation sont le PRODUIT PAYANT. Ils ne sont jamais
// dans une table lisible publiquement : ils vivent dans formation_acces, fermee
// a anon et authenticated. Ce service est le seul chemin.
//
//   action "enregistrer" : l'auteur enregistre les liens de SA formation.
//   action "lire"        : l'acheteur recupere les liens, apres verification du paiement.
//
// Variables d'environnement : Supabase (deja presentes).

import { createClient } from "@supabase/supabase-js";

function admin() {
  return createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Compare deux numeros sur leurs 9 derniers chiffres : les indicatifs et les
// espaces varient d'un enregistrement a l'autre.
function memeNumero(a, b) {
  const n = (x) => String(x || "").replace(/\D/g, "").slice(-9);
  const na = n(a), nb = n(b);
  return na.length >= 8 && na === nb;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Methode non autorisee." });

  let body = req.body || {};
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }

  const action = String(body.action || "").trim();
  const bookId = body.book_id;
  if (!bookId) return res.status(400).json({ error: "book_id requis." });

  try {
    const supa = admin();

    // ===================== L'AUTEUR ENREGISTRE SES LIENS =====================
    if (action === "enregistrer") {
      const auteurId = body.auteur_id;
      const liens = Array.isArray(body.liens) ? body.liens : [];
      if (!auteurId) return res.status(400).json({ error: "auteur_id requis." });

      const { data: bs } = await supa.from("books").select("id, auteur_id").eq("id", bookId).limit(1);
      const livre = bs && bs[0];
      if (!livre) return res.status(404).json({ error: "Cette formation est introuvable." });
      if (String(livre.auteur_id) !== String(auteurId)) {
        return res.status(403).json({ error: "Cette formation ne t'appartient pas." });
      }

      // On ne garde que ce qui a un titre ET une adresse, au maximum 20 liens.
      const propres = liens
        .filter(l => l && String(l.titre || "").trim() && String(l.url || "").trim())
        .slice(0, 20)
        .map(l => {
          let u = String(l.url).trim();
          if (!/^https?:\/\//i.test(u)) u = "https://" + u;
          return { titre: String(l.titre).trim().slice(0, 120), url: u.slice(0, 500) };
        });

      const { error } = await supa.from("formation_acces")
        .upsert([{ book_id: bookId, liens: propres, updated_at: new Date().toISOString() }], { onConflict: "book_id" });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true, nb: propres.length });
    }

    // ============ L'AUTEUR RELIT SES PROPRES LIENS (pour modifier) ============
    if (action === "lire_auteur") {
      const auteurId = body.auteur_id;
      if (!auteurId) return res.status(400).json({ error: "auteur_id requis." });
      const { data: bs } = await supa.from("books").select("id, auteur_id").eq("id", bookId).limit(1);
      const livre = bs && bs[0];
      if (!livre || String(livre.auteur_id) !== String(auteurId)) {
        return res.status(403).json({ error: "Cette formation ne t'appartient pas." });
      }
      const { data } = await supa.from("formation_acces").select("liens").eq("book_id", bookId).limit(1);
      return res.status(200).json({ ok: true, liens: (data && data[0] && data[0].liens) || [] });
    }

    // ================== L'ACHETEUR RECUPERE SES LIENS ==================
    if (action === "lire") {
      const userId = body.user_id && body.user_id !== "guest" ? body.user_id : null;
      const phone = String(body.phone || "").trim();

      // Une formation gratuite est ouverte a tous.
      const { data: bs } = await supa.from("books").select("id, price, product_type").eq("id", bookId).limit(1);
      const livre = bs && bs[0];
      if (!livre) return res.status(404).json({ error: "Cette formation est introuvable." });

      let paye = Number(livre.price || 0) <= 0;

      if (!paye && userId) {
        const { data } = await supa.from("purchases").select("id").eq("book_id", bookId).eq("user_id", userId).limit(1);
        if (data && data.length > 0) paye = true;
      }
      if (!paye && phone) {
        // guest_purchases : on compare sur les 9 derniers chiffres.
        const { data } = await supa.from("guest_purchases").select("id, phone").eq("book_id", bookId).limit(200);
        if (data && data.some(a => memeNumero(a.phone, phone))) paye = true;
        if (!paye) {
          const { data: d2 } = await supa.from("purchases").select("id, phone").eq("book_id", bookId).limit(200);
          if (d2 && d2.some(a => memeNumero(a.phone, phone))) paye = true;
        }
      }

      if (!paye) return res.status(200).json({ ok: true, paye: false, liens: [] });

      const { data } = await supa.from("formation_acces").select("liens").eq("book_id", bookId).limit(1);
      return res.status(200).json({ ok: true, paye: true, liens: (data && data[0] && data[0].liens) || [] });
    }

    return res.status(400).json({ error: "Action inconnue." });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
