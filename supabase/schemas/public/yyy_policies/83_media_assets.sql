-- *** media_assets RLS Policies ***
-- Access is INHERITED from the parent media row (strict 1:1 on media_id).
-- A non-owner role triggers media's own RLS on this subquery, so visibility
-- always matches media exactly — a PK lookup instead of a media->deployment
-- join, and it auto-tracks any future change to media's access rules.
-- Writes are performed by the backend with the service role (bypasses RLS).

CREATE POLICY "Project members can view media_assets"
  ON media_assets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM media AS m
      WHERE m.id = media_assets.media_id
    )
  );
