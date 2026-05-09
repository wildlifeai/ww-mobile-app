import { bleEventBus, BleEvent } from './eventBus';
import { ExtendedPeripheral } from '../../redux/slices/devicesSlice';
import { CommandContext } from './commandRegistry';
import { BLE_PROTOCOL_RETRIES, BLE_PROTOCOL_TIMINGS } from './protocolConstants';
import { bleTransport } from './bleTransportController';
import { writeToDevice } from '../transport';
import { DeviceSignal } from './deviceSignals';

/**
 * Execute a single BLE command: subscribe → send → resolve/reject.
 *
 * Subscribes to `bleEventBus.textLine` and `bleEventBus.deviceSignal`
 * BEFORE writing to the transport, so the response listener is always
 * registered before the device can reply.
 *
 * Resolution:
 *   - `successMatcher(line)` → `collect(line)` → `isComplete()` → `parser()` → resolve
 *   - `failureMatcher(line)` → reject
 *   - `DEVICE_BUSY` signal → reject (retried by the pipeline)
 *   - `DEVICE_DISCONNECTED` signal → reject (non-retryable)
 *   - timeout → reject (retried by the pipeline if eligible)
 */
function runCommand<T>(
  peripheral: ExtendedPeripheral,
  commandConstructor: () => CommandContext<T>
): Promise<T> {
  const context = commandConstructor();

  return new Promise((resolve, reject) => {
    let isResolved = false;
    let timeoutHandle: NodeJS.Timeout;

    const cleanup = () => {
      bleEventBus.removeListener('textLine', handleEvent);
      bleEventBus.removeListener('deviceSignal', handleDeviceSignal);
      clearTimeout(timeoutHandle);
    };

    // Idempotency: Protect against duplicated parse/match triggers
    const idempotentResolve = (result: T) => {
      if (isResolved) return;
      isResolved = true;
      cleanup();
      resolve(result);
    };

    const idempotentReject = (error: Error) => {
      if (isResolved) return;
      isResolved = true;
      cleanup();
      reject(error);
    };

    const handleEvent = (event: BleEvent & { type: 'TEXT_LINE' }) => {
      if (event.deviceId !== peripheral.id) return;

      // Defense: Ignore unmatched lines safely without mutating context state
      if (!context.match(event.line)) {
        context.onUnexpected?.(event.line);
        return;
      }

      try {
        context.collect(event.line);

        // Authority: isComplete holds absolute authority over context lifecycle
        if (context.isComplete()) {
          idempotentResolve(context.getResult());
        }
      } catch (err: any) {
        idempotentReject(err);
      }
    };

    const handleDeviceSignal = (event: BleEvent & { type: 'DEVICE_SIGNAL' }) => {
      if (event.deviceId !== peripheral.id) return;
      if (event.signal === DeviceSignal.BUSY) {
        idempotentReject(new Error('DEVICE_BUSY'));
      } else if (event.signal === DeviceSignal.DISCONNECT) {
        idempotentReject(new Error('DEVICE_DISCONNECTED'));
      }
    };

    // 1. REGISTER BEFORE ACT: Listeners must attach before bytes are placed on the transport
    bleEventBus.on('textLine', handleEvent);
    bleEventBus.on('deviceSignal', handleDeviceSignal);

    // 2. TIMEOUT PROTECTION
    const timeoutThreshold = context.timeoutMs ?? BLE_PROTOCOL_TIMINGS.DEFAULT_RESPONSE_TIMEOUT_MS;
    timeoutHandle = setTimeout(() => {
      const timeoutError = new Error('TIMEOUT');
      if (context.onTimeout) {
         try {
           context.onTimeout();
           if (context.isComplete()) idempotentResolve(context.getResult());
           else idempotentReject(timeoutError);
         } catch(e: any) {
           idempotentReject(e);
         }
      } else {
         idempotentReject(timeoutError);
      }
    }, timeoutThreshold);

    // 3. ACT: Send bytes
    writeToDevice(peripheral, context.build()).catch(idempotentReject);
  });
}

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

  // Connection lost — no point retrying on a dead link
  if (msg.includes('DEVICE_DISCONNECTED') || msg.includes('DISCONNECTED')) {
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

  let lockAcquired = false;
  let heartbeatsPaused = false;

  try {
    // ── Exclusive lock: Acquire first ──
    if (context.requiresExclusiveLock) {
      bleTransport.acquireLock(context.name);
      lockAcquired = true;
    }

    // ── Long-running: Pause heartbeats only after lock is secured ──
    if (context.isLongRunning) {
      bleEventBus.emitEvent({
        type: 'HEARTBEAT_PAUSE', isPaused: true, ts: Date.now()
      });
      heartbeatsPaused = true;
    }

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
          bleTransport.resumeFromBusy();
        }

        // If the error was DEVICE_SLEEP, the commandQueue itself will be paused 
        // waiting for a WAKE signal. We just loop around, and the queue processor
        // won't let this run until the state machine transitions to RUNNING again.
      }
    }
  } finally {
    // ── Only release what THIS instance acquired ──
    if (heartbeatsPaused) {
      bleEventBus.emitEvent({
        type: 'HEARTBEAT_PAUSE', isPaused: false, ts: Date.now()
      });
    }
    if (lockAcquired) {
      bleTransport.releaseLock(context.name);
    }
  }
}
