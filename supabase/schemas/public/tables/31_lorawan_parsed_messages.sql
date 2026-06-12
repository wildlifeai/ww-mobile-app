-- Parsed LoRaWAN message data (extracted from raw_payload)
CREATE TABLE lorawan_parsed_messages (
  id uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  lorawan_message_id uuid NOT NULL REFERENCES lorawan_messages (id) ON DELETE CASCADE,
  device_id uuid REFERENCES devices (id),
  battery_level integer,
  sd_card_used_capacity integer,
  model_output text
);

-- Index for quick lookup by original message
CREATE INDEX lorawan_parsed_messages_message_id_idx ON lorawan_parsed_messages (lorawan_message_id);
CREATE INDEX lorawan_parsed_messages_device_id_idx ON lorawan_parsed_messages (device_id);

COMMENT ON TABLE lorawan_parsed_messages IS 'Parsed LoRaWAN message payload fields (battery level, SD card usage, AI model output)';
COMMENT ON COLUMN lorawan_parsed_messages.lorawan_message_id IS 'Reference to original raw LoRaWAN message';
COMMENT ON COLUMN lorawan_parsed_messages.device_id IS 'Device that sent this message';
COMMENT ON COLUMN lorawan_parsed_messages.battery_level IS 'Battery level percentage (0-100)';
COMMENT ON COLUMN lorawan_parsed_messages.sd_card_used_capacity IS 'SD card used capacity in MB';
COMMENT ON COLUMN lorawan_parsed_messages.model_output IS 'AI model detection output (e.g., "I have seen a Rat!")';

ALTER TABLE lorawan_parsed_messages ENABLE ROW LEVEL SECURITY;
