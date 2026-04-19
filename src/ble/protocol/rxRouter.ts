import { Buffer } from 'buffer';
import { bleEventBus } from './eventBus';
import { DeviceSignal } from './deviceSignals';
import { log } from '../../utils/logger';

const BINARY_MARKER = 0x06;
const HEADER_SIZE = 3;

class RxRouter {
  private mainBuffers: Record<string, Buffer> = {};
  private textBuffers: Record<string, Buffer> = {};

  public handleIncomingBytes(deviceId: string, data: number[] | Uint8Array) {
    const chunk = Buffer.from(data);
    
    if (!this.mainBuffers[deviceId]) {
      this.mainBuffers[deviceId] = Buffer.alloc(0);
      this.textBuffers[deviceId] = Buffer.alloc(0);
    }
    
    this.mainBuffers[deviceId] = Buffer.concat([this.mainBuffers[deviceId], chunk]);
    log(`[RxRouter] handleIncomingBytes: ${chunk.toString('hex')}`)
    this.processBuffer(deviceId);
  }

  private processBuffer(deviceId: string) {
    let mainBuffer = this.mainBuffers[deviceId];
    let textBuffer = this.textBuffers[deviceId];
    const MAX_FRAME_SIZE = 255;

    while (mainBuffer.length > 0) {
      let binIndex = mainBuffer.indexOf(BINARY_MARKER);

      if (binIndex === -1) {
        // No binary marker found. The rest of the stream is purely text.
        textBuffer = Buffer.concat([textBuffer, mainBuffer]);
        mainBuffer = Buffer.alloc(0);
        break; 
      }

      if (binIndex > 0) {
        // Binary marker exists, but not at index 0. Extract preceding bytes as text unconditionally.
        textBuffer = Buffer.concat([textBuffer, mainBuffer.subarray(0, binIndex)]);
        mainBuffer = mainBuffer.subarray(binIndex);
        continue;
      }

      // Marker found exactly at index 0.
      if (mainBuffer.length < HEADER_SIZE) {
        // Need more bytes to evaluate header
        break;
      }

      const packetNum = mainBuffer[1];
      const payloadLength = mainBuffer[2];
      const fullFrameLength = HEADER_SIZE + payloadLength;

      if (fullFrameLength > MAX_FRAME_SIZE || fullFrameLength < HEADER_SIZE) {
        // Header corrupted (insane length). Invalid marker candidate.
        // Force the marker byte into the text buffer and continue searching.
        textBuffer = Buffer.concat([textBuffer, mainBuffer.subarray(0, 1)]);
        mainBuffer = mainBuffer.subarray(1);
        continue;
      }

      if (mainBuffer.length < fullFrameLength) {
        // Valid header, but incomplete frame. Block until data arrives.
        break;
      }

      // -> COMPLETE & VALID BINARY FRAME <-

      // 1. Drain text BEFORE emitting binary to guarantee strict chronological byte-order extraction.
      textBuffer = this.drainTextBuffer(deviceId, textBuffer);

      // 2. Extract and emit binary packet
      const frameData = Uint8Array.prototype.slice.call(mainBuffer, 0, fullFrameLength);
      bleEventBus.emitEvent({
        type: 'BINARY_PACKET',
        data: frameData,
        deviceId,
        packetNum,
        length: payloadLength,
        ts: Date.now()
      });

      // 3. Remove frame from stream
      mainBuffer = mainBuffer.subarray(fullFrameLength);
    }

    // Post-loop sweep to drain newly extracted text
    textBuffer = this.drainTextBuffer(deviceId, textBuffer);

    this.mainBuffers[deviceId] = mainBuffer;
    this.textBuffers[deviceId] = textBuffer;
  }

  private drainTextBuffer(deviceId: string, textBuffer: Buffer): Buffer {
    let splitIndex = this.findSplitIndex(textBuffer);
    while (splitIndex !== -1) {
      let line = Buffer.from(textBuffer.subarray(0, splitIndex)).toString('utf-8');
      line = line.replace(/[\r\n\0]+/g, '');
      
      textBuffer = Buffer.from(textBuffer.subarray(splitIndex + 1));
      
      if (line.trim().length > 0) {
        this.classifyAndEmitText(deviceId, line);
      }
      
      splitIndex = this.findSplitIndex(textBuffer);
    }
    return textBuffer;
  }

  private findSplitIndex(buffer: Buffer): number {
    for (let i = 0; i < buffer.length; i++) {
      if (buffer[i] === 10 || buffer[i] === 13 || buffer[i] === 0) return i;
    }
    return -1;
  }

  private classifyAndEmitText(deviceId: string, line: string) {
    const trimmed = line.trim();
    const ts = Date.now();
    log(`[RxRouter] classifyAndEmitText: "${line}"`)

    // Emit RAW_RX explicitly for UI teletype parsing (Engineer Console)
    bleEventBus.emitEvent({ type: 'RAW_RX', line, deviceId, ts });

    // Device Signals classification
    if (/^Sleep(\s+.*)?/i.test(trimmed)) {
      bleEventBus.emitEvent({ type: 'DEVICE_SIGNAL', signal: DeviceSignal.SLEEP, deviceId, ts });
    }
    
    if (/^(Wake|Waking AI processor|AI processor is awake)/i.test(trimmed)) {
      bleEventBus.emitEvent({ type: 'DEVICE_SIGNAL', signal: DeviceSignal.WAKE, deviceId, ts });
    }
    
    if (/^Camera system not enabled$/i.test(trimmed)) {
      bleEventBus.emitEvent({ type: 'DEVICE_SIGNAL', signal: DeviceSignal.BUSY, deviceId, ts });
    }

    // Default: Emit as standard TEXT_LINE for the active command context
    bleEventBus.emitEvent({ type: 'TEXT_LINE', line, deviceId, ts });
  }

  public clearBuffer(deviceId: string) {
    delete this.mainBuffers[deviceId];
    delete this.textBuffers[deviceId];
  }
}

export const rxRouter = new RxRouter();
