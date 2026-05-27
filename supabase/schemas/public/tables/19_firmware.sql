-- Wildlife Watcher camera firmware versions managed by Wildlife.ai
CREATE TABLE firmware (
  id uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  created_at timestamptz DEFAULT (now()),
  updated_at timestamptz DEFAULT (now()),
  deleted_at timestamptz,
  modified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  version text NOT NULL,
  type text NOT NULL CHECK (type IN ('ble', 'himax')),
  location_path text NOT NULL,
  file_size_bytes bigint,
  release_notes text,
  is_active boolean NOT NULL DEFAULT true,
  crc_checksum text,
  build_date text
);

-- Unique index for type/version combination (excluding soft-deleted)
CREATE UNIQUE INDEX firmware_type_version_unique_idx
  ON firmware (type, version)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE firmware IS 'Wildlife Watcher camera firmware versions managed by Wildlife.ai';
COMMENT ON COLUMN firmware.name IS 'Firmware name';
COMMENT ON COLUMN firmware.version IS 'Firmware version string';
COMMENT ON COLUMN firmware.type IS 'Type of firmware: ble, himax, or config';
COMMENT ON COLUMN firmware.location_path IS 'Location path in Supabase Storage';
COMMENT ON COLUMN firmware.file_size_bytes IS 'Size of the firmware file in bytes';
COMMENT ON COLUMN firmware.release_notes IS 'Release notes for this version';
COMMENT ON COLUMN firmware.is_active IS 'Whether this firmware version is currently active/recommended';
COMMENT ON COLUMN firmware.crc_checksum IS 'CRC16-CCITT checksum of the firmware binary (4-char uppercase hex, e.g. A3F2)';
COMMENT ON COLUMN firmware.build_date IS 'Build date/time extracted from firmware image (used for 8.3 SD card filename)';
COMMENT ON COLUMN firmware.modified_by IS 'User who last modified this record';
COMMENT ON COLUMN firmware.deleted_at IS 'Soft delete timestamp - NULL means active';

ALTER TABLE firmware ENABLE ROW LEVEL SECURITY;

