/**
 * Waiting for the AI processor's Sleep, the message that says a command it
 * refused can go again: the BLE processor wakes it for the next one.
 */
import { bleEventBus, BleEvent } from './eventBus';
import { DeviceSignal } from './deviceSignals';

/**
 * How long a command the AI processor refused until its next Sleep (a cold
 * boot, #476, or a Sleep under way, #535) waits for that Sleep before giving
 * up. The processor sleeps once its inactivity
 * period (op 8) has passed with nothing holding it awake; this allows for a
 * keep-awake hold on top.
 */
export const SLEEP_REFUSAL_WAIT_MS = 15000;

/** Resolve true on this device's next Sleep, false on timeout or when `signal` aborts. */
export function waitForNextSleep(deviceId: string, timeoutMs: number, signal?: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve(false);
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (slept: boolean) => {
      clearTimeout(timer);
      bleEventBus.removeListener('deviceSignal', onSignal);
      signal?.removeEventListener('abort', onAbort);
      resolve(slept);
    };
    const onSignal = (event: BleEvent & { type: 'DEVICE_SIGNAL' }) => {
      if (event.deviceId === deviceId && event.signal === DeviceSignal.SLEEP) finish(true);
    };
    const onAbort = () => finish(false);
    bleEventBus.on('deviceSignal', onSignal);
    signal?.addEventListener('abort', onAbort);
    timer = setTimeout(() => finish(false), timeoutMs);
  });
}
