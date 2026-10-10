-- Soft delete and restore, projects. Why SECURITY DEFINER functions, the one-timestamp
-- rule and the error contract: see 23_soft_delete_deployment.sql (#160, #286). Given
-- p_deleted_at, the delete stamps it on the project, its live deployments, and their live
-- media and observations; without it, on the project alone, as before #286 (ww-website#316
-- still cascades itself). restore_project with the same timestamp undoes that delete.
-- Both need a project admin (ww_admin passes has_project_role), whose role a soft-deleted
-- project keeps.
CREATE OR REPLACE FUNCTION public.soft_delete_project(p_id uuid, p_deleted_at timestamptz DEFAULT NULL)
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

  IF (SELECT auth.uid()) IS NULL
     OR NOT public.has_project_role((SELECT auth.uid()), p_id, 'project_admin') THEN
    RAISE EXCEPTION 'Permission denied: only a project admin can delete a project'
      USING ERRCODE = '42501';
  END IF;

  IF v_deleted_at IS NULL THEN
    UPDATE public.projects SET deleted_at = COALESCE(p_deleted_at, pg_catalog.now()) WHERE id = p_id;
    IF p_deleted_at IS NOT NULL THEN
      UPDATE public.media AS m SET deleted_at = p_deleted_at
      FROM public.deployments AS d
      WHERE m.deployment_id = d.id AND d.project_id = p_id AND d.deleted_at IS NULL AND m.deleted_at IS NULL;
      UPDATE public.observations AS o SET deleted_at = p_deleted_at
      FROM public.deployments AS d
      WHERE o.deployment_id = d.id AND d.project_id = p_id AND d.deleted_at IS NULL AND o.deleted_at IS NULL;
      UPDATE public.deployments SET deleted_at = p_deleted_at WHERE project_id = p_id AND deleted_at IS NULL;
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_project(p_id uuid, p_deleted_at timestamptz)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_restored boolean;
BEGIN
  PERFORM 1 FROM public.projects AS p WHERE p.id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not found' USING ERRCODE = 'P0002';
  END IF;

  IF (SELECT auth.uid()) IS NULL
     OR NOT public.has_project_role((SELECT auth.uid()), p_id, 'project_admin') THEN
    RAISE EXCEPTION 'Permission denied: only a project admin can restore a project'
      USING ERRCODE = '42501';
  END IF;

  -- Parent first: the project, then its deployments, then their media and observations.
  UPDATE public.projects SET deleted_at = NULL WHERE id = p_id AND deleted_at = p_deleted_at;
  v_restored := FOUND;
  UPDATE public.deployments SET deleted_at = NULL WHERE project_id = p_id AND deleted_at = p_deleted_at;
  UPDATE public.media AS m SET deleted_at = NULL
  FROM public.deployments AS d
  WHERE m.deployment_id = d.id AND d.project_id = p_id AND m.deleted_at = p_deleted_at;
  UPDATE public.observations AS o SET deleted_at = NULL
  FROM public.deployments AS d
  WHERE o.deployment_id = d.id AND d.project_id = p_id AND o.deleted_at = p_deleted_at;
  RETURN v_restored;
END;
$$;

-- Signed-in callers only, as in 23_soft_delete_deployment.sql.
REVOKE EXECUTE ON FUNCTION public.soft_delete_project(uuid, timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_project(uuid, timestamptz) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.restore_project(uuid, timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.restore_project(uuid, timestamptz) TO authenticated;
