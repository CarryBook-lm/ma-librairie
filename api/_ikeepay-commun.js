// api/_ikeepay-commun.js — ce que partagent ikeepay-payin.js et ikeepay-webhook.js.
// (Le « _ » devant le nom : Vercel n'en fait PAS une adresse publique, c'est une boîte à outils.)
//
// iKeePay sur CarryBooks, décidé par Landrine le 07/11 : la Côte d'Ivoire, le Sénégal,
// le Bénin et le Burkina Faso passent ENTIÈREMENT par iKeePay, en achat direct
// (le lecteur tape son numéro, choisit son opérateur, valide sur son téléphone).
// Le Cameroun reste sur CamPay, les autres pays sur PawaPay.
//
// Copié de ce qui tourne déjà sur Yolli (CarryBook-lm/yolli, api/ikeepay-*.js),
// adapté aux tables de CarryBooks : purchases / guest_purchases / ventes_auteurs.
//
// RÈGLE UNIQUE : rien de ce qui se passe dans le téléphone du lecteur ne donne un livre.
// Seuls l'avis d'iKeePay (webhook vérifié) ou la réponse d'iKeePay à NOTRE question
// (GET /h2h-verify, avec la clé secrète) changent un paiement en « reussi ».
//
// Variable Vercel : IKEEPAY_SECRET_KEY (la clé secrète, jamais dans le code).

import { createClient } from "@supabase/supabase-js";

export const IKEEPAY_API = "https://api.ikeepay.com";
export const cleIkeepay = () => String(process.env.IKEEPAY_SECRET_KEY || "").trim();

// Les quatre pays. « iso3 » est le code déjà utilisé par CarryBooks dans purchases.pays
// (écran admin « Ventes par pays »), « iso » et « dial » sont ceux qu'attend iKeePay.
export const PAYS_IKP = {
  "Côte d'Ivoire": { iso: "CI", iso3: "CIV", dial: "225", ops: ["ORANGE", "MTN", "MOOV", "WAVE"] },
  "Côte d’Ivoire": { iso: "CI", iso3: "CIV", dial: "225", ops: ["ORANGE", "MTN", "MOOV", "WAVE"] },
  "Sénégal":       { iso: "SN", iso3: "SEN", dial: "221", ops: ["ORANGE", "WAVE"] },
  "Bénin":         { iso: "BJ", iso3: "BEN", dial: "229", ops: ["MTN", "MOOV"] },
  "Burkina Faso":  { iso: "BF", iso3: "BFA", dial: "226", ops: ["ORANGE", "MOOV"] },
};

