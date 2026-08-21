-- *** RLS Policies for ai_model_families ***
--
-- Organisation-scoped isolation. Uses EXISTS for per-row performance.
-- All org members can read; only org managers can write.

-- SELECT: all org members can read
CREATE POLICY ai_model_families_select ON ai_model_families
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles AS ur
            WHERE ur.user_id = auth.uid()
              AND ur.scope_type = 'organisation'
              AND ur.scope_id = ai_model_families.organisation_id
              AND ur.is_active = TRUE
              AND ur.deleted_at IS NULL
        )
    );

-- INSERT: org managers only
CREATE POLICY ai_model_families_insert ON ai_model_families
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles AS ur
            WHERE ur.user_id = auth.uid()
              AND ur.scope_type = 'organisation'
              AND ur.scope_id = ai_model_families.organisation_id
              AND ur.role = 'organisation_manager'
              AND ur.is_active = TRUE
              AND ur.deleted_at IS NULL
        )
    );

-- UPDATE: org managers only
CREATE POLICY ai_model_families_update ON ai_model_families
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_roles AS ur
            WHERE ur.user_id = auth.uid()
              AND ur.scope_type = 'organisation'
              AND ur.scope_id = ai_model_families.organisation_id
              AND ur.role = 'organisation_manager'
              AND ur.is_active = TRUE
              AND ur.deleted_at IS NULL
        )
    );

-- DELETE: org managers only
CREATE POLICY ai_model_families_delete ON ai_model_families
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM user_roles AS ur
            WHERE ur.user_id = auth.uid()
              AND ur.scope_type = 'organisation'
              AND ur.scope_id = ai_model_families.organisation_id
              AND ur.role = 'organisation_manager'
              AND ur.is_active = TRUE
              AND ur.deleted_at IS NULL
        )
    );
