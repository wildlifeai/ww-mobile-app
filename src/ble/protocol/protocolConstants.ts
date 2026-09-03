export const BLE_PROTOCOL_TIMINGS = {
  DEFAULT_RESPONSE_TIMEOUT_MS: 6000,
  LONG_RESPONSE_TIMEOUT_MS: 120000, // E.g., for firmware flashing
  POST_COMPLETION_DRAIN_WINDOW_MS: 10, // Ghost line rejection buffer
  BUSY_RETRY_DELAY_MS: 1000, // Delay before retrying on DEVICE_BUSY
  // How long the queue holds off after a Sleep signal before sending again.
  // A sleeping Himax is woken only by a command, so the pause cannot wait for
  // a Wake that nothing will cause; it waits for the device to finish entering
  // DPD, then the next command is the wake.
  SLEEP_SETTLE_MS: 500,
  IMAGE_STREAM_PACKET_TIMEOUT_MS: 3000,
  // How long the queue keeps holding for an image stream that has gone quiet.
  // The reassembler finalises after 3 s of silence and the queue resumes on
  // that; this is the backstop for a stream that announced its size and never
  // delivered a packet.
  IMAGE_STREAM_STALL_MS: 10000,
} as const;

export const BLE_PROTOCOL_RETRIES = {
  DEFAULT_MAX_RETRIES: 1,
} as const;
