-- *** inat_observation_media RLS Policies ***
-- Read scoped through the parent inat_observations row (deployment -> project
-- membership). Writes are service-role only (backend upload pipeline).

CREATE POLICY "Project members can view inat_observation_media"
  ON inat_observation_media
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM inat_observations AS io
      INNER JOIN deployments AS d ON io.deployment_id = d.id
      WHERE io.id = inat_observation_media.inat_observation_id
        AND d.deleted_at IS NULL
        AND has_project_role((SELECT auth.uid()), d.project_id, 'project_viewer')
    )
  );
