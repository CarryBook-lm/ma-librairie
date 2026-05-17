// api/campay.js
// Fonction serverless Vercel : gère collect, check, withdraw + record_purchase + record_subscription + record_carrycare (bypass RLS)
// + record_pending + recover_lost_purchases (système de récupération automatique des achats perdus)

import { createClient } from "@supabase/supabase-js";

// ============================================================
// 🎁 PARRAINAGE : Créditer le parrain au 1er achat du filleul
// Appelé après chaque INSERT purchases / guest_purchases avec referrer_code
// ============================================================
async function creditReferrer({ supabaseAdmin, referrerCode, purchaseId, userId, guestPhone, bookId, amount }) {
  try {
    if (!referrerCode) return { skipped: true, reason: "no_code" };

    // 1) Charger les settings parrainage (% digital/physique, délai anti-fraude)
    const { data: settingsRows } = await supabaseAdmin
      .from("referral_settings")
      .select("*")
      .eq("active", true)
      .order("id", { ascending: true })
      .limit(1);
    const settings = settingsRows && settingsRows[0];
    if (!settings) return { skipped: true, reason: "no_settings" };

    const pctDigital = parseFloat(settings.reward_pct_digital) || 20;
    const pctPhysical = parseFloat(settings.reward_pct_physical) || 10;
    const delayDays = parseInt(settings.fraud_delay_days) || 30;

    // 2) Trouver le parrain par son code
    const code = String(referrerCode).trim().toUpperCase();
    const { data: parrCodeRows } = await supabaseAdmin
      .from("referral_codes")
      .select("user_id, total_earned, pending_amount")
      .eq("code", code)
      .limit(1);
    if (!parrCodeRows || parrCodeRows.length === 0) {
      return { skipped: true, reason: "code_not_found", code };
    }
    const referrerId = parrCodeRows[0].user_id;

    // 3) Anti-auto-parrainage : refuser si le filleul est le parrain
    if (userId && referrerId === userId) {
      return { skipped: true, reason: "self_referral" };
    }

    // 4) Vérifier que c'est bien le PREMIER achat du filleul
    // (pour user connecté : check purchases / pour guest : check guest_purchases par phone)
    let isFirstPurchase = true;
    if (userId) {
      const { data: prev } = await supabaseAdmin
        .from("purchases")
        .select("id")
        .eq("user_id", userId)
        .limit(2);
      // On a inséré purchaseId juste avant. Si il y en a >=2, c'est PAS le premier
      if (prev && prev.length >= 2) isFirstPurchase = false;
    } else if (guestPhone) {
      const { data: prev } = await supabaseAdmin
        .from("guest_purchases")
        .select("id")
        .eq("phone", guestPhone)
        .limit(2);
      if (prev && prev.length >= 2) isFirstPurchase = false;
    }
    if (!isFirstPurchase) {
      return { skipped: true, reason: "not_first_purchase" };
    }

    // 5) Anti-doublon : vérifier qu'aucune entrée referrals n'existe déjà pour ce purchase
    const purchaseRefField = userId ? "first_purchase_id" : "first_guest_purchase_id";
    const { data: existingRef } = await supabaseAdmin
      .from("referrals")
      .select("id")
      .eq(purchaseRefField, purchaseId)
      .limit(1);
    if (existingRef && existingRef.length > 0) {
      return { skipped: true, reason: "already_credited" };
    }

    // 6) Récupérer le product_type du livre pour appliquer le bon %
    let productType = "digital";
    if (bookId) {
      const { data: bookRow } = await supabaseAdmin
        .from("books")
        .select("product_type")
        .eq("id", bookId)
        .single();
      if (bookRow && bookRow.product_type) productType = bookRow.product_type;
    }
    const isPhysical = productType === "article" || productType === "papier";
    const rewardPct = isPhysical ? pctPhysical : pctDigital;
    const rewardAmount = Math.round((amount || 0) * rewardPct / 100);

    if (rewardAmount <= 0) {
      return { skipped: true, reason: "zero_reward" };
    }

    // 7) Insérer dans referrals
    const availableAt = new Date();
    availableAt.setDate(availableAt.getDate() + delayDays);

    const referralPayload = {
      referrer_id: referrerId,
      referrer_code: code,
      reward_amount: rewardAmount,
      reward_pct: rewardPct,
      first_purchase_amount: amount,
      product_type: productType,
      status: "pending",
      available_at: availableAt.toISOString(),
    };
    if (userId) {
      referralPayload.referred_id = userId;
      referralPayload.first_purchase_id = purchaseId;
    } else {
      referralPayload.first_guest_purchase_id = purchaseId;
      referralPayload.referred_guest_phone = guestPhone;
    }

    const { error: refInsertErr } = await supabaseAdmin
      .from("referrals")
      .insert([referralPayload]);

    if (refInsertErr) {
      console.error("[REFERRAL] Insert error:", refInsertErr);
      return { error: refInsertErr.message };
    }

    // 8) Mettre à jour le solde pending du parrain
    const currentTotal = parseInt(parrCodeRows[0].total_earned || 0);
    const currentPending = parseInt(parrCodeRows[0].pending_amount || 0);
    await supabaseAdmin
      .from("referral_codes")
      .update({
        total_earned: currentTotal + rewardAmount,
        pending_amount: currentPending + rewardAmount,
      })
      .eq("user_id", referrerId);

    console.log("[REFERRAL] ✅ Crédité", rewardAmount, "F à", referrerId, "(", rewardPct, "% sur", productType, ")");
    return { success: true, referrerId, rewardAmount, rewardPct, productType };
  } catch (e) {
    console.error("[REFERRAL] Exception:", e);
    return { error: e.message };
  }
}

