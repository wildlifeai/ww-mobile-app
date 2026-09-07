import { bleEventBus, BleEvent } from './eventBus'
import { DeviceSignal } from './deviceSignals'
import { ERROR_BITS_LINE, isBootPreset, KNOWN_BITS_MASK, parseSelfTestBits, formatSelfTestBits } from '../../utils/deviceSelfTest'
import { log } from '../../utils/logger'

/**
 * The device's latest self-test result, per connection, read off the wire.
 *
 * The Himax announces `Error bits = 0xNNNN` after every wake without being
 * asked, and the same line is the reply to `selftest`. Until September 2026
 * five hooks each sent their own `selftest`, and two of them kept a private
 * listener for the broadcast. Each request is a BLE round trip, and on a
 * sleeping device it is also a wake. This cache watches every text line once
 * and hands the latest reading to whoever asks, so a hook only sends `selftest`
 * when nothing has been heard since the moment it cares about.
 *
 * ## What is stored
 *
 * The bits, when they arrived, and whether they came after a `Wake`. That last
 * flag matters: the BLE processor presets every AI bit (8-15) at boot and only
 * clears them once the Himax reports, so a reading taken before the Himax woke
 * says nothing about the camera, the SD card or the model. Readings that carry
 * the whole preset are dropped outright; a reading with `postWake: false` is
 * kept, since its low byte (battery, LoRaWAN, resets) is real either way.
 *
 * ## Lifetime
 *
 * - **`Wake` keeps the entry and notes the time**, so a caller can tell a
 *   reading from this wake apart from one before it.
 * - **Disconnect clears everything**; the next connection may be a different
 *   device.
 */
export interface SelfTestReading {
    bits: number
    /** When the line arrived, in `Date.now()` terms. */
    ts: number
    /** A `Wake` was seen for this device before the line, on this connection. */
    postWake: boolean
}

type Listener = (reading: SelfTestReading) => void

class SelfTestCache {
    private readings: Map<string, SelfTestReading> = new Map()
    /**
     * The last reading on this connection that carried a real fault, kept
     * separately because the current one is not a record of the session.
     *
     * The firmware runs its camera self-test at boot, inside the
     * `if (cameraSystemEnabled)` block, so a device with a missing sensor says
     * so on the first wake of a session and then reports 0x0000 on every warm
     * wake after it. On the bench on 5 September 2026 a device with no HM0360
     * fitted reported 0x0300 twice and then a clean 0x0000, and the capture
     * that followed timed out with nothing on screen but the word TIMEOUT.
     * `getFresh` is right to answer with the current reading; a flow explaining
     * a failure needs this one.
     */
    private faults: Map<string, SelfTestReading> = new Map()
    private lastWake: Map<string, number> = new Map()
    private listeners: Map<string, Set<Listener>> = new Map()

    private readonly onLine = (event: BleEvent & { type: 'TEXT_LINE' }) => {
        if (!ERROR_BITS_LINE.test(event.line)) return
        const bits = parseSelfTestBits(event.line)
        if (bits === null) return
        if (isBootPreset(bits)) {
            log(`[SelfTestCache] ignoring boot preset ${formatSelfTestBits(bits)} for ${event.deviceId}`)
            return
        }
        this.record(event.deviceId, bits, event.ts)
    }

    private readonly onSignal = (event: BleEvent & { type: 'DEVICE_SIGNAL' }) => {
        if (event.signal === DeviceSignal.WAKE) {
            this.lastWake.set(event.deviceId, event.ts)
        } else if (event.signal === DeviceSignal.DISCONNECT) {
            this.readings.delete(event.deviceId)
            this.faults.delete(event.deviceId)
            this.lastWake.delete(event.deviceId)
        }
    }

    constructor() {
        this.attach()
    }

    /**
     * Put the bus listeners in place. Called from every public method as well
     * as the constructor, because a `bleEventBus.removeAllListeners()` (test
     * teardown, transport reset) would otherwise leave the cache deaf for the
     * rest of the process while still answering with confidence.
     */
    private attach() {
        if (!bleEventBus.listeners('textLine').includes(this.onLine)) {
            bleEventBus.on('textLine', this.onLine)
        }
        if (!bleEventBus.listeners('deviceSignal').includes(this.onSignal)) {
            bleEventBus.on('deviceSignal', this.onSignal)
        }
    }

    /**
     * The last fault this connection saw, or null if it has only ever reported
     * clean. Not a freshness question: use it to explain a failure, never to
     * decide whether the device is healthy now.
     */
    public getLastFault(deviceId: string): SelfTestReading | null {
        this.attach()
        return this.faults.get(deviceId) ?? null
    }

    /** Store a reading the device has just sent, and tell anyone listening. */
    public record(deviceId: string, bits: number, ts: number = Date.now()) {
        this.attach()
        const reading: SelfTestReading = { bits, ts, postWake: this.lastWake.has(deviceId) }
        this.readings.set(deviceId, reading)
        // eslint-disable-next-line no-bitwise
        if ((bits & KNOWN_BITS_MASK) !== 0) this.faults.set(deviceId, reading)
        this.listeners.get(deviceId)?.forEach(fn => fn(reading))
    }

    /** The latest reading for this device, or null when nothing usable is held. */
    public get(deviceId: string): SelfTestReading | null {
        this.attach()
        return this.readings.get(deviceId) ?? null
    }

    /**
     * The latest reading if it is one the caller can use: taken after a wake
     * (so the AI bits are real) and no older than `sinceTs`. Null otherwise, which
     * is the signal to send `selftest`.
     */
    public getFresh(deviceId: string, sinceTs: number): SelfTestReading | null {
        this.attach()
        const reading = this.readings.get(deviceId)
        if (!reading || !reading.postWake || reading.ts < sinceTs) return null
        return reading
    }

    /**
     * Wait for a reading newer than `sinceTs`, typically the broadcast that
     * follows a wake the caller has just caused. Resolves with what is held if
     * that already qualifies; null on timeout.
     */
    public waitForFresh(deviceId: string, sinceTs: number, timeoutMs: number): Promise<SelfTestReading | null> {
        this.attach()
        const held = this.getFresh(deviceId, sinceTs)
        if (held) return Promise.resolve(held)
        return new Promise(resolve => {
            const unsubscribe = this.subscribe(deviceId, reading => {
                if (!reading.postWake || reading.ts < sinceTs) return
                clearTimeout(timer)
                unsubscribe()
                resolve(reading)
            })
            const timer = setTimeout(() => {
                unsubscribe()
                resolve(null)
            }, timeoutMs)
        })
    }

    /** Be told about every reading for this device. Returns the unsubscribe. */
    public subscribe(deviceId: string, fn: Listener): () => void {
        this.attach()
        let set = this.listeners.get(deviceId)
        if (!set) {
            set = new Set()
            this.listeners.set(deviceId, set)
        }
        set.add(fn)
        return () => {
            set!.delete(fn)
            // Only retire the set this listener belonged to. A late unsubscribe
            // (a React double-cleanup, or one that outlives a remount) must not
            // delete a newer set that other subscribers are already on.
            if (set!.size === 0 && this.listeners.get(deviceId) === set) {
                this.listeners.delete(deviceId)
            }
        }
    }

    /** Forget everything. Used on a transport reset and by tests. */
    public clear() {
        this.attach()
        this.readings.clear()
        this.faults.clear()
        this.lastWake.clear()
    }
}

/** Module-level singleton, shared by every session and hook. */
export const selfTestCache = new SelfTestCache()
