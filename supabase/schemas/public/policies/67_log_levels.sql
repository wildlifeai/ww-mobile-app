-- *** Log Levels RLS Policies ***
--
-- RLS policies for log_levels lookup table
-- - All authenticated users can read log levels
-- - Only ww_admins can modify log levels
--
-- Note: log_levels is a static lookup table without modified_by/is_active fields

-- SELECT: All authenticated users can read log levels
CREATE POLICY "log_levels_select_policy"
  ON log_levels
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Only ww_admins can add new log levels
CREATE POLICY "log_levels_insert_policy"
  ON log_levels
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_system_role((SELECT auth.uid()), 'ww_admin')
  );

-- UPDATE: Only ww_admins can update log levels
CREATE POLICY "log_levels_update_policy"
  ON log_levels
  FOR UPDATE
  TO authenticated
  USING (
    has_system_role((SELECT auth.uid()), 'ww_admin')
  )
  WITH CHECK (
    has_system_role((SELECT auth.uid()), 'ww_admin')
  );

-- DELETE: Only ww_admins can delete log levels (hard delete)
CREATE POLICY "log_levels_delete_policy"
  ON log_levels
  FOR DELETE
  TO authenticated
  USING (
    has_system_role((SELECT auth.uid()), 'ww_admin')
  );

COMMENT ON POLICY "log_levels_select_policy" ON log_levels
IS 'All authenticated users can read log levels';

COMMENT ON POLICY "log_levels_insert_policy" ON log_levels
IS 'Only ww_admins can add new log levels';

COMMENT ON POLICY "log_levels_update_policy" ON log_levels
IS 'Only ww_admins can update log levels';

COMMENT ON POLICY "log_levels_delete_policy" ON log_levels
IS 'Only ww_admins can delete log levels';