// ============================================================
// 📧 ENVOI EMAIL DE NOTIFICATION (via Resend)
// Sert pour TOUS les types d'achats :
//   - cart (panier multi-articles)
//   - digital (livre numérique)
//   - paper (livre papier direct)
//   - carrycare (quiz beauté)
// ============================================================
async function sendOrderEmail({ type, order, items, extra }) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "carrybooks.com@gmail.com";

  if (!RESEND_API_KEY) {
    console.warn("[EMAIL] RESEND_API_KEY non configurée — email non envoyé");
    return;
  }

  // Couleurs et icônes selon le type
  const typeConfig = {
    cart: {
      icon: "🛒",
      title: "COMMANDE PANIER",
      gradient: "linear-gradient(135deg, #c9a84c 0%, #b8862d 100%)",
      textColor: "#1a1208",
      needsAction: true
    },
    paper: {
      icon: "📦",
      title: "COMMANDE LIVRE PAPIER",
      gradient: "linear-gradient(135deg, #4f9cf9 0%, #b14fdb 100%)",
      textColor: "#fff",
      needsAction: true
    },
    digital: {
      icon: "📚",
      title: "VENTE LIVRE NUMÉRIQUE",
      gradient: "linear-gradient(135deg, #c9a84c 0%, #8b6f1e 100%)",
      textColor: "#1a1208",
      needsAction: false
    },
    carrycare: {
      icon: "💜",
      title: "VENTE CARRYCARE",
      gradient: "linear-gradient(135deg, #9d4edd 0%, #5a189a 100%)",
      textColor: "#fff",
      needsAction: false
    }
  };

  const config = typeConfig[type] || typeConfig.cart;

  // Construire la section "Articles" (uniquement pour cart)
  let articlesHtml = "";
  if (type === "cart" && items && items.length > 0) {
    const itemsRows = items.map(item => `
      <tr>
        <td style="padding:12px;border-bottom:1px solid #eee;">
          <div style="font-weight:bold;color:#1a1208;">${item.title}</div>
          <div style="font-size:12px;color:#888;margin-top:3px;">
            ${item.product_type === 'papier' ? '📦 Livre papier' : item.product_type === 'article' ? '🛍️ Article divers' : '📚 Livre'}
          </div>
        </td>
        <td style="padding:12px;border-bottom:1px solid #eee;text-align:center;">
          <span style="background:#fff8e1;color:#c9a84c;padding:4px 10px;border-radius:12px;font-weight:bold;">${item.quantity}x</span>
        </td>
        <td style="padding:12px;border-bottom:1px solid #eee;text-align:right;font-weight:bold;color:#1a1208;">
          ${(item.subtotal || item.unit_price * item.quantity).toLocaleString()} F
        </td>
      </tr>
    `).join('');

    articlesHtml = `
      <div style="padding:20px 24px;">
        <div style="font-size:11px;color:#888;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">🛍️ Articles commandés (${items.length})</div>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f5f0e8;">
              <th style="padding:10px;text-align:left;font-size:11px;color:#888;font-weight:600;">PRODUIT</th>
              <th style="padding:10px;text-align:center;font-size:11px;color:#888;font-weight:600;">QTE</th>
              <th style="padding:10px;text-align:right;font-size:11px;color:#888;font-weight:600;">PRIX</th>
            </tr>
          </thead>
          <tbody>${itemsRows}</tbody>
        </table>
        <div style="margin-top:16px;padding-top:14px;border-top:2px solid #f5f0e8;">
          <div style="display:flex;justify-content:space-between;font-size:13px;color:#666;margin-bottom:4px;">
            <span>Sous-total</span>
            <span>${(order.subtotal || 0).toLocaleString()} F</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:13px;color:#666;margin-bottom:8px;">
            <span>Frais de ${order.delivery_method === 'domicile' ? 'livraison' : 'expédition'}</span>
            <span>${(order.shipping_fee || 0).toLocaleString()} F</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:18px;font-weight:bold;color:#c9a84c;border-top:1px solid #eee;padding-top:8px;">
            <span>TOTAL</span>
            <span>${(order.total || order.amount || 0).toLocaleString()} F</span>
          </div>
        </div>
      </div>
    `;
  } else if (extra?.bookTitle) {
    // Pour les achats simples (digital, paper unique, carrycare) : juste afficher le produit
    articlesHtml = `
      <div style="padding:20px 24px;">
        <div style="font-size:11px;color:#888;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">🛍️ Produit</div>
        <div style="background:#f5f0e8;border-radius:8px;padding:14px;">
          <div style="font-size:16px;font-weight:bold;color:#1a1208;">${extra.bookTitle}</div>
          ${extra.bookSubtitle ? `<div style="font-size:12px;color:#666;margin-top:4px;">${extra.bookSubtitle}</div>` : ''}
        </div>
      </div>
    `;
  }

  // Section livraison (uniquement pour cart et paper)
  let livraisonHtml = "";
  if ((type === "cart" || type === "paper") && order.shipping_city) {
    const isDomicile = order.delivery_method === 'domicile';
    const adresseHtml = isDomicile && order.shipping_address
      ? `<div style="margin-top:6px;"><b>Adresse :</b> ${order.shipping_address}</div>`
      : order.shipping_agency
        ? `<div style="margin-top:6px;"><b>Agence :</b> ${order.shipping_agency}</div>`
        : '';
    const notesHtml = order.shipping_notes
      ? `<div style="margin-top:6px;font-style:italic;color:#666;"><b>Note :</b> ${order.shipping_notes}</div>`
      : '';

    livraisonHtml = `
      <div style="padding:20px 24px;border-bottom:1px solid #f5f0e8;">
        <div style="font-size:11px;color:#888;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;">📍 Livraison</div>
        <div style="font-size:15px;color:#1a1208;"><b>Ville :</b> ${order.shipping_city}</div>
        <div style="font-size:13px;color:#666;margin-top:4px;">
          <b>Type :</b> ${isDomicile ? '🏠 Livraison à domicile' : "🏢 Expédition par agence"}
        </div>
        ${adresseHtml}
        ${notesHtml}
      </div>
    `;
  }

  // Section action (bouton appeler) - uniquement si la commande nécessite une action
  let actionHtml = "";
  if (config.needsAction && order.customer_phone) {
    actionHtml = `
      <div style="padding:24px;text-align:center;background:#1a1208;">
        <a href="tel:${order.customer_phone}" style="display:inline-block;background:#c9a84c;color:#1a1208;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;letter-spacing:1px;">
          📞 APPELER LA CLIENTE
        </a>
      </div>
    `;
  }

  // Total
  const totalAmount = order.total || order.amount || 0;

  // Référence affich—e
  const refDisplayed = order.order_reference || order.payment_reference || extra?.reference || "N/A";

  // Nom client
  const clientName = order.customer_name || extra?.customer_name || "Client invité";
  const clientPhone = order.customer_phone || extra?.customer_phone || "Non renseigné";
  const clientEmail = order.customer_email || extra?.customer_email || "";

  const emailHtml = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f5f0e8;">
  <div style="max-width:600px;margin:0 auto;background:#fff;">

    <!-- Header -->
    <div style="background:${config.gradient};color:${config.textColor};padding:24px;text-align:center;">
      <div style="font-size:32px;margin-bottom:6px;">${config.icon}</div>
      <div style="font-size:20px;font-weight:bold;letter-spacing:2px;">${config.title}</div>
      <div style="font-size:13px;opacity:0.85;margin-top:4px;">CarryBooks</div>
    </div>

    <!-- Référence + Total -->
    <div style="padding:24px 24px 12px;border-bottom:2px solid #f0e8d8;">
      <div style="font-size:13px;color:#888;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">Référence</div>
      <div style="font-size:18px;font-weight:bold;color:#1a1208;font-family:monospace;margin-bottom:14px;">${refDisplayed}</div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;">
        <div>
          <div style="font-size:12px;color:#888;">${config.needsAction ? 'TOTAL À ENCAISSER' : 'MONTANT REÇU'}</div>
          <div style="font-size:28px;font-weight:bold;color:#c9a84c;">${totalAmount.toLocaleString()} F</div>
        </div>
        <div style="text-align:right;">
          <div style="background:#d4edda;color:#155724;padding:6px 14px;border-radius:14px;font-weight:bold;font-size:13px;">✅ Payé</div>
        </div>
      </div>
    </div>

    <!-- Client -->
    <div style="padding:20px 24px;border-bottom:1px solid #f5f0e8;">
      <div style="font-size:11px;color:#888;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;">👤 Client</div>
      <div style="font-size:17px;font-weight:bold;color:#1a1208;margin-bottom:6px;">${clientName}</div>
      <div style="font-size:14px;color:#444;">
        <a href="tel:${clientPhone}" style="color:#c9a84c;text-decoration:none;">📞 ${clientPhone}</a>
      </div>
      ${clientEmail ? `<div style="font-size:13px;color:#666;margin-top:4px;">📧 ${clientEmail}</div>` : ''}
    </div>

    ${livraisonHtml}
    ${articlesHtml}

    <!-- Paiement -->
    <div style="padding:20px 24px;background:#fafaf5;border-top:1px solid #f5f0e8;">
      <div style="font-size:11px;color:#888;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">💳 Paiement</div>
      <div style="font-size:14px;color:#1a1208;"><b>Méthode :</b> ${(order.payment_method || extra?.payment_method || 'MTN').toUpperCase().replace('_',' ')}</div>
      <div style="font-size:12px;color:#666;margin-top:4px;"><b>Réf. CamPay :</b> ${order.payment_reference || extra?.reference || 'N/A'}</div>
    </div>

    ${actionHtml}

    <!-- Footer -->
    <div style="padding:14px;text-align:center;background:#0f0a04;color:#888;font-size:11px;">
      CarryBooks — Notification automatique
    </div>

  </div>
