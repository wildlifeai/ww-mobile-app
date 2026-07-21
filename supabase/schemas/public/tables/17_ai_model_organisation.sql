-- Junction table for many-to-many relationship between AI models and organisations
-- NOTE: Currently ai_models.organisation_id provides direct assignment
-- This table supports future multi-org model sharing if needed
CREATE TABLE ai_model_organisation (
  organisation_id uuid NOT NULL REFERENCES organisations (id) ON DELETE CASCADE,
  model_id uuid NOT NULL REFERENCES ai_models (id) ON DELETE CASCADE,
  PRIMARY KEY (organisation_id, model_id)
);

COMMENT ON TABLE ai_model_organisation IS 'Junction table for AI model-to-organisation assignments (supports future multi-org model sharing)';
COMMENT ON COLUMN ai_model_organisation.organisation_id IS 'Organisation with access to this model';
COMMENT ON COLUMN ai_model_organisation.model_id IS 'AI model available to this organisation';

ALTER TABLE ai_model_organisation ENABLE ROW LEVEL SECURITY;
