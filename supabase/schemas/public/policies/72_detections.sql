-- *** detections RLS Policies ***
-- SECURITY MODEL:
-- - Project members can read detections for their deployments (read-only for authenticated users)
-- - Only the service_role (inference pipeline) may INSERT new detections
-- - No UPDATE or DELETE — detections are an append-only archive

-- SELECT: Project members can view detections via media -> deployment -> project
CREATE POLICY "Project members can view detections"
  ON detections
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM media AS m
      INNER JOIN deployments AS d ON d.id = m.deployment_id
      WHERE m.id = detections.media_id
        AND m.deleted_at IS NULL
        AND d.deleted_at IS NULL
        AND has_project_role(auth.uid(), d.project_id, 'project_member')
    )
  );
