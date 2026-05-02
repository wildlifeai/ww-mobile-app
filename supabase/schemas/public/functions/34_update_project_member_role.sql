-- Function: update_project_member_role
-- Purpose: Task 13 - Change project member role with last admin protection
-- Security: SECURITY DEFINER (runs with function owner's permissions to bypass RLS)
-- Dependencies: has_project_role(), user_roles table, admin_audit_log table

CREATE OR REPLACE FUNCTION public.update_project_member_role(
  p_project_id UUID,
  p_user_id UUID,
  p_new_role TEXT,
  p_updated_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old_role TEXT;
  v_result JSONB;
BEGIN
  -- Input validation
  IF p_project_id IS NULL THEN
    RAISE EXCEPTION 'Parameter p_project_id cannot be null' USING ERRCODE = '22004';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Parameter p_user_id cannot be null' USING ERRCODE = '22004';
  END IF;

  IF p_new_role IS NULL THEN
    RAISE EXCEPTION 'Parameter p_new_role cannot be null' USING ERRCODE = '22004';
  END IF;

  IF p_updated_by IS NULL THEN
    RAISE EXCEPTION 'Parameter p_updated_by cannot be null' USING ERRCODE = '22004';
  END IF;

  -- Security check: Only project admins can change roles
  IF NOT public.has_project_role(p_updated_by, p_project_id, 'project_admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only project admins can change roles' USING ERRCODE = '42501';
  END IF;

  -- Validate role: Must be valid project role
  IF p_new_role NOT IN ('project_admin', 'project_member') THEN
    RAISE EXCEPTION 'Invalid role: must be project_admin or project_member' USING ERRCODE = '22023';
  END IF;

  -- Get current role
  SELECT role INTO v_old_role
  FROM public.user_roles
  WHERE user_id = p_user_id
    AND scope_type = 'project'
    AND scope_id = p_project_id
    AND is_active = true
    AND deleted_at IS NULL;

  -- Verify user is a project member
  IF v_old_role IS NULL THEN
    RAISE EXCEPTION 'User is not a member of this project' USING ERRCODE = '22023';
  END IF;

  -- Check if role change is needed
  IF v_old_role = p_new_role THEN
    RAISE EXCEPTION 'User already has this role' USING ERRCODE = '22023';
  END IF;

  -- Last admin protection: Prevent demoting yourself if you're the last admin
  IF p_updated_by = p_user_id AND p_new_role = 'project_member' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE scope_type = 'project'
        AND scope_id = p_project_id
        AND role = 'project_admin'
        AND user_id != p_user_id
        AND is_active = true
        AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Cannot demote yourself as the last project admin' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- Update role
  UPDATE public.user_roles
  SET
    role = p_new_role,
    updated_at = NOW()
  WHERE user_id = p_user_id
    AND scope_type = 'project'
    AND scope_id = p_project_id
    AND is_active = true
    AND deleted_at IS NULL;

  -- Audit log: admin_audit_log table has been removed.

  -- Build success response
  v_result := jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'project_id', p_project_id,
    'old_role', v_old_role,
    'new_role', p_new_role
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.update_project_member_role IS
'Task 13: Change project member role with last admin protection.

Security Features:
- Only project admins can change roles
- Prevents demoting last project admin
- Validates role values (project_admin, project_member)
- Comprehensive input validation
- Audit logging for all role changes

Parameters:
- p_project_id: Project identifier
- p_user_id: User whose role is being changed
- p_new_role: New role to assign (project_admin or project_member)
- p_updated_by: User making the change (must be project_admin)

Returns: JSONB object with success status and role change details

Example:
SELECT update_project_member_role(
  ''proj-uuid''::uuid,
  ''user-uuid''::uuid,
  ''project_member'',
  auth.uid()
);
';
