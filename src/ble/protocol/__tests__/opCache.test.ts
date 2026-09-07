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
        // This test previously carried this name while only reading the value
        // back twice, so it passed against a cache that did hand out the live
        // array. Mutating what `get` returned is the whole point of it.
        //
        // Both halves store a fresh array and assert against OPS rather than
        // storing OPS itself: hand out the live reference and the mutation
        // below would rewrite OPS too, so `toEqual(OPS)` would compare a
        // mutated array against itself and pass either way.
        opCache.set(DEVICE, [...OPS])
        const handedOut = opCache.get(DEVICE)!
        handedOut[0] = 'mutated'
        expect(opCache.get(DEVICE)).toEqual(OPS)
    })

    it('does not keep a reference to the array it was given', () => {
        // The other half: `runCommandPipeline` passes the array it is about to
        // return to its own caller, so the cache and that caller would share it.
        const fromDevice = [...OPS]
        opCache.set(DEVICE, fromDevice)
        fromDevice[0] = 'mutated'
        expect(opCache.get(DEVICE)).toEqual(OPS)
    })

    describe('fetchOnce', () => {
        /** A fetcher whose resolution the test controls, standing in for `AI getop -1`. */
        const deferred = () => {
            let resolve!: (ops: string[]) => void
            let reject!: (e: Error) => void
            const promise = new Promise<string[]>((res, rej) => { resolve = res; reject = rej })
            const fetcher = jest.fn(() => promise)
            return { fetcher, resolve, reject }
        }

        it('serves the cache without calling the fetcher', async () => {
            opCache.set(DEVICE, OPS)
            const { fetcher } = deferred()
            await expect(opCache.fetchOnce(DEVICE, fetcher)).resolves.toEqual(OPS)
            expect(fetcher).not.toHaveBeenCalled()
        })

        it('shares one fetch between callers that miss the cache together', async () => {
            // Capture Picture entry sent four `AI getop -1` in a second on the
            // bench, one per hook, because every hook missed before the first
            // reply landed. Only the first caller may pay for the command.
            const { fetcher, resolve } = deferred()
            const a = opCache.fetchOnce(DEVICE, fetcher)
            const b = opCache.fetchOnce(DEVICE, fetcher)
            const c = opCache.fetchOnce(DEVICE, fetcher)
            expect(fetcher).toHaveBeenCalledTimes(1)
            resolve([...OPS])
            await expect(Promise.all([a, b, c])).resolves.toEqual([OPS, OPS, OPS])
        })

        it('hands each sharer its own copy', async () => {
            const { fetcher, resolve } = deferred()
            const a = opCache.fetchOnce(DEVICE, fetcher)
            const b = opCache.fetchOnce(DEVICE, fetcher)
            resolve([...OPS])
            const [first, second] = await Promise.all([a, b])
            first[0] = 'mutated'
            expect(second).toEqual(OPS)
        })

        it('fetches again once the shared fetch has settled and nothing was cached', async () => {
            // The pipeline stores the reply; if it did not (a parse failure,
            // say), the next caller must not be handed a promise that is over.
            const first = deferred()
            const a = opCache.fetchOnce(DEVICE, first.fetcher)
            first.resolve([...OPS])
            await a
            const second = deferred()
            opCache.fetchOnce(DEVICE, second.fetcher)
            expect(second.fetcher).toHaveBeenCalledTimes(1)
        })

        it('forgets a failed fetch so the next caller retries', async () => {
            const first = deferred()
            const a = opCache.fetchOnce(DEVICE, first.fetcher)
            first.reject(new Error('timeout'))
            await expect(a).rejects.toThrow('timeout')
            const second = deferred()
            opCache.fetchOnce(DEVICE, second.fetcher)
            expect(second.fetcher).toHaveBeenCalledTimes(1)
        })

        it('keeps fetches for different devices apart', () => {
            const a = deferred()
            const b = deferred()
            opCache.fetchOnce(DEVICE, a.fetcher)
            opCache.fetchOnce(OTHER, b.fetcher)
            expect(a.fetcher).toHaveBeenCalledTimes(1)
            expect(b.fetcher).toHaveBeenCalledTimes(1)
        })
    })
})
