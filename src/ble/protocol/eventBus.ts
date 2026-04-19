import EventEmitter from 'eventemitter3';
import { DeviceSignalType } from './deviceSignals';

export type BleEvent =
  | { type: 'TEXT_LINE'; line: string; ts: number; deviceId: string }
  | { type: 'RAW_TX'; command: string; ts: number; deviceId: string }
  | { type: 'RAW_RX'; line: string; ts: number; deviceId: string }
  | { type: 'BINARY_PACKET'; data: Uint8Array; ts: number; deviceId: string; packetNum: number; length: number }
  | { type: 'QUEUE_STATE_CHANGED'; isBusy: boolean; ts: number; deviceId?: string }
  | { type: 'DEVICE_SIGNAL'; signal: DeviceSignalType; ts: number; deviceId: string }
  | { type: 'HEARTBEAT_PAUSE'; isPaused: boolean; ts: number; deviceId?: string };

type BleEventBusMap = {
  textLine: (event: BleEvent & { type: 'TEXT_LINE' }) => void;
  rawTx: (event: BleEvent & { type: 'RAW_TX' }) => void;
  rawRx: (event: BleEvent & { type: 'RAW_RX' }) => void;
  binaryPacket: (event: BleEvent & { type: 'BINARY_PACKET' }) => void;
  queueStateChanged: (event: BleEvent & { type: 'QUEUE_STATE_CHANGED' }) => void;
  deviceSignal: (event: BleEvent & { type: 'DEVICE_SIGNAL' }) => void;
  heartbeatPause: (event: BleEvent & { type: 'HEARTBEAT_PAUSE' }) => void;
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
      case 'RAW_TX':
        this.emit('rawTx', event);
        break;
      case 'RAW_RX':
        this.emit('rawRx', event);
        break;
      case 'BINARY_PACKET':
        this.emit('binaryPacket', event);
        break;
      case 'QUEUE_STATE_CHANGED':
        this.emit('queueStateChanged', event);
        break;
      case 'DEVICE_SIGNAL':
        this.emit('deviceSignal', event);
        break;
      case 'HEARTBEAT_PAUSE':
        this.emit('heartbeatPause', event);
        break;
    }
    this.emit('any', event);
  }
}

export const bleEventBus = new BleEventBus();
