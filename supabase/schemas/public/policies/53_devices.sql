-- *** Devices RLS Policies ***
-- UPDATED: 2025-11-27 - Replaced project_members with user_roles
-- UPDATED: 2025-11-27 - Adapted for MVP2 schema (devices linked via device_preparation)

-- SELECT: Project members can view devices linked to their projects via device_preparation
CREATE POLICY "Project members can view active devices"
  ON devices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM device_preparation dp
      INNER JOIN user_roles ur ON ur.scope_type = 'project' AND ur.scope_id = dp.project_id
      WHERE dp.id IN (
        SELECT device_preparation_id FROM deployments WHERE device_preparation_id IS NOT NULL
      )
        AND ur.user_id = auth.uid()
        AND ur.is_active = true
        AND ur.deleted_at IS NULL
    )
    OR
    -- Organisation members can view devices in their organisation
    EXISTS (
      SELECT 1
      FROM user_roles ur
      WHERE ur.scope_type = 'organisation'
        AND ur.scope_id = devices.organisation_id
        AND ur.user_id = auth.uid()
        AND ur.is_active = true
        AND ur.deleted_at IS NULL
    )
  );

-- UPDATE: Organisation managers and admins can update devices
CREATE POLICY "Organisation managers can update devices"
  ON devices
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL AND (
      has_system_role((SELECT auth.uid()), 'ww_admin') OR
      has_organisation_role((SELECT auth.uid()), devices.organisation_id, 'organisation_manager')
    )
  )
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL AND (
      has_system_role((SELECT auth.uid()), 'ww_admin') OR
      has_organisation_role((SELECT auth.uid()), devices.organisation_id, 'organisation_manager')
    )
  );

-- UPDATE: Organisation managers and admins can soft-delete devices
CREATE POLICY "Organisation managers can soft-delete devices"
  ON devices
  FOR UPDATE
  TO authenticated
  USING (
    has_system_role((SELECT auth.uid()), 'ww_admin') OR
    has_organisation_role((SELECT auth.uid()), devices.organisation_id, 'organisation_manager')
  )
  WITH CHECK (
    deleted_at IS NOT NULL
  );

COMMENT ON POLICY "Project members can view active devices" ON devices
IS 'Updated 2025-11-27: Uses user_roles and device_preparation for project/organisation association';
