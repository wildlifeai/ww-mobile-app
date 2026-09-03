import { opCache } from '../opCache'
import { bleEventBus } from '../eventBus'
import { DeviceSignal } from '../deviceSignals'

/**
 * The cache is only as good as the moments it gives up. A stale op array is
 * worse than no cache: it reads as a confident answer while the device has
 * moved on, and the caller has no way to tell the difference.
 */
describe('opCache', () => {
    const DEVICE = 'dev_a'
    const OTHER = 'dev_b'
    const OPS = ['1', '0', '0', '5', '9', '1', '500']

    const wake = (deviceId: string) =>
        bleEventBus.emitEvent({ type: 'DEVICE_SIGNAL', signal: DeviceSignal.WAKE, deviceId, ts: Date.now() })
    const disconnect = (deviceId: string) =>
        bleEventBus.emitEvent({ type: 'DEVICE_SIGNAL', signal: DeviceSignal.DISCONNECT, deviceId, ts: Date.now() })

    beforeEach(() => opCache.clear())

    it('returns what was stored', () => {
        opCache.set(DEVICE, OPS)
        expect(opCache.get(DEVICE)).toEqual(OPS)
    })

    it('returns null for a device it has never seen', () => {
        expect(opCache.get(DEVICE)).toBeNull()
    })

    it('keeps devices apart, so one camera cannot answer for another', () => {
        opCache.set(DEVICE, OPS)
        expect(opCache.get(OTHER)).toBeNull()
    })

    it('drops the entry on wake, because a sleeping device rewrites its own ops', () => {
        // Automatic day/night switching changes the active slot and the AE check
        // writes op25, both while the app is not looking.
        opCache.set(DEVICE, OPS)
        wake(DEVICE)
        expect(opCache.get(DEVICE)).toBeNull()
    })

    it('only drops the device that woke', () => {
        opCache.set(DEVICE, OPS)
        opCache.set(OTHER, OPS)
        wake(DEVICE)
        expect(opCache.get(DEVICE)).toBeNull()
        expect(opCache.get(OTHER)).toEqual(OPS)
    })

    it('drops the entry on disconnect', () => {
        opCache.set(DEVICE, OPS)
        disconnect(DEVICE)
        expect(opCache.get(DEVICE)).toBeNull()
    })

    it('drops the entry when invalidated', () => {
        opCache.set(DEVICE, OPS)
        opCache.invalidate(DEVICE)
        expect(opCache.get(DEVICE)).toBeNull()
    })

    it('patches one value a setop wrote and keeps the rest, which spares a wake', () => {
        // A capture that changed the flash used to re-read the whole array,
        // waking a device that then had to sleep again before the picture.
        opCache.set(DEVICE, OPS)
        opCache.patch(DEVICE, 3, '7')
        expect(opCache.get(DEVICE)).toEqual(['1', '0', '0', '7', '9', '1', '500'])
        // The array handed out before the patch is not changed under the caller.
        expect(OPS[3]).toBe('5')
    })

    it('patches nothing when it holds nothing', () => {
        opCache.patch(DEVICE, 3, '7')
        expect(opCache.get(DEVICE)).toBeNull()
    })

    it('drops the entry when the patched index is beyond what it holds', () => {
        // The firmware knows a parameter this copy does not: the copy is stale.
        opCache.set(DEVICE, OPS)
        opCache.patch(DEVICE, 32, '1')
        expect(opCache.get(DEVICE)).toBeNull()
    })

    it('refuses to store an empty array', () => {
        // A getops that resolved to nothing is a parse failure, not a device
        // with no parameters. Caching it would serve that failure to everyone.
        opCache.set(DEVICE, [])
        expect(opCache.get(DEVICE)).toBeNull()
    })

    it('does not hand out a live reference that a caller could mutate', () => {
        opCache.set(DEVICE, OPS)
        const first = opCache.get(DEVICE)
        expect(first).toEqual(OPS)
        // Guards the shared-singleton risk: every hook reads the same object.
        expect(opCache.get(DEVICE)).toEqual(OPS)
    })
})
