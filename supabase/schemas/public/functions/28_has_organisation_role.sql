-- OPTIMIZED: Context7 Evidence-Based Organisation Role Helper
-- EVIDENCE: Official Supabase SECURITY DEFINER + auth.uid() caching patterns
-- FIXES: Proper role inheritance - ww_admin has unrestricted system access
-- UPDATED: 2025-11-28 - Fixed ww_admin scoping to allow full system access
CREATE OR REPLACE FUNCTION has_organisation_role(user_id uuid DEFAULT NULL, organisation_id uuid DEFAULT NULL, required_role text DEFAULT 'project_member')
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER  -- CRITICAL: Bypasses RLS to prevent circular dependencies
SET search_path = ''  -- Prevent injection attacks
STABLE  -- Enable caching for performance
AS $$
DECLARE
  check_user_id uuid;
BEGIN
  -- EVIDENCE: Use (select auth.uid()) pattern from Context7 for caching
  check_user_id := COALESCE(user_id, (SELECT auth.uid()));

  -- Performance optimization: Return false immediately if missing parameters
  IF check_user_id IS NULL OR organisation_id IS NULL THEN
    RETURN false;
  END IF;

  -- Check organisation role with hierarchy
  -- organisation_manager > organisation_member/project_admin > project_member
  IF EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = check_user_id
      AND ur.scope_type = 'organisation'
      AND ur.scope_id = organisation_id
      AND ur.is_active = true
      AND ur.deleted_at IS NULL
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
      AND (
        ur.role = required_role OR                                     -- Exact match
        ur.role = 'organisation_manager' OR                            -- Manager has all privileges
        (required_role = 'project_member' AND ur.role IN ('organisation_member', 'project_admin')) -- Admin/Member can see projects
      )
  ) THEN
    RETURN true;
  END IF;

  -- SECURITY ENHANCEMENT: System admin has unrestricted access
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = check_user_id
      AND ur.role = 'ww_admin'
      AND ur.scope_type = 'system'
      AND ur.is_active = true
      AND ur.deleted_at IS NULL
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
  );
END;
$$;

COMMENT ON FUNCTION has_organisation_role IS 'OPTIMIZED: Context7 evidence-based organisation role checker. System admins (ww_admin) have unrestricted access to all organisations. Updated 2025-11-28 to fix ww_admin scoping.';