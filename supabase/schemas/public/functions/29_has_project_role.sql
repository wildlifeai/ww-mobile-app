-- OPTIMIZED: Context7 Evidence-Based Project Role Helper with Hierarchy
-- EVIDENCE: Official Supabase SECURITY DEFINER + auth.uid() caching patterns
-- IMPLEMENTS: Complete role hierarchy - direct project, organisation inheritance, system admin
-- UPDATED: 2025-11-28 - Fixed ww_admin scoping for unrestricted access
CREATE OR REPLACE FUNCTION has_project_role(user_id uuid DEFAULT NULL, project_id uuid DEFAULT NULL, required_role text DEFAULT 'project_member')
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER  -- CRITICAL: Bypasses RLS to prevent circular dependencies
SET search_path = ''  -- Prevent injection attacks
VOLATILE  -- Must be volatile to react to tests switching `auth.uid()` mid-transaction
AS $$
DECLARE
  check_user_id uuid;
BEGIN
  -- EVIDENCE: Use (select auth.uid()) pattern from Context7 for caching
  check_user_id := COALESCE(user_id, (SELECT auth.uid()));

  -- Performance optimization: Return false immediately if missing parameters
  IF check_user_id IS NULL OR project_id IS NULL THEN
    RETURN false;
  END IF;

  -- 1. Check direct project role (with hierarchy)
  -- HIERARCHY: project_admin inherits project_member permissions
  IF EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = check_user_id
      AND ur.scope_type = 'project'
      AND ur.scope_id = project_id
      AND ur.is_active = true
      AND ur.deleted_at IS NULL
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
      AND CASE required_role
            -- project_viewer is the lowest (read-only) tier: members and admins
            -- also satisfy a viewer-level (read) check, but a viewer does NOT
            -- satisfy a project_member check, so write policies still exclude them.
            WHEN 'project_viewer' THEN
              ur.role IN ('project_viewer', 'project_member', 'project_admin')
            WHEN 'project_member' THEN
              ur.role IN ('project_member', 'project_admin')
            WHEN 'project_admin' THEN
              ur.role = 'project_admin'
            ELSE
              ur.role = required_role
          END
  ) THEN
    RETURN true;
  END IF;

  -- 2. Check organisation-level role inheritance for this project (with hierarchy)
  -- HIERARCHY: project_admin inherits project_member permissions at org level too
  IF EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.projects p ON p.id = has_project_role.project_id
    WHERE ur.user_id = check_user_id
      AND ur.scope_type = 'organisation'
      AND ur.scope_id = p.organisation_id
      AND ur.is_active = true
      AND ur.deleted_at IS NULL
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
      AND p.deleted_at IS NULL
      AND CASE required_role
            -- project_viewer is the lowest (read-only) tier: members and admins
            -- also satisfy a viewer-level (read) check, but a viewer does NOT
            -- satisfy a project_member check, so write policies still exclude them.
            WHEN 'project_viewer' THEN
              ur.role IN ('project_viewer', 'project_member', 'project_admin')
            WHEN 'project_member' THEN
              ur.role IN ('project_member', 'project_admin')
            WHEN 'project_admin' THEN
              ur.role = 'project_admin'
            ELSE
              ur.role = required_role
          END
  ) THEN
    RETURN true;
  END IF;

  -- 3. SECURITY ENHANCEMENT: System admin has unrestricted access
  -- ww_admin gets full system access without requiring organisation membership
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

COMMENT ON FUNCTION has_project_role IS 'OPTIMIZED: Context7 evidence-based project role checker with complete hierarchy (direct/org/system). System admins (ww_admin) have unrestricted access. Updated 2025-11-28 to fix ww_admin scoping.';

-- Ensure authenticated users can execute
GRANT EXECUTE ON FUNCTION public.has_project_role(uuid, uuid, text) TO authenticated;

