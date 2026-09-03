import AsyncStorage from '@react-native-async-storage/async-storage'

import { keepAwake, KeepAwakeSession } from '../keepAwake'

// A real in-memory store rather than the global jest.fn() mock: the project's
// `restoreMocks: true` strips that mock's implementations before each test,
// so a value written in one step silently reads back as null in the next.
jest.mock('@react-native-async-storage/async-storage', () => {
    const store = new Map<string, string>()
    return {
        __esModule: true,
        default: {
            setItem: async (key: string, value: string) => { store.set(key, value) },
            getItem: async (key: string) => store.get(key) ?? null,
            removeItem: async (key: string) => { store.delete(key) },
            clear: async () => { store.clear() },
        },
    }
})
import type { CommandContext } from '../../protocol/commandRegistry'
import { bleEventBus } from '../../protocol/eventBus'
import { DeviceSignal } from '../../protocol/deviceSignals'

/**
 * op8 is written to the device's CONFIG.TXT and applies in the field, so the
 * one thing this module must never do is leave it raised. Every test here is
 * a way the restore could be lost, and the assertion that it was not.
 */
describe('keepAwake', () => {
    const DEVICE = 'dev_a'
    const HOLD = 20000

    /** A session whose device reports `op8`, recording every command it is asked to run. */
    const fakeSession = (op8: string | undefined, opts: { failWrites?: boolean } = {}) => {
        const ops = ['1', '0', '0', '5', '9', '1', '500', '0']
        if (op8 !== undefined) ops.push(op8)
        const writes: string[] = []
        const session: KeepAwakeSession = {
            getOps: jest.fn(async () => ops.slice()),
            execute: jest.fn(async <T,>(ctor: () => CommandContext<T>) => {
                const command = ctor().build()
                if (opts.failWrites) throw new Error('DEVICE_DISCONNECTED')
                writes.push(command)
                return true as unknown as T
            }),
        }
        return { session, writes }
    }

    const disconnect = (deviceId: string) =>
        bleEventBus.emitEvent({ type: 'DEVICE_SIGNAL', signal: DeviceSignal.DISCONNECT, deviceId, ts: Date.now() })

    beforeEach(async () => {
        keepAwake.clear()
        await AsyncStorage.clear()
    })

    it('raises op8 to the hold and remembers the original', async () => {
        const { session, writes } = fakeSession('3000')
        await expect(keepAwake.acquire(session, DEVICE, HOLD)).resolves.toBe(true)
        expect(writes).toEqual(['AI setop 8 20000'])
        expect(keepAwake.holds(DEVICE)).toBe(true)
    })

    it('writes nothing when the device already sleeps later than the hold, and has nothing to put back', async () => {
        const { session, writes } = fakeSession('30000')
        await keepAwake.acquire(session, DEVICE, HOLD)
        expect(writes).toEqual([])
        expect(keepAwake.holds(DEVICE)).toBe(true)

        await keepAwake.release(session, DEVICE)
        expect(writes).toEqual([])
        expect(keepAwake.holds(DEVICE)).toBe(false)
    })

    it('release puts the original back and ends the hold', async () => {
        const { session, writes } = fakeSession('3000')
        await keepAwake.acquire(session, DEVICE, HOLD)
        await keepAwake.release(session, DEVICE)
        expect(writes).toEqual(['AI setop 8 20000', 'AI setop 8 3000'])
        expect(keepAwake.holds(DEVICE)).toBe(false)

        // Nothing owed afterwards: a reconnect writes nothing.
        const next = fakeSession('3000')
        await keepAwake.restorePending(next.session, DEVICE)
        expect(next.writes).toEqual([])
    })

    it('is one hold however many times it is acquired', async () => {
        const { session, writes } = fakeSession('3000')
        await keepAwake.acquire(session, DEVICE, HOLD)
        await keepAwake.acquire(session, DEVICE, HOLD)
        expect(writes).toEqual(['AI setop 8 20000'])
        expect(session.getOps).toHaveBeenCalledTimes(1)
    })

    it('does not hold, and writes nothing, when op8 cannot be read', async () => {
        const { session, writes } = fakeSession(undefined)
        await expect(keepAwake.acquire(session, DEVICE, HOLD)).resolves.toBe(false)
        expect(writes).toEqual([])
        expect(keepAwake.holds(DEVICE)).toBe(false)
    })

    it('keeps the restore owed when the release write fails, and completes it when a flow next asks', async () => {
        const first = fakeSession('3000')
        await keepAwake.acquire(first.session, DEVICE, HOLD)

        const dead = fakeSession('20000', { failWrites: true })
        await keepAwake.release(dead.session, DEVICE)
        expect(keepAwake.holds(DEVICE)).toBe(false)

        const reconnected = fakeSession('20000')
        await keepAwake.restorePending(reconnected.session, DEVICE)
        expect(reconnected.writes).toEqual(['AI setop 8 3000'])

        // Written back once, not every time a flow asks after.
        const later = fakeSession('3000')
        await keepAwake.restorePending(later.session, DEVICE)
        expect(later.writes).toEqual([])
    })

    it('drops the hold on a link drop and restores when a flow next asks', async () => {
        const { session } = fakeSession('3000')
        await keepAwake.acquire(session, DEVICE, HOLD)

        disconnect(DEVICE)
        expect(keepAwake.holds(DEVICE)).toBe(false)

        const reconnected = fakeSession('20000')
        await keepAwake.restorePending(reconnected.session, DEVICE)
        expect(reconnected.writes).toEqual(['AI setop 8 3000'])
    })

    it('survives an app restart: the owed value comes back from disk', async () => {
        const { session } = fakeSession('3000')
        await keepAwake.acquire(session, DEVICE, HOLD)

        keepAwake.clear() // memory gone, storage kept

        const reconnected = fakeSession('20000')
        await keepAwake.restorePending(reconnected.session, DEVICE)
        expect(reconnected.writes).toEqual(['AI setop 8 3000'])
    })

    it('a hold taken while a restore is owed keeps the earlier original, not the raised value', async () => {
        const first = fakeSession('3000')
        await keepAwake.acquire(first.session, DEVICE, HOLD)
        disconnect(DEVICE)

        // Reconnected, hold re-taken before anything restored: the device reads 20000.
        const again = fakeSession('20000')
        await keepAwake.acquire(again.session, DEVICE, HOLD)
        expect(again.writes).toEqual([]) // already raised
        await keepAwake.release(again.session, DEVICE)
        expect(again.writes).toEqual(['AI setop 8 3000'])
    })

    it('brings its own earlier, larger raise down to the hold now asked for', async () => {
        // A 20 s hold from an older build was never released; the app now asks for 3 s.
        const first = fakeSession('3000')
        await keepAwake.acquire(first.session, DEVICE, 20000)
        disconnect(DEVICE)

        const again = fakeSession('20000')
        await keepAwake.acquire(again.session, DEVICE, 3000)
        expect(again.writes).toEqual(['AI setop 8 3000'])

        // 3 s is also the original, so there is nothing left to put back, now or later.
        await keepAwake.release(again.session, DEVICE)
        expect(again.writes).toEqual(['AI setop 8 3000'])
        const later = fakeSession('3000')
        await keepAwake.restorePending(later.session, DEVICE)
        expect(later.writes).toEqual([])
    })

    it('restores an original that sits between the old raise and the new hold', async () => {
        const first = fakeSession('5000')
        await keepAwake.acquire(first.session, DEVICE, 20000)
        disconnect(DEVICE)

        const again = fakeSession('20000')
        await keepAwake.acquire(again.session, DEVICE, 3000)
        await keepAwake.release(again.session, DEVICE)
        expect(again.writes).toEqual(['AI setop 8 3000', 'AI setop 8 5000'])
    })

    it('leaves a larger value alone when it is not its own', async () => {
        const { session, writes } = fakeSession('30000')
        await keepAwake.acquire(session, DEVICE, 3000)
        expect(writes).toEqual([])
    })

    it('an owed original is stale once something else has set op8 below the hold', async () => {
        const first = fakeSession('3000')
        await keepAwake.acquire(first.session, DEVICE, HOLD)
        disconnect(DEVICE)

        // A deployment reset op8 to 1000 in the meantime. That is the field
        // value now; putting 3000 back would undo the deployment.
        const deployed = fakeSession('1000')
        await keepAwake.acquire(deployed.session, DEVICE, HOLD)
        await keepAwake.release(deployed.session, DEVICE)
        expect(deployed.writes).toEqual(['AI setop 8 20000', 'AI setop 8 1000'])
    })

    it('restorePending waits for an active hold rather than restoring under it', async () => {
        const { session, writes } = fakeSession('3000')
        await keepAwake.acquire(session, DEVICE, HOLD)
        await keepAwake.restorePending(session, DEVICE)
        expect(writes).toEqual(['AI setop 8 20000'])
        expect(keepAwake.holds(DEVICE)).toBe(true)
    })

    it('keeps devices apart', async () => {
        const a = fakeSession('3000')
        await keepAwake.acquire(a.session, DEVICE, HOLD)
        expect(keepAwake.holds('dev_b')).toBe(false)

        const b = fakeSession('20000')
        await keepAwake.restorePending(b.session, 'dev_b')
        expect(b.writes).toEqual([])
    })
})
