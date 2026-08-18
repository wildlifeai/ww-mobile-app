-- *** embedding_runs RLS Policies ***
-- Deployment-scoped runs: visible to project members of that deployment.
-- Project-scoped runs: visible to members of that project.
-- Global-scope runs: visible to ww_admin only.
-- All writes are performed by the backend with the service role (bypasses RLS).

CREATE POLICY "Project members can view embedding_runs"
  ON embedding_runs
  FOR SELECT
  TO authenticated
  USING (
    (
      embedding_runs.deployment_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM deployments AS d
        WHERE d.id = embedding_runs.deployment_id
          AND d.deleted_at IS NULL
          AND has_project_role((SELECT auth.uid()), d.project_id, 'project_viewer')
      )
    )
    OR (
      embedding_runs.scope = 'project'
      AND embedding_runs.project_id IS NOT NULL
      AND has_project_role((SELECT auth.uid()), embedding_runs.project_id, 'project_viewer')
    )
    OR has_system_role(auth.uid(), 'ww_admin')
  );
