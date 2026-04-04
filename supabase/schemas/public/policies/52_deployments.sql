-- *** Deployments RLS Policies ***
-- UPDATED: 2026-03-27 - Deprecated device_preparation (Phase 1)
-- Now uses native project_id on deployments table

-- SELECT: Project members can view deployments for their project
CREATE POLICY "Project members can view active deployments"
  ON deployments
  FOR SELECT
  TO authenticated
  USING (
    has_project_role(auth.uid(), deployments.project_id, 'project_member')
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

-- UPDATE: Deployment creator can update own deployments
CREATE POLICY "Deployment creator can update own deployments"
  ON deployments
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL AND setup_by = (SELECT auth.uid())
  )
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL AND setup_by = (SELECT auth.uid())
  );

-- UPDATE: Deployment creator can soft-delete own deployments
CREATE POLICY "Deployment creator can soft-delete own deployments"
  ON deployments
  FOR UPDATE
  TO authenticated
  USING (
    setup_by = auth.uid()
  )
  WITH CHECK (
    deleted_at IS NOT NULL
  );

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

-- UPDATE: Project admins can soft-delete deployments
CREATE POLICY "Project admins can soft-delete deployments"
  ON deployments
  FOR UPDATE
  TO authenticated
  USING (
    has_project_role((SELECT auth.uid()), deployments.project_id, 'project_admin')
  )
  WITH CHECK (
    deleted_at IS NOT NULL
  );

COMMENT ON POLICY "Project members can view active deployments" ON deployments
IS 'Updated 2026-03-27: Uses native project_id on deployments table';

COMMENT ON POLICY "Project members can create deployments" ON deployments
IS 'Updated 2026-03-27: Uses native project_id on deployments table';
