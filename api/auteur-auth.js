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
const SAFE = "id, nom_complet, email, pays, telephone, bio, photo_url, code_source, pixel_meta, pixel_tiktok, facebook, instagram, tiktok, linkedin, youtube, kyc_status, kyc_nom, kyc_prenom, kyc_naissance, kyc_lieu_naissance, kyc_situation, kyc_nationalite, kyc_pays_residence, kyc_sexe, kyc_paiement_phone, kyc_piece_type, kyc_piece_url, kyc_piece_url2, kyc_contrat_url, kyc_motif_refus, abonnement_actif, banni, banni_motif";

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

// Comptes auteurs liés : le principal regroupe les gains de ses noms de plume (ex : Landrine 8 = Julia 9)
const COMPTES_LIES = { 8: [9] };
const idsComptesLies = (id) => [id].concat(COMPTES_LIES[id] || []);

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
    // Délai (en jours) avant qu'une commission soit retirable (défaut 7, modifiable dans les réglages)
    async function lireDelaiRetrait() {
      try {
        const { data } = await supa.from("reglages").select("valeur").eq("cle", "delai_retrait_jours").limit(1);
        if (data && data[0] && data[0].valeur != null) { const n = Number(data[0].valeur); if (n >= 0) return n; }
      } catch (e) {}
      return 7;
    }

    if (action === "get") {
      const id = body.id;
      if (!id) return res.status(400).json({ error: "id requis." });
      const { data } = await supa.from("auteurs").select(SAFE).eq("id", id).limit(1);
      const delai = await lireDelaiRetrait();
      let supportNonLus = 0;
      try { const { count } = await supa.from("support_messages").select("id", { count: "exact", head: true }).eq("auteur_id", id).eq("cote", "admin").eq("lu_auteur", false); supportNonLus = count || 0; } catch (e) {}
      return res.status(200).json({ auteur: (data && data[0]) || null, delai_retrait: delai, support_non_lus: supportNonLus });
    }

    // ---------- MISE A JOUR DU PROFIL (pas le mot de passe) ----------
    if (action === "update") {
      const id = body.id;
      if (!id) return res.status(400).json({ error: "id requis." });
      const patch = {};
      ["nom_complet", "pays", "telephone", "bio", "photo_url", "pixel_meta", "pixel_tiktok", "facebook", "instagram", "tiktok", "linkedin", "youtube", "abonnement_actif"].forEach((k) => {
        if (k in body) patch[k] = (body[k] === "" ? null : body[k]);
      });
      if (Object.keys(patch).length === 0) return res.status(400).json({ error: "Rien a mettre a jour." });
      const { data, error } = await supa.from("auteurs").update(patch).eq("id", id).select(SAFE).maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ auteur: data });
    }

    // ---------- SOUMISSION DE LA VERIFICATION (KYC) ----------
    if (action === "submit_kyc") {
      const id = body.id;
      if (!id) return res.status(400).json({ error: "id requis." });
      const patch = {
        kyc_status: "en_attente",
        kyc_submitted_at: new Date().toISOString(),
        kyc_motif_refus: null,
      };
      ["kyc_nom", "kyc_prenom", "kyc_naissance", "kyc_lieu_naissance", "kyc_situation", "kyc_nationalite", "kyc_pays_residence", "kyc_sexe", "kyc_paiement_phone", "kyc_piece_type", "kyc_piece_url", "kyc_piece_url2", "kyc_contrat_url"].forEach((k) => {
        if (k in body) patch[k] = (body[k] === "" ? null : body[k]);
      });
      const { data, error } = await supa.from("auteurs").update(patch).eq("id", id).select(SAFE).maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ auteur: data });
    }

    // ---------- DEMANDE DE RETRAIT (auteur) ----------
    if (action === "request_retrait") {
      const id = body.id;
      const montant = Math.round(Number(body.montant || 0));
      if (!id) return res.status(400).json({ error: "id requis." });
      if (!montant || montant <= 0) return res.status(400).json({ error: "Montant invalide." });
      // Seules les commissions plus anciennes que le délai sont retirables
      const delaiJ = await lireDelaiRetrait();
      const seuil = new Date(Date.now() - delaiJ * 86400000).toISOString();
      const idsLies = idsComptesLies(id);
      const { data: va } = await supa.from("ventes_auteurs").select("part_auteur").in("auteur_id", idsLies).lte("created_at", seuil);
      const mature = (va || []).reduce((s, v) => s + (v.part_auteur || 0), 0);
      const { data: rr } = await supa.from("retraits").select("montant, statut").in("auteur_id", idsLies).in("statut", ["paye", "en_attente"]);
      const dejaPris = (rr || []).reduce((s, r) => s + (r.montant || 0), 0);
      const dispo = mature - dejaPris;
      if (montant > dispo) return res.status(400).json({ error: "Montant supérieur au disponible (" + dispo + " FCFA)." });
      const { data: au } = await supa.from("auteurs").select("kyc_paiement_phone, telephone").eq("id", id).limit(1);
      const phone = (au && au[0]) ? (au[0].kyc_paiement_phone || au[0].telephone || "") : "";
      const { error } = await supa.from("retraits").insert([{ auteur_id: id, montant, phone, statut: "en_attente" }]);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true, dispo: dispo - montant });
    }

    // ---------- SUPPORT : lire le fil ----------
    if (action === "support_lire") {
      const id = body.id;
      if (!id) return res.status(400).json({ error: "id requis." });
      const { data } = await supa.from("support_messages").select("id, cote, texte, image_url, annonce_id, created_at").eq("auteur_id", id).order("created_at", { ascending: true });
      return res.status(200).json({ ok: true, messages: data || [] });
    }

    // ---------- SUPPORT : envoyer un message a l'equipe ----------
    if (action === "support_envoyer") {
      const id = body.id;
      const texte = (body.texte || "").trim();
      const image_url = (body.image_url || "").trim() || null;
      if (!id) return res.status(400).json({ error: "id requis." });
      if (!texte && !image_url) return res.status(400).json({ error: "Message vide." });
      const { data, error } = await supa.from("support_messages").insert([{ auteur_id: id, cote: "auteur", texte, image_url, lu_admin: false, lu_auteur: true }]).select("id, cote, texte, image_url, created_at").maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true, message: data });
    }

    // ---------- SUPPORT : marquer les messages de l'equipe comme lus ----------
    if (action === "support_marquer_lu") {
      const id = body.id;
      if (!id) return res.status(400).json({ error: "id requis." });
      await supa.from("support_messages").update({ lu_auteur: true }).eq("auteur_id", id).eq("cote", "admin").eq("lu_auteur", false);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Action inconnue." });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