export function admin() {
  return createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Lecture tolérante : un champ peut être rangé à plusieurs endroits selon l'événement.
export function pick(obj, ...chemins) {
  for (const ch of chemins) {
    let v = obj;
    for (const p of ch.split(".")) { v = v == null ? undefined : v[p]; if (v == null) break; }
    if (v != null && v !== "") return v;
  }
  return undefined;
}

// On demande à iKeePay où en est un paiement direct.
// ⚠️ Leur réponse : { status:"success", data:{ status:"completed"|"pending"|"failed" } }.
// Le « success » du haut dit seulement que la QUESTION a abouti. L'état du paiement est
// dans data.status — c'est lui qu'on lit (piège découvert sur Yolli le 05/11).
// Renvoie "reussi", "echec", "attente", ou null si iKeePay n'a pas pu répondre.
export async function etatChezIkeepay(reference) {
  if (!reference || !cleIkeepay()) return null;
  for (const chemin of ["/h2h-verify/", "/checkout-verify/"]) {
    try {
      const r = await fetch(IKEEPAY_API + chemin + encodeURIComponent(reference), {
        method: "GET", headers: { "x-api-key": cleIkeepay(), "Content-Type": "application/json" },
      });
      if (!r.ok) { console.warn("[IKEEPAY] verify", chemin, r.status); continue; }
      const d = await r.json().catch(() => null);
      if (!d) continue;
      const st = String(pick(d, "data.status", "data.transaction.status", "transaction.status")
                        || (d.data ? "" : pick(d, "status")) || "").toLowerCase();
      if (!st) continue;
      if (/pending|initiated|processing|created/.test(st)) return "attente";
      if (/fail|refus|cancel|declin|expired|reject|error/.test(st)) return "echec";
      if (/completed|complete|success|succeed|paid|reussi|approved/.test(st)) {
        return { statut: "reussi", ref: pick(d, "data.provider_reference", "data.reference", "data.id") || null };
      }
    } catch (e) {
      console.warn("[IKEEPAY] verify", chemin, "injoignable", String((e && e.message) || e));
    }
  }
  return null;
}

// Un paiement qui n'a pas abouti : on l'écrit, pour qu'il ne reste pas « en attente » pour toujours.
// On ne touche jamais à un paiement déjà réussi.
export async function marquerEchec(supa, id, raison) {
  try {
    await supa.from("ikeepay_paiements")
      .update({ statut: "echec", raison: String(raison || "").slice(0, 195), maj_at: new Date().toISOString() })
      .eq("id", id).eq("statut", "attente");
  } catch (e) {}
}

// ---------- e-mails et commission : les mêmes que pour PawaPay ----------
async function emailVente(supa, { bookId, amount, phone, pays, operateur }) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "carrybooks.com@gmail.com";
  const EMAIL_FROM = process.env.EMAIL_FROM || "CarryBooks <onboarding@resend.dev>";
  if (!RESEND_API_KEY) return;
  let titre = "Livre #" + bookId;
  try {
    const { data } = await supa.from("books").select("title, product_type").eq("id", bookId).limit(1);
    if (data && data[0] && data[0].title) titre = (data[0].product_type === "pack" ? "📦 Pack : " : "") + data[0].title;
  } catch (e) {}
  const html = '<div style="font-family:Arial,sans-serif;color:#1a1208">' +
    '<h2 style="color:#c9a84c">Nouvelle vente (iKeePay)</h2>' +
    '<p style="font-size:16px"><b>' + titre + '</b></p>' +
    '<p>Montant : <b>' + amount + ' FCFA</b></p>' +
    '<p>Téléphone : ' + (phone || "-") + '</p>' +
    '<p>Pays : ' + (pays || "-") + ' · Opérateur : ' + (operateur || "-") + '</p>' +
    '<p>Paiement : iKeePay (Mobile Money direct)</p></div>';
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": "Bearer " + RESEND_API_KEY, "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ from: EMAIL_FROM, to: ADMIN_EMAIL, subject: "Vente iKeePay - " + titre, html }),
    });
  } catch (e) { console.error("[IKEEPAY-EMAIL]", e.message); }
}

