-- ═══════════════════════════════════════════════════════════
-- SÉCURISATION RLS — carrycare_results + referral_settings
-- À EXÉCUTER DANS SUPABASE SQL EDITOR
-- ═══════════════════════════════════════════════════════════

-- ═══ TABLE 1 : carrycare_results ═══
-- Chaque utilisateur ne voit QUE ses propres résultats
-- Les admins voient tout

-- 1. Activer RLS
ALTER TABLE public.carrycare_results ENABLE ROW LEVEL SECURITY;

-- 2. Supprimer les anciennes politiques s'il y en a
DROP POLICY IF EXISTS "users_see_own_carrycare" ON public.carrycare_results;
DROP POLICY IF EXISTS "users_insert_own_carrycare" ON public.carrycare_results;
DROP POLICY IF EXISTS "admin_see_all_carrycare" ON public.carrycare_results;
DROP POLICY IF EXISTS "admin_update_carrycare" ON public.carrycare_results;
DROP POLICY IF EXISTS "admin_delete_carrycare" ON public.carrycare_results;

-- 3. Politique : utilisateur voit ses propres résultats
CREATE POLICY "users_see_own_carrycare"
ON public.carrycare_results
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 4. Politique : utilisateur peut INSÉRER ses propres résultats
CREATE POLICY "users_insert_own_carrycare"
ON public.carrycare_results
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 5. Politique : admins voient TOUS les résultats
CREATE POLICY "admin_see_all_carrycare"
ON public.carrycare_results
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admins
    WHERE admins.user_id = auth.uid()
  )
);

-- 6. Politique : admins peuvent modifier
CREATE POLICY "admin_update_carrycare"
ON public.carrycare_results
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admins
    WHERE admins.user_id = auth.uid()
  )
);

-- 7. Politique : admins peuvent supprimer
CREATE POLICY "admin_delete_carrycare"
ON public.carrycare_results
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admins
    WHERE admins.user_id = auth.uid()
  )
);


-- ═══ TABLE 2 : referral_settings ═══
-- Tout le monde peut LIRE (besoin pour afficher)
-- Seuls les admins peuvent MODIFIER

-- 1. Activer RLS
ALTER TABLE public.referral_settings ENABLE ROW LEVEL SECURITY;

-- 2. Supprimer les anciennes politiques
DROP POLICY IF EXISTS "everyone_read_referral_settings" ON public.referral_settings;
DROP POLICY IF EXISTS "admin_modify_referral_settings" ON public.referral_settings;
DROP POLICY IF EXISTS "admin_insert_referral_settings" ON public.referral_settings;
DROP POLICY IF EXISTS "admin_delete_referral_settings" ON public.referral_settings;

-- 3. Politique : tout le monde peut LIRE (besoin pour afficher les options de parrainage)
CREATE POLICY "everyone_read_referral_settings"
ON public.referral_settings
FOR SELECT
TO public
USING (true);

-- 4. Politique : seuls les admins peuvent MODIFIER
CREATE POLICY "admin_modify_referral_settings"
ON public.referral_settings
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admins
    WHERE admins.user_id = auth.uid()
  )
);

-- 5. Politique : seuls les admins peuvent INSÉRER
CREATE POLICY "admin_insert_referral_settings"
ON public.referral_settings
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admins
    WHERE admins.user_id = auth.uid()
  )
);

-- 6. Politique : seuls les admins peuvent SUPPRIMER
CREATE POLICY "admin_delete_referral_settings"
ON public.referral_settings
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admins
    WHERE admins.user_id = auth.uid()
  )
);


-- ═══ VÉRIFICATION ═══
-- Vérifier que les RLS sont bien actives
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('carrycare_results', 'referral_settings');
-- Résultat attendu : rowsecurity = true pour les deux tables
