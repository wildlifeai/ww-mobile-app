import { bleEventBus, BleEvent } from './eventBus';
import { CommandContext } from './commandRegistry';
import { writeToDevice } from '../transport';
import { ExtendedPeripheral } from '../../redux/slices/devicesSlice';
import { BLE_PROTOCOL_TIMINGS } from './protocolConstants';
import { DeviceSignal } from './deviceSignals';

export async function runCommand<T>(
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
