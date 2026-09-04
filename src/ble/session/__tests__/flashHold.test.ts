import AsyncStorage from '@react-native-async-storage/async-storage'

import { flashHold, FlashHoldSession, FLASH_MODE_ALWAYS_ON } from '../flashHold'

// A real in-memory store rather than the global jest.fn() mock, for the same
// reason keepAwake's tests use one: `restoreMocks: true` strips the global
// mock's implementations between tests, so a value written in one step reads
// back as null in the next.
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
 * op34 is written to CONFIG.TXT and applies in the field: a device left in
 * always-on flashes every capture all night. So every test here is a way the
 * restore could be lost, and the assertion that it was not.
 */
describe('flashHold', () => {
    const DEVICE = 'dev_a'

    /** A session whose device reports `op34`, recording every command it runs. */
    const fakeSession = (op34: string | undefined, opts: { failWrites?: boolean } = {}) => {
        // 34 entries before op34, matching a device that reports the flash mode.
        const ops = Array.from({ length: 34 }, () => '0')
        if (op34 !== undefined) ops.push(op34, '0', '0')
        const writes: string[] = []
        const session: FlashHoldSession = {
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
        flashHold.clear()
        await AsyncStorage.clear()
    })

    it('arms the flash and remembers the mode it found', async () => {
        const { session, writes } = fakeSession('1')

        await expect(flashHold.acquire(session, DEVICE)).resolves.toBe(true)

        expect(writes).toEqual([`AI setop 34 ${FLASH_MODE_ALWAYS_ON}`])
        expect(flashHold.holds(DEVICE)).toBe(true)
    })

    it('puts the previous mode back on release', async () => {
        const { session, writes } = fakeSession('1')
        await flashHold.acquire(session, DEVICE)

        await flashHold.release(session, DEVICE)

        expect(writes).toEqual(['AI setop 34 2', 'AI setop 34 1'])
        expect(flashHold.holds(DEVICE)).toBe(false)
    })

    it('writes nothing when the device is already in the mode asked for', async () => {
        const { session, writes } = fakeSession('2')

        await flashHold.acquire(session, DEVICE)
        await flashHold.release(session, DEVICE)

        expect(writes).toEqual([])
    })

    it('does not hold a firmware that has no flash mode', async () => {
        const { session, writes } = fakeSession(undefined)

        await expect(flashHold.acquire(session, DEVICE)).resolves.toBe(false)

        expect(writes).toEqual([])
        expect(flashHold.holds(DEVICE)).toBe(false)
    })

    it('restores on the next visit when the link drops mid-hold', async () => {
        const { session } = fakeSession('1')
        await flashHold.acquire(session, DEVICE)

        disconnect(DEVICE)
        expect(flashHold.holds(DEVICE)).toBe(false)

        // The device comes back still in always-on, the value we left on it.
        const { session: next, writes } = fakeSession('2')
        await flashHold.restorePending(next, DEVICE)

        expect(writes).toEqual(['AI setop 34 1'])
    })

    it('keeps the restore owed when the write back fails', async () => {
        const { session } = fakeSession('3')
        await flashHold.acquire(session, DEVICE)

        const { session: dead } = fakeSession('2', { failWrites: true })
        await flashHold.release(dead, DEVICE)

        const { session: alive, writes } = fakeSession('2')
        await flashHold.restorePending(alive, DEVICE)

        expect(writes).toEqual(['AI setop 34 3'])
    })

    it('does not restore to its own held value after a second visit', async () => {
        const { session } = fakeSession('1')
        await flashHold.acquire(session, DEVICE)
        disconnect(DEVICE)

        // Second visit: the device still reads always-on because of the first
        // hold, so the original to keep is the one from before it.
        const { session: second, writes } = fakeSession('2')
        await flashHold.acquire(second, DEVICE)
        await flashHold.release(second, DEVICE)

        expect(writes).toEqual(['AI setop 34 1'])
    })

    it('goes back to a mode something else set while the link was down', async () => {
        const { session } = fakeSession('1')
        await flashHold.acquire(session, DEVICE)
        disconnect(DEVICE)

        // A deployment ran in between and left the project's mode on the device.
        const { session: second, writes } = fakeSession('3')
        await flashHold.acquire(second, DEVICE)
        await flashHold.release(second, DEVICE)

        expect(writes).toEqual(['AI setop 34 2', 'AI setop 34 3'])
    })

    it('release without a hold does nothing', async () => {
        const { session, writes } = fakeSession('1')

        await flashHold.release(session, DEVICE)

        expect(writes).toEqual([])
    })
})
