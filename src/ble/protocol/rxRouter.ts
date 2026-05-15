import { Buffer } from 'buffer';
import { bleEventBus } from './eventBus';
import { DeviceSignal } from './deviceSignals';
import { log } from '../../utils/logger';

const BINARY_MARKER = 0x06;
const HEADER_SIZE = 3;

class RxRouter {
  private mainBuffers: Record<string, Buffer> = {};
  private textBuffers: Record<string, Buffer> = {};
  private flushTimers: Record<string, ReturnType<typeof setTimeout>> = {};

  /**
   * Time in ms to wait after the last received bytes before flushing
   * undrained text. Short enough to not feel like a delay, long enough
   * to allow MTU-fragmented chunks to reassemble.
   */
  private static readonly FLUSH_DEBOUNCE_MS = 50;

  public handleIncomingBytes(deviceId: string, data: number[] | Uint8Array) {
    const chunk = Buffer.from(data);
    
    if (!this.mainBuffers[deviceId]) {
      this.mainBuffers[deviceId] = Buffer.alloc(0);
      this.textBuffers[deviceId] = Buffer.alloc(0);
    }
    
    this.mainBuffers[deviceId] = Buffer.concat([this.mainBuffers[deviceId], chunk]);
    log(`[RxRouter] handleIncomingBytes: ${chunk.toString('hex')}`)
    this.processBuffer(deviceId);

    // BLE notification boundary flush (debounced):
    // The firmware sends each response as a separate BLE notification WITHOUT line
    // terminators (\n, \r, \0). When the text buffer has content that never drains,
    // we flush it after a brief idle period. The debounce prevents premature flushing
    // of MTU-fragmented chunks that arrive as rapid successive notifications.
    if (this.flushTimers[deviceId]) {
      clearTimeout(this.flushTimers[deviceId]);
    }
    this.flushTimers[deviceId] = setTimeout(() => {
      this.flushStaleTextBuffer(deviceId);
    }, RxRouter.FLUSH_DEBOUNCE_MS);
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

  /**
   * Sanitise, classify, and emit a text line.
   *
   * Sanitisation is intentionally aggressive — every line that reaches a
   * command listener MUST be a clean, meaningful payload. Noise (prompts,
   * empty frames, raw hex dumps) is rejected before it can trigger false
   * regex matches in the command pipeline.
   */
  private classifyAndEmitText(deviceId: string, rawLine: string) {
    const ts = Date.now();

    // ── 1. Always emit raw line for Engineer Console / teletype ──
    bleEventBus.emitEvent({ type: 'RAW_RX', line: rawLine, deviceId, ts });

    // ── 2. Aggressive sanitisation ──
    let line = rawLine
      .replace(/^cmd>\s*/g, '')   // Strip firmware CLI prompt
      .replace(/[\r\n\0]+/g, '')  // Normalise line endings
      .trim();

    // Reject empty lines after sanitisation
    if (line.length === 0) return;

    // Reject pure hex dump noise (e.g. "0A 3F B2 ..." from motion scan)
    if (/^([0-9a-fA-F]{2}\s*)+$/.test(line)) return;

    log(`[RxRouter] classifyAndEmitText: "${line}"`);

    // ── 3. Device Signals classification ──
    if (/^Sleep(\s+.*)?/i.test(line)) {
      bleEventBus.emitEvent({ type: 'DEVICE_SIGNAL', signal: DeviceSignal.SLEEP, deviceId, ts });
    }
    
    if (/^(Wake|Waking AI processor|AI processor is awake)/i.test(line)) {
      bleEventBus.emitEvent({ type: 'DEVICE_SIGNAL', signal: DeviceSignal.WAKE, deviceId, ts });
    }
    
    // "Camera system not enabled" is a CONFIG_ERROR, not BUSY.
    // It means OP 10 = 0 in CONFIG.TXT — a persistent configuration problem
    // that will never self-resolve. Retrying just wastes 1000ms per attempt.
    if (/^Camera system not enabled$/i.test(line)) {
      bleEventBus.emitEvent({ type: 'DEVICE_SIGNAL', signal: DeviceSignal.CONFIG_ERROR, deviceId, ts });
    }

    // ── 4. Emit sanitised line for command pipeline ──
    bleEventBus.emitEvent({ type: 'TEXT_LINE', line, deviceId, ts });
  }

  /**
   * Flushes any stale text remaining in the text buffer after the debounce period.
   * Called by the flush timer when no new bytes arrive within FLUSH_DEBOUNCE_MS.
   */
  private flushStaleTextBuffer(deviceId: string) {
    const textBuffer = this.textBuffers[deviceId];
    if (!textBuffer || textBuffer.length === 0) return;

    // Only flush if there's no pending split character (i.e., a complete but unterminated line)
    if (this.findSplitIndex(textBuffer) !== -1) {
      // There's a split character — drain normally instead
      this.textBuffers[deviceId] = this.drainTextBuffer(deviceId, textBuffer);
      return;
    }

    const line = textBuffer.toString('utf-8').replace(/[\r\n\0]+/g, '');
    this.textBuffers[deviceId] = Buffer.alloc(0);
    if (line.trim().length > 0) {
      log(`[RxRouter] Flushing stale text buffer: "${line}"`);
      this.classifyAndEmitText(deviceId, line);
    }
  }

  public clearBuffer(deviceId: string) {
    if (this.flushTimers[deviceId]) {
      clearTimeout(this.flushTimers[deviceId]);
      delete this.flushTimers[deviceId];
    }
    delete this.mainBuffers[deviceId];
    delete this.textBuffers[deviceId];
  }
}

export const rxRouter = new RxRouter();
