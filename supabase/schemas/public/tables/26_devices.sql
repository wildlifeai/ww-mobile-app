CREATE TABLE devices (
  id uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  created_at timestamptz DEFAULT (now()),
  updated_at timestamptz DEFAULT (now()),
  deleted_at timestamptz,
  modified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  bluetooth_id text NOT NULL UNIQUE,
  organisation_id uuid REFERENCES organisations(id),
  name text NOT NULL,
  device_eui text
);

-- Indexes
CREATE UNIQUE INDEX devices_bluetooth_id_unique_idx ON devices (bluetooth_id);
CREATE INDEX idx_devices_organisation_id ON devices (organisation_id);
CREATE INDEX idx_devices_deleted_at ON devices (deleted_at);

COMMENT ON TABLE devices IS 'Physical camera trap hardware tracking. Each firmware component is tracked independently.';
COMMENT ON COLUMN devices.device_eui IS 'LoRaWAN Device EUI';
COMMENT ON COLUMN devices.modified_by IS 'User who last modified this record';
COMMENT ON COLUMN devices.deleted_at IS 'Soft delete timestamp - NULL means active';
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

-- Ensure authenticated users can select (RLS will still apply)
GRANT SELECT ON public.devices TO authenticated;
