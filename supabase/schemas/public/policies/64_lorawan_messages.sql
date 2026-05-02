-- *** LoRaWAN Messages RLS Policies ***
--
-- Access control for raw LoRaWAN messages from camera devices
-- - Users can only see messages from devices/deployments in their organisation
-- - System processes (via service role) can insert messages
-- - Only system admins can delete messages
--

-- SELECT: Users can see messages from their organisation's devices/deployments
CREATE POLICY "lorawan_messages_select_policy"
  ON lorawan_messages
  FOR SELECT
  TO authenticated
  USING (
    -- WW Admins can see all messages
    has_system_role((SELECT auth.uid()), 'ww_admin') OR
    -- Users can see messages from devices in their organisation
    EXISTS (
      SELECT 1 FROM devices d
      WHERE d.id = lorawan_messages.device_id
        AND d.deleted_at IS NULL
        AND has_organisation_role((SELECT auth.uid()), d.organisation_id, 'organisation_member')
    ) OR
    -- Users can see messages from deployments in projects they're members of
    EXISTS (
      SELECT 1 FROM deployments dep
      WHERE dep.id = lorawan_messages.deployment_id
        AND dep.deleted_at IS NULL
        AND has_project_role((SELECT auth.uid()), dep.project_id, 'project_member')
    )
  );

-- INSERT: System processes can insert messages (typically via service role)
-- Note: This policy allows authenticated users, but in practice, messages are inserted
-- by backend services using the service role key which bypasses RLS
CREATE POLICY "lorawan_messages_insert_policy"
  ON lorawan_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- WW Admins can insert messages (for testing/debugging)
    has_system_role((SELECT auth.uid()), 'ww_admin')
  );

-- UPDATE: Only system admins can update messages (e.g., mark as processed)
CREATE POLICY "lorawan_messages_update_policy"
  ON lorawan_messages
  FOR UPDATE
  TO authenticated
  USING (
    has_system_role((SELECT auth.uid()), 'ww_admin')
  )
  WITH CHECK (
    has_system_role((SELECT auth.uid()), 'ww_admin')
  );

-- DELETE: Only system admins can delete messages
CREATE POLICY "lorawan_messages_delete_policy"
  ON lorawan_messages
  FOR DELETE
  TO authenticated
  USING (
    has_system_role((SELECT auth.uid()), 'ww_admin')
  );

COMMENT ON POLICY "lorawan_messages_select_policy" ON lorawan_messages
IS 'Users can view LoRaWAN messages from their organisation''s devices or project deployments';

COMMENT ON POLICY "lorawan_messages_insert_policy" ON lorawan_messages
IS 'Only ww_admins can insert messages (backend services use service role which bypasses RLS)';

COMMENT ON POLICY "lorawan_messages_update_policy" ON lorawan_messages
IS 'Only ww_admins can update messages (e.g., mark as processed)';

COMMENT ON POLICY "lorawan_messages_delete_policy" ON lorawan_messages
IS 'Only ww_admins can delete messages';
