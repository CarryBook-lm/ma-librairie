// api/meta-conversions.js — API Conversions Meta pour Carrybooks
//
// POURQUOI CE FICHIER
// -------------------
// Le Pixel s'execute dans le navigateur de la cliente. Un bloqueur de
// publicites, un iPhone recent, une connexion coupee, un onglet ferme trop
// vite — et l'evenement se perd. Meta estime que 20 a 30 % des ventes ne
// remontent jamais.
//
// L'API Conversions envoie la MEME information depuis le serveur, que Meta
// recoit toujours. Les deux ensemble, chaque vente est comptee UNE FOIS et
// surement. Sur une autre boutique (CarryGoo), Meta annonce +16,7 % de
// conversions enregistrees grace a ce couplage.
//
// LE POINT LE PLUS IMPORTANT : `event_id`
// ---------------------------------------
// Le navigateur ET le serveur envoient tous les deux le meme achat. Sans
// precaution, Meta le compterait DEUX FOIS — les chiffres seraient faux et
// l'optimisation apprendrait sur du vent.
//
// La regle : les deux envois doivent porter le MEME `event_id`. Meta reconnait
// alors le doublon et n'en garde qu'un. Cet identifiant doit etre stable et
// unique — le numero de commande convient parfaitement.
//
// Cote navigateur, l'appel devient donc :
//   fbq('track', 'Purchase', params, { eventID: 'cmd_' + numeroCommande });
// et ce fichier recoit le meme 'cmd_' + numeroCommande.
// SI CES DEUX VALEURS DIFFERENT, TOUT EST COMPTE EN DOUBLE.
//
// LES DONNEES CLIENT SONT HACHEES
// -------------------------------
// Meta exige que le telephone, l'email, le prenom, le nom et la ville soient
// haches en SHA-256 AVANT l'envoi. Rien ne part en clair. Le hachage se fait
// ici, cote serveur — la page n'a jamais a manipuler ces valeurs.
//
// Normalisation exigee par Meta, a ne pas negliger : minuscules, sans espaces,
// sans accents, et le telephone au format international SANS le +
// (ex : 237690000000). Un numero mal normalise n'est rattache a personne, et
// l'evenement perd tout son interet.
//
// A METTRE DANS LES VARIABLES D'ENVIRONNEMENT DE VERCEL — JAMAIS DANS LE CODE :
//   META_PIXEL_ID       = 1482084486156586
//   META_ACCESS_TOKEN   = le jeton genere dans le Gestionnaire d'evenements
//   META_CONV_SECRET    = un mot de passe invente, partage avec l'appelant
//
// Le jeton donne le droit d'ecrire dans le Pixel. S'il fuite, quelqu'un peut
// injecter de fausses ventes et ruiner l'optimisation des campagnes.

import crypto from 'crypto';

const API = 'https://graph.facebook.com/v21.0';

// --- Normalisation + hachage, selon les regles de Meta ---------------------

function hacher(valeur) {
  const v = String(valeur || '').trim();
  if (!v) return null;
  return crypto.createHash('sha256').update(v).digest('hex');
}

// Minuscules, sans accents, sans ponctuation ni espaces.
function normaliserTexte(t) {
  return String(t || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

// Numero international SANS le +, ex : 690000000 -> 237690000000.
// `indicatif` par defaut : 237 (Cameroun). A changer si la boutique vend
// ailleurs — un numero sans indicatif n'est rattache a personne.
function normaliserTel(tel, indicatif = '237') {
  let d = String(tel || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith(indicatif) && d.length > indicatif.length + 5) return d;
  return indicatif + d;
}

function donneesClient(c = {}, req) {
  const u = {};
  const tel = normaliserTel(c.telephone, c.indicatif);
  if (tel) u.ph = [hacher(tel)];
  if (c.email) u.em = [hacher(String(c.email).trim().toLowerCase())];
  if (c.prenom) u.fn = [hacher(normaliserTexte(c.prenom))];
  if (c.nom) u.ln = [hacher(normaliserTexte(c.nom))];
  if (c.ville) u.ct = [hacher(normaliserTexte(c.ville))];
  if (c.pays) u.country = [hacher(normaliserTexte(c.pays))];

  // NON HACHES, et c'est voulu : Meta s'en sert pour rapprocher l'evenement
  // serveur de la visite navigateur. Sans eux, la correspondance chute
  // fortement.
  //   fbp = cookie _fbp     fbc = cookie _fbc (issu du clic publicitaire)
  if (c.fbp) u.fbp = c.fbp;
  if (c.fbc) u.fbc = c.fbc;

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  if (ip) u.client_ip_address = ip;
  if (req.headers['user-agent']) u.client_user_agent = req.headers['user-agent'];

  return u;
}

// --- Le point d'entree -----------------------------------------------------

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erreur: 'POST attendu' });

  // Ce point d'entree est PUBLIC : sans ce controle, n'importe qui pourrait
  // injecter de fausses ventes dans le Pixel.
  if (req.headers['x-conv-secret'] !== process.env.META_CONV_SECRET) {
    return res.status(401).json({ erreur: 'Non autorise' });
  }

  const PIXEL = process.env.META_PIXEL_ID;
  const TOKEN = process.env.META_ACCESS_TOKEN;
  if (!PIXEL || !TOKEN) {
    return res.status(500).json({ erreur: 'META_PIXEL_ID ou META_ACCESS_TOKEN manquant' });
  }

  const {
    event_name = 'Purchase',
    event_id,          // OBLIGATOIRE : le meme que celui du navigateur
    event_source_url,  // l'adresse de la page ou la vente a eu lieu
    client = {},
    valeur = 0,
    devise = 'XAF',
    contenus = [],     // [{ id, quantity, item_price }]
    test_event_code,   // a renseigner UNIQUEMENT pendant les essais
  } = req.body || {};

  if (!event_id) {
    // On refuse plutot que d'envoyer sans identifiant : un evenement sans
    // `event_id` serait compte EN DOUBLE avec celui du navigateur, et fausserait
    // durablement les chiffres.
    return res.status(400).json({ erreur: 'event_id obligatoire (le meme que le navigateur)' });
  }

  const evenement = {
    event_name,
    event_time: Math.floor(Date.now() / 1000),
    event_id: String(event_id),
    action_source: 'website',
    event_source_url,
    user_data: donneesClient(client, req),
    custom_data: {
      value: Number(valeur) || 0,
      currency: devise,
      contents: contenus.map((c) => ({
        id: String(c.id),
        quantity: Number(c.quantity) || 1,
        item_price: Number(c.item_price) || 0,
      })),
      content_type: 'product',
      num_items: contenus.reduce((s, c) => s + (Number(c.quantity) || 1), 0),
    },
  };

  const corps = { data: [evenement] };
  if (test_event_code) corps.test_event_code = test_event_code;

  try {
    const r = await fetch(`${API}/${PIXEL}/events?access_token=${TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corps),
    });
    const reponse = await r.json();
    if (!r.ok) return res.status(502).json({ erreur: 'Meta a refuse', detail: reponse });
    return res.status(200).json({ ok: true, meta: reponse });
  } catch (e) {
    // UNE VENTE VAUT PLUS QU'UNE MESURE. L'appelant doit traiter cet echec
    // comme sans gravite et ne JAMAIS annuler la commande pour autant.
    return res.status(500).json({ erreur: 'Envoi impossible', detail: String(e && e.message) });
  }
}
