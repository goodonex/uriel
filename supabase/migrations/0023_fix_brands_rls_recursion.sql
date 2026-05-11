-- Brand OS — Fix: "infinite recursion detected in policy for relation 'brands'"
--
-- Ursache: 0012_client_access.sql legte zusätzlich zur Owner-Policy eine
-- SELECT-Policy auf brands an, die per JOIN auf deliver_projects ging.
-- deliver_projects hat aus 0009_rls.sql wiederum eine Policy, die auf brands
-- joint -> zirkuläre RLS-Auswertung.
--
-- Fix:
--   1. ALLE bestehenden Policies auf brands droppen (inkl. legacy Namen).
--   2. Saubere Owner-Policies pro Operation (kein Join, keine Rekursion).
--   3. Client-Portal Read-Zugriff über SECURITY DEFINER Funktion (umgeht
--      RLS in user_roles/deliver_projects -> keine Rekursion).

-- 1) Alle bekannten Policy-Namen droppen (idempotent).
DROP POLICY IF EXISTS "brands_owner_all"                  ON public.brands;
DROP POLICY IF EXISTS "brands_client_read_via_project"    ON public.brands;
DROP POLICY IF EXISTS "brands are visible to their owner" ON public.brands;
DROP POLICY IF EXISTS "owner can insert brands"           ON public.brands;
DROP POLICY IF EXISTS "owner can update own brands"       ON public.brands;
DROP POLICY IF EXISTS "owner can delete own brands"       ON public.brands;
DROP POLICY IF EXISTS "brands_select_owner"               ON public.brands;
DROP POLICY IF EXISTS "brands_insert_owner"               ON public.brands;
DROP POLICY IF EXISTS "brands_update_owner"               ON public.brands;
DROP POLICY IF EXISTS "brands_delete_owner"               ON public.brands;
DROP POLICY IF EXISTS "brands_select_client_via_project"  ON public.brands;

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

-- 2) Saubere Owner-Policies: rein auf user_id = auth.uid(), keine Joins.
CREATE POLICY "brands_select_owner" ON public.brands
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "brands_insert_owner" ON public.brands
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "brands_update_owner" ON public.brands
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "brands_delete_owner" ON public.brands
  FOR DELETE
  USING (auth.uid() = user_id);

-- 3) Client-Portal: Read-Zugriff über SECURITY DEFINER Funktion.
--    Die Funktion liest user_roles + deliver_projects unter
--    Funktions-Owner-Rechten, dadurch wird die RLS-Kette nicht erneut
--    auf brands zurückgeworfen.
CREATE OR REPLACE FUNCTION public.client_can_read_brand(p_brand_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.deliver_projects dp ON dp.id = ur.project_id
    WHERE ur.user_id      = auth.uid()
      AND ur.role         = 'client'
      AND dp.owner_brand_id = p_brand_id
  );
$$;

REVOKE ALL    ON FUNCTION public.client_can_read_brand(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_can_read_brand(uuid) TO authenticated;

CREATE POLICY "brands_select_client_via_project" ON public.brands
  FOR SELECT
  USING (public.client_can_read_brand(id));
