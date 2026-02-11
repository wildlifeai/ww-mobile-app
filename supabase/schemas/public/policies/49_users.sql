-- *** Users Table RLS Policies ***
--
-- Security model:
-- 1. Users can always view their own profile.
-- 2. Users can view profiles of other users they share a project with.
-- 3. Users can view profiles of other users they share an organisation with.
-- 4. WW Admins can view all profiles.

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- SELECT: Profile visibility
CREATE POLICY "users_select_policy"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (
    -- 1. Can see own profile
    id = auth.uid()
    OR
    -- 4. WW Admins can see all
    public.has_system_role(auth.uid(), 'ww_admin')
    OR
    -- 2. Can see others in shared projects
    EXISTS (
      SELECT 1 FROM public.user_roles my_roles
      JOIN public.user_roles other_roles ON my_roles.scope_id = other_roles.scope_id
      WHERE my_roles.user_id = auth.uid()
        AND other_roles.user_id = public.users.id
        AND my_roles.scope_type = 'project'
        AND other_roles.scope_type = 'project'
        AND my_roles.is_active = true
        AND other_roles.is_active = true
    )
    OR
    -- 3. Can see others in shared organisations
    EXISTS (
      SELECT 1 FROM public.user_roles my_org_roles
      JOIN public.user_roles other_org_roles ON my_org_roles.scope_id = other_org_roles.scope_id
      WHERE my_org_roles.user_id = auth.uid()
        AND other_org_roles.user_id = public.users.id
        AND my_org_roles.scope_type = 'organisation'
        AND other_org_roles.scope_type = 'organisation'
        AND my_org_roles.is_active = true
        AND other_org_roles.is_active = true
    )
  );

-- UPDATE: Users can only update their own profile
CREATE POLICY "users_update_policy"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- NOTE: INSERT is usually handled by a trigger on auth.users, but we allow it for completeness
CREATE POLICY "users_insert_policy"
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid() OR public.has_system_role(auth.uid(), 'ww_admin'));
