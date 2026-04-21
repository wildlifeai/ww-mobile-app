import { bleEventBus, BleEvent } from './eventBus';
import { BLE_PROTOCOL_TIMINGS } from './protocolConstants';
import { DeviceSignal } from './deviceSignals';
import { transportLock } from './transportLock';

export type QueueState = 'IDLE' | 'RUNNING' | 'PAUSED_SLEEP' | 'PAUSED_BUSY';
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

export const emitQueueState = (isBusy: boolean) => {
  bleEventBus.emitEvent({
    type: 'QUEUE_STATE_CHANGED',
    isBusy,
    ts: Date.now()
  });
};

class CommandQueue {
  private state: QueueState = 'IDLE';
  private queue: CommandTask[] = [];
  private activeTask: CommandTask | null = null;
  private isProcessing = false;

  constructor() {
    bleEventBus.on('deviceSignal', this.handleDeviceSignal.bind(this));
  }

  public isBusy(): boolean {
    return this.isProcessing || this.activeTask !== null || this.queue.length > 0;
  }

  /**
   * Enqueues a command execution task into the single-flight queue.
   */
  public enqueue<T>(
    executeFn: () => Promise<T>,
    options?: { signal?: AbortSignal }
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      // Enforce exclusive transport lock — reject if a long-running
      // operation (e.g. firmware update) currently holds the lock
      if (transportLock.isLocked) {
        return reject(new Error(
          `Transport locked by '${transportLock.holder}'. ` +
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

  private transitionQueue(newState: QueueState) {
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
    } else if (event.signal === DeviceSignal.BUSY) {
      this.transitionQueue('PAUSED_BUSY');
    } else if (event.signal === DeviceSignal.WAKE) {
      if (this.state === 'PAUSED_SLEEP') {
        this.transitionQueue('RUNNING');
        this.processNext(); // Resume
      }
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
   * Break-glass emergency API
   */
  public clearAll() {
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

export const commandQueue = new CommandQueue();
