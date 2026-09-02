import { bleTransport } from '../protocol/bleTransportController';
import { runCommandPipeline } from '../protocol/runCommandPipeline';
import { bleEventBus, BleEvent } from '../protocol/eventBus';
import { DeviceSignal } from '../protocol/deviceSignals';
import BleManager from 'react-native-ble-manager';
import { rxRouter } from '../protocol/rxRouter';
import { opCache } from '../protocol/opCache';
import { sleepState } from '../protocol/sleepState';
import { commandRegistry } from '../protocol/commandRegistry';
import { ExtendedPeripheral } from '../../redux/slices/devicesSlice';
import { log, logWarn } from '../../utils/logger';

// ── Stream Registry ─────────────────────────────────────────────────
// Manages active binary stream handlers. Fan-out happens on every
// verified binary frame from the RX Router. Previously a separate
// module (protocol/streamRegistry.ts), now co-located with the
// session that owns it.

export type StreamHandler = (event: BleEvent & { type: 'BINARY_PACKET' }) => void;

class StreamRegistry {
  private activeStreams: Map<string, StreamHandler> = new Map();

  constructor() {
    // Observe ONLY verified, reconstructed binary frames from the RX Router
    bleEventBus.on('binaryPacket', (event) => {
      // Fan-out to all active stream consumers
      for (const handler of this.activeStreams.values()) {
        handler(event);
      }
    });
  }

  /** Registers a stream endpoint. Explicitly owned by a workflow or command context. */
  public registerStream(streamId: string, handler: StreamHandler) {
    this.activeStreams.set(streamId, handler);
  }

  /** Cleans up the stream endpoint upon timeout, completion, or session invalidation. */
  public unregisterStream(streamId: string) {
    this.activeStreams.delete(streamId);
  }

  /** Force tear-down of all streams upon hard disconnect or session isolation. */
  public terminateAll() {
    this.activeStreams.clear();
  }
}

/** Module-level singleton — shared across all BLE sessions. */
export const streamRegistry = new StreamRegistry();

// ── Session Factory ─────────────────────────────────────────────────

export function createBleSession(peripheral: ExtendedPeripheral) {
  
  const execute = <T>(
    commandConstructor: () => import('../protocol/commandRegistry').CommandContext<T>, 
    options?: { signal?: AbortSignal, maxRetries?: number, lockHolder?: string }
  ): Promise<T> => {
    // Fail-fast: reject immediately if the device is already disconnected
    // rather than enqueuing a command that will timeout on a dead link.
    if (!peripheral.connected) {
      return Promise.reject(new Error('DEVICE_DISCONNECTED'));
    }
    return bleTransport.enqueue<T>(
      () => runCommandPipeline(peripheral, commandConstructor, options),
      { signal: options?.signal, lockHolder: options?.lockHolder }
    );
  };

  /**
   * The device's operational parameters, from cache when this wake window has
   * already fetched them.
   *
   * Prefer this to `execute(() => commandRegistry.getops())` anywhere the exact
   * freshness does not matter to the caller. A miss costs the same command it
   * always did; a hit costs nothing and, more importantly, does not wake a
   * sleeping device that the caller would then have to wait to fall asleep
   * again. See opCache.ts for what invalidates it.
   */
  const getOps = async (options?: { force?: boolean }): Promise<string[]> => {
    if (!options?.force) {
      const cached = opCache.get(peripheral.id);
      if (cached) return cached;
    }
    return execute(() => commandRegistry.getops());
  };

  const reset = () => {
    bleTransport.clearAll();
    streamRegistry.terminateAll();
    rxRouter.clearBuffer(peripheral.id);
    opCache.invalidate(peripheral.id);
  };

  const disconnect = async () => {
    reset();
    await BleManager.disconnect(peripheral.id);
  };

  /**
   * Wait for the device to enter Deep Power Down (DPD).
   * 
   * @param timeoutMs Maximum time to wait in milliseconds (defaults to 3000ms).
   * @returns Promise that resolves when the device sleeps or the timeout is reached.
   * 
   * Use this before sending commands (like `capture`) that require the device 
   * to wake up from a clean state, preventing the command from racing against 
   * the device's internal inactivity timer (which could cause it to ignore 
   * the command and drop into DPD while the command is running).
   */
  const waitForSleep = (timeoutMs = 3000): Promise<void> => {
    // Already there. Waiting for a Sleep signal that has already been sent is
    // how this call used to burn its whole timeout once the op cache stopped
    // the capture path from waking the device in the first place.
    if (sleepState.isAsleep(peripheral.id)) {
      log('[BleSession] Device already asleep — proceeding immediately.');
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        cleanup();
        logWarn(`[BleSession] Timed out waiting for Sleep signal after ${timeoutMs}ms.`);
        resolve();
      }, timeoutMs);

      const cleanup = () => {
        bleEventBus.removeListener('deviceSignal', onDeviceSignal);
      };

      const onDeviceSignal = (event: BleEvent & { type: 'DEVICE_SIGNAL' }) => {
        if (event.deviceId === peripheral.id && event.signal === DeviceSignal.SLEEP) {
          clearTimeout(timeoutId);
          cleanup();
          log(`[BleSession] Sleep signal detected — proceeding.`);
          resolve();
        }
      };

      bleEventBus.on('deviceSignal', onDeviceSignal);
    });
  };


  return {
    execute,
    getOps,
    reset,
    disconnect,
    waitForSleep,
    subscribe: streamRegistry.registerStream.bind(streamRegistry),
    unsubscribe: streamRegistry.unregisterStream.bind(streamRegistry),
    // Attach listener for specific device signals or info
    on: (eventName: 'textLine' | 'binaryPacket' | 'deviceSignal', handler: any) => {
      bleEventBus.on(eventName, handler);
      return () => bleEventBus.removeListener(eventName, handler);
    }
  };
}

export type BleSession = ReturnType<typeof createBleSession>;
