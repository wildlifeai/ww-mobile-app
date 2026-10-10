-- *** LoRaWAN Parsed Messages RLS Policies ***
--
-- Access control for parsed LoRaWAN messages (structured data from raw messages)
-- - The raw message's deployment's project and ww_admin read a parsed message
-- - System processes (via service role) can insert/update messages
-- - Only system admins can delete messages
--

-- SELECT: the same rule as lorawan_messages (#323), through the raw message's deployment.
CREATE POLICY "lorawan_parsed_messages_select_policy"
  ON lorawan_parsed_messages
  FOR SELECT
  TO authenticated
  USING (
    has_system_role((SELECT auth.uid()), 'ww_admin')
    OR EXISTS (
      SELECT 1
      FROM lorawan_messages AS lm
      INNER JOIN deployments AS dep ON lm.deployment_id = dep.id
      WHERE lm.id = lorawan_parsed_messages.lorawan_message_id
        AND dep.deleted_at IS NULL
        AND has_project_role((SELECT auth.uid()), dep.project_id, 'project_viewer')
    )
  );

-- INSERT: System processes can insert parsed messages (typically via service role)
-- Note: Backend message parser uses service role which bypasses RLS
CREATE POLICY "lorawan_parsed_messages_insert_policy"
  ON lorawan_parsed_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- WW Admins can insert messages (for testing/debugging)
    has_system_role((SELECT auth.uid()), 'ww_admin')
  );

-- UPDATE: Only system admins can update parsed messages
CREATE POLICY "lorawan_parsed_messages_update_policy"
  ON lorawan_parsed_messages
  FOR UPDATE
  TO authenticated
  USING (
    has_system_role((SELECT auth.uid()), 'ww_admin')
  )
  WITH CHECK (
    has_system_role((SELECT auth.uid()), 'ww_admin')
  );

-- DELETE: Only system admins can delete parsed messages
CREATE POLICY "lorawan_parsed_messages_delete_policy"
  ON lorawan_parsed_messages
  FOR DELETE
  TO authenticated
  USING (
    has_system_role((SELECT auth.uid()), 'ww_admin')
  );

COMMENT ON POLICY "lorawan_parsed_messages_select_policy" ON lorawan_parsed_messages
IS 'The deployment''s project members and ww_admins can view a parsed LoRaWAN message (#323)';

COMMENT ON POLICY "lorawan_parsed_messages_insert_policy" ON lorawan_parsed_messages
IS 'Only ww_admins can insert messages (backend parser uses service role which bypasses RLS)';

COMMENT ON POLICY "lorawan_parsed_messages_update_policy" ON lorawan_parsed_messages
IS 'Only ww_admins can update parsed messages';

COMMENT ON POLICY "lorawan_parsed_messages_delete_policy" ON lorawan_parsed_messages
IS 'Only ww_admins can delete parsed messages';
