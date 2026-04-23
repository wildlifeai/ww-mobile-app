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
 *   - Safe against overlapping waitFor() calls (Set-based tracking)
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
  private activeHandlers = new Set<(event: BleEvent & { type: 'TEXT_LINE' }) => void>()
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
   *
   * The predicate is wrapped in try-catch so callers can throw from it
   * (e.g. FileTransferError on device error lines) without crashing
   * the EventEmitter dispatch loop.
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

      const handler = (event: BleEvent & { type: 'TEXT_LINE' }) => {
        if (event.deviceId !== this.deviceId) return
        if (!this.filter(event.line)) return
        try {
          if (predicate(event.line)) {
            cleanup()
            resolve(event.line)
          }
        } catch (err) {
          cleanup()
          reject(err)
        }
      }

      const cleanup = () => {
        bleEventBus.removeListener('textLine', handler)
        this.activeHandlers.delete(handler)
        clearTimeout(timer)
      }

      timer = setTimeout(() => {
        cleanup()
        reject(new StreamTimeoutError(timeoutMs))
      }, timeoutMs)

      this.activeHandlers.add(handler)
      bleEventBus.on('textLine', handler)
    })
  }

  /**
   * Force teardown. Idempotent. Called in finally block.
   * Removes all active listeners to prevent orphans.
   */
  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    for (const handler of this.activeHandlers) {
      bleEventBus.removeListener('textLine', handler)
    }
    this.activeHandlers.clear()
    log(`[TextStreamScope] Destroyed for device ${this.deviceId.substring(0, 8)}`)
  }
}
