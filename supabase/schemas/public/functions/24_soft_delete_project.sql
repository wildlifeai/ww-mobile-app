-- Soft delete, projects. Why a SECURITY DEFINER function: see
-- 23_soft_delete_deployment.sql (#160), which also gives the error contract.
CREATE OR REPLACE FUNCTION public.soft_delete_project(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_deleted_at timestamptz;
BEGIN
  SELECT p.deleted_at INTO v_deleted_at FROM public.projects AS p WHERE p.id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not found' USING ERRCODE = 'P0002';
  END IF;

  -- A project admin (ww_admin passes has_project_role).
  IF (SELECT auth.uid()) IS NULL
     OR NOT public.has_project_role((SELECT auth.uid()), p_id, 'project_admin') THEN
    RAISE EXCEPTION 'Permission denied: only a project admin can delete a project'
      USING ERRCODE = '42501';
  END IF;

  IF v_deleted_at IS NULL THEN
    UPDATE public.projects SET deleted_at = pg_catalog.now() WHERE id = p_id;
  END IF;
END;
$$;
