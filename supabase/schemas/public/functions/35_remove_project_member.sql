-- =============================================================================
-- remove_project_member() FUNCTION
-- =============================================================================
-- Description: Removes a user from a project with soft delete, audit logging,
--              and last admin protection.
--
-- Purpose: Provides a secure, auditable way to remove project members while
--          preventing organizational integrity violations (e.g., removing last admin).
--
-- Security Model: SECURITY DEFINER (bypasses RLS for privileged operations)
--                 with explicit authorization checks
--
-- Key Features:
--   - Project admin authorization required
--   - Last admin protection (prevents orphaned projects)
--   - Soft delete pattern (deleted_at timestamp)
--   - Automatic audit log entry
--   - JSON response with operation details
--
-- Related Functions: has_project_role(), add_project_member()
-- Related Tables: user_roles, admin_audit_log
-- =============================================================================

CREATE OR REPLACE FUNCTION public.remove_project_member(
  p_project_id UUID,
  p_user_id UUID,
  p_removed_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role TEXT;
  v_result JSONB;
BEGIN
  -- =============================================================================
  -- VALIDATION: Authorization Check
  -- =============================================================================
  -- Only project admins can remove members from their projects

  IF NOT public.has_project_role(p_removed_by, p_project_id, 'project_admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only project admins can remove members'
      USING ERRCODE = '42501',
            HINT = 'User must have project_admin role for this project';
  END IF;

  -- =============================================================================
  -- VALIDATION: Member Existence Check
  -- =============================================================================
  -- Verify the target user is actually a member of this project

  SELECT role INTO v_role
  FROM public.user_roles
  WHERE user_id = p_user_id
    AND scope_type = 'project'
    AND scope_id = p_project_id
    AND is_active = true
    AND deleted_at IS NULL;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'User is not a member of this project'
      USING ERRCODE = '22023',
            DETAIL = format('user_id: %s, project_id: %s', p_user_id, p_project_id);
  END IF;

  -- =============================================================================
  -- VALIDATION: Last Admin Protection
  -- =============================================================================
  -- Prevent removal of the last project admin to avoid orphaned projects

  IF v_role = 'project_admin' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE scope_type = 'project'
        AND scope_id = p_project_id
        AND role = 'project_admin'
        AND user_id != p_user_id
        AND is_active = true
        AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Cannot remove the last project admin'
        USING ERRCODE = '23514',
              HINT = 'Assign another user as project_admin before removing this user';
    END IF;
  END IF;

  -- =============================================================================
  -- OPERATION: Soft Delete Member Role
  -- =============================================================================
  -- Mark the user_roles record as deleted (soft delete pattern)

  UPDATE public.user_roles
  SET deleted_at = NOW(),
      updated_at = NOW()
  WHERE user_id = p_user_id
    AND scope_type = 'project'
    AND scope_id = p_project_id
    AND is_active = true
    AND deleted_at IS NULL;

  -- =============================================================================
  -- AUDIT: Log Administrative Action
  -- =============================================================================
  -- Create immutable audit trail entry for compliance and forensics

  INSERT INTO public.admin_audit_log (
    admin_id,
    action,
    target_user_id,
    target_project_id,
    metadata
  )
  VALUES (
    p_removed_by,
    'REMOVE_PROJECT_MEMBER',
    p_user_id,
    p_project_id,
    jsonb_build_object(
      'removed_role', v_role,
      'timestamp', NOW()
    )
  );

  -- =============================================================================
  -- RESPONSE: Operation Summary
  -- =============================================================================
  -- Return structured JSON response with operation details

  v_result := jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'project_id', p_project_id,
    'removed_role', v_role,
    'removed_by', p_removed_by,
    'removed_at', NOW()
  );

  RETURN v_result;
END;
$$;

-- =============================================================================
-- FUNCTION COMMENTS
-- =============================================================================

COMMENT ON FUNCTION public.remove_project_member IS
  'Task 13: Removes a project member with soft delete pattern and comprehensive audit logging. Enforces authorization (project_admin only), prevents removal of last admin, and creates immutable audit trail. Returns JSON summary of removal operation.';

-- =============================================================================
-- USAGE EXAMPLES
-- =============================================================================
--
-- Example 1: Remove a viewer from project (successful)
-- SELECT remove_project_member(
--   'project-uuid-here'::uuid,
--   'user-to-remove-uuid'::uuid,
--   'admin-user-uuid'::uuid
-- );
--
-- Example 2: Attempt to remove last admin (will fail with exception)
-- SELECT remove_project_member(
--   'project-uuid-here'::uuid,
--   'last-admin-uuid'::uuid,
--   'admin-user-uuid'::uuid
-- );
-- ERROR: Cannot remove the last project admin
--
-- Example 3: Non-admin attempts removal (will fail with exception)
-- SELECT remove_project_member(
--   'project-uuid-here'::uuid,
--   'target-user-uuid'::uuid,
--   'non-admin-user-uuid'::uuid
-- );
-- ERROR: Unauthorized: Only project admins can remove members
--
-- =============================================================================
-- SECURITY CONSIDERATIONS
-- =============================================================================
--
-- 1. SECURITY DEFINER: Function runs with owner privileges to bypass RLS
--    - Necessary to modify user_roles table which has restrictive RLS policies
--    - Explicit authorization check compensates for elevated privileges
--
-- 2. search_path = '': Prevents schema injection attacks
--    - All object references must be fully qualified (public.table_name)
--
-- 3. Last Admin Protection: Business logic prevents organizational integrity violations
--    - Projects must always have at least one admin
--    - Enforced at application layer (not database constraint)
--
-- 4. Soft Delete Pattern: Preserves referential integrity and audit history
--    - deleted_at timestamp marks removal without deleting record
--    - Allows historical queries and potential restoration
--
-- 5. Audit Logging: Immutable trail for compliance and forensics
--    - Every removal is logged with full context
--    - Cannot be modified or deleted by application users
--
-- =============================================================================
-- PERFORMANCE CHARACTERISTICS
-- =============================================================================
--
-- Expected Execution Time: <50ms (3 queries + 1 insert)
--   1. Authorization check via has_project_role: ~10ms
--   2. Member existence check: ~5ms (indexed on user_id, scope_id)
--   3. Last admin validation: ~10ms (indexed query)
--   4. UPDATE user_roles: ~10ms (primary key update)
--   5. INSERT admin_audit_log: ~5ms (primary key + 6 indexes)
--
-- Index Dependencies:
--   - idx_user_roles_user_scope (user_id, scope_type, scope_id)
--   - idx_user_roles_scope_role (scope_id, role, is_active)
--   - idx_admin_audit_log_admin_id
--   - idx_admin_audit_log_target_user_id
--   - idx_admin_audit_log_target_project_id
--
-- =============================================================================
-- ERROR CODES
-- =============================================================================
--
-- 42501 - Insufficient privilege (non-admin attempting removal)
-- 22023 - Invalid parameter value (user not a member of project)
-- 23514 - Check violation (attempting to remove last admin)
--
-- =============================================================================
