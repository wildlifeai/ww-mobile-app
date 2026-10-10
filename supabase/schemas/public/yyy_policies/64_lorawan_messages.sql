-- *** LoRaWAN Messages RLS Policies ***
--
-- Access control for raw LoRaWAN messages from camera devices
-- - The deployment's project and ww_admin read a message
-- - System processes (via service role) can insert messages
-- - Only system admins can delete messages
--

-- SELECT: a message is its deployment's project's data (#323). Any project may deploy a
-- camera (#320), so the camera's organisation no longer reads its messages, and a
-- message with no deployment is for ww_admin only. has_project_role counts an
-- organisation manager as a viewer of every project in the organisation (#162).
CREATE POLICY "lorawan_messages_select_policy"
  ON lorawan_messages
  FOR SELECT
  TO authenticated
  USING (
    has_system_role((SELECT auth.uid()), 'ww_admin')
    OR EXISTS (
      SELECT 1 FROM deployments AS dep
      WHERE dep.id = lorawan_messages.deployment_id
        AND dep.deleted_at IS NULL
        AND has_project_role((SELECT auth.uid()), dep.project_id, 'project_viewer')
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
IS 'The deployment''s project members and ww_admins can view a LoRaWAN message (#323)';

COMMENT ON POLICY "lorawan_messages_insert_policy" ON lorawan_messages
IS 'Only ww_admins can insert messages (backend services use service role which bypasses RLS)';

COMMENT ON POLICY "lorawan_messages_update_policy" ON lorawan_messages
IS 'Only ww_admins can update messages (e.g., mark as processed)';

COMMENT ON POLICY "lorawan_messages_delete_policy" ON lorawan_messages
IS 'Only ww_admins can delete messages';
