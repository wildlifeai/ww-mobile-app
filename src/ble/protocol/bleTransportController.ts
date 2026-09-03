/**
 * BleTransportController
 *
 * Unified authority for BLE command transport state.
 * Owns: command queue, transport lock, device signal handling.
 *
 * Consolidates what was previously spread across:
 *   - commandQueue.ts (queue state + processing) → now in bleTransportController
 *   - transportLock.ts (exclusive lock) → now in bleTransportController
 *   - runCommand.ts (subscribe → send → resolve) → now runCommandPipeline.ts
 *
 * Consumers interact via:
 *   - bleTransport.enqueue()    — submit a command for execution
 *   - bleTransport.clearAll()   — break-glass emergency reset
 *   - bleTransport.acquireLock() / releaseLock() — exclusive transport
 *   - bleTransport.isBusy()     — check if commands are in-flight
 *   - bleTransport.resumeFromBusy() — externally driven BUSY → RUNNING
 */

import { bleEventBus, BleEvent } from './eventBus';
import { BLE_PROTOCOL_TIMINGS } from './protocolConstants';
import { DeviceSignal } from './deviceSignals';
import { imageReassemblerEmitter } from '../emitters';
import { log, logWarn } from '../../utils/logger';

/**
 * Transport-level state. Represents what the BLE transport layer
 * is doing RIGHT NOW — a single source of truth.
 *
 *   IDLE         — No commands queued or active, transport available
 *   RUNNING      — Actively executing a command
 *   PAUSED_SLEEP — Device is entering DPD; queue blocked until WAKE, or
 *                  until SLEEP_SETTLE_MS has passed, whichever comes first.
 *                  The device wakes only when sent a command, so a pause
 *                  that waited for a Wake alone stranded every command
 *                  queued behind it (bench, 3 September 2026: a Sleep that
 *                  landed while a slow JS thread was still completing
 *                  `slots` froze Capture Picture until the link dropped).
 *   PAUSED_BUSY  — Device reported BUSY; queue blocked until resume
 *   LOCKED       — Exclusive lock held (e.g. file transfer); queue
 *                  rejects non-holder commands
 *
 * Two gates sit beside that state: the exclusive lock above, and the image
 * stream. While `AI txfile` is streaming a picture in, nothing may be sent.
 * The nRF forwards any command to the Himax at once, restarts its binary
 * packet counter, and the reply only comes once the file has finished
 * (bench, 3 September 2026: a `slots` sent mid-stream produced "AI processor
 * not responding", 412 phantom sequence gaps and a reply 14 s late). The
 * reassembler announces the stream's start and end; the queue holds between
 * them, with a stall timer so a stream that dies cannot hold it for good.
 */
export type TransportState = 'IDLE' | 'RUNNING' | 'PAUSED_SLEEP' | 'PAUSED_BUSY';
export type CommandState = 'CREATED' | 'ACTIVE' | 'COMPLETING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface CommandTask<T = any> {
  id: string;
  execute: () => Promise<T>;
  abortSignal?: AbortSignal;
  onStateChange?: (state: CommandState) => void;
  // Internal tracking
  _state: CommandState;
  _resolve: (value: T) => void;
  _reject: (err: Error) => void;
  _abortHandler?: () => void;
}

const emitQueueState = (isBusy: boolean) => {
  bleEventBus.emitEvent({
    type: 'QUEUE_STATE_CHANGED',
    isBusy,
    ts: Date.now()
  });
};

class BleTransportController {
  private state: TransportState = 'IDLE';
  private queue: CommandTask[] = [];
  private activeTask: CommandTask | null = null;
  private isProcessing = false;

  // ── Exclusive transport lock ──────────────────────────────────────
  // When held, enqueue() rejects new commands unless the caller IS the
  // lock holder. This prevents rogue battery checks, status polls, or
  // Engineer Console writes from corrupting a long-running firmware
  // update or flash erase operation.
  //
  // Acquired/released by runCommandPipeline for commands with
  // `requiresExclusiveLock: true`, and by runFileTransferPipeline
  // for the entire transfer session.
  private _lockHolder: string | null = null;

  // Lifts a sleep pause on its own once the device has had time to enter DPD.
  private sleepSettleTimer: NodeJS.Timeout | null = null;

  // Holds the queue while an image streams in. See the header.
  private streamActive = false;
  private streamStallTimer: NodeJS.Timeout | null = null;

  constructor() {
    bleEventBus.on('deviceSignal', this.handleDeviceSignal.bind(this));
    imageReassemblerEmitter.on('onImageStart', () => this.beginStream());
    imageReassemblerEmitter.on('onImageProgress', () => this.armStreamStall());
    imageReassemblerEmitter.on('onImageComplete', () => this.endStream('image saved'));
    imageReassemblerEmitter.on('onImageError', () => this.endStream('transfer failed'));
  }

  // ── State inspection ──────────────────────────────────────────────

  /** Current transport state for debugging/telemetry. */
  public get transportState(): TransportState {
    return this.state;
  }

  // ── Lock API ──────────────────────────────────────────────────────

