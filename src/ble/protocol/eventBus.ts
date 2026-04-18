import EventEmitter from 'eventemitter3';
import { DeviceSignalType } from './deviceSignals';

export type BleEvent =
  | { type: 'TEXT_LINE'; line: string; ts: number; deviceId: string }
  | { type: 'BINARY_PACKET'; data: Uint8Array; ts: number; deviceId: string; packetNum: number; length: number }
  | { type: 'DEVICE_SIGNAL'; signal: DeviceSignalType; ts: number; deviceId: string };

type BleEventBusMap = {
  textLine: (event: BleEvent & { type: 'TEXT_LINE' }) => void;
  binaryPacket: (event: BleEvent & { type: 'BINARY_PACKET' }) => void;
  deviceSignal: (event: BleEvent & { type: 'DEVICE_SIGNAL' }) => void;
  // Fall-through wildcard
  any: (event: BleEvent) => void;
};

class BleEventBus extends EventEmitter<BleEventBusMap> {
  public emitEvent(event: BleEvent) {
    // Sync dispatch explicitly avoids interleaving guarantees,
    // protecting streams from command backpressure blocking.
    switch (event.type) {
      case 'TEXT_LINE':
        this.emit('textLine', event);
        break;
      case 'BINARY_PACKET':
        this.emit('binaryPacket', event);
        break;
      case 'DEVICE_SIGNAL':
        this.emit('deviceSignal', event);
        break;
    }
    this.emit('any', event);
  }
}

export const bleEventBus = new BleEventBus();
