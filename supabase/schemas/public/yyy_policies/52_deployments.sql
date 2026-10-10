-- *** Deployments RLS Policies ***
-- Uses native project_id on deployments table

-- SELECT: Project members can view deployments for their project
CREATE POLICY "Project members can view active deployments"
  ON deployments
  FOR SELECT
  TO authenticated
  USING (
    -- Soft-deleted rows are invisible to clients (#160); pull_changes learns of
    -- deletions through sync_deleted_ids, which applies the same has_project_role rule.
    deployments.deleted_at IS NULL
    AND has_project_role((SELECT auth.uid()), deployments.project_id, 'project_viewer')
  );

-- INSERT: Project members can create deployments
CREATE POLICY "Project members can create deployments"
  ON deployments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND has_project_role((SELECT auth.uid()), deployments.project_id, 'project_member')
  );

-- UPDATE: Deployment creator can update own deployments, while they hold at least
-- project_member on its project (#260). Without the role check a creator downgraded
-- to project_viewer kept write access, against "viewer is read-only". project_admin
-- and ww_admin pass a project_member check. project_id and setup_by themselves are
-- locked by trg_deployments_lock_columns: a policy cannot compare old and new rows.
CREATE POLICY "Deployment creator can update own deployments"
  ON deployments
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL AND setup_by = (SELECT auth.uid())
    AND has_project_role((SELECT auth.uid()), deployments.project_id, 'project_member')
  )
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL AND setup_by = (SELECT auth.uid())
    AND has_project_role((SELECT auth.uid()), deployments.project_id, 'project_member')
  );

-- Soft deletes go through soft_delete_deployment (SECURITY DEFINER), not an UPDATE policy:
-- the SELECT policy hides soft-deleted rows, and Postgres checks an UPDATE's new row
-- against it, so no client UPDATE that sets deleted_at can pass (#160).

-- UPDATE: Project admins can update deployments
CREATE POLICY "Project admins can update deployments"
  ON deployments
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND has_project_role((SELECT auth.uid()), deployments.project_id, 'project_admin')
  )
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND has_project_role((SELECT auth.uid()), deployments.project_id, 'project_admin')
  );


COMMENT ON POLICY "Project members can view active deployments" ON deployments
IS 'Updated 2026-03-27: Uses native project_id on deployments table';

COMMENT ON POLICY "Project members can create deployments" ON deployments
IS 'Updated 2026-03-27: Uses native project_id on deployments table';
