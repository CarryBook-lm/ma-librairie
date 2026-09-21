// api/notifier-refus.js
// Prévient un auteur par email que son livre a été refusé, avec le MOTIF.
// Déclenché depuis l'admin (Admin.jsx -> refuserLivre), après l'enregistrement du refus.
// Sécurisé : seul l'admin (Landrine) peut l'appeler (JWT Supabase vérifié).
//
// 21/09 : avant ce fichier, aucun message ne partait quand un livre était refusé.
// L'auteur ne pouvait le découvrir qu'en rouvrant l'application — et il écrivait
// à CarryBooks pour demander pourquoi.
//
// RÈGLE : un email raté ne doit JAMAIS bloquer la modération. Ce point d'entrée
// répond toujours 200 et l'admin ignore le résultat.
import { createClient } from "@supabase/supabase-js";

const ADMIN_UID = "f8b0dcd2-bf6e-443f-b2ea-a03db4e979dc";

function echapper(t) {
  return String(t == null ? "" : t)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST requis" });
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { book_id, token } = body;
    if (!book_id) return res.status(200).json({ ok: false, error: "book_id requis" });

    const supa = createClient(
      process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Sécurité : seul l'admin déclenche cet envoi
    try {
      const { data: u } = await supa.auth.getUser(token || "");
      if (!u || !u.user || u.user.id !== ADMIN_UID) return res.status(403).json({ ok: false, error: "Non autorisé" });
    } catch (e) { return res.status(403).json({ ok: false, error: "Non autorisé" }); }

    const { data: bs } = await supa.from("books").select("id, title, motif_refus, auteur_id").eq("id", book_id).limit(1);
    const livre = bs && bs[0];
    if (!livre) return res.status(200).json({ ok: false, error: "Livre introuvable" });
    if (!livre.auteur_id) return res.status(200).json({ ok: false, error: "Livre sans auteur rattaché" });

    const { data: as } = await supa.from("auteurs").select("id, nom_complet, email").eq("id", livre.auteur_id).limit(1);
    const auteur = as && as[0];
    if (!auteur || !auteur.email) return res.status(200).json({ ok: false, error: "Cet auteur n'a pas d'adresse email enregistrée." });

    const CLE = process.env.RESEND_API_KEY;
    if (!CLE) return res.status(200).json({ ok: false, error: "RESEND_API_KEY manquante" });
    const EXPEDITEUR = process.env.EMAIL_FROM || "CarryBooks <onboarding@resend.dev>";

    const prenom = String(auteur.nom_complet || "").trim().split(/\s+/)[0] || "";
    const titre = echapper(livre.title);
    const motif = echapper(livre.motif_refus || "Aucun motif n'a été indiqué.");

    const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1a1208;line-height:1.7;max-width:560px">
  <p>Bonjour ${echapper(prenom)},</p>
  <p>Nous avons examiné votre livre <b>« ${titre} »</b>, et nous ne pouvons pas le publier en l'état.</p>
  <div style="background:#fdecea;border:1px solid #e53935;border-radius:8px;padding:14px;margin:18px 0">
    <b style="color:#c62828">Motif du refus</b><br/>${motif}
  </div>
  <p><b>Ce refus n'est pas définitif.</b> Vous pouvez corriger votre livre et nous le renvoyer :</p>
  <ol>
    <li>Ouvrez votre espace auteur sur <a href="https://carrybooks.com">carrybooks.com</a>.</li>
    <li>Allez dans <b>Mes livres</b>, puis dans l'onglet <b>Refusés</b>.</li>
    <li>Ouvrez le livre, appuyez sur <b>Modifier</b> et corrigez le point indiqué.</li>
    <li>Appuyez sur <b>Soumettre pour validation</b>. Nous réexaminerons le livre.</li>
  </ol>
  <p>Si le motif n'est pas clair, répondez à ce message : nous vous expliquerons précisément quoi corriger.</p>
  <p>Merci de votre travail et à très vite.</p>
  <p style="color:#8a7a5c">CarryBooks</p>
</div>`;

    const texte = "Bonjour " + prenom + ",\n\n"
      + "Nous avons examine votre livre « " + (livre.title || "") + " », et nous ne pouvons pas le publier en l'etat.\n\n"
      + "MOTIF DU REFUS : " + (livre.motif_refus || "Aucun motif n'a ete indique.") + "\n\n"
      + "Ce refus n'est pas definitif. Ouvrez votre espace auteur sur carrybooks.com, allez dans Mes livres puis dans l'onglet Refuses, "
      + "ouvrez le livre, appuyez sur Modifier, corrigez le point indique, puis appuyez sur Soumettre pour validation.\n\n"
      + "Si le motif n'est pas clair, repondez a ce message.\n\nCarryBooks";

    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": "Bearer " + CLE, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: EXPEDITEUR,
          to: [auteur.email],
          subject: "Votre livre « " + (livre.title || "") + " » n'a pas été publié",
          html,
          text: texte,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return res.status(200).json({ ok: false, error: (j && (j.message || j.name)) || ("Resend a refusé (HTTP " + r.status + ")") });
      return res.status(200).json({ ok: true, email: auteur.email });
    } catch (e) {
      return res.status(200).json({ ok: false, error: "Envoi impossible : " + (e && e.message) });
    }
  } catch (e) {
    return res.status(200).json({ ok: false, error: String(e && e.message || e) });
  }
}
