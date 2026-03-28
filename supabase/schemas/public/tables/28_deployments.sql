CREATE TABLE deployments (
  id uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  created_at timestamptz DEFAULT (now()),
  updated_at timestamptz DEFAULT (now()),
  deleted_at timestamptz,
  
  -- Snapshot of device configuration at deployment time
  device_preparation_id_deprecated uuid REFERENCES device_preparation(id),
  
  -- Deployment lifecycle
  name text NOT NULL,
  setup_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deployment_start timestamptz NOT NULL,
  ended_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deployment_end timestamptz,
  deployment_status_id int REFERENCES deployment_statuses(id),
  capture_method_id int REFERENCES capture_methods(id), -- RESTORED
  deployment_photos jsonb, -- RESTORED
  start_deployment_comments text,
  end_deployment_comments text,
  
  -- Location data
  location_name text NOT NULL,
  location_description text,
  camera_location_image_paths jsonb,
  latitude double precision,
  longitude double precision,
  altitude double precision,
  accuracy double precision,
  location geography(Point,4326),
  -- Camera configuration
  camera_height float,
  activity_detection_sensitivity_id int REFERENCES activity_sensitivity(id),
  timelapse_interval_seconds int,

  -- New fields (Fixing sync error)
  project_id uuid NOT NULL REFERENCES projects(id),
  device_id uuid NOT NULL REFERENCES devices(id),
  location_data jsonb -- Stores the raw JSON location object from frontend
);

-- Indexes
CREATE UNIQUE INDEX deployments_start_device_unique_idx ON deployments (deployment_start, device_id);
CREATE INDEX idx_deployments_setup_by ON deployments (setup_by);
CREATE INDEX idx_deployments_ended_by ON deployments (ended_by);
CREATE INDEX idx_deployments_project_id ON deployments (project_id);
CREATE INDEX idx_deployments_device_id ON deployments (device_id);
CREATE INDEX idx_deployments_deleted_at ON deployments (deleted_at);
CREATE INDEX deployments_location_idx ON deployments USING GIST (location);

-- Constraints
ALTER TABLE deployments ADD CONSTRAINT deployments_latitude_check CHECK (latitude >= -90 AND latitude <= 90);
ALTER TABLE deployments ADD CONSTRAINT deployments_longitude_check CHECK (longitude >= -180 AND longitude <= 180);
ALTER TABLE deployments ADD CONSTRAINT deployments_end_check CHECK (deployment_end IS NULL OR deployment_end >= deployment_start);

COMMENT ON TABLE deployments IS 'Stores camera deployments for wildlife monitoring projects. Snapshots device configuration at deployment time via device_preparation_id.';
COMMENT ON COLUMN deployments.device_preparation_id IS 'Links to prep session that prepared this device. Critical for traceability.';
COMMENT ON COLUMN deployments.setup_by IS 'User who set up the deployment.';
COMMENT ON COLUMN deployments.ended_by IS 'User who ended the deployment.';
COMMENT ON COLUMN deployments.location_name IS 'Descriptive label or name for the deployment location.';
COMMENT ON COLUMN deployments.location_description IS 'Detailed description of the location.';
COMMENT ON COLUMN deployments.camera_location_image_paths IS 'Array of paths to photos of the camera setup location.';
COMMENT ON COLUMN deployments.camera_height IS 'Height of the camera in meters.';
COMMENT ON COLUMN deployments.altitude IS 'Altitude in meters from GPS.';
COMMENT ON COLUMN deployments.accuracy IS 'GPS accuracy in meters.';
COMMENT ON COLUMN deployments.capture_method_id IS 'Mode of capture (timelapse, motion, etc).';
COMMENT ON COLUMN deployments.project_id IS 'Project this deployment belongs to.';
COMMENT ON COLUMN deployments.device_id IS 'Device used in this deployment.';
COMMENT ON COLUMN deployments.location_data IS 'Raw JSON location data from the mobile app.';

ALTER TABLE deployments ENABLE ROW LEVEL SECURITY;

-- Ensure authenticated users can select (RLS will still apply)
GRANT SELECT ON public.deployments TO authenticated;

