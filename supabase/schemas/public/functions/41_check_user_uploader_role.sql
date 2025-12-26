-- RPC for model-conversion tool to check if a user can upload models
-- Requirements: Must be organisation_manager for the target org OR ww_admin
CREATE OR REPLACE FUNCTION check_user_uploader_role(p_user_id uuid, p_org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- We reuse the existing has_organisation_role helper
  -- It already handles:
  -- 1. Direct organisation_manager role check
  -- 2. System-wide ww_admin check
  RETURN public.has_organisation_role(p_user_id, p_org_id, 'organisation_manager');
END;
$$;

COMMENT ON FUNCTION check_user_uploader_role IS 'Check if a user is authorized to upload models (Manager for the org or System Admin)';
