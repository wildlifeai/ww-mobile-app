-- OPTIMIZED: Context7 Evidence-Based System Role Helper Function
-- EVIDENCE: Official Supabase SECURITY DEFINER pattern with auth.uid() caching
-- FIXES: Auth context resolution, role inheritance, and circular RLS dependencies
CREATE OR REPLACE FUNCTION has_system_role(user_id uuid DEFAULT NULL, required_role text DEFAULT 'ww_admin')
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

  -- Performance optimization: Return false immediately if no user
  IF check_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Check system-level role with all constraints
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = check_user_id
      AND ur.role = required_role
      AND ur.scope_type = 'system'
      AND ur.is_active = true
      AND ur.deleted_at IS NULL
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
  );
END;
$$;

COMMENT ON FUNCTION has_system_role IS 'OPTIMIZED: Context7 evidence-based system role checker. Uses auth.uid() caching pattern and SECURITY DEFINER to prevent RLS circular dependencies.';

-- Ensure authenticated users can execute
GRANT EXECUTE ON FUNCTION public.has_system_role(uuid, text) TO authenticated;