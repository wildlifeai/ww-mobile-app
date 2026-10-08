CREATE TABLE projects (
  -- Columns stay in the order the migrations created them; add new ones at the end (#220, MIGRATIONS.md).
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
  record_gps_in_images boolean NOT NULL DEFAULT false,
  lorawan_required boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  -- Capture flash settings, written to the device at deployment (see COMMENTs below).
  -- Check-constrained rather than lookup tables: the values map 1:1 onto fixed
  -- firmware op-codes, so they are never user-editable data.
  -- flash_led keeps its default: which LED to use does not depend on the light
  -- check, and IR is invisible to wildlife. It only matters once flash_mode is set.
  flash_led text NOT NULL DEFAULT 'ir'
    CHECK (flash_led IN ('white', 'ir')),
  -- flash_mode defaults to 'off' (#173). It shipped as DEFAULT 'light_sensor', which quietly
  -- put every project on the one mode that depends on the firmware's AE light
  -- check — the check that is still being worked on and is not to be relied on.
  -- 'off' matches what the app already resolves an unset value to
  -- (ww-mobile-app#286, src/utils/projectFlash.ts).
  --
  -- Note the cost: the same gate arms the IR that lights motion-detection frames
  -- at night, so an 'off' project has no capture flash AND no night IR for motion
  -- detection. That is deliberate until the light check is trustworthy — a project
  -- that wants illumination sets 'always_on' or 'time_of_day' explicitly.
  flash_mode text NOT NULL DEFAULT 'off'
    CHECK (flash_mode IN ('off', 'light_sensor', 'always_on', 'time_of_day')),
  flash_window_minutes int
    CHECK (flash_window_minutes IS null
           OR (flash_window_minutes >= 1 AND flash_window_minutes <= 1440)),
  flash_window_start_minutes_utc int
    CHECK (flash_window_start_minutes_utc IS null
           OR (flash_window_start_minutes_utc >= 0 AND flash_window_start_minutes_utc <= 1439)),
  -- Burst capture (#218): photos taken on every trigger, motion or timelapse, and
  -- the gap between them. Existing projects got the defaults too, deliberately.
  -- migra adds columns from one change in alphabetical order, hence this order.
  photo_interval_milliseconds int NOT NULL DEFAULT 1000
    CHECK (photo_interval_milliseconds >= 200 AND photo_interval_milliseconds <= 2000),
  photos_per_trigger int NOT NULL DEFAULT 3
    CHECK (photos_per_trigger >= 1 AND photos_per_trigger <= 10),
  -- On-device detection threshold (#244), a percentage the app converts for op16.
  -- 50 is the camera's floor: op16 is int8, and for an int8 softmax output (scale
  -- 1/256, zero point -128) op16 = 0 is already 50%. Default 57 is op16 = 18, the
  -- factory value every camera used before this column.
  detection_threshold_pct int NOT NULL DEFAULT 57
    CHECK (detection_threshold_pct >= 50 AND detection_threshold_pct <= 99)
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
COMMENT ON COLUMN projects.flash_mode IS 'Capture flash mode, written to the device as op34 FLASH_MODE: off=0, light_sensor=1, always_on=2, time_of_day=3. Defaults to off because light_sensor depends on the firmware AE light check, which is not yet trustworthy. Note that off also disables the night IR for motion detection, which shares the same gate — a project wanting illumination must set always_on or time_of_day.';
COMMENT ON COLUMN projects.flash_led IS 'Which LED the capture flash uses, written as op13 FLASH_LED: white=1, ir=2. Default ir: invisible to wildlife, and the same gate gives night IR illumination for motion detection.';
COMMENT ON COLUMN projects.flash_window_start_minutes_utc IS 'Start of the flash window for flash_mode=time_of_day, written as op35. Minutes after midnight UTC (0-1439). The device stores UTC, so this column does too; the website converts to deployment-local time for display. NULL unless flash_mode=time_of_day.';
COMMENT ON COLUMN projects.flash_window_minutes IS 'Length of the flash window for flash_mode=time_of_day, written as op36. Minutes (1-1440); may wrap past midnight. NULL unless flash_mode=time_of_day.';
COMMENT ON COLUMN projects.photos_per_trigger IS 'Photos per trigger (motion or timelapse), written to the device as op5. Photos as the user sees them: when the project also records the raw BMP, the app doubles the value for op5.';
COMMENT ON COLUMN projects.photo_interval_milliseconds IS 'Interval between the photos of one trigger in milliseconds, written to the device as op6.';
COMMENT ON COLUMN projects.detection_threshold_pct IS 'On-device detection threshold, percent (50-99, default 57). The app writes it to the camera as op16 MODEL_THRESHOLD = ceil(pct * 2.56) - 128, exact for int8 softmax model outputs (scale 1/256, zero point -128): 57 -> 18, the factory value; 50 -> 0; 99 -> 126.';


ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Ensure authenticated users can select (RLS will still apply)
GRANT SELECT ON public.projects TO authenticated;

