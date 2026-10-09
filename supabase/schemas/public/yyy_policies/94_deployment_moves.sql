-- *** deployment_moves RLS Policies ***
-- A viewer of either project reads the moves between them (#260). No write policy:
-- only move_deployment (SECURITY DEFINER) writes, and sync_deleted_ids trusts these
-- rows, so no client may write them (98_authenticated_write_grants.sql).
CREATE POLICY "Project viewers can view deployment moves"
  ON deployment_moves
  FOR SELECT
  TO authenticated
  USING (
    has_project_role((SELECT auth.uid()), deployment_moves.from_project_id, 'project_viewer')
    OR has_project_role((SELECT auth.uid()), deployment_moves.to_project_id, 'project_viewer')
  );
