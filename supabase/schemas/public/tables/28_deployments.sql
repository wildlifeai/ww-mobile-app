CREATE TABLE deployments (
  id uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  created_at timestamptz DEFAULT (now()),
  updated_at timestamptz DEFAULT (now()),
  deleted_at timestamptz,

  -- Deployment lifecycle
  name text NOT NULL,
  setup_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  deployment_start timestamptz NOT NULL,
  ended_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  deployment_end timestamptz,
  deployment_status_id int REFERENCES deployment_statuses (id),
  capture_method_id int REFERENCES capture_methods (id), -- RESTORED
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
  location GEOGRAPHY (POINT, 4326),
  timezone text, -- IANA tz resolved from latitude/longitude (display-only)
  -- Camera configuration
  camera_height float,
  activity_detection_sensitivity_id int REFERENCES activity_sensitivity (id),
  timelapse_interval_seconds int,

  -- New fields (Fixing sync error)
  project_id uuid NOT NULL REFERENCES projects (id),
  device_id uuid NOT NULL REFERENCES devices (id),
  location_data jsonb, -- Stores the raw JSON location object from frontend

  -- Device Snapshot Fields (Captured at deployment start)
  camera_model text,
  lorawan_network text,
  device_eui text,
  lorawan_registration_completed boolean NOT NULL DEFAULT false,
  lorawan_last_verified_at timestamptz,
  ai_model_id uuid REFERENCES ai_models (id),
  ble_firmware_id uuid REFERENCES firmware (id),
  himax_firmware_id uuid REFERENCES firmware (id),

  battery_level_at_start integer,
  sd_card_total_kb_at_start integer,
  sd_card_available_kb_at_start integer,
  lorawan_rssi_at_start integer,
  lorawan_snr_at_start double precision,

  -- CamtrapDP alignment fields
  camera_tilt float CHECK (camera_tilt IS null OR (camera_tilt >= -90 AND camera_tilt <= 90)),
  detection_distance float CHECK (detection_distance IS null OR (detection_distance >= 0)),
  bait_use text CHECK (bait_use IS null OR (bait_use IN ('none', 'scent', 'food', 'visual', 'acoustic', 'other'))),
  feature_type text CHECK (feature_type IS null OR (feature_type IN ('roadTrail', 'waterSource', 'burrow', 'nestSite', 'other'))),
  habitat text,
  deployment_tags text []
);

-- Indexes
CREATE UNIQUE INDEX deployments_start_device_unique_idx ON deployments (deployment_start, device_id);
CREATE INDEX idx_deployments_setup_by ON deployments (setup_by);
CREATE INDEX idx_deployments_ended_by ON deployments (ended_by);
CREATE INDEX idx_deployments_project_id ON deployments (project_id);
CREATE INDEX idx_deployments_device_id ON deployments (device_id);
CREATE INDEX idx_deployments_deleted_at ON deployments (deleted_at);
CREATE INDEX deployments_location_idx ON deployments USING gist (location);

-- Constraints
ALTER TABLE deployments ADD CONSTRAINT deployments_latitude_check CHECK (latitude >= -90 AND latitude <= 90);
ALTER TABLE deployments ADD CONSTRAINT deployments_longitude_check CHECK (longitude >= -180 AND longitude <= 180);
ALTER TABLE deployments ADD CONSTRAINT deployments_end_check CHECK (deployment_end IS null OR deployment_end >= deployment_start);
ALTER TABLE deployments ADD CONSTRAINT deployments_battery_level_start_check CHECK (battery_level_at_start IS null OR (battery_level_at_start >= 0 AND battery_level_at_start <= 100));

