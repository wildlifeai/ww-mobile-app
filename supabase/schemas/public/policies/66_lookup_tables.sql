-- *** Lookup Tables RLS Policies ***
--
-- RLS policies for reference data lookup tables
-- - All authenticated users can read lookup data
-- - Only ww_admins can modify lookup data
--

-- =============================================================================
-- DEPLOYMENT STATUSES
-- =============================================================================

-- SELECT: All authenticated users can read deployment statuses
CREATE POLICY "deployment_statuses_select_policy"
  ON deployment_statuses
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Only ww_admins can add new deployment statuses
CREATE POLICY "deployment_statuses_insert_policy"
  ON deployment_statuses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_system_role((SELECT auth.uid()), 'ww_admin')
  );

-- UPDATE: Only ww_admins can update deployment statuses
CREATE POLICY "deployment_statuses_update_policy"
  ON deployment_statuses
  FOR UPDATE
  TO authenticated
  USING (
    has_system_role((SELECT auth.uid()), 'ww_admin')
  )
  WITH CHECK (
    has_system_role((SELECT auth.uid()), 'ww_admin')
  );

-- DELETE: Only ww_admins can delete deployment statuses (soft delete via is_active)
CREATE POLICY "deployment_statuses_delete_policy"
  ON deployment_statuses
  FOR UPDATE
  TO authenticated
  USING (
    has_system_role((SELECT auth.uid()), 'ww_admin')
    AND is_active = true
  )
  WITH CHECK (
    is_active = false
  );

-- =============================================================================
-- CAPTURE METHODS
-- =============================================================================

-- SELECT: All authenticated users can read capture methods
CREATE POLICY "capture_methods_select_policy"
  ON capture_methods
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Only ww_admins can add new capture methods
CREATE POLICY "capture_methods_insert_policy"
  ON capture_methods
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_system_role((SELECT auth.uid()), 'ww_admin')
  );

-- UPDATE: Only ww_admins can update capture methods
CREATE POLICY "capture_methods_update_policy"
  ON capture_methods
  FOR UPDATE
  TO authenticated
  USING (
    has_system_role((SELECT auth.uid()), 'ww_admin')
  )
  WITH CHECK (
    has_system_role((SELECT auth.uid()), 'ww_admin')
  );

-- DELETE: Only ww_admins can delete capture methods (soft delete via is_active)
CREATE POLICY "capture_methods_delete_policy"
  ON capture_methods
  FOR UPDATE
  TO authenticated
  USING (
    has_system_role((SELECT auth.uid()), 'ww_admin')
    AND is_active = true
  )
  WITH CHECK (
    is_active = false
  );

-- =============================================================================
-- ACTIVITY SENSITIVITY
-- =============================================================================

-- SELECT: All authenticated users can read activity sensitivity levels
CREATE POLICY "activity_sensitivity_select_policy"
  ON activity_sensitivity
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Only ww_admins can add new activity sensitivity levels
CREATE POLICY "activity_sensitivity_insert_policy"
  ON activity_sensitivity
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_system_role((SELECT auth.uid()), 'ww_admin')
  );

-- UPDATE: Only ww_admins can update activity sensitivity levels
CREATE POLICY "activity_sensitivity_update_policy"
  ON activity_sensitivity
  FOR UPDATE
  TO authenticated
  USING (
    has_system_role((SELECT auth.uid()), 'ww_admin')
  )
  WITH CHECK (
    has_system_role((SELECT auth.uid()), 'ww_admin')
  );

-- DELETE: Only ww_admins can delete activity sensitivity levels (soft delete via is_active)
CREATE POLICY "activity_sensitivity_delete_policy"
  ON activity_sensitivity
  FOR UPDATE
  TO authenticated
  USING (
    has_system_role((SELECT auth.uid()), 'ww_admin')
    AND is_active = true
  )
  WITH CHECK (
    is_active = false
  );

-- =============================================================================
-- SAMPLING DESIGNS
-- =============================================================================

-- SELECT: All authenticated users can read sampling designs
CREATE POLICY "sampling_designs_select_policy"
  ON sampling_designs
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Only ww_admins can add new sampling designs
CREATE POLICY "sampling_designs_insert_policy"
  ON sampling_designs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_system_role((SELECT auth.uid()), 'ww_admin')
  );

-- UPDATE: Only ww_admins can update sampling designs
CREATE POLICY "sampling_designs_update_policy"
  ON sampling_designs
  FOR UPDATE
  TO authenticated
  USING (
    has_system_role((SELECT auth.uid()), 'ww_admin')
  )
  WITH CHECK (
    has_system_role((SELECT auth.uid()), 'ww_admin')
  );

-- DELETE: Only ww_admins can delete sampling designs (soft delete via is_active)
CREATE POLICY "sampling_designs_delete_policy"
  ON sampling_designs
  FOR UPDATE
  TO authenticated
  USING (
    has_system_role((SELECT auth.uid()), 'ww_admin')
    AND is_active = true
  )
  WITH CHECK (
    is_active = false
  );

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON POLICY "deployment_statuses_select_policy" ON deployment_statuses
IS 'All authenticated users can read deployment statuses';

COMMENT ON POLICY "capture_methods_select_policy" ON capture_methods
IS 'All authenticated users can read capture methods';

COMMENT ON POLICY "activity_sensitivity_select_policy" ON activity_sensitivity
IS 'All authenticated users can read activity sensitivity levels';

COMMENT ON POLICY "sampling_designs_select_policy" ON sampling_designs
IS 'All authenticated users can read sampling designs';