  /**
   * Acquire the exclusive transport lock.
   * Throws if the lock is already held by a different holder.
   */
  public acquireLock(holder: string): void {
    if (this._lockHolder) {
      throw new Error(
        `Transport lock already held by '${this._lockHolder}', ` +
        `cannot acquire for '${holder}'`
      );
    }
    this._lockHolder = holder;
    log(`[BleTransport] Lock acquired by '${holder}'`);
  }

  /**
   * Release the lock. Only the current holder can release it.
   * Mismatched releases are logged but ignored to prevent
   * one component from stealing another's lock.
   */
  public releaseLock(holder: string): void {
    if (this._lockHolder === null) {
      return; // Already released — no-op
    }
    if (this._lockHolder !== holder) {
      logWarn(`[BleTransport] '${holder}' tried to release lock, but it is held by '${this._lockHolder}'. Ignoring.`);
      return;
    }
    log(`[BleTransport] Lock released by '${holder}'`);
    this._lockHolder = null;
  }

  /** Whether the exclusive transport lock is currently held. */
  public get isLocked(): boolean {
    return this._lockHolder !== null;
  }

  /** The current lock holder, or null if unlocked. */
  public get lockHolder(): string | null {
    return this._lockHolder;
  }

  /**
   * Check if a specific holder owns the lock.
   * Used internally to allow the lock holder's own commands
   * through without deadlocking.
   */
  public isLockedBy(holder: string): boolean {
    return this._lockHolder === holder;
  }

  // ── Queue API ─────────────────────────────────────────────────────

  public isBusy(): boolean {
    return this.isProcessing || this.activeTask !== null || this.queue.length > 0;
  }

