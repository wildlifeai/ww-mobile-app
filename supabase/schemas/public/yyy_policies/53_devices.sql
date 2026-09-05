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

-- INSERT: Organisation members and admins can register a device
--
-- Without this policy the table had no INSERT route at all, and under RLS that
-- denies every role including ww_admin. The mobile app registers a camera it
-- meets over BLE and pushes the row on the next sync, so every such push failed
-- with 42501; because the app uploads projects, then devices, then deployments
-- and stops the chain on the first failure, no deployment could reach the cloud
-- either (#178, and wildlifeai/ww-mobile-app#287 for the chain behaviour).
--
-- Deliberately `organisation_member`, one tier below the UPDATE policy's
-- `organisation_manager` (Victor, 5 September 2026). The person holding a new
-- camera in a valley is a field user, and field users are usually not managers,
-- so requiring a manager to register hardware would leave the common case broken
-- in a less obvious way. Adding a device to an organisation you already belong to
-- is also the mildest of the three writes: it creates a row scoped to that
-- organisation and grants nobody anything.
--
-- The tenant boundary is unchanged. `has_organisation_role` matches on the
-- device's own organisation_id, so a member of org A still cannot register a
-- device into org B; test 18 pins that.
--
-- Note this is strictly wider than UPDATE: a member may create a device and then
-- not be allowed to rename it. That asymmetry is intentional for now, but it is
-- the obvious thing to revisit if field users start reporting they cannot correct
-- a device they just added.
CREATE POLICY "Organisation members can add devices"
  ON devices
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL AND (
      has_system_role((SELECT auth.uid()), 'ww_admin')
      OR has_organisation_role((SELECT auth.uid()), devices.organisation_id, 'organisation_member')
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
