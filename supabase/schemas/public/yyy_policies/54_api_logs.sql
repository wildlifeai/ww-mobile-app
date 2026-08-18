-- *** api_logs RLS Policies ***
-- SECURITY MODEL: WW Admin only access (privacy/security requirement)
-- - Only WW Admin can view logs (system monitoring)
-- - Regular users cannot see any logs (privacy protected)
-- - Logs still written to DB for admin analysis

-- Policy: WW Admin can view ALL logs
-- PATTERN: System-wide role check using has_system_role()
-- EVIDENCE: Matches pattern from organisations, projects, user_roles policies
-- SECURITY: Prevents regular users from viewing sensitive log data
CREATE POLICY "ww_admin_view_all_logs"
  ON api_logs
  FOR SELECT
  TO authenticated
  USING (
    has_system_role((SELECT auth.uid()), 'ww_admin')
  );
