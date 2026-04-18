import { Buffer } from 'buffer';
import { bleEventBus } from './eventBus';
import { DeviceSignal } from './deviceSignals';

const BINARY_MARKER = 0x06;
const HEADER_SIZE = 3;

class RxRouter {
  private buffers: Record<string, Buffer> = {};

  public handleIncomingBytes(deviceId: string, data: number[] | Uint8Array) {
    const chunk = Buffer.from(data);
    
    if (!this.buffers[deviceId]) {
      this.buffers[deviceId] = Buffer.alloc(0);
    }
    
    this.buffers[deviceId] = Buffer.concat([this.buffers[deviceId], chunk]);
    this.processBuffer(deviceId);
  }

  private processBuffer(deviceId: string) {
    let buffer = this.buffers[deviceId];

    while (buffer.length > 0) {
      const binIndex = buffer.indexOf(BINARY_MARKER);
      const nlIndex = buffer.indexOf('\n');

      if (binIndex !== -1 && (nlIndex === -1 || binIndex < nlIndex)) {
        // Binary packet appears before any newline.
        if (buffer.length - binIndex < HEADER_SIZE) {
          // Need more bytes for header
          break;
        }

        const packetNum = buffer[binIndex + 1];
        const payloadLength = buffer[binIndex + 2];
        const fullFrameLength = HEADER_SIZE + payloadLength;

        if (buffer.length - binIndex < fullFrameLength) {
          // Need more bytes to complete this binary frame
          break;
        }

        const frameData = Uint8Array.prototype.slice.call(buffer, binIndex, binIndex + fullFrameLength);
        
        bleEventBus.emitEvent({
          type: 'BINARY_PACKET',
          data: frameData,
          deviceId,
          packetNum,
          length: payloadLength,
          ts: Date.now()
        });

        // Safely splice it out of the buffer, stitching surrounding text bytes together
        buffer = Buffer.concat([
          buffer.subarray(0, binIndex),
          buffer.subarray(binIndex + fullFrameLength)
        ]);
        continue;
      }

      if (nlIndex !== -1) {
        // A newline appears before any binary packet.
        let line = buffer.subarray(0, nlIndex).toString('utf-8');
        line = line.replace(/\r$/, '');

        // Advance buffer past the newline
        buffer = buffer.subarray(nlIndex + 1);

        if (line.trim().length > 0) {
          this.classifyAndEmitText(deviceId, line);
        }
        continue;
      }

      // No complete text lines and no parsable binary packets left. Wait for more data.
      break;
    }

    this.buffers[deviceId] = buffer;
  }

  private classifyAndEmitText(deviceId: string, line: string) {
    const trimmed = line.trim();
    const ts = Date.now();

    // Device Signals classification
    if (/^Sleep(\s+.*)?/i.test(trimmed)) {
      bleEventBus.emitEvent({ type: 'DEVICE_SIGNAL', signal: DeviceSignal.SLEEP, deviceId, ts });
      return;
    }
    
    if (/^(Wake|Waking AI processor|AI processor is awake)/i.test(trimmed)) {
      bleEventBus.emitEvent({ type: 'DEVICE_SIGNAL', signal: DeviceSignal.WAKE, deviceId, ts });
      return;
    }
    
    if (/^Camera system not enabled$/i.test(trimmed)) {
      bleEventBus.emitEvent({ type: 'DEVICE_SIGNAL', signal: DeviceSignal.BUSY, deviceId, ts });
      return;
    }

    // Default: Emit as standard TEXT_LINE for the active command context
    console.log('RX_ROUTER EMITTING TEXT_LINE:', line);
    bleEventBus.emitEvent({ type: 'TEXT_LINE', line, deviceId, ts });
  }

  public clearBuffer(deviceId: string) {
    delete this.buffers[deviceId];
  }
}

export const rxRouter = new RxRouter();
