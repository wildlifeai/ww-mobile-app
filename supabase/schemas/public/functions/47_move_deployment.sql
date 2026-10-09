-- Move a deployment to another project in the same organisation (#260). The only
-- way a client changes deployments.project_id: trg_deployments_lock_columns refuses
-- it for client roles, and this function runs as its owner, which the trigger lets
-- through. The caller is auth.uid(); there is no actor argument (test 21).
--
-- Who: project_admin of both the source and the target project, or ww_admin
-- (has_project_role counts ww_admin as project_admin everywhere).
--
-- What follows the deployment: its media, observations and photos, which are read
-- through deployments.project_id; its conservation_alerts, re-pointed here; and its
-- device, whose updated_at is bumped so an incremental pull fetches it for members
-- of the target. Photos stay at their paths (storage_can_access_deployment_photo
-- resolves them through the deployment). A member of the source who can no longer
-- read the deployment learns of it from sync_deleted_ids, through deployment_moves.
--
-- Returns {deployment_id, from_project_id, to_project_id, moved_at, moved}. A move to
-- the project the deployment is already in changes nothing and returns moved = false
-- with moved_at null, so a retried move is harmless.
--
-- Error contract (clients map on SQLSTATE):
--   22004  an argument is null
--   42501  not authenticated, or not project_admin on both projects
--   P0002  the deployment or the target project does not exist, is soft-deleted, or
--          the caller cannot read it (one answer, so existence does not leak)
--   22023  the target is in another organisation, or archived
--
-- plpgsql: functions load before the tables they read.
CREATE OR REPLACE FUNCTION public.move_deployment(p_deployment_id uuid, p_target_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_from_project_id uuid;
  v_device_id uuid;
  v_deployment_deleted_at timestamptz;
  v_source_organisation_id uuid;
  v_source_deleted_at timestamptz;
  v_target_organisation_id uuid;
  v_target_created_by uuid;
  v_target_deleted_at timestamptz;
  v_target_archived boolean;
  v_moved_at timestamptz := pg_catalog.now();
BEGIN
  IF p_deployment_id IS NULL THEN
    RAISE EXCEPTION 'Parameter p_deployment_id cannot be null' USING ERRCODE = '22004';
  END IF;

  IF p_target_project_id IS NULL THEN
    RAISE EXCEPTION 'Parameter p_target_project_id cannot be null' USING ERRCODE = '22004';
  END IF;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  -- Locked, so two moves of one deployment run one after the other.
  SELECT d.project_id, d.device_id, d.deleted_at
  INTO v_from_project_id, v_device_id, v_deployment_deleted_at
  FROM public.deployments AS d
  WHERE d.id = p_deployment_id
  FOR UPDATE;

  IF FOUND THEN
    SELECT p.organisation_id, p.deleted_at
    INTO v_source_organisation_id, v_source_deleted_at
    FROM public.projects AS p
    WHERE p.id = v_from_project_id;
  END IF;

  -- Readable as the deployments SELECT policy reads it. has_project_role does not
  -- look at projects.deleted_at for a project role, so the source is checked here:
  -- a deployment of a soft-deleted project is gone with it.
  IF v_from_project_id IS NULL
     OR v_deployment_deleted_at IS NOT NULL
     OR v_source_deleted_at IS NOT NULL
     OR NOT public.has_project_role(v_uid, v_from_project_id, 'project_viewer') THEN
    RAISE EXCEPTION 'Deployment not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT p.organisation_id, p.created_by, p.deleted_at, p.is_archived
  INTO v_target_organisation_id, v_target_created_by, v_target_deleted_at, v_target_archived
  FROM public.projects AS p
  WHERE p.id = p_target_project_id;

  -- Readable as the projects SELECT policy reads it.
  IF NOT FOUND
     OR v_target_deleted_at IS NOT NULL
     OR NOT public.can_read_project(p_target_project_id, v_target_organisation_id, v_target_created_by) THEN
    RAISE EXCEPTION 'Target project not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_from_project_id = p_target_project_id THEN
    RETURN pg_catalog.jsonb_build_object(
      'deployment_id', p_deployment_id,
      'from_project_id', v_from_project_id,
      'to_project_id', p_target_project_id,
      'moved_at', NULL,
      'moved', false
    );
  END IF;

  IF NOT (public.has_project_role(v_uid, v_from_project_id, 'project_admin')
          AND public.has_project_role(v_uid, p_target_project_id, 'project_admin')) THEN
    RAISE EXCEPTION 'Permission denied: moving a deployment needs project_admin on both projects'
      USING ERRCODE = '42501';
  END IF;

  -- The device belongs to the organisation, so a move never leaves it.
  IF v_target_organisation_id IS DISTINCT FROM v_source_organisation_id THEN
    RAISE EXCEPTION 'A deployment cannot move to a project in another organisation'
      USING ERRCODE = '22023';
  END IF;

  IF v_target_archived THEN
    RAISE EXCEPTION 'A deployment cannot move to an archived project'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.deployments
  SET project_id = p_target_project_id,
      updated_at = v_moved_at
  WHERE id = p_deployment_id;

  UPDATE public.conservation_alerts
  SET project_id = p_target_project_id
  WHERE deployment_id = p_deployment_id
    AND project_id IS DISTINCT FROM p_target_project_id;

  UPDATE public.devices
  SET updated_at = v_moved_at
  WHERE id = v_device_id;

  INSERT INTO public.deployment_moves (deployment_id, from_project_id, to_project_id, moved_by, moved_at)
  VALUES (p_deployment_id, v_from_project_id, p_target_project_id, v_uid, v_moved_at);

  RETURN pg_catalog.jsonb_build_object(
    'deployment_id', p_deployment_id,
    'from_project_id', v_from_project_id,
    'to_project_id', p_target_project_id,
    'moved_at', v_moved_at,
    'moved', true
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.move_deployment(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.move_deployment(uuid, uuid) TO authenticated;
