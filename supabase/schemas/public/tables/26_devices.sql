CREATE TABLE devices (
  id uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  created_at timestamptz DEFAULT (now()),
  updated_at timestamptz DEFAULT (now()),
  deleted_at timestamptz,
  modified_by uuid NOT NULL REFERENCES auth.users(id),
  bluetooth_id text NOT NULL UNIQUE,
  organisation_id uuid REFERENCES organisations(id),
  name text NOT NULL,
  device_eui text,
  
  -- Separate firmware version tracking for each component
  ble_firmware_id uuid REFERENCES firmware(id),
  himax_firmware_id uuid REFERENCES firmware(id),
  config_firmware_id uuid REFERENCES firmware(id),
  
  -- Last successful update timestamps
  ble_firmware_updated_at timestamptz,
  himax_firmware_updated_at timestamptz,
  config_firmware_updated_at timestamptz,
  
  -- Real-time status (updated via LoRaWAN or BLE query)
  battery_level integer,
  last_battery_check timestamptz,
  sd_card_capacity_total_kb int,
  sd_card_capacity_used_kb int,
  last_sd_card_check timestamptz,
  
  -- Constraints
  CONSTRAINT devices_battery_level_check CHECK (battery_level >= 0 AND battery_level <= 100),
  CONSTRAINT devices_sd_card_check CHECK (sd_card_capacity_used_kb <= sd_card_capacity_total_kb)
);

-- Indexes
CREATE UNIQUE INDEX devices_bluetooth_id_unique_idx ON devices (bluetooth_id);
CREATE INDEX idx_devices_organisation_id ON devices (organisation_id);
CREATE INDEX idx_devices_ble_firmware ON devices (ble_firmware_id);
CREATE INDEX idx_devices_himax_firmware ON devices (himax_firmware_id);
CREATE INDEX idx_devices_config_firmware ON devices (config_firmware_id);
CREATE INDEX idx_devices_deleted_at ON devices (deleted_at);

COMMENT ON TABLE devices IS 'Physical camera trap hardware tracking. Each firmware component is tracked independently.';
COMMENT ON COLUMN devices.device_eui IS 'LoRaWAN Device EUI';
COMMENT ON COLUMN devices.ble_firmware_id IS 'Current BLE firmware version';
COMMENT ON COLUMN devices.himax_firmware_id IS 'Current Himax AI firmware version';
COMMENT ON COLUMN devices.config_firmware_id IS 'Current configuration version';
COMMENT ON COLUMN devices.ble_firmware_updated_at IS 'Timestamp of last BLE firmware update';
COMMENT ON COLUMN devices.himax_firmware_updated_at IS 'Timestamp of last Himax firmware update';
COMMENT ON COLUMN devices.config_firmware_updated_at IS 'Timestamp of last Config firmware update';
COMMENT ON COLUMN devices.battery_level IS 'Current battery level (percentage 0-100)';
COMMENT ON COLUMN devices.last_battery_check IS 'Timestamp of last battery level check (from LoRaWAN message)';
COMMENT ON COLUMN devices.sd_card_capacity_total_kb IS 'Total SD card capacity in KB';
COMMENT ON COLUMN devices.sd_card_capacity_used_kb IS 'Used SD card capacity in KB (from LoRaWAN message)';
COMMENT ON COLUMN devices.last_sd_card_check IS 'Timestamp of last SD card check (from LoRaWAN message)';
COMMENT ON COLUMN devices.modified_by IS 'User who last modified this record';
COMMENT ON COLUMN devices.deleted_at IS 'Soft delete timestamp - NULL means active';
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
