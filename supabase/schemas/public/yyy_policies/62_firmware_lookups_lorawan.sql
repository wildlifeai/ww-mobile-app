-- Phase 1: RLS Policies for firmware, activity_sensitivity, sampling_designs, and LoRaWAN tables

-- ==================================================================
-- FIRMWARE POLICIES
-- ==================================================================

ALTER TABLE firmware ENABLE ROW LEVEL SECURITY;

-- Only ww_admin can manage firmware
CREATE POLICY "ww_admin_all_firmware"
  ON firmware FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role = 'ww_admin'
        AND scope_type = 'system'
        AND is_active = true
        AND deleted_at IS null
    )
  );

-- All authenticated users can view firmware (needed for device management)
CREATE POLICY "authenticated_read_firmware"
  ON firmware FOR SELECT
  USING (auth.uid() IS NOT null);

-- Anonymous users: Can view all firmware (needed for public firmware downloads)
CREATE POLICY "anon_read_firmware"
  ON firmware FOR SELECT
  USING (true);

-- ==================================================================
-- LOOKUP TABLES POLICIES (activity_sensitivity, sampling_designs)
-- ==================================================================

ALTER TABLE activity_sensitivity ENABLE ROW LEVEL SECURITY;
ALTER TABLE sampling_designs ENABLE ROW LEVEL SECURITY;

-- ww_admin can manage lookup tables
CREATE POLICY "ww_admin_all_activity_sensitivity"
  ON activity_sensitivity FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role = 'ww_admin'
        AND scope_type = 'system'
        AND is_active = true
        AND deleted_at IS null
    )
  );

CREATE POLICY "ww_admin_all_sampling_designs"
  ON sampling_designs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role = 'ww_admin'
        AND scope_type = 'system'
        AND is_active = true
        AND deleted_at IS null
    )
  );

-- All authenticated users can view lookup tables (needed for project creation/editing)
CREATE POLICY "authenticated_read_activity_sensitivity"
  ON activity_sensitivity FOR SELECT
  USING (auth.uid() IS NOT null AND is_active = true AND deleted_at IS null);

CREATE POLICY "authenticated_read_sampling_designs"
  ON sampling_designs FOR SELECT
  USING (auth.uid() IS NOT null AND is_active = true AND deleted_at IS null);

-- ==================================================================
-- LORAWAN TABLES POLICIES (lorawan_messages, lorawan_parsed_messages)
-- ==================================================================

ALTER TABLE lorawan_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE lorawan_parsed_messages ENABLE ROW LEVEL SECURITY;

-- ww_admin: Full access to all LoRaWAN messages
CREATE POLICY "ww_admin_all_lorawan_messages"
  ON lorawan_messages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role = 'ww_admin'
        AND scope_type = 'system'
        AND is_active = true
        AND deleted_at IS null
    )
  );

CREATE POLICY "ww_admin_all_lorawan_parsed_messages"
  ON lorawan_parsed_messages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role = 'ww_admin'
        AND scope_type = 'system'
        AND is_active = true
        AND deleted_at IS null
    )
  );

-- The deployment's project reads a message: lorawan_messages_select_policy and
-- lorawan_parsed_messages_select_policy (64_, 65_). The project_access_view_* policies
-- that were here went with #323: their organisation branch read deployments under the
-- caller's RLS, so it served only roles that already see the deployment.

COMMENT ON TABLE firmware IS 'Firmware versions for device components (BLE, Himax, config). Managed by ww_admin only.';
COMMENT ON TABLE lorawan_messages IS 'Raw LoRaWAN messages from devices. Project members can view messages for their deployments.';