  /**
   * Enqueues a command execution task into the single-flight queue.
   *
   * @param lockHolder  If provided and matches the current transport lock holder,
   *                    the command is allowed through. This prevents deadlock when
   *                    the lock holder (e.g. file transfer pipeline) needs to
   *                    execute sub-commands while holding the lock.
   */
  public enqueue<T>(
    executeFn: () => Promise<T>,
    options?: { signal?: AbortSignal; lockHolder?: string }
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      // Enforce exclusive transport lock — reject if a long-running
      // operation currently holds the lock, UNLESS the caller IS the holder
      if (this._lockHolder && !this.isLockedBy(options?.lockHolder ?? '')) {
        return reject(new Error(
          `Transport locked by '${this._lockHolder}'. ` +
          `Command rejected to protect active operation.`
        ));
      }

      const task: CommandTask<T> = {
        id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        execute: executeFn,
        abortSignal: options?.signal,
        _state: 'CREATED',
        _resolve: resolve,
        _reject: reject,
      };

      if (options?.signal?.aborted) {
        task._state = 'CANCELLED';
        return reject(new Error('Command cancelled before enqueue'));
      }

      const abortHandler = () => {
        if (task._state !== 'COMPLETED' && task._state !== 'FAILED') {
          this.transitionCommand(task, 'CANCELLED');
          task._reject(new Error('Command cancelled'));
          
          if (this.activeTask?.id !== task.id) {
            this.queue = this.queue.filter(t => t.id !== task.id);
          }
        }
      };

      if (options?.signal) {
        options.signal.addEventListener('abort', abortHandler);
        task._abortHandler = abortHandler;
      }

      this.queue.push(task);
      this.processNext();
    });
  }

  // ── State machine ─────────────────────────────────────────────────

  private transitionQueue(newState: TransportState) {
    if (this.state === newState) return;
    // Prevent illegal transitions
    if (this.state === 'IDLE' && (newState === 'PAUSED_SLEEP' || newState === 'PAUSED_BUSY')) {
       // Ignore sleep/busy if we aren't running anything to protect from dual-wakes
       return;
    }
    this.state = newState;
  }

  private transitionCommand(task: CommandTask, newState: CommandState) {
    task._state = newState;
    task.onStateChange?.(newState);
  }

  private handleDeviceSignal(event: BleEvent & { type: 'DEVICE_SIGNAL' }) {
    if (event.signal === DeviceSignal.SLEEP) {
      this.transitionQueue('PAUSED_SLEEP');
      if (this.state === 'PAUSED_SLEEP') this.armSleepSettle();
    } else if (event.signal === DeviceSignal.BUSY) {
      this.transitionQueue('PAUSED_BUSY');
    } else if (event.signal === DeviceSignal.CONFIG_ERROR) {
      // Intentionally NO queue pause. CONFIG_ERROR is a non-retryable
      // configuration problem (e.g. "Camera system not enabled").
      // runCommandPipeline handles it by rejecting the active command.
      // Pausing the queue here would deadlock — the condition will
      // never self-resolve.
    } else if (event.signal === DeviceSignal.WAKE) {
      this.clearSleepSettle();
      if (this.state === 'PAUSED_SLEEP') {
        this.transitionQueue('RUNNING');
        this.processNext(); // Resume
      }
    } else if (event.signal === DeviceSignal.DISCONNECT) {
      // Fail-fast: reject all queued + active commands immediately
      // instead of letting each one time out sequentially (3s × N).
      this.clearAll();
    }
  }

  /**
   * After a Sleep, resume on our own once the device has had time to enter
   * DPD. The nRF wakes the Himax for whatever we send next, so the next
   * command is the wake; waiting for a Wake signal instead would wait forever.
   */
  private armSleepSettle() {
    this.clearSleepSettle();
    this.sleepSettleTimer = setTimeout(() => {
      this.sleepSettleTimer = null;
      if (this.state === 'PAUSED_SLEEP') {
        this.transitionQueue('RUNNING');
        this.processNext();
      }
    }, BLE_PROTOCOL_TIMINGS.SLEEP_SETTLE_MS);
  }

  private clearSleepSettle() {
    if (this.sleepSettleTimer) {
      clearTimeout(this.sleepSettleTimer);
      this.sleepSettleTimer = null;
    }
  }

  // ── Image stream gate ─────────────────────────────────────────────

  /** Whether an image is streaming in and the queue is holding for it. */
  public get isStreaming(): boolean {
    return this.streamActive;
  }

  private beginStream() {
    this.streamActive = true;
    this.armStreamStall();
    log(`[BleTransport] Image stream started; holding ${this.queue.length} queued command(s) until it ends`);
  }

  private endStream(reason: string) {
    if (!this.streamActive) return;
    this.streamActive = false;
    this.clearStreamStall();
    log(`[BleTransport] Image stream ended (${reason}); ${this.queue.length} command(s) waiting`);
    this.processNext();
  }

  /** A stream that stops delivering must not hold the queue for good. */
  private armStreamStall() {
    if (!this.streamActive) return;
    this.clearStreamStall();
    this.streamStallTimer = setTimeout(() => {
      this.streamStallTimer = null;
      logWarn(`[BleTransport] Image stream silent for ${BLE_PROTOCOL_TIMINGS.IMAGE_STREAM_STALL_MS} ms; releasing the queue`);
      this.endStream('stalled');
    }, BLE_PROTOCOL_TIMINGS.IMAGE_STREAM_STALL_MS);
  }

  private clearStreamStall() {
    if (this.streamStallTimer) {
      clearTimeout(this.streamStallTimer);
      this.streamStallTimer = null;
    }
  }

  /**
   * Externally driven resume (e.g., from retry middleware or explicitly)
   */
  public resumeFromBusy() {
    if (this.state === 'PAUSED_BUSY') {
      this.transitionQueue('RUNNING');
      this.processNext();
    }
  }

  private async processNext() {
    if (this.isProcessing) return;
    if (this.activeTask || this.queue.length === 0) {
      if (this.queue.length === 0 && !this.activeTask) {
        this.transitionQueue('IDLE');
      }
      return;
    }
    if (this.state === 'PAUSED_SLEEP' || this.state === 'PAUSED_BUSY') {
      return;
    }
    if (this.streamActive) {
      return; // endStream() resumes
    }

    this.isProcessing = true;
    emitQueueState(true);
    this.transitionQueue('RUNNING');
    
    const task = this.queue.shift()!;
    this.activeTask = task;

    if (task._state === 'CANCELLED') {
      this.activeTask = null;
      this.isProcessing = false;
      if (this.queue.length === 0) emitQueueState(false);
      this.processNext();
      return;
    }

    this.transitionCommand(task, 'ACTIVE');

    try {
      const result = await task.execute();
      
      // Strict Late-Response Drain Post-Completion
      this.transitionCommand(task, 'COMPLETING');
      await new Promise(r => setTimeout(r, BLE_PROTOCOL_TIMINGS.POST_COMPLETION_DRAIN_WINDOW_MS));

      if ((task._state as CommandState) !== 'CANCELLED') {
         this.transitionCommand(task, 'COMPLETED');
         task._resolve(result);
      }
    } catch (err: any) {
      if ((task._state as CommandState) !== 'CANCELLED') {
         this.transitionCommand(task, 'FAILED');
         task._reject(err);
      }
    } finally {
      if (task.abortSignal && task._abortHandler) {
        task.abortSignal.removeEventListener('abort', task._abortHandler);
      }
      this.activeTask = null;
      this.isProcessing = false;
      if (this.queue.length === 0) emitQueueState(false);
      this.processNext();
    }
  }

  /**
   * Break-glass emergency API.
   * Immediately rejects all queued and active commands,
   * resets the transport to IDLE state.
   */
  public clearAll() {
    this._lockHolder = null;
    this.clearSleepSettle();
    this.streamActive = false;
    this.clearStreamStall();
    const error = new Error('Session Reset');
    if (this.activeTask) {
      this.transitionCommand(this.activeTask, 'CANCELLED');
      this.activeTask._reject(error);
      this.activeTask = null;
    }
    const currentQueue = [...this.queue];
    this.queue = [];
    for (const task of currentQueue) {
      this.transitionCommand(task, 'CANCELLED');
      task._reject(error);
    }
    this.transitionQueue('IDLE');
    this.isProcessing = false;
  }
}

/** Singleton BLE transport controller — the single authority for command transport state. */
export const bleTransport = new BleTransportController();
