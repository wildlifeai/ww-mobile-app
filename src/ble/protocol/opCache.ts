import { bleEventBus, BleEvent } from './eventBus';
import { DeviceSignal } from './deviceSignals';
import { log } from '../../utils/logger';

/**
 * Per-connection cache of the device's operational parameter array.
 *
 * `AI getop -1` returns every value at once (37 on the September 2026 firmware),
 * and nearly every device hook wants one or two of them. A bench run on
 * 2 September counted **18 fetches of the same array** for six photos and one
 * camera switch, three of them within 400ms of each other on screen entry.
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
 *
 * ## One fetch at a time
 *
 * A miss is not the whole story. Several hooks mount together on a screen and
 * each asks for the array in the same tick, before the first reply can fill the
 * cache, so every one of them misses and sends its own `AI getop -1`. Capture
 * Picture entry sent four on the bench on 4 September 2026, back to back. So a
 * fetch in flight is shared: `fetchOnce` hands the same promise to everyone who
 * asks until it settles, and only the first caller pays for the command.
 *
 * ## Copies, not references
 *
 * This is a module-level singleton, so every hook that reads it would otherwise
 * be handed the same array object: one caller writing into it would silently
 * rewrite the parameters every other caller reads, with nothing in the logs to
 * show where the value came from. Arrays are copied in and out. Nobody mutates
 * one today, and a few dozen strings are cheap enough that keeping it that way should
 * not depend on nobody ever doing so.
 */
class OpCache {
    private ops: Map<string, string[]> = new Map();
    private pending: Map<string, Promise<string[]>> = new Map();

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
        this.ops.set(deviceId, [...ops]);
    }

    /** The array for this device, or null when nothing usable is held. */
    public get(deviceId: string): string[] | null {
        const ops = this.ops.get(deviceId);
        return ops ? [...ops] : null;
    }

    /**
     * The array from the cache, from a fetch already in flight for this device,
     * or from `fetcher`, in that order. Concurrent callers share one fetch; a
     * fetch that fails is forgotten at once, so the next caller tries again.
     * The pipeline behind `fetcher` stores the reply itself.
     */
    public fetchOnce(deviceId: string, fetcher: () => Promise<string[]>): Promise<string[]> {
        const cached = this.get(deviceId);
        if (cached) return Promise.resolve(cached);

        const inFlight = this.pending.get(deviceId);
        if (inFlight) {
            log(`[OpCache] sharing the fetch in flight for ${deviceId}`);
            return inFlight.then(ops => [...ops]);
        }

        const fetch = fetcher();
        this.pending.set(deviceId, fetch);
        const settled = () => {
            if (this.pending.get(deviceId) === fetch) this.pending.delete(deviceId);
        };
        // Both branches handled here, so a failed fetch nobody else joined is
        // never an unhandled rejection; the caller sees it through the copy.
        fetch.then(settled, settled);
        return fetch.then(ops => [...ops]);
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

    /**
     * Forget everything held, fetches in flight included. Used on a transport
     * reset: a fetch started before the reset may never answer, and nobody
     * should be made to wait on it.
     */
    public clear() {
        this.ops.clear();
        this.pending.clear();
    }
}

/** Module-level singleton, shared by every session. */
export const opCache = new OpCache();
