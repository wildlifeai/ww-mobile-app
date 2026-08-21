-- *** device_alert_rules RLS Policies ***
-- Project members (viewer and up) can see a project's alert rules; only project
-- admins manage them. The manifest job and the LoRaWAN uplink decoder use the
-- service role (bypasses RLS).

CREATE POLICY "Project members can view device_alert_rules"
  ON device_alert_rules
  FOR SELECT
  TO authenticated
  USING (
    has_project_role((SELECT auth.uid()), project_id, 'project_viewer')
  );

CREATE POLICY "Project admins can insert device_alert_rules"
  ON device_alert_rules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_project_role((SELECT auth.uid()), project_id, 'project_admin')
  );

CREATE POLICY "Project admins can update device_alert_rules"
  ON device_alert_rules
  FOR UPDATE
  TO authenticated
  USING (
    has_project_role((SELECT auth.uid()), project_id, 'project_admin')
  )
  WITH CHECK (
    has_project_role((SELECT auth.uid()), project_id, 'project_admin')
  );

CREATE POLICY "Project admins can delete device_alert_rules"
  ON device_alert_rules
  FOR DELETE
  TO authenticated
  USING (
    has_project_role((SELECT auth.uid()), project_id, 'project_admin')
  );
