-- *** User Roles RLS Policies ***
--
-- Simplified user_roles access - users can only see their own roles
-- This prevents infinite recursion issues with complex policy checks
--
-- MVP2 USAGE NOTE:
-- While the schema supports a full 5-tier role hierarchy with organisation managers,
-- MVP2 uses a simplified model:
-- - All users are members of the "General" organisation by default
-- - Only 2-3 ww_admin users exist (system administrators)
-- - Primary permission model is PROJECT-BASED role assignment (project_admin, project_member)
-- - Organisation manager logic below exists for future expansion but is NOT used in MVP2
-- - In practice, only ww_admin assigns project-level roles in MVP2
--
-- The complex privilege escalation prevention below is technically correct but
-- represents unused code paths in MVP2's single-organisation model.

-- SELECT: Simple, non-recursive role visibility policy
CREATE POLICY "user_roles_select_policy"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND user_id = auth.uid()
  );

-- INSERT: Role assignment with privilege escalation prevention
CREATE POLICY "user_roles_insert_policy"
  ON user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND granted_by = (SELECT auth.uid())
    AND (
      -- System roles: ONLY WW Admins can assign
      (scope_type = 'system' AND role = 'ww_admin' AND
       has_system_role((SELECT auth.uid()), 'ww_admin')) OR

      -- Organisation organisation_manager: Only WW Admins or existing organisation managers
      (scope_type = 'organisation' AND role = 'organisation_manager' AND (
        has_system_role((SELECT auth.uid()), 'ww_admin') OR
        has_organisation_role((SELECT auth.uid()), user_roles.scope_id, 'organisation_manager')
      )) OR

      -- Organisation project_admin: Organisation managers and above
      (scope_type = 'organisation' AND role = 'project_admin' AND (
        has_system_role((SELECT auth.uid()), 'ww_admin') OR
        has_organisation_role((SELECT auth.uid()), user_roles.scope_id, 'organisation_manager')
      )) OR

      -- Organisation project_member: Project admins and above
      (scope_type = 'organisation' AND role = 'project_member' AND (
        has_system_role((SELECT auth.uid()), 'ww_admin') OR
        has_organisation_role((SELECT auth.uid()), user_roles.scope_id, 'organisation_manager') OR
        has_organisation_role((SELECT auth.uid()), user_roles.scope_id, 'project_admin')
      )) OR

      -- Project-specific roles: Project admins and above for that project
      (scope_type = 'project' AND role IN ('project_admin', 'project_member') AND (
        has_system_role((SELECT auth.uid()), 'ww_admin') OR
        has_project_role((SELECT auth.uid()), user_roles.scope_id, 'project_admin') OR
        EXISTS (
          SELECT 1 FROM projects p
          WHERE p.id = user_roles.scope_id
            AND has_organisation_role((SELECT auth.uid()), p.organisation_id, 'project_admin')
        )
      ))
    )
  );

-- UPDATE: Same privilege rules as INSERT for role modifications
CREATE POLICY "user_roles_update_policy"
  ON user_roles
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL AND (
      -- System roles: Only WW Admins can modify
      (scope_type = 'system' AND has_system_role((SELECT auth.uid()), 'ww_admin')) OR

      -- Organisation roles: Appropriate organisation privileges
      (scope_type = 'organisation' AND (
        has_system_role((SELECT auth.uid()), 'ww_admin') OR
        (role IN ('organisation_manager') AND
         has_organisation_role((SELECT auth.uid()), user_roles.scope_id, 'organisation_manager')) OR
        (role IN ('project_admin', 'project_member') AND (
          has_organisation_role((SELECT auth.uid()), user_roles.scope_id, 'organisation_manager') OR
          has_organisation_role((SELECT auth.uid()), user_roles.scope_id, 'project_admin')
        ))
      )) OR

      -- Project roles: Project admins and above
      (scope_type = 'project' AND (
        has_system_role((SELECT auth.uid()), 'ww_admin') OR
        has_project_role((SELECT auth.uid()), user_roles.scope_id, 'project_admin') OR
        EXISTS (
          SELECT 1 FROM projects p
          WHERE p.id = user_roles.scope_id
            AND has_organisation_role((SELECT auth.uid()), p.organisation_id, 'project_admin')
        )
      ))
    )
  )
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL AND (
      -- System roles: Only WW Admins can modify
      (scope_type = 'system' AND has_system_role((SELECT auth.uid()), 'ww_admin')) OR

      -- Organisation roles: Appropriate organisation privileges
      (scope_type = 'organisation' AND (
        has_system_role((SELECT auth.uid()), 'ww_admin') OR
        (role IN ('organisation_manager') AND
         has_organisation_role((SELECT auth.uid()), user_roles.scope_id, 'organisation_manager')) OR
        (role IN ('project_admin', 'project_member') AND (
          has_organisation_role((SELECT auth.uid()), user_roles.scope_id, 'organisation_manager') OR
          has_organisation_role((SELECT auth.uid()), user_roles.scope_id, 'project_admin')
        ))
      )) OR

      -- Project roles: Project admins and above
      (scope_type = 'project' AND (
        has_system_role((SELECT auth.uid()), 'ww_admin') OR
        has_project_role((SELECT auth.uid()), user_roles.scope_id, 'project_admin') OR
        EXISTS (
          SELECT 1 FROM projects p
          WHERE p.id = user_roles.scope_id
            AND has_organisation_role((SELECT auth.uid()), p.organisation_id, 'project_admin')
        )
      ))
    )
  );

-- DELETE: Role removal with same privilege requirements
CREATE POLICY "user_roles_delete_policy"
  ON user_roles
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND deleted_at IS NULL
    AND (
      -- System roles: Only WW Admins can remove
      (scope_type = 'system' AND has_system_role((SELECT auth.uid()), 'ww_admin')) OR

      -- Organisation roles: Appropriate organisation privileges
      (scope_type = 'organisation' AND (
        has_system_role((SELECT auth.uid()), 'ww_admin') OR
        (role IN ('organisation_manager') AND
         has_organisation_role((SELECT auth.uid()), user_roles.scope_id, 'organisation_manager')) OR
        (role IN ('project_admin', 'project_member') AND (
          has_organisation_role((SELECT auth.uid()), user_roles.scope_id, 'organisation_manager') OR
          has_organisation_role((SELECT auth.uid()), user_roles.scope_id, 'project_admin')
        ))
      )) OR

      -- Project roles: Project admins and above
      (scope_type = 'project' AND (
        has_system_role((SELECT auth.uid()), 'ww_admin') OR
        has_project_role((SELECT auth.uid()), user_roles.scope_id, 'project_admin') OR
        EXISTS (
          SELECT 1 FROM projects p
          WHERE p.id = user_roles.scope_id
            AND has_organisation_role((SELECT auth.uid()), p.organisation_id, 'project_admin')
        )
      ))
    )
  )
  WITH CHECK (
    deleted_at IS NOT NULL
  );