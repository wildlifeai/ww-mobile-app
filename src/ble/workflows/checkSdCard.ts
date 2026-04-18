import { BleSession } from '../session/createBleSession';
import { commandRegistry } from '../protocol/commandRegistry';

export async function checkSdCard(session: BleSession): Promise<{ totalSpaceMb: number; freeSpaceMb: number }> {
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
    totalSpaceMb: result.total,
    freeSpaceMb: result.free
  };
}
