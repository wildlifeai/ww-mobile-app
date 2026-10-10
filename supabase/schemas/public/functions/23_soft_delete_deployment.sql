-- Soft delete and restore, deployments. Since #160 the SELECT policies hide soft-deleted
-- rows, and Postgres applies SELECT policies to the new row of an UPDATE, so a client
-- UPDATE that sets or clears deleted_at can never pass RLS. Soft deletes and restores go
-- through these SECURITY DEFINER functions instead (push_changes calls the delete), which
-- check the caller themselves.
--
-- One timestamp per delete (#286). Given p_deleted_at, soft_delete_deployment stamps it on
-- the deployment and on its live media and observations, and restore_deployment with the
-- same timestamp undoes exactly that delete, leaving anything deleted earlier deleted.
-- ww-website passes one timestamp for a whole batch. Without p_deleted_at the delete stamps
-- now() on the deployment alone, as before #286: the website's current code cascades and
-- re-stamps the children itself after this call, so a database cascade under another
-- timestamp would make its undo restore the deployment without its photos. Make the
-- cascade the default once ww-website passes p_deleted_at (ww-website#312).
--
-- Error contract: P0002 when no deployment has that id, 42501 when the caller may not
-- delete it (can_delete_deployment). A delete succeeds when the deployment ends up
-- soft-deleted, now or already (the app re-pushes a deletion whose acknowledgement was
-- lost); a restore returns whether the deployment itself was restored.

-- Who may delete or restore a deployment: its creator while they hold at least
-- project_member, as for an edit (#260), or a project admin (ww_admin passes
-- has_project_role). A creator downgraded to project_viewer is read-only. COALESCE: with a
-- NULL setup_by (the creator's account was deleted) the creator branch is NULL, not false,
-- and a caller testing NOT of the result would let any member through. plpgsql, not sql:
-- a sql body is checked when created, before 29_has_project_role.sql has run.
CREATE OR REPLACE FUNCTION public.can_delete_deployment(p_project_id uuid, p_setup_by uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
BEGIN
  RETURN COALESCE((SELECT auth.uid()) IS NOT NULL AND (
    (p_setup_by = (SELECT auth.uid())
     AND public.has_project_role((SELECT auth.uid()), p_project_id, 'project_member'))
    OR public.has_project_role((SELECT auth.uid()), p_project_id, 'project_admin')
  ), false);
END;
$$;

CREATE OR REPLACE FUNCTION public.soft_delete_deployment(p_id uuid, p_deleted_at timestamptz DEFAULT NULL)
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

  IF (SELECT auth.uid()) IS NULL OR NOT public.can_delete_deployment(v_project_id, v_setup_by) THEN
    RAISE EXCEPTION 'Permission denied: only its creator while a project member, or a project admin, can delete a deployment'
      USING ERRCODE = '42501';
  END IF;

  IF v_deleted_at IS NULL THEN
    UPDATE public.deployments SET deleted_at = COALESCE(p_deleted_at, pg_catalog.now()) WHERE id = p_id;
    IF p_deleted_at IS NOT NULL THEN
      UPDATE public.media SET deleted_at = p_deleted_at WHERE deployment_id = p_id AND deleted_at IS NULL;
      UPDATE public.observations SET deleted_at = p_deleted_at WHERE deployment_id = p_id AND deleted_at IS NULL;
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_deployment(p_id uuid, p_deleted_at timestamptz)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_project_id uuid;
  v_setup_by uuid;
  v_restored boolean;
BEGIN
  SELECT d.project_id, d.setup_by INTO v_project_id, v_setup_by
  FROM public.deployments AS d
  WHERE d.id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not found' USING ERRCODE = 'P0002';
  END IF;

  IF (SELECT auth.uid()) IS NULL OR NOT public.can_delete_deployment(v_project_id, v_setup_by) THEN
    RAISE EXCEPTION 'Permission denied: only its creator while a project member, or a project admin, can restore a deployment'
      USING ERRCODE = '42501';
  END IF;

  -- Parent first, so nothing reads a live child under a deployment still deleted.
  UPDATE public.deployments SET deleted_at = NULL WHERE id = p_id AND deleted_at = p_deleted_at;
  v_restored := FOUND;
  UPDATE public.media SET deleted_at = NULL WHERE deployment_id = p_id AND deleted_at = p_deleted_at;
  UPDATE public.observations SET deleted_at = NULL WHERE deployment_id = p_id AND deleted_at = p_deleted_at;
  RETURN v_restored;
END;
$$;

-- Signed-in callers only: migra emits no function GRANT or REVOKE, so the migration
-- repeats these by hand, and without them anon keeps EXECUTE through PUBLIC.
REVOKE EXECUTE ON FUNCTION public.soft_delete_deployment(uuid, timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_deployment(uuid, timestamptz) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.restore_deployment(uuid, timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.restore_deployment(uuid, timestamptz) TO authenticated;
