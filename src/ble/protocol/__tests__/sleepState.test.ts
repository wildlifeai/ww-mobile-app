import { sleepState } from '../sleepState'
import { bleEventBus } from '../eventBus'
import { DeviceSignal } from '../deviceSignals'

/**
 * The distinction that matters is between "asleep" and "not known to be
 * asleep". Reporting the second as the first would let a capture skip a wait it
 * genuinely needed and race the device's inactivity timer, which is the exact
 * failure `waitForSleep` was written to prevent.
 */
describe('sleepState', () => {
    const DEVICE = 'dev_a'
    const OTHER = 'dev_b'

    const signal = (s: string, deviceId: string) =>
        bleEventBus.emitEvent({ type: 'DEVICE_SIGNAL', signal: s as any, deviceId, ts: Date.now() })

    beforeEach(() => sleepState.clear())

    it('reports not-asleep before any signal has been seen', () => {
        // Unknown must behave like awake, so waitForSleep still waits.
        expect(sleepState.isAsleep(DEVICE)).toBe(false)
    })

    it('reports asleep after a Sleep', () => {
        signal(DeviceSignal.SLEEP, DEVICE)
        expect(sleepState.isAsleep(DEVICE)).toBe(true)
    })

    it('reports awake again after a Wake', () => {
        signal(DeviceSignal.SLEEP, DEVICE)
        signal(DeviceSignal.WAKE, DEVICE)
        expect(sleepState.isAsleep(DEVICE)).toBe(false)
    })

    it('tracks devices independently', () => {
        signal(DeviceSignal.SLEEP, DEVICE)
        expect(sleepState.isAsleep(OTHER)).toBe(false)
    })

    it('forgets on disconnect, so a reconnect does not inherit a stale belief', () => {
        signal(DeviceSignal.SLEEP, DEVICE)
        signal(DeviceSignal.DISCONNECT, DEVICE)
        expect(sleepState.isAsleep(DEVICE)).toBe(false)
    })

    it('survives repeated sleeps without flipping', () => {
        signal(DeviceSignal.SLEEP, DEVICE)
        signal(DeviceSignal.SLEEP, DEVICE)
        expect(sleepState.isAsleep(DEVICE)).toBe(true)
    })
})
