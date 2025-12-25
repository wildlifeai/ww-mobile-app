-- Phase 1: RLS Policies for device_preparation table
-- Stakeholder Decisions:
-- Q8: Anyone with project access can perform device preparation (ww_admin, project_admin, project_member)
-- Q9: Records can only be edited while status = 'in_progress'. Once completed/cancelled, they become immutable.

-- Enable RLS
ALTER TABLE device_preparation ENABLE ROW LEVEL SECURITY;

-- Anyone with project access can view device preparation
CREATE POLICY "project_access_view_device_prep"
  ON device_preparation FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND (
          (ur.scope_type = 'system' AND ur.role = 'ww_admin')
          OR (ur.scope_type = 'project' AND ur.scope_id = device_preparation.project_id)
          OR (ur.scope_type = 'organisation' AND ur.scope_id = (
            SELECT organisation_id FROM projects WHERE id = device_preparation.project_id
          ))
        )
        AND ur.is_active = true
        AND ur.deleted_at IS NULL
    )
  );

-- Anyone with project access can create device preparation
CREATE POLICY "project_access_create_device_prep"
  ON device_preparation FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND (
          (ur.scope_type = 'system' AND ur.role = 'ww_admin')
          OR (ur.scope_type = 'project' AND ur.scope_id = device_preparation.project_id)
          OR (ur.scope_type = 'organisation' AND ur.scope_id = (
            SELECT organisation_id FROM projects WHERE id = device_preparation.project_id
          ))
        )
        AND ur.is_active = true
        AND ur.deleted_at IS NULL
    )
  );

-- Only allow updates when status = 'in_progress' (Q9: immutability after completion)
CREATE POLICY "project_access_update_in_progress_only"
  ON device_preparation FOR UPDATE
  USING (
    status = 'in_progress'  -- Can only edit in-progress records
    AND EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND (
          (ur.scope_type = 'system' AND ur.role = 'ww_admin')
          OR (ur.scope_type = 'project' AND ur.scope_id = device_preparation.project_id)
          OR (ur.scope_type = 'organisation' AND ur.scope_id = (
            SELECT organisation_id FROM projects WHERE id = device_preparation.project_id
          ))
        )
        AND ur.is_active = true
        AND ur.deleted_at IS NULL
    )
  )
  WITH CHECK (
    -- Ensure they don't try to edit completed/cancelled records
    status IN ('in_progress', 'completed', 'cancelled')
  );

-- Soft delete only for in-progress records
CREATE POLICY "project_access_delete_in_progress_only"
  ON device_preparation FOR DELETE
  USING (
    status = 'in_progress'
    AND EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND (
          (ur.scope_type = 'system' AND ur.role = 'ww_admin')
          OR (ur.scope_type = 'project' AND ur.scope_id = device_preparation.project_id)
        )
        AND ur.is_active = true
        AND ur.deleted_at IS NULL
    )
  );

COMMENT ON POLICY "project_access_update_in_progress_only" ON device_preparation IS 
  'Per stakeholder decision Q9: device_preparation records become immutable once completed or cancelled';
