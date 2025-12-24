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
        AND deleted_at IS NULL
    )
  );

-- All authenticated users can view firmware (needed for device management)
CREATE POLICY "authenticated_read_firmware"
  ON firmware FOR SELECT
  USING (auth.uid() IS NOT NULL);

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
        AND deleted_at IS NULL
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
        AND deleted_at IS NULL
    )
  );

-- All authenticated users can view lookup tables (needed for project creation/editing)
CREATE POLICY "authenticated_read_activity_sensitivity"
  ON activity_sensitivity FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = true AND deleted_at IS NULL);

CREATE POLICY "authenticated_read_sampling_designs"
  ON sampling_designs FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = true AND deleted_at IS NULL);

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
        AND deleted_at IS NULL
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
        AND deleted_at IS NULL
    )
  );

-- project_access: Can view messages for deployments in their projects
CREATE POLICY "project_access_view_lorawan_messages"
  ON lorawan_messages FOR SELECT
  USING (
    lorawan_messages.deployment_id IN (
      SELECT d.id
      FROM deployments d
      INNER JOIN device_preparation dp ON dp.id = d.device_preparation_id
      JOIN user_roles ur ON (
        (ur.scope_type = 'project' AND ur.scope_id = dp.project_id)
        OR (ur.scope_type = 'organisation' AND ur.scope_id = (
          SELECT organisation_id FROM projects WHERE id = dp.project_id
        ))
      )
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.is_active = true
        AND ur.deleted_at IS NULL
    )
  );

CREATE POLICY "project_access_view_lorawan_parsed_messages"
  ON lorawan_parsed_messages FOR SELECT
  USING (
    lorawan_parsed_messages.lorawan_message_id IN (
      SELECT lm.id
      FROM lorawan_messages lm
      JOIN deployments d ON d.id = lm.deployment_id
      INNER JOIN device_preparation dp ON dp.id = d.device_preparation_id
      JOIN user_roles ur ON (
        (ur.scope_type = 'project' AND ur.scope_id = dp.project_id)
        OR (ur.scope_type = 'organisation' AND ur.scope_id = (
          SELECT organisation_id FROM projects WHERE id = dp.project_id
        ))
      )
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.is_active = true
        AND ur.deleted_at IS NULL
    )
  );

COMMENT ON TABLE firmware IS 'Firmware versions for device components (BLE, Himax, config). Managed by ww_admin only.';
COMMENT ON TABLE lorawan_messages IS 'Raw LoRaWAN messages from devices. Project members can view messages for their deployments.';
