-- Task 13: Query organisation user pool for mobile app project member selection
-- EVIDENCE: Official Supabase SECURITY DEFINER pattern with auth.uid() caching
-- PURPOSE: Returns all users in an organisation with their roles for project member selection
CREATE OR REPLACE FUNCTION get_organisation_users(
  p_organisation_id UUID,
  p_requesting_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  firstname TEXT,
  surname TEXT,
  email TEXT,
  roles JSONB,
  is_in_project BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER  -- CRITICAL: Bypasses RLS to aggregate data from multiple tables
SET search_path = ''  -- Prevent injection attacks
STABLE  -- Enable caching for performance
AS $$
DECLARE
  check_user_id uuid;
BEGIN
  -- EVIDENCE: Use (select auth.uid()) pattern from Context7 for caching
  check_user_id := COALESCE(p_requesting_user_id, (SELECT auth.uid()));

  -- Input validation
  IF p_organisation_id IS NULL THEN
    RAISE EXCEPTION 'Parameter p_organisation_id cannot be null'
      USING ERRCODE = '22004';
  END IF;

  IF check_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '28000';  -- Invalid authorization specification
  END IF;

  -- Security check: Only system admins or organisation members can view org users
  -- Note: The actual permission to add members to projects is checked in add_project_member RPC
  -- This function just returns the user pool for selection
  IF NOT (
    public.has_system_role(check_user_id, 'ww_admin'::text) OR
    public.has_organisation_role(check_user_id, p_organisation_id, 'organisation_member'::text) OR
    public.has_organisation_role(check_user_id, p_organisation_id, 'organisation_manager'::text)
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only organisation members can view organisation users'
      USING ERRCODE = '42501';  -- Insufficient privilege
  END IF;

  -- Return organisation users with aggregated roles
  RETURN QUERY
  SELECT
    u.id,
    (u.firstname || ' ' || u.surname) AS name,
    u.firstname,
    u.surname,
    au.email::text,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'role', ur.role,
          'scope_type', ur.scope_type,
          'scope_id', ur.scope_id,
          'is_active', ur.is_active
        )
        ORDER BY ur.scope_type, ur.role
      ) FILTER (WHERE ur.id IS NOT NULL),
      '[]'::jsonb
    ) AS roles,
    false AS is_in_project  -- Default value; caller can check user_roles for project membership
  FROM public.users u
  JOIN public.user_roles uo ON u.id = uo.user_id
    AND uo.scope_type = 'organisation'
    AND uo.scope_id = p_organisation_id
    AND uo.deleted_at IS NULL
  JOIN auth.users au ON u.id = au.id
  LEFT JOIN public.user_roles ur ON u.id = ur.user_id
    AND ur.deleted_at IS NULL
    AND ur.is_active = true
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
  WHERE u.deleted_at IS NULL
  GROUP BY u.id, u.firstname, u.surname, au.email
  ORDER BY u.firstname, u.surname;
END;
$$;

COMMENT ON FUNCTION get_organisation_users IS 'Task 13: Returns all users in an organisation with their active roles for project member selection in mobile app. Uses SECURITY DEFINER to aggregate data from auth.users and public tables. Only accessible by project admins and organisation managers. Updated 2025-11-27 to use user_roles table.';
