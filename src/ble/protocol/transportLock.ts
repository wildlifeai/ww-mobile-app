/**
 * Exclusive transport lock.
 *
 * When held, the commandQueue rejects new enqueue() calls.
 * This prevents rogue battery checks, status polls, or
 * Engineer Console writes from corrupting a long-running
 * firmware update or flash erase operation.
 *
 * Acquired/released automatically by runCommandPipeline
 * for commands with `requiresExclusiveLock: true`.
 */

import { log } from '../../utils/logger';

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

  release(): void {
    if (this._holder) {
      log(`[TransportLock] Released by '${this._holder}'`);
    }
    this._holder = null;
  }

  get isLocked(): boolean {
    return this._holder !== null;
  }

  get holder(): string | null {
    return this._holder;
  }
}

export const transportLock = new TransportLock();
