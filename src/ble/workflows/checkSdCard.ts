import { BleSession } from '../session/createBleSession';
import { commandRegistry } from '../protocol/commandRegistry';

/**
 * Card size and free space from `AI info`, in kilobytes, the unit the device
 * prints (`31154688 K total drive space` is a 32 GB card). Callers store them
 * in the `sdCard...KbAtStart` columns as they are (#327).
 */
export async function checkSdCard(session: BleSession): Promise<{ totalSpaceKb: number; freeSpaceKb: number }> {
  // `session.execute` will automatically handle DEVICE_SLEEP interruptions natively
  const result = await session.execute<{ total?: number; free?: number; error?: string }>(
    commandRegistry.aiinfo
  );

  if (result.error) {
    throw new Error(`SD Card Check Failed: ${result.error}`);
  }

  if (result.total === undefined || result.free === undefined) {
    throw new Error('SD Card Check Failed: Invalid response payload');
  }

  return {
    totalSpaceKb: result.total,
    freeSpaceKb: result.free
  };
}
