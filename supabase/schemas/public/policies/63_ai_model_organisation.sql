-- *** AI Model Organisation RLS Policies ***
--
-- Junction table RLS for AI model-to-organisation assignments
-- - Organisation members can see which models are available to their organisation
-- - Only organisation_managers and ww_admins can assign models to organisations
-- - Prevents cross-organisation model access manipulation
--

-- SELECT: Organisation members can see their organisation's model assignments
CREATE POLICY "ai_model_organisation_select_policy"
  ON ai_model_organisation
  FOR SELECT
  TO authenticated
  USING (
    -- WW Admins can see all model assignments
    has_system_role((SELECT auth.uid()), 'ww_admin') OR
    -- Organisation members can see their organisation's model assignments
    has_organisation_role((SELECT auth.uid()), ai_model_organisation.organisation_id, 'organisation_member')
  );

-- INSERT: Only organisation_managers and ww_admins can assign models to organisations
CREATE POLICY "ai_model_organisation_insert_policy"
  ON ai_model_organisation
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL AND (
      -- WW Admins can assign any model to any organisation
      has_system_role((SELECT auth.uid()), 'ww_admin') OR
      -- Organisation managers can assign models to their organisation
      has_organisation_role((SELECT auth.uid()), ai_model_organisation.organisation_id, 'organisation_manager')
    )
  );

-- DELETE: Only organisation_managers and ww_admins can remove model assignments
CREATE POLICY "ai_model_organisation_delete_policy"
  ON ai_model_organisation
  FOR DELETE
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL AND (
      -- WW Admins can remove any model assignment
      has_system_role((SELECT auth.uid()), 'ww_admin') OR
      -- Organisation managers can remove models from their organisation
      has_organisation_role((SELECT auth.uid()), ai_model_organisation.organisation_id, 'organisation_manager')
    )
  );

COMMENT ON POLICY "ai_model_organisation_select_policy" ON ai_model_organisation
IS 'Organisation members can view their organisation''s AI model assignments';

COMMENT ON POLICY "ai_model_organisation_insert_policy" ON ai_model_organisation
IS 'Only organisation_managers and ww_admins can assign AI models to organisations';

COMMENT ON POLICY "ai_model_organisation_delete_policy" ON ai_model_organisation
IS 'Only organisation_managers and ww_admins can remove AI model assignments';
