import { useMemo } from 'react';
import { createBleSession, BleSession } from '../ble/session/createBleSession';
import { ExtendedPeripheral } from '../redux/slices/devicesSlice';

export function useBleSession(device: ExtendedPeripheral | undefined): BleSession | null {
  const session = useMemo(() => {
    if (!device || !device.connected) return null;
    return createBleSession(device);
  }, [device]);

  return session;
}
