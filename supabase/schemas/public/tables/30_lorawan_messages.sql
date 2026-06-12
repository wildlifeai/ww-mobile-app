-- LoRaWAN messages received from camera devices
CREATE TABLE lorawan_messages (
  id uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  device_eui text NOT NULL,
  device_id uuid REFERENCES devices (id),
  deployment_id uuid REFERENCES deployments (id),
  raw_payload jsonb NOT NULL,
  received_at timestamptz DEFAULT (now()),
  processed_at timestamptz
);

-- Indexes for common queries
CREATE INDEX lorawan_messages_device_eui_idx ON lorawan_messages (device_eui);
CREATE INDEX lorawan_messages_device_id_idx ON lorawan_messages (device_id);
CREATE INDEX lorawan_messages_deployment_id_idx ON lorawan_messages (deployment_id);
CREATE INDEX lorawan_messages_received_at_idx ON lorawan_messages (received_at DESC);
CREATE INDEX lorawan_messages_unprocessed_idx ON lorawan_messages (processed_at) WHERE processed_at IS NULL;

COMMENT ON TABLE lorawan_messages IS 'Stores raw data received from cameras via LoRaWAN for debugging and processing.';
COMMENT ON COLUMN lorawan_messages.device_eui IS 'LoRaWAN Device EUI (registration ID from LoRaWAN network)';
COMMENT ON COLUMN lorawan_messages.device_id IS 'Reference to devices table (matched from device_eui)';
COMMENT ON COLUMN lorawan_messages.deployment_id IS 'Reference to deployment (if device is currently deployed)';
COMMENT ON COLUMN lorawan_messages.raw_payload IS 'Raw LoRaWAN message payload (JSON)';
COMMENT ON COLUMN lorawan_messages.received_at IS 'Timestamp when message was received by backend';
COMMENT ON COLUMN lorawan_messages.processed_at IS 'Timestamp when message was parsed (NULL = unprocessed)';

ALTER TABLE lorawan_messages ENABLE ROW LEVEL SECURITY;
