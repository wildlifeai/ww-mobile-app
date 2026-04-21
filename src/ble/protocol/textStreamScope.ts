/**
 * TextStreamScope — scoped text line listener with automatic cleanup.
 *
 * Invariant: The file transfer pipeline must NEVER use raw
 * bleEventBus.on('textLine', ...) directly. All text line listening
 * goes through this scoped abstraction.
 *
 * Benefits:
 *   - Automatic cleanup via destroy() in finally
 *   - Device-scoped filtering
 *   - No orphan listeners on crash
 *   - Deterministic ownership
 */

import { bleEventBus, BleEvent } from './eventBus'
import { log } from '../../utils/logger'

/**
 * Thrown when a waitFor() call exceeds its timeout.
 * Callers should use instanceof StreamTimeoutError instead of
 * checking error.message strings.
 */
export class StreamTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Stream timed out after ${timeoutMs}ms`)
    this.name = 'StreamTimeoutError'
  }
}

export class TextStreamScope {
  private handler: ((event: BleEvent & { type: 'TEXT_LINE' }) => void) | null = null
  private destroyed = false

  constructor(
    private readonly deviceId: string,
    private readonly filter: (line: string) => boolean,
  ) {}

  /**
   * Wait for a line matching both the scope filter AND the predicate.
   * Returns the matching line.
   *
   * Automatically cleans up the listener on resolve, reject, or destroy.
   */
  waitFor(
    predicate: (line: string) => boolean,
    timeoutMs: number,
  ): Promise<string> {
    if (this.destroyed) {
      return Promise.reject(new Error('TextStreamScope destroyed'))
    }

    return new Promise<string>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout>

      const cleanup = () => {
        if (this.handler) {
          bleEventBus.removeListener('textLine', this.handler)
          this.handler = null
        }
        clearTimeout(timer)
      }

      timer = setTimeout(() => {
        cleanup()
        reject(new StreamTimeoutError(timeoutMs))
      }, timeoutMs)

      this.handler = (event: BleEvent & { type: 'TEXT_LINE' }) => {
        if (event.deviceId !== this.deviceId) return
        if (!this.filter(event.line)) return
        if (predicate(event.line)) {
          cleanup()
          resolve(event.line)
        }
      }

      bleEventBus.on('textLine', this.handler)
    })
  }

  /**
   * Force teardown. Idempotent. Called in finally block.
   */
  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    if (this.handler) {
      bleEventBus.removeListener('textLine', this.handler)
      this.handler = null
    }
    log(`[TextStreamScope] Destroyed for device ${this.deviceId.substring(0, 8)}`)
  }
}
