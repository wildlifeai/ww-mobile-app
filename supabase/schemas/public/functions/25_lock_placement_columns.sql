-- Columns that place a row in a deployment, a project or an organisation, locked
-- against client updates (#260, #267). The triggers are in triggers/30_triggers.sql.
--
-- A policy cannot do this. It sees one row at a time, never the old and the new
-- together, and permissive UPDATE policies combine with OR: a project_admin of the
-- source passed the admin policy's USING on the old row and the creator policy's
-- WITH CHECK on a new row whose setup_by they had set to themselves, which moved
-- the deployment into any project they could read.
--
-- Only the client roles are refused. The service role, postgres, and SECURITY
-- DEFINER functions owned by postgres run as those roles and pass, so a move goes
-- through a function that checks the caller itself. SECURITY INVOKER on purpose:
-- as DEFINER, current_user would always be the owner.

-- deployments.project_id and setup_by: refused for any client role.
CREATE OR REPLACE FUNCTION public.lock_deployment_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon')
     AND (NEW.project_id IS DISTINCT FROM OLD.project_id
          OR NEW.setup_by IS DISTINCT FROM OLD.setup_by) THEN
    RAISE EXCEPTION 'Permission denied: a deployment''s project_id and setup_by cannot be changed'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

-- media.deployment_id and uploaded_by: refused for any client role (#267). The
-- uploader policy checked only uploaded_by, so an uploader could move their media
-- into any deployment they could read, and a project_admin could too by also
-- setting uploaded_by to themselves.
CREATE OR REPLACE FUNCTION public.lock_media_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon')
     AND (NEW.deployment_id IS DISTINCT FROM OLD.deployment_id
          OR NEW.uploaded_by IS DISTINCT FROM OLD.uploaded_by) THEN
    RAISE EXCEPTION 'Permission denied: a media record''s deployment_id and uploaded_by cannot be changed'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

-- deployments.device_id: a client may place a deployment only on a device of the
-- project's organisation (#304), the rule move_deployment already keeps. Without it a
-- member put a deployment on another organisation's camera, given its id (a Camtrap DP
-- cameraID), and then read the device through can_read_device's deployment branch.
--
-- device_fits_project compares the two organisations past RLS, because a project member
-- need not see an undeployed device of the organisation (an invitation grants a project
-- role only). It answers false to anyone who is not a member of the project, whatever
-- the device, so it tells nobody else which organisation a device is in.
CREATE OR REPLACE FUNCTION public.device_fits_project(p_device_id uuid, p_project_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.has_project_role((SELECT auth.uid()), p_project_id, 'project_member') THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM public.devices d
    JOIN public.projects p ON p.organisation_id = d.organisation_id
    WHERE d.id = p_device_id AND p.id = p_project_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.device_fits_project(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.device_fits_project(uuid, uuid) TO authenticated;

-- Checked on INSERT and when device_id changes, never on other updates: push_changes
-- repeats device_id on every update, and a device moved to another organisation later
-- must not fail each edit to its old deployments, and with it the phone's whole push.
CREATE OR REPLACE FUNCTION public.check_deployment_device()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon')
     AND (TG_OP = 'INSERT' OR NEW.device_id IS DISTINCT FROM OLD.device_id)
     AND NOT public.device_fits_project(NEW.device_id, NEW.project_id) THEN
    RAISE EXCEPTION 'Permission denied: a deployment''s device must belong to its project''s organisation'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

-- projects.organisation_id: refused for any client role except a ww_admin.
CREATE OR REPLACE FUNCTION public.lock_project_organisation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon')
     AND NEW.organisation_id IS DISTINCT FROM OLD.organisation_id THEN
    -- Nested, so has_system_role runs only for a real change by a client.
    IF NOT public.has_system_role((SELECT auth.uid()), 'ww_admin') THEN
      RAISE EXCEPTION 'Permission denied: only a ww_admin can change a project''s organisation_id'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
