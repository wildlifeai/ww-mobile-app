-- OPTIMIZED: Context7 Evidence-Based User Organisation Helper
-- EVIDENCE: Official Supabase SECURITY DEFINER pattern with auth.uid() caching
-- PURPOSE: Get user's primary organisation or validate membership
-- UPDATED: 2025-11-27 - Changed from user_organisations to user_roles
CREATE OR REPLACE FUNCTION get_user_organisation(user_id uuid DEFAULT NULL, organisation_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER  -- CRITICAL: Bypasses RLS to prevent circular dependencies
SET search_path = ''  -- Prevent injection attacks
STABLE  -- Enable caching for performance
AS $$
DECLARE
  check_user_id uuid;
  result_org_id uuid;
BEGIN
  -- EVIDENCE: Use (select auth.uid()) pattern from Context7 for caching
  check_user_id := COALESCE(user_id, (SELECT auth.uid()));

  -- Performance optimization: Return NULL immediately if no user
  IF check_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Case 1: Validate specific organisation membership
  IF organisation_id IS NOT NULL THEN
    SELECT ur.scope_id INTO result_org_id
    FROM public.user_roles ur
    WHERE ur.user_id = check_user_id
      AND ur.scope_type = 'organisation'
      AND ur.scope_id = get_user_organisation.organisation_id
      AND ur.deleted_at IS NULL
    LIMIT 1;

    RETURN result_org_id;
  END IF;

  -- Case 2: Get user's primary organisation (first joined, still active)
  SELECT ur.scope_id INTO result_org_id
  FROM public.user_roles ur
  WHERE ur.user_id = check_user_id
    AND ur.scope_type = 'organisation'
    AND ur.deleted_at IS NULL
  ORDER BY ur.created_at ASC
  LIMIT 1;

  RETURN result_org_id;
END;
$$;

COMMENT ON FUNCTION get_user_organisation IS 'OPTIMIZED: Context7 evidence-based helper for user organisation access. Validates membership or returns primary org. Uses auth.uid() caching. Updated 2025-11-27 to use user_roles table.';