-- *** ecological_shift_reports RLS Policies ***
-- Access scoped via deployment -> project membership.
-- Writes are performed by the backend with the service role (bypasses RLS).

CREATE POLICY "Project members can view ecological_shift_reports"
  ON ecological_shift_reports
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM deployments AS d
      WHERE d.id = ecological_shift_reports.deployment_id
        AND d.deleted_at IS NULL
        AND has_project_role((SELECT auth.uid()), d.project_id, 'project_viewer')
    )
  );
