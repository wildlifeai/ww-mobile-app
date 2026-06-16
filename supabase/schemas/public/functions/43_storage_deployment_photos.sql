-- Access check for the deployment-photos bucket.
-- Object path convention: {project_id}/{deployment_id}/{filename}
-- Any active member of the project (direct, via organisation, or ww_admin)
-- can read and upload; pass required_role := 'project_admin' for admin-only
-- actions (e.g. delete).
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

  RETURN public.has_project_role(v_user_id, v_project_id, required_role);
END;
$$;

GRANT EXECUTE ON FUNCTION public.storage_can_access_deployment_photo(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.storage_can_access_deployment_photo(text, text, text) TO service_role;
