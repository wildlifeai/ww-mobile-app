-- Soft delete helper - project member (using user_roles)
-- UPDATED: 2025-11-27 - Changed from project_members to user_roles
CREATE OR REPLACE FUNCTION public.soft_remove_project_member(p_project_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  -- Check if caller has project admin role
  IF NOT public.has_project_role(auth.uid(), p_project_id, 'project_admin') THEN
    RAISE EXCEPTION 'Permission denied: must be project admin to remove members.' USING ERRCODE = '42501';
  END IF;

  -- Soft delete the user's project role
  UPDATE public.user_roles
  SET deleted_at = NOW()
  WHERE scope_type = 'project'
    AND scope_id = p_project_id
    AND user_id = p_user_id
    AND deleted_at IS NULL;
END;
$$;

COMMENT ON FUNCTION public.soft_remove_project_member IS 'Soft deletes a project member role. Updated 2025-11-27 to use user_roles table.';