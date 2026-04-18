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
      // 1. Check for binary frame
      if (buffer[0] === BINARY_MARKER) {
        if (buffer.length < HEADER_SIZE) {
          // Need more bytes for header
          break;
        }
        
        const packetNum = buffer[1];
        const payloadLength = buffer[2];
        const fullFrameLength = HEADER_SIZE + payloadLength;

        if (buffer.length < fullFrameLength) {
          // Need more bytes to complete this binary frame
          break;
        }

        const frameData = Uint8Array.prototype.slice.call(buffer, 0, fullFrameLength);
        
        bleEventBus.emitEvent({
          type: 'BINARY_PACKET',
          data: frameData,
          deviceId,
          packetNum,
          length: payloadLength,
          ts: Date.now()
        });

        // Advance buffer past this binary frame
        buffer = buffer.subarray(fullFrameLength);
        continue;
      }

      // 2. Not a binary frame, look for text newline
      const newlineIndex = buffer.indexOf('\n');
      if (newlineIndex !== -1) {
        // Extract line and remove \r if present
        let line = buffer.subarray(0, newlineIndex).toString('utf-8');
        line = line.replace(/\r$/, '');

        // Advance buffer past the newline
        buffer = buffer.subarray(newlineIndex + 1);

        // Filter out completely empty lines if desired, or keep them. Often raw \r\n causes noise.
        if (line.trim().length > 0) {
          this.classifyAndEmitText(deviceId, line);
        }
        continue;
      }

      // 3. No binary marker and no newline. 
      // Could be an incomplete text line. Wait for more data.
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
    bleEventBus.emitEvent({ type: 'TEXT_LINE', line, deviceId, ts });
  }

  public clearBuffer(deviceId: string) {
    delete this.buffers[deviceId];
  }
}

export const rxRouter = new RxRouter();
