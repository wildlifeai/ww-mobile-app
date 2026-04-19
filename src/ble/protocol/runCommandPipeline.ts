import { runCommand } from './runCommand';
import { ExtendedPeripheral } from '../../redux/slices/devicesSlice';
import { CommandContext } from './commandRegistry';
import { BLE_PROTOCOL_RETRIES, BLE_PROTOCOL_TIMINGS } from './protocolConstants';
import { commandQueue } from './commandQueue';

/**
 * Classifies if an error is eligible for a retry.
 * Only transport-level and device-state failures are retried.
 * Protocol parsing failures and hard hardware errors skip the retry loop.
 */
function isRetryable(error: Error): boolean {
  const msg = error.message.toUpperCase();
  
  // Non-retryable protocol/parse failures
  if (msg.includes('PARSE') || msg.includes('UNEXPECTED') || msg.includes('MALFORMED')) {
    return false;
  }
  
  // Explicit device errors that won't resolve on retry
  if (msg.includes('AI NACK') || msg.includes('I2C ERROR') || msg.includes('I2C_ERROR')) {
    return false;
  }

  // Allowed to retry
  if (msg.includes('TIMEOUT') || msg.includes('DEVICE_SLEEP') || msg.includes('DEVICE_BUSY')) {
    return true;
  }

  // Default to allowing transport drops or GATT errors to retry
  return true;
}

export async function runCommandPipeline<T>(
  peripheral: ExtendedPeripheral,
  commandConstructor: () => CommandContext<T>,
  options?: { maxRetries?: number }
): Promise<T> {
  const context = commandConstructor();
  const maxRetries = options?.maxRetries ?? context.retryPolicy?.maxRetries ?? BLE_PROTOCOL_RETRIES.DEFAULT_MAX_RETRIES;
  let attempt = 0;

  while (true) {
    try {
      return await runCommand(peripheral, commandConstructor);
    } catch (error: any) {
      if (attempt >= maxRetries || !isRetryable(error)) {
        throw error;
      }
      
      attempt++;

      // If the error was DEVICE_BUSY, we inject a delay via the Constant
      if (error.message.includes('DEVICE_BUSY')) {
        await new Promise(r => setTimeout(r, BLE_PROTOCOL_TIMINGS.BUSY_RETRY_DELAY_MS));
        // Also manually tell the queue it can unpause from BUSY
        commandQueue.resumeFromBusy();
      }
      
      // If the error was DEVICE_SLEEP, the commandQueue itself will be paused 
      // waiting for a WAKE signal. We just loop around, and the queue processor
      // won't let this run until the state machine transitions to RUNNING again.
    }
  }
}
