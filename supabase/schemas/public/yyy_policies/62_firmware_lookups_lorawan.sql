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

-- project_access: Can view messages for deployments in their projects
CREATE POLICY "project_access_view_lorawan_messages"
  ON lorawan_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM deployments AS d
      INNER JOIN user_roles AS ur ON (
        (ur.scope_type = 'project' AND d.project_id = ur.scope_id)
        OR (ur.scope_type = 'organisation' AND ur.scope_id = (
          SELECT projects.organisation_id
          FROM projects
          WHERE projects.id = d.project_id
        ))
      )
      WHERE d.id = lorawan_messages.deployment_id
        AND ur.user_id = (SELECT auth.uid())
        AND ur.is_active = true
        AND ur.deleted_at IS null
    )
  );

CREATE POLICY "project_access_view_lorawan_parsed_messages"
  ON lorawan_parsed_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM lorawan_messages AS lm
      INNER JOIN deployments AS d ON lm.deployment_id = d.id
      INNER JOIN user_roles AS ur ON (
        (ur.scope_type = 'project' AND d.project_id = ur.scope_id)
        OR (ur.scope_type = 'organisation' AND ur.scope_id = (
          SELECT projects.organisation_id
          FROM projects
          WHERE projects.id = d.project_id
        ))
      )
      WHERE lm.id = lorawan_parsed_messages.lorawan_message_id
        AND ur.user_id = (SELECT auth.uid())
        AND ur.is_active = true
        AND ur.deleted_at IS null
    )
  );

COMMENT ON TABLE firmware IS 'Firmware versions for device components (BLE, Himax, config). Managed by ww_admin only.';
COMMENT ON TABLE lorawan_messages IS 'Raw LoRaWAN messages from devices. Project members can view messages for their deployments.';
