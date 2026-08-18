-- *** deployment_effort RLS Policies ***
-- Access scoped via deployment -> project membership.

-- SELECT: Project members can view effort
CREATE POLICY "Project members can view deployment_effort"
  ON deployment_effort
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM deployments AS d
      WHERE d.id = deployment_effort.deployment_id
        AND d.deleted_at IS NULL
        AND has_project_role((SELECT auth.uid()), d.project_id, 'project_viewer')
    )
  );

-- INSERT: Project members can create effort
CREATE POLICY "Project members can create deployment_effort"
  ON deployment_effort
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM deployments AS d
      WHERE d.id = deployment_effort.deployment_id
        AND d.deleted_at IS NULL
        AND has_project_role((SELECT auth.uid()), d.project_id, 'project_member')
    )
  );

-- UPDATE: Project members can update effort
CREATE POLICY "Project members can update deployment_effort"
  ON deployment_effort
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM deployments AS d
      WHERE d.id = deployment_effort.deployment_id
        AND d.deleted_at IS NULL
        AND has_project_role((SELECT auth.uid()), d.project_id, 'project_member')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM deployments AS d
      WHERE d.id = deployment_effort.deployment_id
        AND d.deleted_at IS NULL
        AND has_project_role((SELECT auth.uid()), d.project_id, 'project_member')
    )
  );
