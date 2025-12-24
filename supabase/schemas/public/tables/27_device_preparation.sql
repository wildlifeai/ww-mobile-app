-- Device preparation workflow (camera workbench procedure)
-- Only ever 1 active record per device
CREATE TABLE device_preparation (
  id uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  created_at timestamptz DEFAULT (now()),
  updated_at timestamptz DEFAULT (now()),
  deleted_at timestamptz,
  modified_by uuid NOT NULL REFERENCES auth.users(id),
  
  device_id uuid NOT NULL REFERENCES devices(id),
  camera_model text,
  
  -- LoRaWAN setup
  lorawan_network text,
  device_eui text,
  lorawan_registration_completed boolean NOT NULL DEFAULT false,
  lorawan_last_verified_at timestamptz,
  
  -- Project assignment (Required only when status = completed)
  project_id uuid REFERENCES projects(id),
  ai_model_id uuid REFERENCES ai_models(id),
  
  -- Firmware versions to be installed/verified
  ble_firmware_id uuid REFERENCES firmware(id),
  himax_firmware_id uuid REFERENCES firmware(id),
  config_firmware_id uuid REFERENCES firmware(id),
  
  -- Check results (Booleans) -- RESTORED for sync compatibility
  battery_check_passed boolean DEFAULT false,
  camera_view_test_passed boolean DEFAULT false,
  firmware_check_passed boolean DEFAULT false,
  sd_card_check_passed boolean DEFAULT false,
  firmware_updated boolean DEFAULT false,

  -- Detailed Test Results (Actual data)
  battery_level_at_check integer,
  sd_card_total_kb_at_check integer,
  sd_card_available_kb_at_check integer,
  lorawan_rssi_at_check integer,
  lorawan_snr_at_check float,
  
  -- Workflow status
  status text NOT NULL CHECK (status IN ('in_progress', 'completed', 'cancelled')) DEFAULT 'in_progress',
  is_deployment_ready boolean NOT NULL DEFAULT false,
  completed_at timestamptz,

  -- Constraints
  CONSTRAINT device_preparation_status_project_check CHECK (status != 'completed' OR project_id IS NOT NULL),
  CONSTRAINT device_preparation_battery_level_check CHECK (battery_level_at_check IS NULL OR (battery_level_at_check >= 0 AND battery_level_at_check <= 100))
);

-- Only one active preparation per device
CREATE UNIQUE INDEX device_preparation_active_device_unique_idx
  ON device_preparation (device_id)
  WHERE deleted_at IS NULL AND status = 'in_progress';

COMMENT ON TABLE device_preparation IS 'Device preparation workflow (camera workbench). Only ever 1 active record per device. Status calculated based on test results.';
COMMENT ON INDEX device_preparation_active_device_unique_idx IS 'Ensures only one active (in_progress) preparation exists per device. Completed/cancelled records are ignored to allow history.';
COMMENT ON COLUMN device_preparation.device_id IS 'Device being prepared';
COMMENT ON COLUMN device_preparation.camera_model IS 'Model of the camera hardware';
COMMENT ON COLUMN device_preparation.lorawan_network IS 'LoRaWAN network provider (e.g., The Things Network)';
COMMENT ON COLUMN device_preparation.device_eui IS 'LoRaWAN Device EUI (registration ID)';
COMMENT ON COLUMN device_preparation.lorawan_registration_completed IS 'Whether LoRaWAN registration is complete';
COMMENT ON COLUMN device_preparation.lorawan_last_verified_at IS 'Timestamp when LoRaWAN connectivity was last verified';
COMMENT ON COLUMN device_preparation.project_id IS 'Project this device is being prepared for (required when status=completed)';
COMMENT ON COLUMN device_preparation.ai_model_id IS 'AI model to be loaded (project default can change over time, can be NULL)';
COMMENT ON COLUMN device_preparation.ble_firmware_id IS 'BLE Firmware version to be installed';
COMMENT ON COLUMN device_preparation.himax_firmware_id IS 'Himax Firmware version to be installed';
COMMENT ON COLUMN device_preparation.config_firmware_id IS 'Config Firmware version to be installed';
COMMENT ON COLUMN device_preparation.battery_level_at_check IS 'Battery level recorded during check (%)';
COMMENT ON COLUMN device_preparation.sd_card_total_kb_at_check IS 'Total SD card capacity recorded during check (KB)';
COMMENT ON COLUMN device_preparation.sd_card_available_kb_at_check IS 'Available SD card capacity recorded during check (KB)';
COMMENT ON COLUMN device_preparation.lorawan_rssi_at_check IS 'LoRaWAN RSSI recorded during check';
COMMENT ON COLUMN device_preparation.lorawan_snr_at_check IS 'LoRaWAN SNR recorded during check';
COMMENT ON COLUMN device_preparation.status IS 'Workflow status: in_progress, completed, cancelled';
COMMENT ON COLUMN device_preparation.is_deployment_ready IS 'Calculated: true if status = completed';
COMMENT ON COLUMN device_preparation.completed_at IS 'Timestamp when preparation was completed';
COMMENT ON COLUMN device_preparation.modified_by IS 'User who last modified this record';
COMMENT ON COLUMN device_preparation.deleted_at IS 'Soft delete timestamp - NULL means active';

ALTER TABLE device_preparation ENABLE ROW LEVEL SECURITY;
