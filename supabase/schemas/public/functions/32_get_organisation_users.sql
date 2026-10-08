-- Task 13: Query organisation user pool for mobile app project member selection
-- EVIDENCE: Official Supabase SECURITY DEFINER pattern with auth.uid() caching
-- PURPOSE: Returns all users in an organisation with their roles for project member selection
CREATE OR REPLACE FUNCTION get_organisation_users(
  p_organisation_id UUID
)
RETURNS TABLE (
  id UUID,
  name TEXT,
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
  -- Get authenticated user
  check_user_id := auth.uid();

  -- Input validation
  IF p_organisation_id IS NULL THEN
    RAISE EXCEPTION 'Parameter p_organisation_id cannot be null'
      USING ERRCODE = '22004';
  END IF;

  IF check_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '28000';  -- Invalid authorization specification
  END IF;

  -- General is refused outright. handle_new_user enrols every account in it, so
  -- listing General lists the whole platform, emails included, and there is no
  -- team to build from it. This used to be reachable by any account at all,
  -- since every account is an organisation_member of General (test 22).
  IF EXISTS (
    SELECT 1 FROM public.organisations o
    WHERE o.id = p_organisation_id AND o.slug = 'general'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: the General organisation contains every account and cannot be listed'
      USING ERRCODE = '42501';
  END IF;

  -- Security check: only an organisation manager of this organisation, or a
  -- system admin, may see its people and their emails. Ordinary members could,
  -- before; that is what made General a full email list. This is the rule the
  -- COMMENT below always described. The actual permission to add members to
  -- projects is still checked in add_project_member.
  IF NOT (
    public.has_system_role(check_user_id, 'ww_admin'::text) OR
    public.has_organisation_role(check_user_id, p_organisation_id, 'organisation_manager'::text)
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only organisation managers can view organisation users'
      USING ERRCODE = '42501';  -- Insufficient privilege
  END IF;

  -- Return organisation users with aggregated roles
  RETURN QUERY
  SELECT
    u.id,
    (u.firstname || ' ' || u.surname) AS name,
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
    -- SECURITY FIX: Only include roles within this organisation
    AND (
      (ur.scope_type = 'organisation' AND ur.scope_id = p_organisation_id)
      OR (ur.scope_type = 'project' AND EXISTS (
        SELECT 1 FROM public.projects p 
        WHERE p.id = ur.scope_id 
        AND p.organisation_id = p_organisation_id
        AND p.deleted_at IS NULL
      ))
    )
  WHERE u.deleted_at IS NULL
  GROUP BY u.id, u.firstname, u.surname, au.email
  ORDER BY (u.firstname || ' ' || u.surname);
END;
$$;

COMMENT ON FUNCTION get_organisation_users IS 'Task 13: Returns all users in an organisation with their active roles for project member selection in mobile app. Uses SECURITY DEFINER to aggregate data from auth.users and public tables. Only accessible by project admins and organisation managers. Updated 2026-02-11 to use firstname/surname, remove user impersonation vulnerability, and fix information leakage by filtering roles to organisation scope.';
