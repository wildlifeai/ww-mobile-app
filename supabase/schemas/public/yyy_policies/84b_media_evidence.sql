-- *** media_evidence RLS Policies ***
-- Read access through deployment -> project membership, as for observations. No write
-- policy: only the website's service role writes (98_authenticated_write_grants.sql).
CREATE POLICY "Project members can view media evidence"
  ON media_evidence
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM deployments AS d
      WHERE d.id = media_evidence.deployment_id
        AND d.deleted_at IS NULL
        AND has_project_role((SELECT auth.uid()), d.project_id, 'project_viewer')
    )
  );
