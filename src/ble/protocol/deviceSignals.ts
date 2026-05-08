export const DeviceSignal = {
  SLEEP: 'SLEEP',
  WAKE: 'WAKE',
  BUSY: 'BUSY',
  DISCONNECT: 'DISCONNECT',
} as const;

export type DeviceSignalType = typeof DeviceSignal[keyof typeof DeviceSignal];
