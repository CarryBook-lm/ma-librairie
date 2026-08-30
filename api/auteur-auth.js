// api/auteur-auth.js
// Authentification des AUTEURS par email + mot de passe (independante du
// systeme lecteur par telephone). Le mot de passe est HACHE avec scrypt
// (module crypto integre a Node, pas de dependance). Jamais stocke ni
// renvoye en clair. Toutes les operations passent par la cle service_role.
//
// Variables d'environnement (deja presentes) : SUPABASE_SERVICE_ROLE_KEY,
// VITE_SUPABASE_URL (ou SUPABASE_URL).
//
// Actions (POST { action, ... }) :
//   signup  -> cree le compte auteur, renvoie le profil (sans le hash)
//   login   -> verifie email+mot de passe, renvoie le profil
//   get     -> recharge un profil par id
//   update  -> met a jour les champs de profil (pas le mot de passe)

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// Champs "surs" renvoyes au client (JAMAIS password_hash)
const SAFE = "id, nom_complet, email, pays, telephone, bio, photo_url, code_source, pixel_meta, pixel_tiktok";

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return salt + ":" + hash;
}

function verifyPassword(password, stored) {
  try {
    const parts = String(stored).split(":");
    if (parts.length !== 2) return false;
    const [salt, hash] = parts;
    const test = crypto.scryptSync(String(password), salt, 64).toString("hex");
    const a = Buffer.from(hash, "hex");
    const b = Buffer.from(test, "hex");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch (e) {
    return false;
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST uniquement" });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};
  const action = body.action;

  const supa = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    // ---------- CREATION DE COMPTE ----------
    if (action === "signup") {
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const nom = String(body.nom_complet || "").trim();
      if (!email || !email.includes("@")) return res.status(400).json({ error: "Adresse email invalide." });
      if (password.length < 6) return res.status(400).json({ error: "Mot de passe trop court (6 caracteres minimum)." });
      if (!nom) return res.status(400).json({ error: "Nom d'auteur requis." });

      // Email deja utilise ?
      const { data: exist } = await supa.from("auteurs").select("id").ilike("email", email).limit(1);
      if (exist && exist.length) return res.status(409).json({ error: "Un compte auteur existe deja avec cet email." });

      // code_source unique (sert de lien-boutique + parrainage)
      const base = (nom.split(/\s+/)[0] || "auteur").toLowerCase().replace(/[^a-z0-9]/g, "");
      const code = (base || "auteur") + Math.random().toString(36).slice(2, 7);

      const row = {
        nom_complet: nom,
        email: email,
        password_hash: hashPassword(password),
        pays: String(body.pays || "").trim() || null,
        telephone: String(body.telephone || "").trim() || null,
        bio: String(body.bio || "").trim() || null,
        photo_url: body.photo_url || null,
        code_source: code,
      };
      const { data, error } = await supa.from("auteurs").insert(row).select(SAFE).maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ auteur: data });
    }

    // ---------- CONNEXION ----------
    if (action === "login") {
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      if (!email || !password) return res.status(400).json({ error: "Email et mot de passe requis." });

      const { data } = await supa.from("auteurs").select(SAFE + ", password_hash").ilike("email", email).limit(1);
      const a = data && data[0];
      if (!a || !a.password_hash || !verifyPassword(password, a.password_hash)) {
        return res.status(401).json({ error: "Email ou mot de passe incorrect." });
      }
      delete a.password_hash;
      return res.status(200).json({ auteur: a });
    }

    // ---------- RECHARGER UN PROFIL ----------
    if (action === "get") {
      const id = body.id;
      if (!id) return res.status(400).json({ error: "id requis." });
      const { data } = await supa.from("auteurs").select(SAFE).eq("id", id).limit(1);
      return res.status(200).json({ auteur: (data && data[0]) || null });
    }

    // ---------- MISE A JOUR DU PROFIL (pas le mot de passe) ----------
    if (action === "update") {
      const id = body.id;
      if (!id) return res.status(400).json({ error: "id requis." });
      const patch = {};
      ["nom_complet", "pays", "telephone", "bio", "photo_url", "pixel_meta", "pixel_tiktok"].forEach((k) => {
        if (k in body) patch[k] = (body[k] === "" ? null : body[k]);
      });
      if (Object.keys(patch).length === 0) return res.status(400).json({ error: "Rien a mettre a jour." });
      const { data, error } = await supa.from("auteurs").update(patch).eq("id", id).select(SAFE).maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ auteur: data });
    }

    return res.status(400).json({ error: "Action inconnue." });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
