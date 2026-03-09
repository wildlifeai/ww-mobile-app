-- *** User Roles RLS Policies ***
--
-- IMPORTANT: user_roles policies CANNOT call has_system_role(), has_project_role(),
-- or has_organisation_role() because those functions read from user_roles,
-- causing infinite recursion in PostgreSQL's policy evaluation.
--
-- MVP2 approach:
-- - SELECT: Users can only see their own roles
-- - INSERT/UPDATE/DELETE: Only via service_role (server-side functions)
--   The has_system_role/has_project_role checks are done in the API layer
--   or through SECURITY DEFINER functions that bypass RLS.
--
-- This avoids the infinite recursion problem while maintaining security.
-- Role assignment in practice goes through:
-- 1. tests.assign_role() - test helper (runs as postgres)
-- 2. respond_to_invitation() - SECURITY DEFINER function
-- 3. handle_new_user() trigger - runs as postgres
-- 4. Service role API calls

-- SELECT: Users can see their own roles only
-- Admin-level role visibility is achieved via service_role (bypasses RLS).
CREATE POLICY "user_roles_select_policy"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND user_id = (SELECT auth.uid())
  );

-- INSERT: Disabled for authenticated users (use service_role or SECURITY DEFINER functions)
-- Role assignment is handled by server-side functions to avoid recursion
-- No INSERT policy = default deny for authenticated role

-- UPDATE: Disabled for authenticated users (use service_role or SECURITY DEFINER functions)
-- No UPDATE policy = default deny for authenticated role

-- Note: The old policies with has_system_role/has_project_role checks caused
-- infinite recursion (42P17) because PostgreSQL's policy planner detects
-- that evaluating user_roles policies requires reading user_roles.
-- Even though has_system_role is SECURITY DEFINER (runs as postgres/superuser),
-- the planner rejects the dependency cycle before runtime evaluation.