-- *** cluster_assignments RLS Policies ***
-- Access scoped via deployment -> project membership.
-- Cluster confirmation/locking is performed by the backend with the service role,
-- so no INSERT/UPDATE policy is granted to authenticated users.

CREATE POLICY "Project members can view cluster_assignments"
  ON cluster_assignments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM deployments AS d
      WHERE d.id = cluster_assignments.deployment_id
        AND d.deleted_at IS NULL
        AND has_project_role((SELECT auth.uid()), d.project_id, 'project_viewer')
    )
  );
