export const BLE_PROTOCOL_TIMINGS = {
  DEFAULT_RESPONSE_TIMEOUT_MS: 6000,
  LONG_RESPONSE_TIMEOUT_MS: 120000, // E.g., for firmware flashing
  POST_COMPLETION_DRAIN_WINDOW_MS: 150, // Ghost line rejection buffer
  BUSY_RETRY_DELAY_MS: 1000, // Delay before retrying on DEVICE_BUSY
  IMAGE_STREAM_PACKET_TIMEOUT_MS: 3000,
} as const;

export const BLE_PROTOCOL_RETRIES = {
  DEFAULT_MAX_RETRIES: 1,
} as const;
