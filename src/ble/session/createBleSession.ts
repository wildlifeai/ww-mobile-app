import { commandQueue } from '../protocol/commandQueue';
import { runCommandPipeline } from '../protocol/runCommandPipeline';
import { streamRegistry } from '../protocol/streamRegistry';
import { bleEventBus } from '../protocol/eventBus';
import BleManager from 'react-native-ble-manager';
import { rxRouter } from '../protocol/rxRouter';
import { ExtendedPeripheral } from '../../redux/slices/devicesSlice';

export function createBleSession(peripheral: ExtendedPeripheral) {
  
  const execute = <T>(
    commandConstructor: () => import('../protocol/commandRegistry').CommandContext<T>, 
    options?: { signal?: AbortSignal, maxRetries?: number }
  ): Promise<T> => {
    return commandQueue.enqueue<T>(
      () => runCommandPipeline(peripheral, commandConstructor, options),
      { signal: options?.signal }
    );
  };

  const reset = () => {
    commandQueue.clearAll();
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
