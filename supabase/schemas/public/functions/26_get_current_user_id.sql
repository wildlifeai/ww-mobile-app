-- OPTIMIZED: Context7 Evidence-Based Auth Helper Function
-- Based on official Supabase RLS performance patterns from Context7 research
-- CRITICAL: Uses (select auth.uid()) pattern for caching and SECURITY DEFINER for RLS bypass
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER  -- CRITICAL: Bypasses RLS to prevent circular dependencies
SET search_path = ''  -- Prevent injection attacks
STABLE  -- Enable caching for performance
AS $$
BEGIN
  -- EVIDENCE: Official Supabase pattern from Context7 - (select auth.uid()) enables caching
  -- Fallback to JWT claims for test environments (Supabase test helper compatibility)
  RETURN COALESCE(
    (SELECT auth.uid()),  -- Primary: Use cached auth context
    NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid  -- Test fallback
  );
END;
$$;

COMMENT ON FUNCTION get_current_user_id IS 'OPTIMIZED: Auth helper with Context7 caching pattern. Uses (select auth.uid()) for performance and test compatibility.';