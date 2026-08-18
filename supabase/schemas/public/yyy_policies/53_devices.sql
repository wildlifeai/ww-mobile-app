-- *** Devices RLS Policies ***
-- Joins deployments via device_id natively

-- SELECT: Project members can view devices linked to their projects via deployments
CREATE POLICY "Project members can view active devices"
  ON devices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM deployments AS d
      INNER JOIN user_roles AS ur ON ur.scope_type = 'project' AND d.project_id = ur.scope_id
      WHERE d.device_id = devices.id
        AND d.deleted_at IS NULL
        AND ur.user_id = auth.uid()
        AND ur.is_active = TRUE
        AND ur.deleted_at IS NULL
    )
    OR
    -- Organisation members can view devices in their organisation
    EXISTS (
      SELECT 1
      FROM user_roles AS ur
      WHERE ur.scope_type = 'organisation'
        AND ur.scope_id = devices.organisation_id
        AND ur.user_id = auth.uid()
        AND ur.is_active = TRUE
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
      has_system_role((SELECT auth.uid()), 'ww_admin')
      OR has_organisation_role((SELECT auth.uid()), devices.organisation_id, 'organisation_manager')
    )
  )
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL AND (
      has_system_role((SELECT auth.uid()), 'ww_admin')
      OR has_organisation_role((SELECT auth.uid()), devices.organisation_id, 'organisation_manager')
    )
  );

-- UPDATE: Organisation managers and admins can soft-delete devices
CREATE POLICY "Organisation managers can soft-delete devices"
  ON devices
  FOR UPDATE
  TO authenticated
  USING (
    has_system_role((SELECT auth.uid()), 'ww_admin')
    OR has_organisation_role((SELECT auth.uid()), devices.organisation_id, 'organisation_manager')
  )
  WITH CHECK (
    deleted_at IS NOT NULL
  );

COMMENT ON POLICY "Project members can view active devices" ON devices
IS 'Uses user_roles and deployments for project/organisation association';
