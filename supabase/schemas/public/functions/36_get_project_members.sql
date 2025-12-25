-- FUNCTION: get_project_members
-- PURPOSE: List all active project members with role details and granter information
-- TASK 13: Backend support for mobile app project team display
-- SECURITY: DEFINER with proper authorization check
-- PERFORMANCE: STABLE for query optimization
CREATE OR REPLACE FUNCTION public.get_project_members(
  p_project_id UUID,
  p_requesting_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  email TEXT,
  role TEXT,
  granted_at TIMESTAMPTZ,
  granted_by UUID,
  granted_by_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
DECLARE
  check_user_id UUID;
BEGIN
  -- Resolve requesting user (default to authenticated user)
  check_user_id := COALESCE(p_requesting_user_id, (SELECT auth.uid()));

  -- Validation: Ensure user and project are provided
  IF check_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_project_id IS NULL THEN
    RAISE EXCEPTION 'Parameter p_project_id cannot be null' USING ERRCODE = '22004';
  END IF;

  -- Security check: Must be project member (or admin) or ww_admin to view members
  IF NOT (
    public.has_system_role(check_user_id, 'ww_admin') OR
    public.has_project_role(check_user_id, p_project_id, 'project_admin') OR
    public.has_project_role(check_user_id, p_project_id, 'project_member')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Must be project member or system admin to view members' USING ERRCODE = '42501';
  END IF;

  -- Return project members with granter details
  RETURN QUERY
  SELECT
    u.id,
    u.name,
    au.email::text,
    ur.role,
    ur.granted_at,
    ur.granted_by,
    granter.name AS granted_by_name
  FROM public.user_roles ur
  JOIN public.users u ON ur.user_id = u.id
  JOIN auth.users au ON u.id = au.id
  LEFT JOIN public.users granter ON ur.granted_by = granter.id
  WHERE ur.scope_type = 'project'
    AND ur.scope_id = p_project_id
    AND ur.is_active = true
    AND ur.deleted_at IS NULL
    AND u.deleted_at IS NULL
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
  ORDER BY
    -- Sort by role hierarchy
    CASE ur.role
      WHEN 'project_admin' THEN 1
      WHEN 'project_member' THEN 2
      ELSE 3
    END,
    u.name;
END;
$$;

COMMENT ON FUNCTION public.get_project_members IS 'Task 13: Returns active project members with role details and granter information. Security: DEFINER with permission check (project_member or ww_admin). Performance: STABLE for caching.';
