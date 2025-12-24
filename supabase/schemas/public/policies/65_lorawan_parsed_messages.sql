-- *** LoRaWAN Parsed Messages RLS Policies ***
--
-- Access control for parsed LoRaWAN messages (structured data from raw messages)
-- - Users can only see parsed messages from devices in their organisation
-- - System processes (via service role) can insert/update messages
-- - Only system admins can delete messages
--

-- SELECT: Users can see parsed messages from their organisation's devices
CREATE POLICY "lorawan_parsed_messages_select_policy"
  ON lorawan_parsed_messages
  FOR SELECT
  TO authenticated
  USING (
    -- WW Admins can see all parsed messages
    has_system_role((SELECT auth.uid()), 'ww_admin') OR
    -- Users can see parsed messages from devices in their organisation
    EXISTS (
      SELECT 1 FROM devices d
      WHERE d.id = lorawan_parsed_messages.device_id
        AND d.deleted_at IS NULL
        AND has_organisation_role((SELECT auth.uid()), d.organisation_id, 'organisation_member')
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
IS 'Users can view parsed LoRaWAN messages from their organisation''s devices';

COMMENT ON POLICY "lorawan_parsed_messages_insert_policy" ON lorawan_parsed_messages
IS 'Only ww_admins can insert messages (backend parser uses service role which bypasses RLS)';

COMMENT ON POLICY "lorawan_parsed_messages_update_policy" ON lorawan_parsed_messages
IS 'Only ww_admins can update parsed messages';

COMMENT ON POLICY "lorawan_parsed_messages_delete_policy" ON lorawan_parsed_messages
IS 'Only ww_admins can delete parsed messages';
