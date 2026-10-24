// api/ma-bibliotheque.js
// Bibliotheque UNIQUE d'un lecteur, quel que soit l'endroit ou il a achete
// (CarryBooks ou la vitrine d'un auteur) et quelle que soit son identite
// (compte Google/email, ou numero de telephone sans compte).
//
// Entree : POST { token?, phone? }
//   token = jeton de session du compte (verifie cote serveur), phone = numero du lecteur.
// Sortie : { ok, ids, purchases:[{book_id, created_at, amount}] }
//
// Principe : on part de ce qu'on sait du lecteur (son compte, son numero), puis on
// ajoute les numeros qu'il a deja utilises pour payer avec son compte. On cherche
// ensuite TOUS les achats (comptes + invites) faits avec ces numeros.
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// 9 derniers chiffres : exact pour un numero camerounais, assez precis ailleurs.
const cle = (p) => {
  const d = String(p || "").replace(/\D/g, "");
  if (d.length < 8) return "";
  return d.slice(-9);
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { token, phone } = req.body || {};
    let uid = null;
    if (token) {
      try {
        const { data } = await admin.auth.getUser(String(token));
        uid = (data && data.user && data.user.id) || null;
      } catch (e) {}
    }
    const cles = new Set();
    const k0 = cle(phone);
    if (k0) cles.add(k0);
    if (!uid && !k0) return res.status(400).json({ error: "Compte ou numero requis." });

    const lignes = [];
    if (uid) {
      const { data } = await admin.from("purchases").select("book_id, created_at, amount, phone").eq("user_id", uid);
      (data || []).forEach(r => { lignes.push(r); const k = cle(r.phone); if (k) cles.add(k); });
    }
    if (cles.size) {
      const filtre = Array.from(cles).map(k => "phone.ilike.%" + k + "%").join(",");
      const [g, p] = await Promise.all([
        admin.from("guest_purchases").select("book_id, created_at, amount, phone").or(filtre),
        admin.from("purchases").select("book_id, created_at, amount, phone").or(filtre),
      ]);
      (g.data || []).forEach(r => lignes.push(r));
      (p.data || []).forEach(r => lignes.push(r));
    }
    // Un seul exemplaire par livre (le plus recent).
    const parLivre = new Map();
    lignes.filter(r => r && r.book_id != null).forEach(r => {
      const k = String(r.book_id);
      const ex = parLivre.get(k);
      if (!ex || String(r.created_at || "") > String(ex.created_at || "")) parLivre.set(k, r);
    });
    const purchases = Array.from(parLivre.values()).map(r => ({ book_id: r.book_id, created_at: r.created_at, amount: r.amount }));
    return res.status(200).json({ ok: true, ids: purchases.map(r => r.book_id), purchases });
  } catch (e) {
    return res.status(500).json({ error: (e && e.message) || "Erreur serveur." });
  }
}
