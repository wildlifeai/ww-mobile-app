-- *** Devices RLS Policies ***
-- UPDATED: 2026-03-27 - Deprecated device_preparation (Phase 1)
-- Now joins deployments via device_id natively

-- SELECT: Project members can view devices linked to their projects via deployments
CREATE POLICY "Project members can view active devices"
  ON devices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM deployments d
      INNER JOIN user_roles ur ON ur.scope_type = 'project' AND ur.scope_id = d.project_id
      WHERE d.device_id = devices.id
        AND d.deleted_at IS NULL
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
