// api/campay.js
// Fonction serverless Vercel : gère collect, check, withdraw + record_purchase + record_subscription + record_carrycare (bypass RLS)
// + record_pending + recover_lost_purchases (système de récupération automatique des achats perdus)

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
      const { reference, user_id, book_id, amount, phone, external_reference } = params;

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

      // 🔥 Marquer le pending comme completed si existait
      try {
        await supabaseAdmin
          .from("pending_purchases")
          .update({ status: "completed", recovered_at: new Date().toISOString() })
          .eq("reference", reference);
      } catch (e) { /* silent fail */ }

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
      const { phone, book_id, amount, reference, external_reference, type } = params;

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
        }])
        .select()
        .single();

      if (error) {
        console.error("[GUEST_PURCHASE] Erreur insert:", error);
        // 🛡️ On retourne SUCCESS quand même pour ne pas casser le flow de paiement
        // L'achat est déjà dans CamPay + localStorage du client
        return res.status(200).json({ success: false, error: error.message, non_blocking: true });
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

    return res.status(400).json({ error: "Action inconnue" });
  } catch (err) {
    console.error("Erreur CamPay:", err);
    return res.status(500).json({ error: err.message });
  }
}
