-- Access check for the deployment-photos bucket.
-- Object path convention: {project_id}/{deployment_id}/{filename}
-- has_project_role decides, at required_role: 'project_viewer' to view (#273),
-- the default 'project_member' to upload, 'project_admin' for admin-only actions
-- (e.g. delete).
--
-- Access follows the deployment (#260). Objects stay where they were uploaded when
-- move_deployment moves a deployment, so the project is the deployment's current
-- project_id when the second segment is a known deployment, and the first segment
-- otherwise, as before. For a deployment never moved the two are the same project.
-- Security Definer to bypass recursive RLS on user_roles.
CREATE OR REPLACE FUNCTION public.storage_can_access_deployment_photo(
  bucket_id text,
  object_name text,
  required_role text DEFAULT 'project_member'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_project_id uuid;
  v_deployment_segment text;
  v_current_project_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF bucket_id <> 'deployment-photos' THEN
    RETURN false;
  END IF;

  -- First path segment must be a valid project UUID
  BEGIN
    v_project_id := pg_catalog.split_part(object_name, '/', 1)::uuid;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;

  -- Matched as text before the cast, so a segment that is not a UUID costs no
  -- exception block.
  v_deployment_segment := pg_catalog.split_part(object_name, '/', 2);
  IF v_deployment_segment ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT d.project_id INTO v_current_project_id
    FROM public.deployments AS d
    WHERE d.id = v_deployment_segment::uuid;

    IF FOUND THEN
      v_project_id := v_current_project_id;
    END IF;
  END IF;

  RETURN public.has_project_role(v_user_id, v_project_id, required_role);
END;
$$;

GRANT EXECUTE ON FUNCTION public.storage_can_access_deployment_photo(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.storage_can_access_deployment_photo(text, text, text) TO service_role;
