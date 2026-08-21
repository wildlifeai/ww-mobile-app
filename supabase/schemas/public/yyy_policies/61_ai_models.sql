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
        AND deleted_at IS null
    )
  );

-- organisation_manager: Can upload and manage models for their organisation
CREATE POLICY "org_manager_manage_ai_models"
  ON ai_models FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (SELECT auth.uid())
        AND user_roles.role = 'organisation_manager'
        AND (
          user_roles.scope_type = 'system'  -- System-wide org managers
          OR (user_roles.scope_type = 'organisation' AND user_roles.scope_id = ai_models.organisation_id)
        )
        AND user_roles.is_active = true
        AND user_roles.deleted_at IS null
    )
  );

-- Organisation members: Can view models in their organisation
-- Covers both direct org membership and project-level access
CREATE POLICY "org_member_view_ai_models"
  ON ai_models FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles AS ur
      WHERE ur.user_id = auth.uid()
        AND ur.is_active = true
        AND ur.deleted_at IS null
        AND (
          -- Direct org membership (any role)
          (ur.scope_type = 'organisation' AND ur.scope_id = ai_models.organisation_id)
          -- Or project membership under the org
          OR (ur.scope_type = 'project' AND EXISTS (
            SELECT 1 FROM projects AS p
            WHERE p.id = ur.scope_id
              AND p.organisation_id = ai_models.organisation_id
          ))
        )
    )
  );


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
        AND deleted_at IS null
    )
  );

-- organisation_manager: Can assign models to organisations they manage
CREATE POLICY "org_manager_assign_models"
  ON ai_model_organisation FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (SELECT auth.uid())
        AND user_roles.role = 'organisation_manager'
        AND (
          user_roles.scope_type = 'system'
          OR (user_roles.scope_type = 'organisation' AND user_roles.scope_id = ai_model_organisation.organisation_id)
        )
        AND user_roles.is_active = true
        AND user_roles.deleted_at IS null
    )
  );

-- All users: Can view model assignments for their organisations
CREATE POLICY "users_view_org_model_assignments"
  ON ai_model_organisation FOR SELECT
  USING (
    ai_model_organisation.organisation_id IN (
      SELECT ur.scope_id
      FROM user_roles AS ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.scope_type = 'organisation'
        AND ur.is_active = true
        AND ur.deleted_at IS null
    )
  );

COMMENT ON TABLE ai_models IS
  'AI model management: organisation_manager can upload, project_admin can select for projects';


-- Anonymous users: can view all AI models (declared public in
-- 99_anon_access_grants.sql - model downloads and manifest generation).
-- Same pattern as anon_read_firmware; restores the USING (true) read
-- policy that 99_ references but which was lost in later policy rework
-- (anon reads 42501'd against the user_roles subqueries until 2026-07).
CREATE POLICY "anon_read_ai_models"
  ON ai_models FOR SELECT TO anon
  USING (true);