</body>
</html>
  `.trim();

  // Sujet unique selon le type
  const typePrefix = {
    cart: "🛒",
    paper: "📦",
    digital: "📚",
    carrycare: "💜"
  };
  const subject = `${typePrefix[type] || "🛒"} ${refDisplayed} — ${clientName} — ${totalAmount.toLocaleString()} F`;

  // Appel API Resend (avec encoding UTF-8 explicite pour les accents français)
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + RESEND_API_KEY,
      "Content-Type": "application/json; charset=utf-8",
      "Accept-Charset": "utf-8"
    },
    body: JSON.stringify({
      from: "CarryBooks <onboarding@resend.dev>",
      to: ADMIN_EMAIL,
      subject: subject,
      html: emailHtml,
      headers: {
        "Content-Type": "text/html; charset=utf-8"
      }
    })
  });

  const data = await response.json();
  if (!response.ok) {
    console.error("[EMAIL] Erreur Resend:", data);
    throw new Error("Resend error: " + JSON.stringify(data));
  }

  console.log("[EMAIL] ✅ Email envoyé:", data.id, "type:", type, "—", ADMIN_EMAIL);
  return data;
}

// Ancien wrapper pour compatibilit—
async function sendCartOrderEmail(order, items) {
  return sendOrderEmail({ type: "cart", order, items });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const CAMPAY_TOKEN = process.env.CAMPAY_TOKEN;
  if (!CAMPAY_TOKEN) {
    return res.status(500).json({ error: "Token CamPay manquant" });
  }

  const { action, ...params } = req.body;

  try {
    // ========== ACTION : COLLECT ==========
    if (action === "collect") {
      const response = await fetch("https://www.campay.net/api/collect/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Token " + CAMPAY_TOKEN,
        },
        body: JSON.stringify({
          amount: String(params.amount),
          currency: "XAF",
          from: params.phone,
          description: params.description,
          external_reference: params.external_reference,
        }),
      });
      const data = await response.json();
      return res.status(response.status).json(data);
    }

    // ========== ACTION : CHECK / STATUS ==========
    // Accepte les deux noms (check pour ancienne compat, status pour nouveau)
    if (action === "check" || action === "status") {
      const checkUrl = `https://www.campay.net/api/transaction/${params.reference}/`;
      const checkRes = await fetch(checkUrl, {
        headers: { Authorization: "Token " + CAMPAY_TOKEN },
      });
      const checkData = await checkRes.json();
      return res.status(200).json(checkData);
    }

    // ========== ACTION : WITHDRAW ==========
    if (action === "withdraw") {
      const response = await fetch("https://www.campay.net/api/withdraw/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Token " + CAMPAY_TOKEN,
        },
        body: JSON.stringify({
          amount: String(params.amount),
          currency: "XAF",
          to: params.phone,
          description: params.description,
          external_reference: params.external_reference,
        }),
      });
      const data = await response.json();
      return res.status(response.status).json(data);
    }

    // ========== ACTION : RECORD_PURCHASE ==========
    if (action === "record_purchase") {
      const { reference, user_id, book_id, amount, phone, external_reference, referrer_code } = params;

      const verifyUrl = `https://www.campay.net/api/transaction/${reference}/`;
      const verifyRes = await fetch(verifyUrl, {
        headers: { Authorization: "Token " + CAMPAY_TOKEN },
      });
      const verifyData = await verifyRes.json();

      if (verifyData.status !== "SUCCESSFUL") {
        return res.status(400).json({
          error: "Paiement non confirmé par CamPay",
          status: verifyData.status,
        });
      }

      const supabaseAdmin = createClient(
        process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );

      const { data: existing } = await supabaseAdmin
        .from("purchases")
        .select("id")
        .eq("external_reference", external_reference)
        .limit(1);

      if (existing && existing.length > 0) {
        return res.status(200).json({
          success: true,
          message: "Achat déjà enregistré",
          purchase_id: existing[0].id,
          duplicate: true,
        });
      }

      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("purchases")
        .insert([
          {
            user_id,
            book_id,
            amount,
            phone,
            external_reference,
            type: "sale",
            referrer_code: referrer_code || null,
          },
        ])
        .select();

      if (insertError) {
        console.error("[RECORD_PURCHASE] Insert error:", insertError);
        return res.status(500).json({
          error: "Erreur enregistrement achat",
          details: insertError.message,
        });
      }

      // 🎁 PARRAINAGE : créditer le parrain si code valide
      if (referrer_code && inserted && inserted[0]) {
        const refResult = await creditReferrer({
          supabaseAdmin,
          referrerCode: referrer_code,
          purchaseId: inserted[0].id,
          userId: user_id,
          guestPhone: null,
          bookId: book_id,
          amount: amount,
        });
        console.log("[RECORD_PURCHASE] Referral result:", refResult);
      }

      // 🔥 Marquer le pending comme completed si existait
      try {
        await supabaseAdmin
          .from("pending_purchases")
          .update({ status: "completed", recovered_at: new Date().toISOString() })
          .eq("reference", reference);
      } catch (e) { /* silent fail */ }

      // 📧 ENVOI EMAIL DE NOTIFICATION (non bloquant)
      try {
        // Récupérer le titre du livre
        const { data: bookData } = await supabaseAdmin
          .from("books")
          .select("title, category")
          .eq("id", book_id)
          .single();

        await sendOrderEmail({
          type: "digital",
          order: {
            order_reference: external_reference,
            customer_name: "Client " + (phone || "inconnu"),
            customer_phone: phone || "Non renseigné",
            customer_email: "",
            amount: amount,
            total: amount,
            payment_reference: reference,
            payment_method: "MTN/Orange"
          },
          extra: {
            bookTitle: bookData?.title || "Livre numérique",
            bookSubtitle: bookData?.category || ""
          }
        });
      } catch (emailErr) {
        console.error("[RECORD_PURCHASE] Email error (non bloquant):", emailErr);
      }

      return res.status(200).json({
        success: true,
        purchase: inserted[0],
      });
    }

    // ========== ACTION : RECORD_SUBSCRIPTION ==========
    if (action === "record_subscription") {
      const {
        reference,
        user_id,
        plan,
        books_per_month,
        price,
        external_reference,
      } = params;

      const verifyUrl = `https://www.campay.net/api/transaction/${reference}/`;
      const verifyRes = await fetch(verifyUrl, {
        headers: { Authorization: "Token " + CAMPAY_TOKEN },
      });
      const verifyData = await verifyRes.json();

      if (verifyData.status !== "SUCCESSFUL") {
        return res.status(400).json({
          error: "Paiement non confirmé par CamPay",
          status: verifyData.status,
        });
      }

      const supabaseAdmin = createClient(
        process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );

      const { data: existing } = await supabaseAdmin
        .from("subscriptions")
        .select("id")
        .eq("user_id", user_id)
        .eq("status", "actif")
        .gte("started_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
        .limit(1);

      if (existing && existing.length > 0) {
        return res.status(200).json({
          success: true,
          message: "Abonnement déjà enregistré",
          subscription_id: existing[0].id,
          duplicate: true,
        });
      }

      const now = new Date();
      const expires = new Date(now);
      if (plan === "mensuel") expires.setMonth(expires.getMonth() + 1);
      else expires.setFullYear(expires.getFullYear() + 1);

      await supabaseAdmin
        .from("subscriptions")
        .update({ status: "expire" })
        .eq("user_id", user_id)
        .eq("status", "actif");

      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("subscriptions")
        .insert([
          {
            user_id,
            plan,
            books_per_month,
            books_used: 0,
            price,
            started_at: now.toISOString(),
            expires_at: expires.toISOString(),
            status: "actif",
          },
        ])
        .select()
        .single();

      if (insertError) {
        console.error("[RECORD_SUBSCRIPTION] Insert error:", insertError);
        return res.status(500).json({
          error: "Erreur enregistrement abonnement",
          details: insertError.message,
        });
      }

      // 🔥 Marquer le pending comme completed si existait
      try {
        await supabaseAdmin
          .from("pending_purchases")
          .update({ status: "completed", recovered_at: new Date().toISOString() })
          .eq("reference", reference);
      } catch (e) { /* silent fail */ }

      return res.status(200).json({
        success: true,
        subscription: inserted,
      });
    }

    // ========== ACTION : RECORD_CARRYCARE ==========
    // Enregistre un paiement CarryCare (diagnostic) dans Supabase APRÈS vérification CamPay
    if (action === "record_carrycare") {
      const {
        reference,
        external_reference,
        quiz_type,
        amount,
        phone,
        result_data,
      } = params;

      // 1. VÉRIFIER auprès de CamPay
      const verifyUrl = `https://www.campay.net/api/transaction/${reference}/`;
      const verifyRes = await fetch(verifyUrl, {
        headers: { Authorization: "Token " + CAMPAY_TOKEN },
      });
      const verifyData = await verifyRes.json();

      if (verifyData.status !== "SUCCESSFUL") {
        return res.status(400).json({
          error: "Paiement non confirmé par CamPay",
          status: verifyData.status,
        });
      }

      // 2. Supabase admin
      const supabaseAdmin = createClient(
        process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );

      // 3. Idempotence : si déjà enregistré, retourner
      const { data: existing } = await supabaseAdmin
        .from("carrycare_results")
        .select("id")
        .eq("external_reference", external_reference)
        .limit(1);

      if (existing && existing.length > 0) {
        return res.status(200).json({
          success: true,
          message: "Diagnostic déjà enregistré",
          result_id: existing[0].id,
          duplicate: true,
        });
      }

      // 4. INSERT dans carrycare_results
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("carrycare_results")
        .insert([
          {
            external_reference,
            quiz_type: quiz_type || "body",
            amount,
            phone,
            result_data,
          },
        ])
        .select()
        .single();

      if (insertError) {
        console.error("[RECORD_CARRYCARE] Insert error:", insertError);
        // On retourne quand même success pour ne pas bloquer le client
        // (le résultat est en local dans le state, l'utilisateur pourra le voir)
        return res.status(200).json({
          success: true,
          warning: "Erreur enregistrement BD mais paiement OK",
          details: insertError.message,
        });
      }

      // 🔥 Marquer le pending comme completed si existait
      try {
        await supabaseAdmin
          .from("pending_purchases")
          .update({ status: "completed", recovered_at: new Date().toISOString() })
          .eq("reference", reference);
      } catch (e) { /* silent fail */ }

      // 📧 ENVOI EMAIL DE NOTIFICATION (non bloquant)
      try {
        const quizLabels = {
          body: "Diagnostic Corps",
          facial: "Diagnostic Visage",
          ligne: "Garde la Ligne",
          capillaire: "Diagnostic Capillaire"
        };
        await sendOrderEmail({
          type: "carrycare",
          order: {
            order_reference: external_reference,
            customer_name: result_data?.name || result_data?.firstname || "Cliente",
            customer_phone: phone || "Non renseigné",
            customer_email: result_data?.email || "",
            amount: amount,
            total: amount,
            payment_reference: reference,
            payment_method: "MTN/Orange"
          },
          extra: {
            bookTitle: `💜 ${quizLabels[quiz_type] || quiz_type || "CarryCare"}`,
            bookSubtitle: "Diagnostic personnalis— CarryCare"
          }
        });
      } catch (emailErr) {
        console.error("[RECORD_CARRYCARE] Email error (non bloquant):", emailErr);
      }

      return res.status(200).json({
        success: true,
        result: inserted,
      });
    }

    // ========== 🔥 ACTION : RECORD_PENDING ==========
    // Enregistre l'INTENTION d'achat AVANT confirmation CamPay
    // Permet de récupérer les achats perdus si la connexion coupe
    if (action === "record_pending") {
      const {
        reference,
        user_id,
        type, // 'book', 'subscription', 'quiz'
        book_id,
        amount,
        phone,
        metadata,
      } = params;

      // Validation : user_id obligatoire (sinon impossible de récupérer)
      if (!user_id || !reference || !type || !amount) {
        return res.status(400).json({
          error: "Paramètres manquants pour record_pending",
        });
      }

      const supabaseAdmin = createClient(
        process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );

      // Insert pending (UPSERT pour éviter les doublons si rappel)
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("pending_purchases")
        .upsert(
          [
            {
              user_id,
              reference,
              type,
              book_id: book_id || null,
              amount,
              phone: phone || null,
              status: "pending",
              metadata: metadata || null,
            },
          ],
          { onConflict: "reference" }
        )
        .select()
        .single();

      if (insertError) {
        console.error("[RECORD_PENDING] Insert error:", insertError);
        // ⚠️ ON NE BLOQUE PAS LE PAIEMENT si le pending échoue
        // Le paiement doit pouvoir continuer même si on n'a pas pu sauvegarder l'intention
        return res.status(200).json({
          success: false,
          warning: "Pending non enregistré mais paiement peut continuer",
          details: insertError.message,
        });
      }

      return res.status(200).json({
        success: true,
        pending: inserted,
      });
    }

    // ========== 🔥 ACTION : RECOVER_LOST_PURCHASES ==========
    // Vérifie tous les pending d'un user et récupère les achats perdus
    // Appelée au chargement de la bibliothèque du client
    if (action === "recover_lost_purchases") {
      const { user_id } = params;

      if (!user_id) {
        return res.status(400).json({ error: "user_id manquant" });
      }

      const supabaseAdmin = createClient(
        process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );

      // 1. Récupérer tous les pending de moins de 7 jours (limite raisonnable)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: pendings, error: pendingError } = await supabaseAdmin
        .from("pending_purchases")
        .select("*")
        .eq("user_id", user_id)
        .eq("status", "pending")
        .gte("created_at", sevenDaysAgo);

      if (pendingError) {
        console.error("[RECOVER] Error fetching pendings:", pendingError);
        return res.status(200).json({ recovered: [], errors: [] });
      }

      if (!pendings || pendings.length === 0) {
        return res.status(200).json({ recovered: [], message: "Aucun achat en attente" });
      }

      const recovered = [];
      const errors = [];

      // 2. Pour chaque pending, vérifier CamPay
      for (const pending of pendings) {
        try {
          const verifyUrl = `https://www.campay.net/api/transaction/${pending.reference}/`;
          const verifyRes = await fetch(verifyUrl, {
            headers: { Authorization: "Token " + CAMPAY_TOKEN },
          });
          const verifyData = await verifyRes.json();

          if (verifyData.status === "SUCCESSFUL") {
            // 🎯 PAIEMENT RÉUSSI MAIS PAS LIVRÉ → on récupère

            if (pending.type === "book") {
              // Vérifier si pas déjà dans purchases
              const { data: existingPurchase } = await supabaseAdmin
                .from("purchases")
                .select("id")
                .eq("user_id", user_id)
                .eq("book_id", pending.book_id)
                .limit(1);

              if (existingPurchase && existingPurchase.length > 0) {
                // Déjà acheté, on marque juste le pending
                await supabaseAdmin
                  .from("pending_purchases")
                  .update({ status: "completed", recovered_at: new Date().toISOString() })
                  .eq("id", pending.id);
                continue;
              }

              // Insérer dans purchases
              const { data: newPurchase, error: insertErr } = await supabaseAdmin
                .from("purchases")
                .insert([
                  {
                    user_id: pending.user_id,
                    book_id: pending.book_id,
                    amount: pending.amount,
                    phone: pending.phone,
                    external_reference: "RECOVERED_" + pending.reference,
                    type: "sale",
                  },
                ])
                .select()
                .single();

              if (insertErr) {
                errors.push({ reference: pending.reference, error: insertErr.message });
                continue;
              }

              // Marquer comme recovered
              await supabaseAdmin
                .from("pending_purchases")
                .update({ status: "recovered", recovered_at: new Date().toISOString() })
                .eq("id", pending.id);

              recovered.push({
                type: "book",
                book_id: pending.book_id,
                amount: pending.amount,
                reference: pending.reference,
              });
            } else if (pending.type === "subscription") {
              // Pour les abonnements, on note mais on demande au client de re-confirmer
              // (car les abonnements ont des règles plus complexes)
              await supabaseAdmin
                .from("pending_purchases")
                .update({ status: "recovered", recovered_at: new Date().toISOString() })
                .eq("id", pending.id);

              recovered.push({
                type: "subscription",
                reference: pending.reference,
                metadata: pending.metadata,
                requires_action: true,
              });
            } else if (pending.type === "quiz") {
              // Pour les quiz, on note mais le client doit refaire le quiz pour recevoir les résultats
              await supabaseAdmin
                .from("pending_purchases")
                .update({ status: "recovered", recovered_at: new Date().toISOString() })
                .eq("id", pending.id);

              recovered.push({
                type: "quiz",
                reference: pending.reference,
                metadata: pending.metadata,
              });
            }
          } else if (verifyData.status === "FAILED") {
            // Paiement échoué, on marque comme failed
            await supabaseAdmin
              .from("pending_purchases")
              .update({ status: "failed" })
              .eq("id", pending.id);
          }
          // Si PENDING dans CamPay, on laisse tel quel (on revérifiera plus tard)
        } catch (err) {
          console.error("[RECOVER] Error checking", pending.reference, err);
          errors.push({ reference: pending.reference, error: err.message });
        }
      }

      return res.status(200).json({
        success: true,
        recovered,
        errors,
        checked: pendings.length,
      });
    }

    // ========== 🆕 ACTION : RECORD_GUEST_PURCHASE ==========
    // Enregistre un achat fait SANS connexion (mode invité)
    // Stocké avec le numéro de téléphone comme identifiant
    // Permettra plus tard de récupérer les livres si le client crée un compte
    if (action === "record_guest_purchase") {
      const { phone, book_id, amount, reference, external_reference, type, referrer_code } = params;

      if (!phone || !reference) {
        return res.status(400).json({ error: "phone et reference requis" });
      }

      const supabaseAdmin = createClient(
        process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );

      // Normaliser le téléphone (enlever espaces, garder + et chiffres)
      const normalizedPhone = String(phone).replace(/\s+/g, "").trim();

      // Vérifier si déjà enregistré (idempotence)
      const { data: existing } = await supabaseAdmin
        .from("guest_purchases")
        .select("id")
        .eq("reference", reference)
        .limit(1);

      if (existing && existing.length > 0) {
        return res.status(200).json({ success: true, message: "Déjà enregistré", id: existing[0].id });
      }

      // Insérer le nouvel achat invité
      const { data, error } = await supabaseAdmin
        .from("guest_purchases")
        .insert([{
          phone: normalizedPhone,
          book_id: book_id || null,
          amount: amount || 0,
          reference: reference,
          external_reference: external_reference || null,
          type: type || "book",
          referrer_code: referrer_code || null,
        }])
        .select()
        .single();

      if (error) {
        console.error("[GUEST_PURCHASE] Erreur insert:", error);
        // 🛡️ On retourne SUCCESS quand même pour ne pas casser le flow de paiement
        // L'achat est déjà dans CamPay + localStorage du client
        return res.status(200).json({ success: false, error: error.message, non_blocking: true });
      }

      // 🎁 PARRAINAGE : créditer le parrain si code valide
      if (referrer_code && data) {
        const refResult = await creditReferrer({
          supabaseAdmin,
          referrerCode: referrer_code,
          purchaseId: data.id,
          userId: null,
          guestPhone: normalizedPhone,
          bookId: book_id,
          amount: amount,
        });
        console.log("[GUEST_PURCHASE] Referral result:", refResult);
      }

      // 📧 ENVOI EMAIL DE NOTIFICATION (non bloquant)
      try {
        // R�cup�rer le titre du livre
        const { data: bookData } = await supabaseAdmin
          .from("books")
          .select("title, category")
          .eq("id", book_id)
          .single();

        await sendOrderEmail({
          type: "digital",
          order: {
            order_reference: external_reference || reference,
            customer_name: "Client invité " + normalizedPhone,
            customer_phone: normalizedPhone,
            customer_email: "",
            amount: amount,
            total: amount,
            payment_reference: reference,
            payment_method: "MTN/Orange"
          },
          extra: {
            bookTitle: bookData?.title || "Livre numérique",
            bookSubtitle: (bookData?.category || "") + " — Achat invité"
          }
        });
      } catch (emailErr) {
        console.error("[GUEST_PURCHASE] Email error (non bloquant):", emailErr);
      }

      return res.status(200).json({ success: true, id: data.id });
    }

    // ========== 🆕 ACTION : RECOVER_GUEST_PURCHASES ==========
    // Quand un client crée un compte ou se connecte, il peut entrer son
    // numéro de téléphone pour récupérer ses achats invités précédents
    if (action === "recover_guest_purchases") {
      const { user_id, phone } = params;

      if (!user_id || !phone) {
        return res.status(400).json({ error: "user_id et phone requis" });
      }

      const supabaseAdmin = createClient(
        process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );

      const normalizedPhone = String(phone).replace(/\s+/g, "").trim();

      // 🎯 Générer toutes les variantes possibles du numéro pour matcher
      // Cameroun : numéro local 6XX XXX XXX OU avec préfixe 237 ou +237
      const phoneCandidates = new Set();
      phoneCandidates.add(normalizedPhone);

      // Enlever + en début si présent
      const noPlus = normalizedPhone.replace(/^\+/, "");
      phoneCandidates.add(noPlus);

      // Enlever 237 en début si présent
      if (noPlus.startsWith("237")) {
        phoneCandidates.add(noPlus.substring(3));
      }

      // Ajouter 237 en début si pas présent (et longueur correspond à un numéro local)
      if (!noPlus.startsWith("237") && noPlus.length >= 8 && noPlus.length <= 10) {
        phoneCandidates.add("237" + noPlus);
        phoneCandidates.add("+237" + noPlus);
      }

      // Convertir en array pour la requête
      const phoneArray = Array.from(phoneCandidates);

      // 🔍 LOG DEBUG pour identifier le problème
      console.log("[RECOVER_GUEST] Input phone:", phone);
      console.log("[RECOVER_GUEST] Normalized:", normalizedPhone);
      console.log("[RECOVER_GUEST] Candidates:", phoneArray);
      console.log("[RECOVER_GUEST] User ID:", user_id);

      // 1. Chercher tous les achats invités NON encore récupérés avec n'importe quel format
      const { data: guestPurchases, error: fetchError } = await supabaseAdmin
        .from("guest_purchases")
        .select("*")
        .in("phone", phoneArray)
        .is("recovered_by_user_id", null);

      // 🔍 LOG DEBUG
      console.log("[RECOVER_GUEST] Found:", guestPurchases?.length || 0, "purchases");
      console.log("[RECOVER_GUEST] Error:", fetchError);

      if (fetchError) {
        console.error("[RECOVER_GUEST] Error:", fetchError);
        return res.status(200).json({ recovered: [], error: fetchError.message });
      }

      if (!guestPurchases || guestPurchases.length === 0) {
        return res.status(200).json({ recovered: [], message: "Aucun achat trouvé pour ce numéro" });
      }

      const recovered = [];
      const errors = [];

      // 2. Pour chaque achat invité, créer une entrée dans 'purchases'
      for (const gp of guestPurchases) {
        try {
          if (gp.type === "book" && gp.book_id) {
            // Vérifier si l'utilisateur a déjà ce livre
            const { data: existing } = await supabaseAdmin
              .from("purchases")
              .select("id")
              .eq("user_id", user_id)
              .eq("book_id", gp.book_id)
              .limit(1);

            if (!existing || existing.length === 0) {
              // Ajouter à purchases (sans reference/external_reference qui n'existent pas dans la table actuelle)
              const { error: insertError } = await supabaseAdmin
                .from("purchases")
                .insert([{
                  user_id: user_id,
                  book_id: gp.book_id,
                  amount: gp.amount || 0,
                }]);

              if (insertError) {
                errors.push({ ref: gp.reference, error: insertError.message });
                continue;
              }
            }

            recovered.push({ book_id: gp.book_id, reference: gp.reference });
          }

          // Marquer comme récupéré
          await supabaseAdmin
            .from("guest_purchases")
            .update({
              recovered_by_user_id: user_id,
              recovered_at: new Date().toISOString(),
            })
            .eq("id", gp.id);

        } catch (err) {
          errors.push({ ref: gp.reference, error: err.message });
        }
      }

      return res.status(200).json({
        success: true,
        recovered,
        errors,
        total: guestPurchases.length,
      });
    }

    // ========== ACTION : RECORD_PAPER_ORDER (Module POD) ==========
    if (action === "record_paper_order") {
      const {
        reference,
        order_data,
        external_reference
      } = params;

      // 1) Vérifier que le paiement est bien confirmé par CamPay
      const verifyUrl = `https://www.campay.net/api/transaction/${reference}/`;
      const verifyRes = await fetch(verifyUrl, {
        headers: { Authorization: "Token " + CAMPAY_TOKEN },
      });
      const verifyData = await verifyRes.json();

      if (verifyData.status !== "SUCCESSFUL") {
        return res.status(400).json({
          error: "Paiement non confirmé par CamPay",
          status: verifyData.status,
        });
      }

      const supabaseAdmin = createClient(
        process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );

      // 2) Vérifier qu'on n'a pas déjà enregistré cette commande (anti-doublon)
      if (order_data && order_data.order_ref) {
        const { data: existing } = await supabaseAdmin
          .from("paper_orders")
          .select("id, order_ref")
          .eq("order_ref", order_data.order_ref)
          .limit(1);

        if (existing && existing.length > 0) {
          return res.status(200).json({
            success: true,
            message: "Commande déjà enregistrée",
            order_id: existing[0].id,
            order_ref: existing[0].order_ref,
            duplicate: true,
          });
        }
      }

      // 3) Insérer la commande avec statut "paye"
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("paper_orders")
        .insert([{
          order_ref: order_data.order_ref,
          user_id: order_data.user_id || null,
          guest_email: order_data.guest_email || null,
          items: order_data.items || [],
          subtotal: order_data.subtotal || 0,
          shipping_fee: order_data.shipping_fee || 0,
          discount: order_data.discount || 0,
          total_amount: order_data.total_amount || 0,
          customer_name: order_data.customer_name,
          customer_phone: order_data.customer_phone,
          customer_email: order_data.customer_email || null,
          shipping_city: order_data.shipping_city,
          shipping_zone_id: order_data.shipping_zone_id || null,
          shipping_address: order_data.shipping_address || null,
          shipping_agency: order_data.shipping_agency || null,
          shipping_notes: order_data.shipping_notes || null,
          status: "paye",
          payment_method: order_data.payment_method,
          payment_reference: reference,
          paid_at: new Date().toISOString(),
        }])
        .select();

      if (insertError) {
        console.error("[RECORD_PAPER_ORDER] Insert error:", insertError);
        return res.status(500).json({
          error: "Erreur enregistrement commande papier",
          details: insertError.message,
        });
      }

      // 📧 ENVOI EMAIL DE NOTIFICATION (non bloquant)
      try {
        const orderForEmail = inserted[0];
        // Items du paper_order sont stock—s en JSONB
        const items = Array.isArray(orderForEmail.items) ? orderForEmail.items : [];
        await sendOrderEmail({
          type: "paper",
          order: {
            order_reference: orderForEmail.order_ref,
            customer_name: orderForEmail.customer_name,
            customer_phone: orderForEmail.customer_phone,
            customer_email: orderForEmail.customer_email,
            shipping_city: orderForEmail.shipping_city,
            shipping_address: orderForEmail.shipping_address,
            shipping_agency: orderForEmail.shipping_agency,
            shipping_notes: orderForEmail.shipping_notes,
            delivery_method: orderForEmail.delivery_method || 'agence',
            subtotal: orderForEmail.subtotal || 0,
            shipping_fee: orderForEmail.shipping_fee || 0,
            total: orderForEmail.total_amount || 0,
            payment_method: order_data.payment_method || "MTN/Orange",
            payment_reference: reference
          },
          extra: {
            bookTitle: items.length > 0 ? items.map(i => `${i.quantity || 1}x ${i.title || 'Livre'}`).join(', ') : "Livre papier",
            bookSubtitle: `${items.length} article(s)`
          }
        });
      } catch (emailErr) {
        console.error("[RECORD_PAPER_ORDER] Email error (non bloquant):", emailErr);
      }

      return res.status(200).json({
        success: true,
        order: inserted[0],
      });
    }

    // ========== ACTION : RECORD_CART_ORDER (Module Panier) ==========
    if (action === "record_cart_order") {
      const {
        reference,
        order_data,
        external_reference
      } = params;

      // 1) V—rifier que le paiement est bien confirm— par CamPay
      const verifyUrl = `https://www.campay.net/api/transaction/${reference}/`;
      const verifyRes = await fetch(verifyUrl, {
        headers: { Authorization: "Token " + CAMPAY_TOKEN },
      });
      const verifyData = await verifyRes.json();

      if (verifyData.status !== "SUCCESSFUL") {
        return res.status(400).json({
          error: "Paiement non confirmé par CamPay",
          status: verifyData.status,
        });
      }

      const supabaseAdmin = createClient(
        process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );

      // 2) V—rifier qu'on n'a pas d—j— enregistr— cette commande (anti-doublon)
      if (order_data && order_data.order_reference) {
        const { data: existing } = await supabaseAdmin
          .from("cart_orders")
          .select("id, order_reference")
          .eq("order_reference", order_data.order_reference)
          .limit(1);

        if (existing && existing.length > 0) {
          return res.status(200).json({
            success: true,
            message: "Commande déjà enregistrée",
            order_id: existing[0].id,
            order_reference: existing[0].order_reference,
            duplicate: true,
          });
        }
      }

      // 3) Ins—rer la commande dans cart_orders
      const { data: insertedOrder, error: insertOrderError } = await supabaseAdmin
        .from("cart_orders")
        .insert([{
          order_reference: order_data.order_reference,
          user_id: order_data.user_id || null,
          customer_name: order_data.customer_name,
          customer_phone: order_data.customer_phone,
          customer_email: order_data.customer_email || null,
          shipping_zone_id: order_data.shipping_zone_id || null,
          shipping_city: order_data.shipping_city,
          shipping_address: order_data.shipping_address || null,
          shipping_agency: order_data.shipping_agency || null,
          shipping_notes: order_data.shipping_notes || null,
          shipping_fee: order_data.shipping_fee || 0,
          delivery_method: order_data.delivery_method || "agence",
          subtotal: order_data.subtotal || 0,
          total: order_data.total || 0,
          payment_method: order_data.payment_method,
          payment_phone: order_data.payment_phone || null,
          payment_status: "paid",
          payment_reference: reference,
          payment_paid_at: new Date().toISOString(),
          status: "confirmed"
        }])
        .select()
        .single();

      if (insertOrderError) {
        console.error("[RECORD_CART_ORDER] Insert order error:", insertOrderError);
        return res.status(500).json({
          error: "Erreur enregistrement commande panier",
          details: insertOrderError.message,
        });
      }

      // 4) Ins—rer les items de la commande
      if (order_data.items && Array.isArray(order_data.items) && order_data.items.length > 0) {
        const itemsPayload = order_data.items.map(item => ({
          order_id: insertedOrder.id,
          book_id: item.book_id,
          product_type: item.product_type,
          title: item.title,
          cover: item.cover || null,
          unit_price: item.unit_price,
          quantity: item.quantity,
          subtotal: item.subtotal || (item.unit_price * item.quantity)
        }));

        const { error: insertItemsError } = await supabaseAdmin
          .from("cart_order_items")
          .insert(itemsPayload);

        if (insertItemsError) {
          console.error("[RECORD_CART_ORDER] Insert items error:", insertItemsError);
          // Items pas inser—s mais commande oui : on alerte mais on continue
          return res.status(500).json({
            error: "Commande enregistrée mais erreur sur les articles",
            details: insertItemsError.message,
            order_id: insertedOrder.id
          });
        }
      }

      // 5) D—cr—menter le stock via la fonction SQL
      try {
        await supabaseAdmin.rpc("decrement_stock_for_order", { p_order_id: insertedOrder.id });
      } catch (e) {
        console.error("[RECORD_CART_ORDER] Stock decrement error:", e);
        // Non bloquant
      }

      // 6) 📧 ENVOI EMAIL DE NOTIFICATION (via Resend)
      try {
        await sendCartOrderEmail(insertedOrder, order_data.items || []);
      } catch (emailErr) {
        console.error("[RECORD_CART_ORDER] Email send error (non bloquant):", emailErr);
        // Non bloquant : la commande reste valide m—me si l'email —choue
      }

      return res.status(200).json({
        success: true,
        order: insertedOrder,
      });
    }

    // ========== ACTION : SEND_CARRYCARE_EMAIL (notification admin uniquement) ==========
    if (action === "send_carrycare_email") {
      const { quiz_type, amount, phone, result_data } = params;
      try {
        const quizLabels = {
          body: "Diagnostic Corps",
          facial: "Diagnostic Visage",
          ligne: "Garde la Ligne",
          capillaire: "Diagnostic Capillaire"
        };
        await sendOrderEmail({
          type: "carrycare",
          order: {
            order_reference: "CC-" + Date.now(),
            customer_name: result_data?.name || result_data?.firstname || "Cliente CarryCare",
            customer_phone: phone || "Non renseigné",
            customer_email: result_data?.email || "",
            amount: amount || 0,
            total: amount || 0,
            payment_reference: "carrycare_" + Date.now(),
            payment_method: "MTN/Orange"
          },
          extra: {
            bookTitle: "💜 " + (quizLabels[quiz_type] || quiz_type || "CarryCare"),
            bookSubtitle: "Diagnostic personnalisé CarryCare"
          }
        });
        return res.status(200).json({ success: true });
      } catch (emailErr) {
        console.error("[SEND_CARRYCARE_EMAIL]", emailErr);
        return res.status(500).json({ error: emailErr.message });
      }
    }

    return res.status(400).json({ error: "Action inconnue" });
  } catch (err) {
    console.error("Erreur CamPay:", err);
    return res.status(500).json({ error: err.message });
  }
}
