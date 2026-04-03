CREATE TABLE projects (
  id uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  created_at timestamptz DEFAULT (now()),
  updated_at timestamptz DEFAULT (now()),
  deleted_at timestamptz,
  modified_by uuid DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE SET NULL,
  name text NOT NULL,
  organisation_id uuid NOT NULL REFERENCES organisations (id) ON DELETE RESTRICT,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  is_baited boolean,
  is_monitoring_marked_individuals boolean,
  project_image text,
  sampling_design_id int REFERENCES sampling_designs (id),
  website text,
  model_id uuid REFERENCES ai_models (id),
  capture_method_id int REFERENCES capture_methods (id),
  activity_detection_sensitivity_id int REFERENCES activity_sensitivity (id),
  timelapse_interval_seconds int,
  lorawan_required boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false
);

-- Create index for organisation-based queries
CREATE INDEX projects_organisation_id_idx ON projects (organisation_id);

COMMENT ON TABLE projects IS 'Wildlife monitoring projects (org-scoped). RLS policies enforce multi-tenant isolation. Soft deletes preserve historical data.';
COMMENT ON COLUMN projects.organisation_id IS 'Organisation that owns this project (CASCADE restrict - cannot delete org with active projects)';
COMMENT ON COLUMN projects.created_by IS 'User who initially created the project (SET NULL on delete)';
COMMENT ON COLUMN projects.modified_by IS 'User who last modified this record';
COMMENT ON COLUMN projects.is_active IS 'Project active status (future enhancement for project end)';
COMMENT ON COLUMN projects.model_id IS 'Default AI model for ALL project deployments. Only Project Admins can modify. NULL = photos only without AI detection.';
COMMENT ON COLUMN projects.website IS 'External website associated with the project';
COMMENT ON COLUMN projects.timelapse_interval_seconds IS 'Timelapse interval in seconds (only for timelapse capture method)';
COMMENT ON COLUMN projects.deleted_at IS 'Soft delete timestamp - NULL means active';
COMMENT ON COLUMN projects.lorawan_required IS 'Whether LoRaWAN connectivity is mandatory for deployments in this project';
COMMENT ON COLUMN projects.is_archived IS 'Explicit archived state (true when inactive). Supplements deleted_at.';


ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Ensure authenticated users can select (RLS will still apply)
GRANT SELECT ON public.projects TO authenticated;

