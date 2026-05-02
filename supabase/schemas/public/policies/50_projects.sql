-- *** Projects RLS Policies ***
--
-- Organisation-scoped project access with multi-tenant isolation
-- - Projects are isolated by organisation
-- - Users can only see projects they have roles for
-- - Cross-organisation access is prevented
-- - Role-based access within organisation boundaries
-- - WW Admins have unrestricted access to all projects
-- UPDATED: 2025-11-28 - Clarified ww_admin unrestricted access

-- SELECT: Role-based project visibility
-- Users can see projects they have roles for
-- SELECT: Role-based project visibility (MVP2: Strict Isolation)
-- Users can ONLY see projects they have direct roles for (or WW Admin)
CREATE POLICY "projects_select_policy"
  ON projects
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL AND (
      -- WW Admins can see all projects
      has_system_role((SELECT auth.uid()), 'ww_admin') OR
      -- Users can see projects they have project-level roles for
      EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.scope_type = 'project'
          AND ur.scope_id::uuid = projects.id
          AND ur.user_id = (SELECT auth.uid())
          AND ur.is_active = true
          AND ur.deleted_at IS NULL
      )
    )
  );

-- INSERT: Authenticated users can create projects (MVP2: Users can become project admins)
CREATE POLICY "projects_insert_policy"
  ON projects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND created_by = (SELECT auth.uid())
  );

-- UPDATE: Project admins can update (MVP2: No Org Managers)
CREATE POLICY "projects_update_policy"
  ON projects
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL AND (
      has_system_role((SELECT auth.uid()), 'ww_admin') OR
      has_project_role((SELECT auth.uid()), projects.id, 'project_admin')
    )
  )
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL AND (
      has_system_role((SELECT auth.uid()), 'ww_admin') OR
      has_project_role((SELECT auth.uid()), projects.id, 'project_admin')
    )
  );

-- DELETE: Project deletion (soft delete) with same privileges as update
CREATE POLICY "projects_delete_policy"
  ON projects
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND deleted_at IS NULL -- Can only soft delete active projects
    -- Must have appropriate role
    AND (
      has_system_role((SELECT auth.uid()), 'ww_admin') OR
      has_project_role((SELECT auth.uid()), projects.id, 'project_admin')
    )
  )
  WITH CHECK (
    deleted_at IS NOT NULL -- Ensure it's being soft deleted
  );

COMMENT ON POLICY "projects_select_policy" ON projects
IS 'Updated 2025-11-27: Uses user_roles instead of project_members';

COMMENT ON POLICY "projects_update_policy" ON projects
IS 'Updated 2025-11-27: Removed user_organisations dependency';

COMMENT ON POLICY "projects_delete_policy" ON projects
IS 'Updated 2025-11-27: Removed user_organisations dependency';
