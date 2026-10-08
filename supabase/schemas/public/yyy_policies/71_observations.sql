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
        AND has_project_role((SELECT auth.uid()), d.project_id, 'project_viewer')
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

-- UPDATE: Project members can update observations in their project
-- (confirm/correct/blank/redraw AI labels). has_project_role is hierarchical,
-- so project_admin satisfies the project_member check too. Tighten to
-- 'project_admin' if admin-only editing is required.
CREATE POLICY "Project members can update observations"
  ON observations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM deployments AS d
      WHERE d.id = observations.deployment_id
        AND d.deleted_at IS NULL
        AND has_project_role((SELECT auth.uid()), d.project_id, 'project_member')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM deployments AS d
      WHERE d.id = observations.deployment_id
        AND d.deleted_at IS NULL
        AND has_project_role((SELECT auth.uid()), d.project_id, 'project_member')
    )
  );

-- Members remove a wrong label outright (ww-website MediaDetail). Same rule as
-- UPDATE: a member can already rewrite any observation in the project. Without
-- this policy the grant let the DELETE through and RLS matched 0 rows, so the
-- website reported a removal that never happened (#222).
CREATE POLICY "Project members can delete observations"
  ON observations
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM deployments AS d
      WHERE d.id = observations.deployment_id
        AND d.deleted_at IS NULL
        AND has_project_role((SELECT auth.uid()), d.project_id, 'project_member')
    )
  );
