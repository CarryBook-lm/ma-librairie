// api/campay.js
// Fonction serverless Vercel : gère collect, check, withdraw + record_purchase + record_subscription (bypass RLS)

import { createClient } from "@supabase/supabase-js";

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

    // ========== ACTION : CHECK ==========
    if (action === "check") {
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
    // Enregistre un achat de livre dans Supabase APRÈS vérification du paiement CamPay
    // Utilise service_role pour bypass RLS — GARANTIT l'INSERT
    if (action === "record_purchase") {
      const { reference, user_id, book_id, amount, phone, external_reference } = params;

      // 1. VÉRIFIER auprès de CamPay que le paiement est bien SUCCESSFUL
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

      // 2. Créer un client Supabase avec service_role (bypass RLS)
      const supabaseAdmin = createClient(
        process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );

      // 3. Vérifier si l'achat n'existe pas déjà (idempotence)
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

      // 4. INSERT dans purchases avec service_role
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

      return res.status(200).json({
        success: true,
        purchase: inserted[0],
      });
    }

    // ========== ACTION : RECORD_SUBSCRIPTION ==========
    // Enregistre un abonnement dans Supabase APRÈS vérification du paiement CamPay
    // Utilise service_role pour bypass RLS — GARANTIT l'INSERT
    if (action === "record_subscription") {
      const {
        reference,
        user_id,
        plan,
        books_per_month,
        price,
        external_reference,
      } = params;

      // 1. VÉRIFIER auprès de CamPay que le paiement est bien SUCCESSFUL
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

      // 2. Créer un client Supabase avec service_role (bypass RLS)
      const supabaseAdmin = createClient(
        process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );

      // 3. Vérifier si l'abonnement n'existe pas déjà (idempotence)
      // On suppose que la table subscriptions a une colonne external_reference
      // Si elle ne l'a pas, on peut quand même check par user_id + plan + date proche
      const { data: existing } = await supabaseAdmin
        .from("subscriptions")
        .select("id")
        .eq("user_id", user_id)
        .eq("status", "actif")
        .gte("started_at", new Date(Date.now() - 5 * 60 * 1000).toISOString()) // créé dans les 5 dernières min
        .limit(1);

      if (existing && existing.length > 0) {
        return res.status(200).json({
          success: true,
          message: "Abonnement déjà enregistré",
          subscription_id: existing[0].id,
          duplicate: true,
        });
      }

      // 4. Calculer la date d'expiration
      const now = new Date();
      const expires = new Date(now);
      if (plan === "mensuel") expires.setMonth(expires.getMonth() + 1);
      else expires.setFullYear(expires.getFullYear() + 1);

      // 5. Désactiver les anciens abonnements actifs de cet utilisateur
      await supabaseAdmin
        .from("subscriptions")
        .update({ status: "expire" })
        .eq("user_id", user_id)
        .eq("status", "actif");

      // 6. INSERT du nouveau abonnement
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

      return res.status(200).json({
        success: true,
        subscription: inserted,
      });
    }

    return res.status(400).json({ error: "Action inconnue" });
  } catch (err) {
    console.error("Erreur CamPay:", err);
    return res.status(500).json({ error: err.message });
  }
}
