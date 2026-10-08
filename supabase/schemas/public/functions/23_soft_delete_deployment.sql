-- Soft delete, deployments. Since #160 the SELECT policies hide soft-deleted rows,
-- and Postgres applies SELECT policies to the new row of an UPDATE, so a client
-- UPDATE that sets deleted_at can never pass RLS. Soft deletes go through these
-- SECURITY DEFINER functions instead (push_changes calls them), which check what
-- the old soft-delete policies checked. The website deletes through its own API on
-- the service role and is unaffected.
--
-- Succeeds when the row ends up soft-deleted, now or already (the app re-pushes a
-- deletion whose acknowledgement was lost). Raises P0002 when no row has that id,
-- and 42501 when the caller may not delete it.
CREATE OR REPLACE FUNCTION public.soft_delete_deployment(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_project_id uuid;
  v_setup_by uuid;
  v_deleted_at timestamptz;
BEGIN
  SELECT d.project_id, d.setup_by, d.deleted_at INTO v_project_id, v_setup_by, v_deleted_at
  FROM public.deployments AS d
  WHERE d.id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not found' USING ERRCODE = 'P0002';
  END IF;

  -- Its creator while they hold at least project_member, as for an edit (#260), or a
  -- project admin (ww_admin passes has_project_role). A creator downgraded to
  -- project_viewer is read-only.
  IF (SELECT auth.uid()) IS NULL OR NOT (
    (v_setup_by = (SELECT auth.uid())
     AND public.has_project_role((SELECT auth.uid()), v_project_id, 'project_member'))
    OR public.has_project_role((SELECT auth.uid()), v_project_id, 'project_admin')
  ) THEN
    RAISE EXCEPTION 'Permission denied: only its creator while a project member, or a project admin, can delete a deployment'
      USING ERRCODE = '42501';
  END IF;

  IF v_deleted_at IS NULL THEN
    UPDATE public.deployments SET deleted_at = pg_catalog.now() WHERE id = p_id;
  END IF;
END;
$$;
