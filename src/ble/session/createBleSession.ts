import { bleTransport } from '../protocol/bleTransportController';
import { runCommandPipeline } from '../protocol/runCommandPipeline';
import { bleEventBus, BleEvent } from '../protocol/eventBus';
import BleManager from 'react-native-ble-manager';
import { rxRouter } from '../protocol/rxRouter';
import { ExtendedPeripheral } from '../../redux/slices/devicesSlice';

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

  const reset = () => {
    bleTransport.clearAll();
    streamRegistry.terminateAll();
    rxRouter.clearBuffer(peripheral.id);
  };

  const disconnect = async () => {
    reset();
    await BleManager.disconnect(peripheral.id);
  };

  return {
    execute,
    reset,
    disconnect,
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
