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
const SAFE = "id, nom_complet, email, pays, telephone, bio, photo_url, code_source, pixel_meta, pixel_tiktok, facebook, instagram, tiktok, linkedin, youtube, kyc_status, kyc_nom, kyc_prenom, kyc_naissance, kyc_lieu_naissance, kyc_situation, kyc_nationalite, kyc_pays_residence, kyc_sexe, kyc_paiement_phone, kyc_piece_type, kyc_piece_url, kyc_piece_url2, kyc_contrat_url, kyc_motif_refus, abonnement_actif, couleur, vitrine_nom, vitrine_logo, vitrine_entete, banni, banni_motif";

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
      // Message d'accueil automatique : les annonces marquees "permanentes" arrivent dans son Support
      try {
        const { data: anns } = await supa.from("support_annonces").select("id, texte").eq("permanente", true).order("created_at", { ascending: true });
        if (anns && anns.length && data) {
          const rows = anns.map(a => ({ auteur_id: data.id, cote: "admin", texte: a.texte, annonce_id: a.id, lu_admin: true, lu_auteur: false }));
          await supa.from("support_messages").insert(rows);
        }
      } catch (e) {}
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
      ["nom_complet", "pays", "telephone", "bio", "photo_url", "pixel_meta", "pixel_tiktok", "facebook", "instagram", "tiktok", "linkedin", "youtube", "couleur", "vitrine_nom", "vitrine_logo", "vitrine_entete", "abonnement_actif"].forEach((k) => {
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

    // ---------- ANNONCES PUBLICITAIRES DE L'AUTEUR (accueil du site) ----------
    // 21/09 : l'auteur peut maintenant VOIR, MODIFIER L'IMAGE et SUPPRIMER ses
    // annonces. Tout passe par le serveur (service_role) : la table annonces_pub
    // ne peut pas identifier un auteur (il n'est pas un compte Supabase), donc
    // ouvrir la modification et la suppression cote navigateur reviendrait a
    // laisser n'importe qui effacer les annonces du site.
    // Le statut ne change pas : l'annonce est publiee comme avant.
    function lienNormalise(l) {
      return String(l || "").trim().toLowerCase().replace(/\/+$/, "");
    }

    if (action === "annonces_lister") {
      const id = body.id;
      if (!id) return res.status(400).json({ error: "id requis." });
      const { data, error } = await supa.from("annonces_pub")
        .select("id, image_url, lien, statut, motif_refus, created_at")
        .eq("auteur_id", id).order("created_at", { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true, annonces: data || [] });
    }

    if (action === "annonce_creer") {
      const id = body.id;
      const image_url = String(body.image_url || "").trim();
      const lien = String(body.lien || "").trim();
      if (!id) return res.status(400).json({ error: "id requis." });
      if (!image_url) return res.status(400).json({ error: "Ajoute une image pour cette annonce." });
      if (!lien) return res.status(400).json({ error: "Colle le lien vers ton livre." });
      // UN MEME LIEN NE PEUT PAS SERVIR DEUX FOIS chez le meme auteur, tant que
      // l'annonce qui le porte n'a pas ete supprimee.
      const { data: deja } = await supa.from("annonces_pub").select("id, lien, statut").eq("auteur_id", id);
      const cible = lienNormalise(lien);
      const doublon = (deja || []).find(a => a.statut !== "refusee" && lienNormalise(a.lien) === cible);
      if (doublon) return res.status(409).json({ error: "Ce lien est déjà utilisé par une de tes annonces. Deux solutions, au choix : change l'image de l'annonce existante dans « Mes annonces », juste en dessous, ou supprime l'annonce existante pour pouvoir créer une nouvelle annonce avec ce lien." });
      const { data, error } = await supa.from("annonces_pub")
        .insert([{ auteur_id: id, image_url, lien, statut: "active" }])
        .select("id, image_url, lien, statut, motif_refus, created_at").maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true, annonce: data });
    }

    if (action === "annonce_image") {
      const id = body.id;
      const annonce_id = body.annonce_id;
      const image_url = String(body.image_url || "").trim();
      if (!id || !annonce_id) return res.status(400).json({ error: "id et annonce_id requis." });
      if (!image_url) return res.status(400).json({ error: "Ajoute une image pour cette annonce." });
      // .eq("auteur_id", id) : un auteur ne peut toucher QUE ses propres annonces.
      const { data, error } = await supa.from("annonces_pub").update({ image_url })
        .eq("id", annonce_id).eq("auteur_id", id)
        .select("id, image_url, lien, statut, motif_refus, created_at").maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      if (!data) return res.status(404).json({ error: "Cette annonce est introuvable. Recharge la page." });
      return res.status(200).json({ ok: true, annonce: data });
    }

    if (action === "annonce_supprimer") {
      const id = body.id;
      const annonce_id = body.annonce_id;
      if (!id || !annonce_id) return res.status(400).json({ error: "id et annonce_id requis." });
      const { error } = await supa.from("annonces_pub").delete().eq("id", annonce_id).eq("auteur_id", id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    // ---------- SUPPRESSION D'UN LIVRE PAR SON AUTEUR ----------
    // 25/09 : les auteurs n'arrivaient pas a supprimer un livre. La suppression
    // partait du navigateur (delete from books), or la table n'autorise les
    // auteurs qu'a CREER et MODIFIER : aucune ligne n'etait effacee, et comme
    // Supabase ne renvoie pas d'erreur dans ce cas, le site affichait quand meme
    // « Livre supprime ». La suppression passe donc par le serveur, qui verifie
    // que le livre appartient bien a l'auteur.
    if (action === "livre_supprimer") {
      const id = body.id;
      const book_id = body.book_id;
      if (!id || !book_id) return res.status(400).json({ error: "id et book_id requis." });

      const { data: bs } = await supa.from("books").select("id, title, status, auteur_id").eq("id", book_id).limit(1);
      const livre = bs && bs[0];
      if (!livre) return res.status(404).json({ error: "Ce livre est introuvable. Recharge la page." });
      if (String(livre.auteur_id) !== String(id)) return res.status(403).json({ error: "Ce livre ne t'appartient pas." });

      // Un livre EN LIGNE n'est jamais efface : des lecteurs peuvent l'avoir achete
      // et le retrouvent dans leur bibliotheque. On demande a l'auteur de passer
      // par CarryBooks pour le retirer de la vente.
      if (livre.status === "actif") {
        return res.status(409).json({ error: "Ce livre est en ligne et peut avoir été acheté. Écris à CarryBooks dans le Support pour le retirer de la vente : les lecteurs qui l'ont acheté doivent continuer à le lire." });
      }

      // Meme sans etre en ligne, un livre deja vendu ne doit pas disparaitre.
      let vendus = 0;
      try {
        const { count: c1 } = await supa.from("purchases").select("id", { count: "exact", head: true }).eq("book_id", book_id);
        const { count: c2 } = await supa.from("guest_purchases").select("id", { count: "exact", head: true }).eq("book_id", book_id);
        vendus = (c1 || 0) + (c2 || 0);
      } catch (e) {}
      if (vendus > 0) {
        return res.status(409).json({ error: "Ce livre a déjà été acheté " + vendus + " fois. Il ne peut pas être supprimé : écris à CarryBooks dans le Support." });
      }

      const { error } = await supa.from("books").delete().eq("id", book_id).eq("auteur_id", id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true, titre: livre.title });
    }

    return res.status(400).json({ error: "Action inconnue." });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