COMMENT ON TABLE deployments IS 'Stores camera deployments for wildlife monitoring projects. Snapshots device configuration at deployment time.';
COMMENT ON COLUMN deployments.setup_by IS 'User who set up the deployment.';
COMMENT ON COLUMN deployments.ended_by IS 'User who ended the deployment.';
COMMENT ON COLUMN deployments.location_name IS 'Descriptive label or name for the deployment location.';
COMMENT ON COLUMN deployments.location_description IS 'Detailed description of the location.';
COMMENT ON COLUMN deployments.camera_location_image_paths IS 'Array of paths to photos of the camera setup location.';
COMMENT ON COLUMN deployments.camera_height IS 'Height of the camera in meters.';
COMMENT ON COLUMN deployments.altitude IS 'Altitude in meters from GPS.';
COMMENT ON COLUMN deployments.accuracy IS 'GPS accuracy in meters.';
COMMENT ON COLUMN deployments.timezone IS 'IANA time zone name (e.g. Pacific/Auckland) for this deployment location, resolved from latitude/longitude at creation/ingestion via timezonefinder. NULL falls back to UTC at display. media.timestamp stays UTC; this column is display-only and does not affect stored instants.';
COMMENT ON COLUMN deployments.capture_method_id IS 'Mode of capture (timelapse, motion, etc).';
COMMENT ON COLUMN deployments.project_id IS 'Project this deployment belongs to.';
COMMENT ON COLUMN deployments.device_id IS 'Device used in this deployment.';
COMMENT ON COLUMN deployments.location_data IS 'Raw JSON location data from the mobile app.';
COMMENT ON COLUMN deployments.camera_model IS 'Camera hardware model snapped at deployment start.';
COMMENT ON COLUMN deployments.lorawan_network IS 'LoRaWAN network provider snapped at deployment start.';
COMMENT ON COLUMN deployments.device_eui IS 'LoRaWAN Device EUI snapped at deployment start.';
COMMENT ON COLUMN deployments.lorawan_registration_completed IS 'Whether LoRaWAN registration was complete at deployment start.';
COMMENT ON COLUMN deployments.lorawan_last_verified_at IS 'LoRaWAN verification timestamp at deployment start.';
COMMENT ON COLUMN deployments.ai_model_id IS 'AI model assigned at deployment start.';
COMMENT ON COLUMN deployments.ble_firmware_id IS 'BLE Firmware version active at deployment start.';
COMMENT ON COLUMN deployments.himax_firmware_id IS 'Himax Firmware version active at deployment start.';

COMMENT ON COLUMN deployments.battery_level_at_start IS 'Battery level recorded at deployment start (%).';
COMMENT ON COLUMN deployments.sd_card_total_kb_at_start IS 'Total SD card capacity recorded at deployment start (KB).';
COMMENT ON COLUMN deployments.sd_card_available_kb_at_start IS 'Available SD card capacity recorded at deployment start (KB).';
COMMENT ON COLUMN deployments.lorawan_rssi_at_start IS 'LoRaWAN RSSI recorded at deployment start.';
COMMENT ON COLUMN deployments.lorawan_snr_at_start IS 'LoRaWAN SNR recorded at deployment start.';
COMMENT ON COLUMN deployments.camera_tilt IS 'Camera tilt angle in degrees (CamtrapDP cameraTilt).';
COMMENT ON COLUMN deployments.detection_distance IS 'Maximum detection distance in metres (CamtrapDP detectionDistance).';
COMMENT ON COLUMN deployments.bait_use IS 'Attractant used: none, scent, food, visual, acoustic, or other (CamtrapDP baitUse).';
COMMENT ON COLUMN deployments.feature_type IS 'Feature monitored: roadTrail, waterSource, burrow, nestSite, or other (CamtrapDP featureType).';
COMMENT ON COLUMN deployments.habitat IS 'Free-text habitat description at the deployment location (CamtrapDP habitat).';
COMMENT ON COLUMN deployments.deployment_tags IS 'Array of grouping tags for this deployment (CamtrapDP deploymentTags).';

ALTER TABLE deployments ENABLE ROW LEVEL SECURITY;

-- Ensure authenticated users can select (RLS will still apply)
GRANT SELECT ON public.deployments TO authenticated;

