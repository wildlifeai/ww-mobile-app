-- Phase 1: RLS Policies for ai_models and ai_model_organisation tables
-- Per stakeholder requirements and migration plan

-- Enable RLS
ALTER TABLE ai_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_model_organisation ENABLE ROW LEVEL SECURITY;

-- ==================================================================
-- AI MODELS POLICIES
-- ==================================================================

-- ww_admin: Full access to all models
CREATE POLICY "ww_admin_all_ai_models"
  ON ai_models FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role = 'ww_admin'
        AND scope_type = 'system'
        AND is_active = true
        AND deleted_at IS NULL
    )
  );

-- organisation_manager: Can upload and manage models for their organisation
CREATE POLICY "org_manager_manage_ai_models"
  ON ai_models FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role = 'organisation_manager'
        AND (
          scope_type = 'system'  -- System-wide org managers
          OR (scope_type = 'organisation' AND scope_id = ai_models.organisation_id)
        )
        AND is_active = true
        AND deleted_at IS NULL
    )
  );

-- project_admin and project_member: Can view models available to their organisation
CREATE POLICY "project_access_view_org_ai_models"
  ON ai_models FOR SELECT
  USING (
    ai_models.organisation_id IN (
      SELECT DISTINCT p.organisation_id
      FROM projects p
      JOIN user_roles ur ON (
        (ur.scope_type = 'project' AND ur.scope_id = p.id)
        OR (ur.scope_type = 'organisation' AND ur.scope_id = p.organisation_id)
      )
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.is_active = true
        AND ur.deleted_at IS NULL
        -- Removed p.deleted_at IS NULL to allow sync of deleted projects' models if needed
    )
  );

-- Anonymous users: Can view all AI models (needed for public model downloads)
CREATE POLICY "anon_read_ai_models"
  ON ai_models FOR SELECT
  USING (true);

-- ==================================================================
-- AI MODEL ORGANISATION POLICIES
-- ==================================================================

-- ww_admin: Full access
CREATE POLICY "ww_admin_all_ai_model_org"
  ON ai_model_organisation FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role = 'ww_admin'
        AND scope_type = 'system'
        AND is_active = true
        AND deleted_at IS NULL
    )
  );

-- organisation_manager: Can assign models to organisations they manage
CREATE POLICY "org_manager_assign_models"
  ON ai_model_organisation FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role = 'organisation_manager'
        AND (
          scope_type = 'system'
          OR (scope_type = 'organisation' AND scope_id = ai_model_organisation.organisation_id)
        )
        AND is_active = true
        AND deleted_at IS NULL
    )
  );

-- All users: Can view model assignments for their organisations
CREATE POLICY "users_view_org_model_assignments"
  ON ai_model_organisation FOR SELECT
  USING (
    ai_model_organisation.organisation_id IN (
      SELECT ur.scope_id
      FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.scope_type = 'organisation'
        AND ur.is_active = true
        AND ur.deleted_at IS NULL
    )
  );

COMMENT ON TABLE ai_models IS 
  'AI model management: organisation_manager can upload, project_admin can select for projects';
