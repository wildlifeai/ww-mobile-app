-- Function to check if a user can upload to the ai-models bucket
-- Security Definer to bypass recursive RLS on user_roles
CREATE OR REPLACE FUNCTION public.storage_can_upload_model(bucket_id text, object_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_path_part text;
BEGIN
  -- 1. Must be authenticated
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 2. Must be the 'ai-models' bucket
  IF bucket_id <> 'ai-models' THEN
    RETURN FALSE;
  END IF;

  -- 3. Extract the first part of the path (Organisation ID)
  -- storage.objects.name format: "org_id/filename"
  v_path_part := pg_catalog.split_part(object_name, '/', 1);

  -- 4. Check Permissions
  -- A. WW Admin (System Scope)
  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_user_id
      AND role = 'ww_admin'
      AND scope_type = 'system'
      AND is_active = true
      AND deleted_at IS NULL
  ) THEN
    RETURN TRUE;
  END IF;

  -- B. Organisation Manager (Matching Path)
  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_user_id
        AND role = 'organisation_manager'
        AND scope_type = 'organisation'
        AND (
            -- Multi-tenant: Path starts with their Org UUID
            scope_id::text = v_path_part
            OR
            -- System Standard: General Org Manager can use 'models/' prefix pattern
            (scope_id = 'b0000000-0000-0000-0000-000000000001' AND v_path_part = 'models')
        )
        AND is_active = true
        AND deleted_at IS NULL
  ) THEN
    RETURN TRUE;
  END IF;

  -- C. User-specific uploads: path starts with auth.uid()
  IF v_path_part = v_user_id::text THEN
    RETURN TRUE;
  END IF;

  -- Default Deny
  RETURN FALSE;
END;
$$;

-- Grant Execute Permission (Critical for API Access)
GRANT EXECUTE ON FUNCTION public.storage_can_upload_model(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.storage_can_upload_model(text, text) TO service_role;
