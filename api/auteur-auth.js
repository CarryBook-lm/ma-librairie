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
const SAFE = "id, nom_complet, email, pays, telephone, bio, photo_url, code_source, pixel_meta, pixel_tiktok, facebook, instagram, tiktok, linkedin, youtube, kyc_status, kyc_nom, kyc_prenom, kyc_naissance, kyc_lieu_naissance, kyc_situation, kyc_nationalite, kyc_pays_residence, kyc_sexe, kyc_paiement_phone, kyc_piece_type, kyc_piece_url, kyc_piece_url2, kyc_contrat_url, kyc_motif_refus, abonnement_actif, couleur, vitrine_nom, vitrine_logo, vitrine_logo_192, vitrine_entete, coul_entete, coul_entete_texte, coul_fond, coul_prix, coul_bouton, coul_bouton_texte, vitrine_formations_lien, mode_vente, banni, banni_motif";

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
  // 15/10 : le Support est separe par site (colonne site : 'cb' = CarryBooks, 'hr' = HomoRomance).
  const siteSup = body.site === "hr" ? "hr" : "cb";

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
        vitrine_nom: String(body.vitrine_nom || "").trim() || null,
        mode_vente: String(body.mode_vente || "") === "vitrine" ? "vitrine" : "les_deux",
      };
      const { data, error } = await supa.from("auteurs").insert(row).select(SAFE).maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      // Message d'accueil automatique : les annonces marquees "permanentes" arrivent dans son Support
      try {
        const { data: anns } = await supa.from("support_annonces").select("id, texte").eq("permanente", true).eq("site", siteSup).order("created_at", { ascending: true });
        if (anns && anns.length && data) {
          const rows = anns.map(a => ({ auteur_id: data.id, cote: "admin", texte: a.texte, annonce_id: a.id, lu_admin: true, lu_auteur: false, site: siteSup }));
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
      try { const { count } = await supa.from("support_messages").select("id", { count: "exact", head: true }).eq("auteur_id", id).eq("site", siteSup).eq("cote", "admin").eq("lu_auteur", false); supportNonLus = count || 0; } catch (e) {}
      return res.status(200).json({ auteur: (data && data[0]) || null, delai_retrait: delai, support_non_lus: supportNonLus });
    }

    // ---------- MISE A JOUR DU PROFIL (pas le mot de passe) ----------
    if (action === "update") {
      const id = body.id;
      if (!id) return res.status(400).json({ error: "id requis." });
      const patch = {};
      ["nom_complet", "pays", "telephone", "bio", "photo_url", "pixel_meta", "pixel_tiktok", "facebook", "instagram", "tiktok", "linkedin", "youtube", "couleur", "vitrine_nom", "vitrine_logo", "vitrine_logo_192", "vitrine_entete", "coul_entete", "coul_entete_texte", "coul_fond", "coul_prix", "coul_bouton", "coul_bouton_texte", "vitrine_formations_lien", "mode_vente", "kyc_paiement_phone", "abonnement_actif"].forEach((k) => {
        if (k in body) patch[k] = (body[k] === "" ? null : body[k]);
      });
      if (Object.keys(patch).length === 0) return res.status(400).json({ error: "Rien a mettre a jour." });
      const { data, error } = await supa.from("auteurs").update(patch).eq("id", id).select(SAFE).maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ auteur: data });
    }

    // ---------- PHOTO DE PROFIL PROPRE A HOMOROMANCE (15/10) ----------
    // Le compte 8 sert les deux sites : la photo de HomoRomance ne doit JAMAIS
    // remplacer celle de CarryBooks (colonne photo_url). Elle est rangee a part,
    // dans la table reglages, sous la cle photo_hr_<id>.
    if (action === "photo_hr_get") {
      const id = Number(body.id) || 8;
      const { data } = await supa.from("reglages").select("cle, valeur").in("cle", ["photo_hr_" + id, "profil_hr_" + id]);
      let url = null, profil = {};
      (data || []).forEach(r => {
        if (r.cle === "photo_hr_" + id) url = r.valeur || null;
        if (r.cle === "profil_hr_" + id) { try { profil = JSON.parse(r.valeur || "{}") || {}; } catch (e) { profil = {}; } }
      });
      return res.status(200).json({ url, profil });
    }
    // Bio, reseaux sociaux et pixels propres a HomoRomance : jamais dans la ligne auteurs
    // (qui est celle de CarryBooks pour le compte 8).
    if (action === "profil_hr_set") {
      const id = Number(body.id);
      if (!id) return res.status(400).json({ error: "id requis." });
      const CLES = ["bio", "facebook", "instagram", "tiktok", "linkedin", "youtube", "pixel_meta", "pixel_tiktok"];
      const p = {};
      CLES.forEach(k => { p[k] = String((body.profil || {})[k] || "").trim(); });
      const { error } = await supa.from("reglages").upsert({ cle: "profil_hr_" + id, valeur: JSON.stringify(p), updated_at: new Date().toISOString() }, { onConflict: "cle" });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true, profil: p });
    }
    if (action === "photo_hr_set") {
      const id = Number(body.id);
      if (!id) return res.status(400).json({ error: "id requis." });
      const url = String(body.url || "").trim();
      const { error } = await supa.from("reglages").upsert({ cle: "photo_hr_" + id, valeur: url, updated_at: new Date().toISOString() }, { onConflict: "cle" });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true, url: url || null });
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
      const { data } = await supa.from("support_messages").select("id, cote, texte, image_url, annonce_id, created_at").eq("auteur_id", id).eq("site", siteSup).order("created_at", { ascending: true });
      return res.status(200).json({ ok: true, messages: data || [] });
    }

    // ---------- SUPPORT : envoyer un message a l'equipe ----------
    if (action === "support_envoyer") {
      const id = body.id;
      const texte = (body.texte || "").trim();
      const image_url = (body.image_url || "").trim() || null;
      if (!id) return res.status(400).json({ error: "id requis." });
      if (!texte && !image_url) return res.status(400).json({ error: "Message vide." });
      const { data, error } = await supa.from("support_messages").insert([{ auteur_id: id, cote: "auteur", texte, image_url, lu_admin: false, lu_auteur: true, site: siteSup }]).select("id, cote, texte, image_url, created_at").maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true, message: data });
    }

    // ---------- SUPPORT : marquer les messages de l'equipe comme lus ----------
    if (action === "support_marquer_lu") {
      const id = body.id;
      if (!id) return res.status(400).json({ error: "id requis." });
      await supa.from("support_messages").update({ lu_auteur: true }).eq("auteur_id", id).eq("site", siteSup).eq("cote", "admin").eq("lu_auteur", false);
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

    // ---------- PROCHAINES SORTIES : MODIFIER LA DATE / SUPPRIMER L'ANNONCE (15/10) ----------
    // Comme pour les annonces, tout passe par le serveur (service_role) : l'auteur
    // n'est pas un compte Supabase, la table ne peut donc pas le reconnaitre.
    // - cote AUTEUR : on ne touche QUE aux sorties dont auteur_id est le sien
    //   (ou celui d'un compte lie, ex. Landrine 8 = Julia 9)
    // - cote ADMIN : le serveur verifie le jeton Supabase et l'adresse e-mail
    const ADMINS_SORTIES = ["carrybooks.com@gmail.com", "homoromancebook@gmail.com"];
    async function emailDuJeton(token) {
      try {
        if (!token) return "";
        const { data } = await supa.auth.getUser(String(token));
        return String((data && data.user && data.user.email) || "").trim().toLowerCase();
      } catch (e) { return ""; }
    }
    function dateIsoValide(d) {
      return /^\d{4}-\d{2}-\d{2}$/.test(String(d || "")) && !isNaN(Date.parse(String(d)));
    }
    const SORTIE_CHAMPS = "id, cover, resume, date_sortie, site, auteur_id";
    const aujourdhuiIso = () => new Date().toISOString().slice(0, 10);

    if (action === "sorties_lister") {
      const id = body.id;
      if (!id) return res.status(400).json({ error: "id requis." });
      const { data, error } = await supa.from("sorties_prevues")
        .select(SORTIE_CHAMPS)
        .in("auteur_id", idsComptesLies(id))
        .gte("date_sortie", aujourdhuiIso())
        .order("date_sortie", { ascending: true });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true, sorties: data || [] });
    }

    if (action === "sortie_modifier") {
      const id = body.id;
      const sortie_id = body.sortie_id;
      const date_sortie = String(body.date_sortie || "").trim();
      if (!id || !sortie_id) return res.status(400).json({ error: "id et sortie_id requis." });
      if (!dateIsoValide(date_sortie)) return res.status(400).json({ error: "Choisis une date valide." });
      if (date_sortie < aujourdhuiIso()) return res.status(400).json({ error: "La date de sortie ne peut pas être dans le passé." });
      const { data, error } = await supa.from("sorties_prevues").update({ date_sortie })
        .eq("id", sortie_id).in("auteur_id", idsComptesLies(id))
        .select(SORTIE_CHAMPS).maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      if (!data) return res.status(404).json({ error: "Cette annonce est introuvable. Recharge la page." });
      return res.status(200).json({ ok: true, sortie: data });
    }

    if (action === "sortie_supprimer") {
      const id = body.id;
      const sortie_id = body.sortie_id;
      if (!id || !sortie_id) return res.status(400).json({ error: "id et sortie_id requis." });
      const { data, error } = await supa.from("sorties_prevues").delete()
        .eq("id", sortie_id).in("auteur_id", idsComptesLies(id)).select("id");
      if (error) return res.status(500).json({ error: error.message });
      if (!data || !data.length) return res.status(404).json({ error: "Cette annonce est introuvable. Recharge la page." });
      return res.status(200).json({ ok: true });
    }

    // ---------- 15/10 : purge des auteurs qui n'ont AUCUN livre (apercu puis suppression) ----------
    if (action === "admin_purger_auteurs") {
      const emailAdmin = await emailDuJeton(body.token);
      if (!emailAdmin || ADMINS_SORTIES.indexOf(emailAdmin) === -1) return res.status(403).json({ error: "Réservé à l'administrateur." });
      const PROTEGES = [8, 9];
      const { data: auts, error: eA } = await supa.from("auteurs").select("id, nom_complet, email").limit(10000);
      if (eA) return res.status(500).json({ error: eA.message });
      const { data: bks } = await supa.from("books").select("auteur_id").not("auteur_id", "is", null).limit(50000);
      const avecLivre = new Set((bks || []).map(b => String(b.auteur_id)));
      const { data: vts } = await supa.from("ventes_auteurs").select("auteur_id").limit(50000);
      (vts || []).forEach(v => avecLivre.add(String(v.auteur_id)));
      const { data: rts } = await supa.from("retraits").select("auteur_id").limit(50000);
      (rts || []).forEach(v => avecLivre.add(String(v.auteur_id)));
      const cibles = (auts || []).filter(a => !avecLivre.has(String(a.id)) && PROTEGES.indexOf(Number(a.id)) === -1);
      if (!body.confirmer) {
        return res.status(200).json({ ok: true, apercu: true, total: cibles.length, auteurs: cibles.map(a => ({ id: a.id, nom: a.nom_complet, email: a.email })) });
      }
      const idsOk = new Set(cibles.map(a => String(a.id)));
      const aSupprimer = (Array.isArray(body.ids) ? body.ids : []).filter(id => idsOk.has(String(id)));
      let supprimes = 0; const echecs = [];
      for (const id of aSupprimer) {
        for (const t of ["support_messages", "annonces_pub", "sorties_prevues"]) { try { await supa.from(t).delete().eq("auteur_id", id); } catch (e) {} }
        const { error } = await supa.from("auteurs").delete().eq("id", id);
        if (error) echecs.push({ id, erreur: error.message }); else supprimes++;
      }
      return res.status(200).json({ ok: true, supprimes, echecs });
    }

    // ---------- 15/10 : l'administrateur genere un nouveau mot de passe pour une auteure ----------
    if (action === "admin_reset_mdp") {
      const emailAdmin = await emailDuJeton(body.token);
      if (!emailAdmin || ADMINS_SORTIES.indexOf(emailAdmin) === -1) return res.status(403).json({ error: "Réservé à l'administrateur." });
      const auteurId = body.auteur_id;
      if (!auteurId) return res.status(400).json({ error: "auteur_id requis." });
      const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let nouveau = "";
      for (let i = 0; i < 8; i++) nouveau += alphabet[crypto.randomInt(alphabet.length)];
      const { data, error } = await supa.from("auteurs").update({ password_hash: hashPassword(nouveau) }).eq("id", auteurId).select("id, email, nom_complet");
      if (error) return res.status(500).json({ error: error.message });
      if (!data || !data.length) return res.status(404).json({ error: "Auteure introuvable." });
      return res.status(200).json({ ok: true, mot_de_passe: nouveau, email: data[0].email, nom: data[0].nom_complet });
    }

    if (action === "sortie_admin_modifier" || action === "sortie_admin_supprimer") {
      const email = await emailDuJeton(body.token);
      if (!email || ADMINS_SORTIES.indexOf(email) === -1) return res.status(403).json({ error: "Réservé à l'administrateur." });
      const sortie_id = body.sortie_id;
      if (!sortie_id) return res.status(400).json({ error: "sortie_id requis." });
      if (action === "sortie_admin_modifier") {
        const date_sortie = String(body.date_sortie || "").trim();
        if (!dateIsoValide(date_sortie)) return res.status(400).json({ error: "Choisis une date valide." });
        if (date_sortie < aujourdhuiIso()) return res.status(400).json({ error: "La date de sortie ne peut pas être dans le passé." });
        const { data, error } = await supa.from("sorties_prevues").update({ date_sortie })
          .eq("id", sortie_id).select(SORTIE_CHAMPS).maybeSingle();
        if (error) return res.status(500).json({ error: error.message });
        if (!data) return res.status(404).json({ error: "Cette annonce est introuvable. Recharge la page." });
        return res.status(200).json({ ok: true, sortie: data });
      }
      const { data, error } = await supa.from("sorties_prevues").delete().eq("id", sortie_id).select("id");
      if (error) return res.status(500).json({ error: error.message });
      if (!data || !data.length) return res.status(404).json({ error: "Cette annonce est introuvable. Recharge la page." });
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

    // 06/10 : PUBLIER EN VITRINE SEULE.
    // La politique RLS de books n'autorise le navigateur a inserer qu'un livre
    // "brouillon" ou "en_attente" - c'est voulu, sinon n'importe quel visiteur
    // mettrait un livre en ligne. Une publication en vitrine ecrit status
    // "actif" : elle doit donc passer par ici, avec la cle de service, apres
    // verification de l'auteur. La regle "reserve aux auteurs verifies" est
    // ainsi appliquee par le serveur, et plus seulement par le navigateur.
    if (action === "livre_vitrine") {
      const id = Number(body.id || 0);
      const bookId = Number(body.book_id || 0);
      const champs = body.payload && typeof body.payload === "object" ? body.payload : null;
      if (!id || !champs) return res.status(400).json({ error: "id et payload requis." });

      const { data: aa } = await supa.from("auteurs").select("id, kyc_status, banni").eq("id", id).limit(1);
      const aut = aa && aa[0];
      if (!aut) return res.status(404).json({ error: "Compte auteur introuvable." });
      if (aut.banni) return res.status(403).json({ error: "Ton compte est suspendu." });
      if (aut.kyc_status !== "valide") {
        return res.status(403).json({ error: "La vente en vitrine seule est reservee aux auteurs verifies. Termine ta verification d'identite dans Mon compte." });
      }

      // Pas de prix plancher ici : cette action ne sert QU'A la publication en
      // vitrine seule, ou l'auteur fixe son prix librement. Le plancher de
      // 2 000 FCFA ne vaut que pour le catalogue CarryBooks.
      // Le navigateur ne choisit pas les champs sensibles : on les impose ici.
      const row = Object.assign({}, champs);
      delete row.id;
      delete row.created_at;
      row.auteur_id = id;
      row.status = "actif";
      row.moderation = "valide";
      row.exclusif_vitrine = true;
      row.motif_refus = null;
      row.masque = false;

      if (bookId) {
        const { data: bs } = await supa.from("books").select("id, auteur_id").eq("id", bookId).limit(1);
        const livre = bs && bs[0];
        if (!livre) return res.status(404).json({ error: "Ce livre est introuvable. Recharge la page." });
        if (String(livre.auteur_id) !== String(id)) return res.status(403).json({ error: "Ce livre ne t'appartient pas." });
        const { error } = await supa.from("books").update(row).eq("id", bookId);
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ ok: true, id: bookId });
      }

      const { data: cree, error } = await supa.from("books").insert(row).select("id").maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true, id: cree && cree.id });
    }

    return res.status(400).json({ error: "Action inconnue." });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
