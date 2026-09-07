import { bleEventBus, BleEvent } from './eventBus';
import { DeviceSignal } from './deviceSignals';

/**
 * Whether each device is currently in Deep Power Down, tracked from the Sleep
 * and Wake signals it broadcasts.
 *
 * `waitForSleep` exists so a capture does not race the device's inactivity
 * timer, and it waits for a Sleep signal to arrive. That is correct only while
 * something has just woken the device. Once the op cache stopped the capture
 * path from reading parameters it already had, the device was usually asleep
 * before the wait even started, so the signal had already been and gone and the
 * wait ran to its full 5000ms timeout.
 *
 * Measured on the bench, 2 September: `startCapture` to `capture` went from
 * 2.03s to 5.03s, three times in a row, purely from waiting for something that
 * had already happened. The cache had removed one wake and added a longer wait.
 *
 * `unknown` is deliberately not the same as `awake`: before any signal has been
 * seen this reports false, so `waitForSleep` behaves exactly as it did before
 * and waits. Only a Sleep we actually observed short-circuits the wait.
 */
class SleepState {
    private asleep: Map<string, boolean> = new Map();

    constructor() {
        bleEventBus.on('deviceSignal', (event: BleEvent & { type: 'DEVICE_SIGNAL' }) => {
            if (event.signal === DeviceSignal.SLEEP) {
                this.asleep.set(event.deviceId, true);
            } else if (event.signal === DeviceSignal.WAKE) {
                this.asleep.set(event.deviceId, false);
            } else if (event.signal === DeviceSignal.DISCONNECT) {
                // The next connection starts with no idea what state it is in.
                this.asleep.delete(event.deviceId);
            }
        });
    }

    /** True only when a Sleep was observed and no Wake has followed it. */
    public isAsleep(deviceId: string): boolean {
        return this.asleep.get(deviceId) === true;
    }

    /** Forget everything. Used by tests and on a transport reset. */
    public clear() {
        this.asleep.clear();
    }
}

/** Module-level singleton, shared by every session. */
export const sleepState = new SleepState();
