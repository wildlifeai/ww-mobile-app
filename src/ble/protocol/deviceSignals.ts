export const DeviceSignal = {
  SLEEP: 'SLEEP',
  WAKE: 'WAKE',
  BUSY: 'BUSY',
  /** Non-retryable device state error (e.g. "Camera system not enabled").
   *  Unlike BUSY, this indicates a configuration problem that won't resolve
   *  on its own — retrying would just waste time and queue bandwidth. */
  CONFIG_ERROR: 'CONFIG_ERROR',
  DISCONNECT: 'DISCONNECT',
} as const;

export type DeviceSignalType = typeof DeviceSignal[keyof typeof DeviceSignal];
