-- ============================================================================
-- VIEW: Secure Model Upload Permissions
-- Used by Storage RLS policies to bypass context-switching limitations
-- ============================================================================

CREATE OR REPLACE VIEW public.my_model_upload_permissions
WITH (security_invoker = true) -- Run as caller to respect underlying user_roles RLS
AS
SELECT
  ur.role,
  ur.scope_type,
  ur.scope_id::text AS scope_id_text
FROM public.user_roles AS ur
WHERE
  ur.user_id = auth.uid()
  AND ur.is_active = true
  AND ur.deleted_at IS null;

-- Grants
GRANT SELECT ON public.my_model_upload_permissions TO authenticated;
GRANT SELECT ON public.my_model_upload_permissions TO public;
