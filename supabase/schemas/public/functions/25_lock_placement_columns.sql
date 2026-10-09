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
