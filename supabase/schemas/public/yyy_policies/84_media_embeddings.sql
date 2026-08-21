-- *** media_embeddings RLS Policies ***
-- Access scoped via deployment -> project membership.
-- Writes are performed by the backend with the service role (bypasses RLS).

CREATE POLICY "Project members can view media_embeddings"
  ON media_embeddings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM deployments AS d
      WHERE d.id = media_embeddings.deployment_id
        AND d.deleted_at IS NULL
        AND has_project_role((SELECT auth.uid()), d.project_id, 'project_viewer')
    )
  );
