-- *** Devices RLS Policies ***
-- Joins deployments via device_id natively

-- SELECT: any signed-in user but the demo account (#327, can_read_device)
CREATE POLICY "Signed-in users can view active devices"
  ON devices
  FOR SELECT
  TO authenticated
  USING (
    -- Soft-deleted rows are invisible to clients (#160); pull_changes learns of
    -- deletions through sync_deleted_ids. The read rule is can_read_device, shared
    -- with that helper.
    devices.deleted_at IS NULL
    AND can_read_device(devices.id, devices.organisation_id)
  );

-- INSERT: any signed-in user but the demo account registers a camera (#327). Cameras
-- belong to no organisation, so organisation_id is not checked: a field user invited to one
-- project registers the camera in their hand. Registering creates a row and grants nobody
-- anything.
CREATE POLICY "Signed-in users can add devices"
  ON devices
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL AND NOT public.caller_is_demo()
  );

-- UPDATE: a project_admin of a project that has a live deployment of the camera, or a
-- ww_admin (#327). trg_devices_lock_columns leaves the project admin only the name: the
-- Bluetooth id, LoRaWAN EUI and organisation are ww_admin's, because a camera's EUI decides
-- which deployment receives its LoRaWAN messages (#323).
CREATE POLICY "Deploying project admins can update devices"
  ON devices
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL AND (
      has_system_role((SELECT auth.uid()), 'ww_admin')
      OR EXISTS (
        SELECT 1 FROM deployments AS d
        WHERE d.device_id = devices.id
          AND d.deleted_at IS NULL
          AND has_project_role((SELECT auth.uid()), d.project_id, 'project_admin')
      )
    )
  )
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL AND (
      has_system_role((SELECT auth.uid()), 'ww_admin')
      OR EXISTS (
        SELECT 1 FROM deployments AS d
        WHERE d.device_id = devices.id
          AND d.deleted_at IS NULL
          AND has_project_role((SELECT auth.uid()), d.project_id, 'project_admin')
      )
    )
  );

-- Soft deletes go through soft_delete_device (SECURITY DEFINER), not an UPDATE policy:
-- the SELECT policy hides soft-deleted rows, and Postgres checks an UPDATE's new row
-- against it, so no client UPDATE that sets deleted_at can pass (#160).

COMMENT ON POLICY "Signed-in users can view active devices" ON devices
IS 'Any signed-in user except the demo account reads a live camera (#327); see can_read_device';
