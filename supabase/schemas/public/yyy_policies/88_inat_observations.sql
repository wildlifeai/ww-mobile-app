-- *** inat_observations RLS Policies ***
-- Access scoped via deployment -> project membership. Records are created and
-- updated by the backend service role (iNat upload + community-ID sync daemon);
-- project members may read the sync state to render the iNaturalist thumbnail badge.

CREATE POLICY "Project members can view inat_observations"
  ON inat_observations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM deployments AS d
      WHERE d.id = inat_observations.deployment_id
        AND d.deleted_at IS NULL
        AND has_project_role((SELECT auth.uid()), d.project_id, 'project_viewer')
    )
  );
