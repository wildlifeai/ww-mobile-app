import { bleEventBus, BleEvent } from './eventBus';

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

  /**
   * Registers a stream endpoint. Explicitly owned by a workflow or command context.
   */
  public registerStream(streamId: string, handler: StreamHandler) {
    this.activeStreams.set(streamId, handler);
  }

  /**
   * Cleans up the stream endpoint upon timeout, completion, or session invalidation.
   */
  public unregisterStream(streamId: string) {
    this.activeStreams.delete(streamId);
  }

  /**
   * Force tear-down of all streams upon hard disconnect or session isolation.
   */
  public terminateAll() {
    this.activeStreams.clear();
  }
}

export const streamRegistry = new StreamRegistry();
