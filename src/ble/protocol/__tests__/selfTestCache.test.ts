import { selfTestCache } from '../selfTestCache'
import { bleEventBus } from '../eventBus'
import { DeviceSignal } from '../deviceSignals'

jest.mock('../../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))

/**
 * The cache exists so that hooks stop sending `selftest` for an answer the
 * device volunteers after every wake. It has to know which readings are
 * usable: one taken before the Himax woke carries preset AI bits, and one from
 * a previous connection may be another device's.
 */
describe('selfTestCache', () => {
    const DEVICE = 'dev_a'
    const OTHER = 'dev_b'

    const line = (text: string, deviceId = DEVICE, ts = Date.now()) =>
        bleEventBus.emitEvent({ type: 'TEXT_LINE', line: text, ts, deviceId })
    const wake = (deviceId = DEVICE, ts = Date.now()) =>
        bleEventBus.emitEvent({ type: 'DEVICE_SIGNAL', signal: DeviceSignal.WAKE, deviceId, ts })
    const disconnect = (deviceId = DEVICE) =>
        bleEventBus.emitEvent({ type: 'DEVICE_SIGNAL', signal: DeviceSignal.DISCONNECT, deviceId, ts: Date.now() })

    beforeEach(() => {
        selfTestCache.clear()
        jest.useRealTimers()
    })

    it('holds nothing for a device it has never heard', () => {
        expect(selfTestCache.get(DEVICE)).toBeNull()
    })

    it('records an Error bits line, with the bits parsed', () => {
        line('Error bits = 0x0A00')
        expect(selfTestCache.get(DEVICE)?.bits).toBe(0x0a00)
    })

    it('ignores other lines that happen to carry hex', () => {
        line('Wakeup_event = 0x0000, WakeupEvt1 = 0x0001 WAKE signal')
        line('IMAGE Task received event (0x0a01)')
        expect(selfTestCache.get(DEVICE)).toBeNull()
    })

    it('drops the boot preset, which is every AI bit set at once', () => {
        // The nRF presets bits 8-15 until the Himax reports for itself.
        line('Error bits = 0xFF00')
        expect(selfTestCache.get(DEVICE)).toBeNull()
        line('Error bits = 0xFF01')
        expect(selfTestCache.get(DEVICE)).toBeNull()
    })

    it('marks a reading heard before any Wake as not post-wake', () => {
        line('Error bits = 0x0001')
        expect(selfTestCache.get(DEVICE)?.postWake).toBe(false)
        expect(selfTestCache.getFresh(DEVICE, 0)).toBeNull()
    })

    it('marks a reading heard after a Wake as post-wake, so the AI bits count', () => {
        wake()
        line('Error bits = 0x0000')
        expect(selfTestCache.get(DEVICE)?.postWake).toBe(true)
        expect(selfTestCache.getFresh(DEVICE, 0)?.bits).toBe(0)
    })

    it('does not serve a reading older than the moment the caller cares about', () => {
        wake(DEVICE, 1000)
        line('Error bits = 0x0000', DEVICE, 2000)
        expect(selfTestCache.getFresh(DEVICE, 3000)).toBeNull()
        expect(selfTestCache.getFresh(DEVICE, 2000)?.bits).toBe(0)
    })

    it('keeps devices apart', () => {
        wake(DEVICE)
        line('Error bits = 0x0800', DEVICE)
        expect(selfTestCache.get(OTHER)).toBeNull()
    })

    it('forgets a device on disconnect, wake history included', () => {
        wake()
        line('Error bits = 0x0000')
        disconnect()
        expect(selfTestCache.get(DEVICE)).toBeNull()
        line('Error bits = 0x0000')
        expect(selfTestCache.get(DEVICE)?.postWake).toBe(false)
    })

    it('tells subscribers about every reading and stops after unsubscribe', () => {
        const seen: number[] = []
        const unsubscribe = selfTestCache.subscribe(DEVICE, r => seen.push(r.bits))
        line('Error bits = 0x0001')
        line('Error bits = 0x0002', OTHER)
        unsubscribe()
        line('Error bits = 0x0004')
        expect(seen).toEqual([1])
    })

    it('a late unsubscribe does not silence subscribers that came after it', () => {
        // React double-cleanups and remounts: the old effect's unsubscribe can
        // run after the new effect has subscribed. It must retire only the set
        // it belonged to, never the live one.
        const early = selfTestCache.subscribe(DEVICE, () => {})
        early()                                         // set now empty, retired
        const seen: number[] = []
        const late = selfTestCache.subscribe(DEVICE, r => seen.push(r.bits))   // fresh set
        early()                                         // stale cleanup runs again
        line('Error bits = 0x0001')
        expect(seen).toEqual([1])
        late()
    })

    it('waitForFresh resolves with a qualifying reading that arrives later', async () => {
        wake(DEVICE, 1000)
        const pending = selfTestCache.waitForFresh(DEVICE, 1000, 500)
        line('Error bits = 0x0000', DEVICE, 1500)
        await expect(pending).resolves.toMatchObject({ bits: 0, postWake: true })
    })

    it('waitForFresh resolves at once with a reading it already holds', async () => {
        wake(DEVICE, 1000)
        line('Error bits = 0x0100', DEVICE, 1500)
        await expect(selfTestCache.waitForFresh(DEVICE, 1000, 10)).resolves.toMatchObject({ bits: 0x0100 })
    })

    it('waitForFresh resolves null when nothing usable arrives in time', async () => {
        jest.useFakeTimers()
        const pending = selfTestCache.waitForFresh(DEVICE, Date.now(), 200)
        line('Error bits = 0x0000')   // no Wake seen, so not usable
        jest.advanceTimersByTime(250)
        await expect(pending).resolves.toBeNull()
    })
})
