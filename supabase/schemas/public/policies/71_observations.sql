-- *** observations RLS Policies ***
-- Access scoped via deployment -> project membership.

-- SELECT: Project members can view observations for their deployments
CREATE POLICY "Project members can view active observations"
  ON observations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM deployments AS d
      WHERE d.id = observations.deployment_id
        AND d.deleted_at IS NULL
        AND has_project_role(auth.uid(), d.project_id, 'project_member')
    )
  );

-- INSERT: Project members can record observations (human classifications)
CREATE POLICY "Project members can create observations"
  ON observations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM deployments AS d
      WHERE d.id = observations.deployment_id
        AND d.deleted_at IS NULL
        AND has_project_role((SELECT auth.uid()), d.project_id, 'project_member')
    )
  );

-- UPDATE: Project admins can update any observation in their project
CREATE POLICY "Project admins can update observations"
  ON observations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM deployments AS d
      WHERE d.id = observations.deployment_id
        AND d.deleted_at IS NULL
        AND has_project_role((SELECT auth.uid()), d.project_id, 'project_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM deployments AS d
      WHERE d.id = observations.deployment_id
        AND d.deleted_at IS NULL
        AND has_project_role((SELECT auth.uid()), d.project_id, 'project_admin')
    )
  );