async function emailAuteur(supa, { auteurId, titre, partAuteur, bookId }) {
  try {
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY || !auteurId) return;
    const EMAIL_FROM = process.env.EMAIL_FROM || "CarryBooks <onboarding@resend.dev>";
    const { data: au } = await supa.from("auteurs").select("email, nom_complet").eq("id", auteurId).limit(1);
    if (!au || !au[0] || !au[0].email) return;
    const nom = (au[0].nom_complet || "").split(" ")[0] || "";
    let estHR = false;
    try { const { data: bc } = await supa.from("books").select("category").eq("id", bookId).limit(1); estHR = !!(bc && bc[0] && bc[0].category === "HomoRomance"); } catch (e) {}
    let html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#fff8ec;border-radius:12px;"><div style="text-align:center;font-size:34px;">🎉</div><h2 style="color:#1a1208;text-align:center;margin:8px 0;">Bingo !!!</h2><p style="color:#444;font-size:15px;line-height:1.6;text-align:center;">Bonne nouvelle${nom ? ", " + nom : ""} !<br/>Ton livre <b>${titre}</b> vient d’être vendu sur CarryBooks.</p><div style="background:#c9a84c;color:#1a1208;font-weight:bold;font-size:18px;text-align:center;padding:12px;border-radius:10px;margin:16px 0;">+ ${Number(partAuteur || 0).toLocaleString("fr-FR")} FCFA</div><p style="color:#666;font-size:13px;text-align:center;">Retrouve tes gains dans ton espace auteur.</p><p style="color:#999;font-size:12px;text-align:center;margin-top:18px;">CarryBooks ❤️</p></div>`;
    if (estHR) html = html.replace(/CarryBooks/g, "HomoRomance").replace(/carrybooks\.com/g, "homoromance.com");
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": "Bearer " + RESEND_API_KEY, "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ from: (estHR ? EMAIL_FROM.replace(/CarryBooks/g, "HomoRomance") : EMAIL_FROM), to: au[0].email, subject: "🎉 Ton livre \"" + titre + "\" a été vendu !", html }),
    });
  } catch (e) { console.error("[IKEEPAY-AUTEUR-EMAIL]", e.message); }
}

// Commission auteur : 85 % si la vente vient de l'auteur (vitrine ou lien), 50 % sinon. Même règle que PawaPay.
async function commissionAuteur(supa, { bookId, amount, extRef, authorSrc }) {
  try {
    if (!bookId || !amount) return;
    const { data: bk } = await supa.from("books").select("auteur_id, exclusif_vitrine, title").eq("id", bookId).limit(1);
    const auteurId = bk && bk[0] ? bk[0].auteur_id : null;
    if (!auteurId) return;
    const exclusifVitrine = !!(bk && bk[0] && bk[0].exclusif_vitrine);
    const { data: va } = await supa.from("ventes_auteurs").select("id").eq("reference", extRef).limit(1);
    if (va && va.length > 0) return; // déjà enregistrée
    const { data: au } = await supa.from("auteurs").select("code_source").eq("id", auteurId).limit(1);
    const codeSource = au && au[0] ? au[0].code_source : null;
    const viaLien = authorSrc && codeSource && String(authorSrc).toLowerCase() === String(codeSource).toLowerCase();
    const taux = (exclusifVitrine || viaLien) ? 85 : 50;
    const partAuteur = Math.round(amount * taux / 100);
    const { error } = await supa.from("ventes_auteurs").insert([{
      auteur_id: auteurId, book_id: bookId, reference: extRef,
      montant_total: amount, taux_auteur: taux, part_auteur: partAuteur,
      part_carrybooks: amount - partAuteur, source: exclusifVitrine ? "vitrine" : (viaLien ? "auteur" : "carrybooks"),
    }]);
    if (error) console.error("[IKEEPAY-AUTEUR] ventes_auteurs:", error.message);
    else await emailAuteur(supa, { auteurId, titre: (bk[0].title || "ton livre"), partAuteur, bookId });
  } catch (e) { console.error("[IKEEPAY-AUTEUR]", e.message); }
}

