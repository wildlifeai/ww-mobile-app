import { bleEventBus, BleEvent } from './eventBus';
import { DeviceSignal } from './deviceSignals';
import { log } from '../../utils/logger';

/**
 * Per-connection cache of the device's operational parameter array.
 *
 * `AI getop -1` returns all 32 values at once, and nearly every device hook
 * wants one or two of them. A bench run on 2 September counted **18 fetches of
 * the same array** for six photos and one camera switch, three of them within
 * 400ms of each other on screen entry.
 *
 * The cost is not the bytes. The AI processor sleeps after about a second of
 * inactivity, so a fetch usually has to wake it, and the capture path then waits
 * for it to sleep again before it can take a picture. One redundant read is a
 * wake, a response and a sleep: measured at 1.2s inside a single capture.
 *
 * **Why not read the free copy instead.** The Himax sends the whole array to the
 * nRF on every sleep, and the nRF logs it as "AI processor sends stats". It then
 * forwards six bytes, the word `Sleep`, and drops the numbers. Until the
 * firmware passes them on, the app cannot see a broadcast it is not sent, so a
 * cache is the app-side half of the answer.
 *
 * ## Lifetime
 *
 * The entry lives for one wake window and no longer:
 *
 * - **`setop` patches it.** The device has confirmed the value with `Set OpParam
 *   N = V`, so the array is updated in place rather than dropped. Dropping it
 *   cost a wake on every capture that changed a setting: the capture's
 *   pre-flight re-read the array, which woke the device, which then had to
 *   sleep again before the capture (measured 3.6 s each, 3 September 2026).
 * - **`Wake` invalidates it.** The device can change its own parameters while we
 *   are not looking: automatic day/night switching rewrites the active slot, and
 *   the AE check writes its decision to op25. Anything read before a sleep is a
 *   guess afterwards.
 * - **Disconnect clears everything**, since the next connection may be a
 *   different device.
 *
 * That window is exactly the one the redundant reads happen in, so the narrow
 * lifetime costs almost nothing and keeps the cache honest.
 */
class OpCache {
    private ops: Map<string, string[]> = new Map();

    constructor() {
        bleEventBus.on('deviceSignal', (event: BleEvent & { type: 'DEVICE_SIGNAL' }) => {
            if (event.signal === DeviceSignal.WAKE) {
                // Woken devices may have rewritten their own parameters.
                if (this.ops.delete(event.deviceId)) {
                    log(`[OpCache] dropped on wake for ${event.deviceId}`);
                }
            } else if (event.signal === DeviceSignal.DISCONNECT) {
                this.ops.delete(event.deviceId);
            }
        });
    }

    /** Store the array a `getops` call just returned. */
    public set(deviceId: string, ops: string[]) {
        if (!Array.isArray(ops) || ops.length === 0) return;
        this.ops.set(deviceId, ops);
    }

    /** The array for this device, or null when nothing usable is held. */
    public get(deviceId: string): string[] | null {
        return this.ops.get(deviceId) ?? null;
    }

    /** Forget this device's array. */
    public invalidate(deviceId: string) {
        this.ops.delete(deviceId);
    }

    /**
     * Record one value the device has just confirmed writing, keeping the rest
     * of the array. Nothing happens when no array is held; an index the array
     * does not reach drops it, because the firmware evidently knows more
     * parameters than the copy held here.
     */
    public patch(deviceId: string, index: number, value: string) {
        const current = this.ops.get(deviceId);
        if (!current) return;
        if (index < 0 || index >= current.length) {
            this.ops.delete(deviceId);
            return;
        }
        const next = current.slice();
        next[index] = value;
        this.ops.set(deviceId, next);
    }

    /** Forget everything. Used on a transport reset. */
    public clear() {
        this.ops.clear();
    }
}

/** Module-level singleton, shared by every session. */
export const opCache = new OpCache();
