/**
 * Exclusive transport lock.
 *
 * When held, the commandQueue rejects new enqueue() calls
 * (unless the caller IS the lock holder — see isHeldBy()).
 * This prevents rogue battery checks, status polls, or
 * Engineer Console writes from corrupting a long-running
 * firmware update or flash erase operation.
 *
 * Acquired/released automatically by runCommandPipeline
 * for commands with `requiresExclusiveLock: true`, and by
 * runFileTransferPipeline for the entire transfer session.
 */

import { log, logWarn } from '../../utils/logger';

class TransportLock {
  private _holder: string | null = null;

  acquire(holder: string): void {
    if (this._holder) {
      throw new Error(
        `Transport lock already held by '${this._holder}', ` +
        `cannot acquire for '${holder}'`
      );
    }
    this._holder = holder;
    log(`[TransportLock] Acquired by '${holder}'`);
  }

  /**
   * Release the lock. Only the current holder can release it.
   * Mismatched releases are logged but ignored to prevent
   * one component from stealing another's lock.
   */
  release(holder: string): void {
    if (this._holder === null) {
      return; // Already released — no-op
    }
    if (this._holder !== holder) {
      logWarn(`[TransportLock] '${holder}' tried to release, but lock is held by '${this._holder}'. Ignoring.`);
      return;
    }
    log(`[TransportLock] Released by '${holder}'`);
    this._holder = null;
  }

  get isLocked(): boolean {
    return this._holder !== null;
  }

  get holder(): string | null {
    return this._holder;
  }

  /**
   * Check if a specific holder owns the lock.
   * Used by commandQueue to allow the lock holder's own
   * commands through without deadlocking.
   */
  isHeldBy(holder: string): boolean {
    return this._holder === holder;
  }
}

export const transportLock = new TransportLock();

