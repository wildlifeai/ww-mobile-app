-- *** media RLS Policies ***
-- Access is scoped via deployment -> project membership.

-- SELECT: Project members can view media for their deployments
CREATE POLICY "Project members can view active media"
  ON media
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM deployments AS d
      WHERE d.id = media.deployment_id
        AND d.deleted_at IS NULL
        AND has_project_role(auth.uid(), d.project_id, 'project_member')
    )
  );

-- INSERT: Project members can upload media to their deployments
CREATE POLICY "Project members can upload media"
  ON media
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM deployments AS d
      WHERE d.id = media.deployment_id
        AND d.deleted_at IS NULL
        AND has_project_role((SELECT auth.uid()), d.project_id, 'project_member')
    )
  );

-- UPDATE: Media uploader can update own media records (e.g. favorite, comments)
CREATE POLICY "Media uploader can update own media"
  ON media
  FOR UPDATE
  TO authenticated
  USING (
    uploaded_by = (SELECT auth.uid())
  )
  WITH CHECK (
    uploaded_by = (SELECT auth.uid())
  );

-- UPDATE: Project admins can update any media in their project
CREATE POLICY "Project admins can update media"
  ON media
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM deployments AS d
      WHERE d.id = media.deployment_id
        AND d.deleted_at IS NULL
        AND has_project_role((SELECT auth.uid()), d.project_id, 'project_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM deployments AS d
      WHERE d.id = media.deployment_id
        AND d.deleted_at IS NULL
        AND has_project_role((SELECT auth.uid()), d.project_id, 'project_admin')
    )
  );
