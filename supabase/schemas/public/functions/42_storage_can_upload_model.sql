-- Debug Table
CREATE TABLE IF NOT EXISTS public.debug_storage_logs (
    id uuid DEFAULT extensions.gen_random_uuid() PRIMARY KEY,
    message text,
    details jsonb,
    created_at timestamptz DEFAULT now()
);
ALTER TABLE public.debug_storage_logs ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.debug_storage_logs TO authenticated, service_role, postgres;

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
  -- Log entry
  INSERT INTO public.debug_storage_logs (message, details) 
  VALUES ('storage_can_upload_model called', pg_catalog.jsonb_build_object('bucket', bucket_id, 'path', object_name, 'user_id', v_user_id));
  
  -- 1. Must be authenticated
  IF v_user_id IS NULL THEN
    INSERT INTO public.debug_storage_logs (message) VALUES ('Denied: user_id is NULL');
    RETURN FALSE;
  END IF;

  -- 2. Must be the 'ai-models' bucket
  IF bucket_id <> 'ai-models' THEN
    INSERT INTO public.debug_storage_logs (message) VALUES ('Denied: wrong bucket: ' || bucket_id);
    RETURN FALSE;
  END IF;

  -- 3. Extract the first part of the path (Organisation ID)
  -- storage.objects.name format: "org_id/filename"
  v_path_part := pg_catalog.split_part(object_name, '/', 1);
  INSERT INTO public.debug_storage_logs (message) VALUES ('Path first part: ' || v_path_part);

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
    INSERT INTO public.debug_storage_logs (message) VALUES ('Allowed: ww_admin');
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
    INSERT INTO public.debug_storage_logs (message) VALUES ('Allowed: organisation_manager with matching scope');
    RETURN TRUE;
  END IF;

  -- C. User-specific uploads: path starts with auth.uid()
  IF v_path_part = v_user_id::text THEN
    INSERT INTO public.debug_storage_logs (message) VALUES ('Allowed: user-specific path match');
    RETURN TRUE;
  END IF;

  -- Default Deny
  INSERT INTO public.debug_storage_logs (message) VALUES ('Denied: no matching permissions found');
  RETURN FALSE;
END;
$$;

-- Grant Execute Permission (Critical for API Access)
GRANT EXECUTE ON FUNCTION public.storage_can_upload_model(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.storage_can_upload_model(text, text) TO service_role;

-- DEBUG: Policy Audit Function
CREATE OR REPLACE FUNCTION public.debug_get_policies()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN (
    SELECT pg_catalog.jsonb_agg(pg_catalog.row_to_json(p))
    FROM pg_catalog.pg_policies p
    WHERE p.schemaname = 'storage' AND p.tablename = 'objects'
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.debug_get_policies() TO authenticated;
