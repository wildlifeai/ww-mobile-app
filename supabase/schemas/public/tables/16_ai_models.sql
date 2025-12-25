-- AI Models table for managing machine learning models per organisation
CREATE TABLE ai_models (
  id uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  created_at timestamptz DEFAULT (now()),
  updated_at timestamptz DEFAULT (now()),
  deleted_at timestamptz,
  modified_by uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL,
  version text NOT NULL,
  description text,
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  uploaded_by uuid REFERENCES auth.users(id),
  storage_path text NOT NULL UNIQUE,
  file_size_bytes bigint,
  file_type text,
  detection_capabilities text[]
);

-- Unique index for org/name/version combination (excluding soft-deleted)
CREATE UNIQUE INDEX ai_models_org_name_version_unique_idx
  ON ai_models (organisation_id, name, version)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE ai_models IS 'AI/ML models for wildlife detection. Managed by organisation_managers, assigned to organisations, selected by project_admins.';
COMMENT ON COLUMN ai_models.name IS 'Model name (e.g., "General Wildlife Model")';
COMMENT ON COLUMN ai_models.version IS 'Model version string (e.g., "1.0.0")';
COMMENT ON COLUMN ai_models.organisation_id IS 'Organisation this model is assigned to (or General org for global models)';
COMMENT ON COLUMN ai_models.uploaded_by IS 'User who uploaded this model (organisation_manager role)';
COMMENT ON COLUMN ai_models.storage_path IS 'Path to model file in Supabase Storage';
COMMENT ON COLUMN ai_models.file_size_bytes IS 'Model file size in bytes';
COMMENT ON COLUMN ai_models.file_type IS 'Model file format (e.g., tflite, onnx)';
COMMENT ON COLUMN ai_models.detection_capabilities IS 'Array of species this model can detect';
COMMENT ON COLUMN ai_models.modified_by IS 'User who last modified this record';
COMMENT ON COLUMN ai_models.deleted_at IS 'Soft delete timestamp - NULL means active';

ALTER TABLE ai_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users" ON "public"."ai_models"
AS PERMISSIVE FOR SELECT
TO authenticated
USING (true);