// LE PAIEMENT EST RÉUSSI : on donne le livre.
// Appelé par le webhook ET par la vérification (le lecteur qui attend) : les deux peuvent
// arriver en même temps. Celui qui fait passer la ligne à « reussi » le premier est le seul
// qui continue — l'autre s'arrête. Un lecteur ne reçoit jamais deux fois le même achat.
export async function donnerLeLivre(supa, id, refIkeepay) {
  const { data: pris, error: e1 } = await supa.from("ikeepay_paiements")
    .update({ statut: "reussi", reference_ikeepay: refIkeepay ? String(refIkeepay).slice(0, 120) : null, raison: null, maj_at: new Date().toISOString() })
    .eq("id", id).in("statut", ["attente", "echec"]).select();
  if (e1) throw new Error("maj paiement : " + e1.message);
  if (!pris || !pris.length) return { deja: true }; // déjà donné (ou paiement inconnu)
  const p = pris[0];
  const extRef = "IKP_" + p.id;
  try {
    if (p.user_id) {
      const { data: ex } = await supa.from("purchases").select("id").eq("external_reference", extRef).limit(1);
      if (!ex || !ex.length) {
        const { error } = await supa.from("purchases").insert([{
          user_id: p.user_id, book_id: p.book_id, amount: p.montant, phone: p.phone || p.numero_paiement || "",
          external_reference: extRef, type: "sale", pays: p.pays, referrer_code: p.referrer_code || null,
        }]);
        if (error) throw new Error("purchases : " + error.message);
      }
    } else {
      const { data: ex } = await supa.from("guest_purchases").select("id").eq("reference", extRef).limit(1);
      if (!ex || !ex.length) {
        const { error } = await supa.from("guest_purchases").insert([{
          phone: String(p.phone || p.numero_paiement || "").trim(), book_id: p.book_id, amount: p.montant,
          reference: extRef, external_reference: extRef, type: "book", pays: p.pays, referrer_code: p.referrer_code || null,
        }]);
        if (error) throw new Error("guest_purchases : " + error.message);
      }
    }
  } catch (e) {
    // L'achat n'a pas pu être écrit : on remet le paiement « en attente » pour qu'un
    // prochain passage (webhook réessayé ou vérification) recommence. Mieux vaut
    // réessayer que laisser un lecteur payé sans son livre.
    await supa.from("ikeepay_paiements").update({ statut: "attente", raison: String(e.message).slice(0, 195) }).eq("id", id);
    throw e;
  }
  // Code promo : une utilisation de plus
  if (p.promo_id) {
    try {
      const { data: pr } = await supa.from("promo_codes").select("uses_count").eq("id", p.promo_id).limit(1);
      await supa.from("promo_codes").update({ uses_count: ((pr && pr[0] && pr[0].uses_count) || 0) + 1 }).eq("id", p.promo_id);
    } catch (e) {}
  }
  await emailVente(supa, { bookId: p.book_id, amount: p.montant, phone: p.phone || p.numero_paiement, pays: p.pays, operateur: p.operateur });
  await commissionAuteur(supa, { bookId: p.book_id, amount: p.montant, extRef, authorSrc: p.author_src || "" });
  return { ok: true, paiement: p };
}

// RATTRAPAGE : les paiements restés « en attente » (avis d'iKeePay perdu, lecteur qui a
// fermé la page). À chaque appel de l'API, on en revérifie quelques-uns chez iKeePay.
// Un lecteur payé finit donc toujours par recevoir son livre, même s'il n'attend pas.
export async function rattraper(supa, max = 3) {
  try {
    const maintenant = Date.now();
    const { data } = await supa.from("ikeepay_paiements").select("id, created_at, verifie_at")
      .eq("statut", "attente")
      .lt("created_at", new Date(maintenant - 90 * 1000).toISOString())
      .gt("created_at", new Date(maintenant - 3 * 86400000).toISOString())
      .order("verifie_at", { ascending: true, nullsFirst: true }).limit(10);
    let n = 0;
    for (const p of (data || [])) {
      if (n >= max) break;
      if (p.verifie_at && maintenant - new Date(p.verifie_at).getTime() < 120000) continue;
      n++;
      await supa.from("ikeepay_paiements").update({ verifie_at: new Date().toISOString() }).eq("id", p.id);
      const st = await etatChezIkeepay(p.id);
      if (st && st.statut === "reussi") { try { await donnerLeLivre(supa, p.id, st.ref); } catch (e) {} }
      else if (st === "echec") await marquerEchec(supa, p.id, "verify failed");
      else if (maintenant - new Date(p.created_at).getTime() > 2 * 86400000) await marquerEchec(supa, p.id, "sans réponse après 48 h");
    }
  } catch (e) { console.warn("[IKEEPAY] rattrapage", e.message); }
}
