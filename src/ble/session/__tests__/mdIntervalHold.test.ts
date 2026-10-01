import AsyncStorage from '@react-native-async-storage/async-storage'

import { mdIntervalHold, MdIntervalHoldSession } from '../mdIntervalHold'

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
 * op11 is written to CONFIG.TXT and applies in the field: on a stopped camera
 * it is 0, and left raised it turns motion capture back on. Every test here is
 * a way the restore could be lost, or paid over a value that is not ours, and
 * the assertion that it was not (#274).
 */
describe('mdIntervalHold', () => {
    const DEVICE = 'dev_a'

    /**
     * A device whose op11 reads `op11` and moves with every setop 11 that
     * lands, recording each command. `failWrites` models a dead link;
     * `landThenFail` a write that reaches the device and loses its reply;
     * `getOpsGate` holds the op read until the test opens it.
     */
    const fakeDevice = (
        op11: string | undefined,
        opts: { failWrites?: boolean, landThenFail?: boolean, getOpsGate?: Promise<void> } = {}
    ) => {
        const ops = Array.from({ length: 11 }, () => '0')
        if (op11 !== undefined) ops.push(op11)
        const writes: string[] = []
        const session: MdIntervalHoldSession = {
            getOps: jest.fn(async () => {
                await opts.getOpsGate
                return ops.slice()
            }),
            execute: jest.fn(async <T,>(ctor: () => CommandContext<T>) => {
                const command = ctor().build()
                if (opts.failWrites) throw new Error('DEVICE_DISCONNECTED')
                const setop = /^AI setop 11 (\d+)$/.exec(command)
                if (setop) ops[11] = setop[1]
                writes.push(command)
                if (opts.landThenFail) throw new Error('TIMEOUT')
                return true as unknown as T
            }),
        }
        return { session, writes, op11: () => ops[11] }
    }

    const disconnect = (deviceId: string) =>
        bleEventBus.emitEvent({ type: 'DEVICE_SIGNAL', signal: DeviceSignal.DISCONNECT, deviceId, ts: Date.now() })

    beforeEach(async () => {
        mdIntervalHold.clear()
        await AsyncStorage.clear()
    })

    it('holds op11 at the test interval and puts the original back on release', async () => {
        const device = fakeDevice('0')

        await expect(mdIntervalHold.acquire(device.session, DEVICE, 1000)).resolves.toBe(true)
        expect(device.op11()).toBe('1000')
        expect(mdIntervalHold.holds(DEVICE)).toBe(true)

        await mdIntervalHold.release(device.session, DEVICE)
        expect(device.writes).toEqual(['AI setop 11 1000', 'AI setop 11 0'])
        expect(mdIntervalHold.holds(DEVICE)).toBe(false)

        // Nothing owed afterwards.
        const later = fakeDevice('0')
        await mdIntervalHold.restorePending(later.session, DEVICE)
        expect(later.writes).toEqual([])
    })

    it('writes nothing when op11 already reads the interval, and has nothing to put back', async () => {
        const device = fakeDevice('1000')

        await mdIntervalHold.acquire(device.session, DEVICE, 1000)
        await mdIntervalHold.release(device.session, DEVICE)

        expect(device.writes).toEqual([])
    })

    it('does not hold, and writes nothing, when op11 cannot be read', async () => {
        const device = fakeDevice(undefined)

        await expect(mdIntervalHold.acquire(device.session, DEVICE, 1000)).resolves.toBe(false)

        expect(device.writes).toEqual([])
        expect(mdIntervalHold.holds(DEVICE)).toBe(false)
    })

    it('is one hold however many times it is acquired', async () => {
        const device = fakeDevice('0')

        await mdIntervalHold.acquire(device.session, DEVICE, 1000)
        await mdIntervalHold.acquire(device.session, DEVICE, 1000)

        expect(device.writes).toEqual(['AI setop 11 1000'])
        expect(device.session.getOps).toHaveBeenCalledTimes(1)
    })

    it('owes the restore after a dropped link, and the next test on the device pays it', async () => {
        const first = fakeDevice('0')
        await mdIntervalHold.acquire(first.session, DEVICE, 1000)

        disconnect(DEVICE)
        expect(mdIntervalHold.holds(DEVICE)).toBe(false)

        // Reconnected, the camera still at the raised rate. The next test holds
        // it again, at a different interval, and still goes back to 0.
        const again = fakeDevice('1000')
        await mdIntervalHold.acquire(again.session, DEVICE, 500)
        await mdIntervalHold.release(again.session, DEVICE)

        expect(again.writes).toEqual(['AI setop 11 500', 'AI setop 11 0'])
        expect(again.op11()).toBe('0')
    })

    it('pays a restore left owed by a dropped link when a flow asks, once', async () => {
        const first = fakeDevice('0')
        await mdIntervalHold.acquire(first.session, DEVICE, 1000)
        disconnect(DEVICE)

        const reconnected = fakeDevice('1000')
        await mdIntervalHold.restorePending(reconnected.session, DEVICE)
        expect(reconnected.writes).toEqual(['AI setop 11 0'])

        const later = fakeDevice('0')
        await mdIntervalHold.restorePending(later.session, DEVICE)
        expect(later.writes).toEqual([])
    })

    it('keeps the restore owed when the write back fails', async () => {
        const first = fakeDevice('0')
        await mdIntervalHold.acquire(first.session, DEVICE, 1000)

        const dead = fakeDevice('1000', { failWrites: true })
        await mdIntervalHold.release(dead.session, DEVICE)
        expect(mdIntervalHold.holds(DEVICE)).toBe(false)

        const alive = fakeDevice('1000')
        await mdIntervalHold.restorePending(alive.session, DEVICE)
        expect(alive.writes).toEqual(['AI setop 11 0'])
    })

    it('survives an app restart: the owed value comes back from disk', async () => {
        const first = fakeDevice('0')
        await mdIntervalHold.acquire(first.session, DEVICE, 1000)

        mdIntervalHold.clear() // memory gone, storage kept

        const reconnected = fakeDevice('1000')
        await mdIntervalHold.restorePending(reconnected.session, DEVICE)
        expect(reconnected.writes).toEqual(['AI setop 11 0'])
    })

    it('owes the restore before it writes, so a raise whose reply was lost is still put back', async () => {
        const lost = fakeDevice('0', { landThenFail: true })
        await expect(mdIntervalHold.acquire(lost.session, DEVICE, 1000)).rejects.toThrow('TIMEOUT')
        expect(lost.op11()).toBe('1000')
        expect(mdIntervalHold.holds(DEVICE)).toBe(false)

        const next = fakeDevice('1000')
        await mdIntervalHold.restorePending(next.session, DEVICE)
        expect(next.writes).toEqual(['AI setop 11 0'])
    })

    it('goes back to a value something else set while the link was down', async () => {
        const first = fakeDevice('0')
        await mdIntervalHold.acquire(first.session, DEVICE, 500)
        disconnect(DEVICE)

        // The console set 2000 in between: that is the value to return to.
        const second = fakeDevice('2000')
        await mdIntervalHold.acquire(second.session, DEVICE, 500)
        await mdIntervalHold.release(second.session, DEVICE)

        expect(second.writes).toEqual(['AI setop 11 500', 'AI setop 11 2000'])
    })

    // The Start Monitoring card tests at 1000 ms, the rate a deployment
    // writes. Without `forget`, a restore owed from a dropped card test would
    // read the deployment's 1000 as its own and switch motion detection off.
    it('forget leaves a deployed rate alone, whatever a dropped test left owed', async () => {
        const card = fakeDevice('0')
        await mdIntervalHold.acquire(card.session, DEVICE, 1000)
        disconnect(DEVICE)

        await mdIntervalHold.forget(DEVICE)

        // Weeks later, a motion test on the deployed camera.
        const deployed = fakeDevice('1000')
        await mdIntervalHold.acquire(deployed.session, DEVICE, 1000)
        await mdIntervalHold.release(deployed.session, DEVICE)
        await mdIntervalHold.restorePending(deployed.session, DEVICE)

        expect(deployed.writes).toEqual([])
        expect(deployed.op11()).toBe('1000')
    })

    it('forget makes the release of a test still running a no-op', async () => {
        const card = fakeDevice('0')
        await mdIntervalHold.acquire(card.session, DEVICE, 1000)

        await mdIntervalHold.forget(DEVICE)
        await mdIntervalHold.release(card.session, DEVICE)

        expect(card.writes).toEqual(['AI setop 11 1000'])
        expect(mdIntervalHold.holds(DEVICE)).toBe(false)
    })

    // The motion test's cleanup pays owed restores, and a Stop during setup
    // can run it while the next hold is still being taken.
    it('restorePending leaves an owed restore to a hold still being taken', async () => {
        const first = fakeDevice('0')
        await mdIntervalHold.acquire(first.session, DEVICE, 1000)
        disconnect(DEVICE)

        let open!: () => void
        const gate = new Promise<void>(resolve => { open = resolve })
        const again = fakeDevice('1000', { getOpsGate: gate })
        const taking = mdIntervalHold.acquire(again.session, DEVICE, 1000)
        await mdIntervalHold.restorePending(again.session, DEVICE)
        open()
        await taking
        await mdIntervalHold.release(again.session, DEVICE)

        expect(again.writes).toEqual(['AI setop 11 0'])
    })

    it('restorePending waits for an active hold rather than restoring under it', async () => {
        const device = fakeDevice('0')
        await mdIntervalHold.acquire(device.session, DEVICE, 1000)

        await mdIntervalHold.restorePending(device.session, DEVICE)

        expect(device.writes).toEqual(['AI setop 11 1000'])
        expect(mdIntervalHold.holds(DEVICE)).toBe(true)
    })

    it('keeps devices apart', async () => {
        const a = fakeDevice('0')
        await mdIntervalHold.acquire(a.session, DEVICE, 1000)
        expect(mdIntervalHold.holds('dev_b')).toBe(false)

        const b = fakeDevice('1000')
        await mdIntervalHold.restorePending(b.session, 'dev_b')
        expect(b.writes).toEqual([])
    })
})
