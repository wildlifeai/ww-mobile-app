import AsyncStorage from '@react-native-async-storage/async-storage'

import { flashLedHold, FlashLedHoldSession } from '../flashLedHold'

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
 * op13 (the flash LED) and op9 (its brightness) are written to CONFIG.TXT and
 * are what the camera's own photos use. A motion test borrowed them and never
 * gave them back (#387), and op13 left at a test's LED kept the camera lighting
 * its motion frames while it slept (#383). Every test here is a way the restore
 * could be lost, or paid over a value that is not the test's, and the
 * assertion that it was not.
 */
describe('flashLedHold', () => {
    const DEVICE = 'dev_a'
    const IR = { led: 2, brightness: 50 }

    /**
     * A device whose op9 and op13 read as given and move with every setop
     * that lands, recording each command. `failWrites` models a dead link;
     * `failIndex` a single op whose write fails; `landThenFail` a write that
     * reaches the device and loses its reply; `getOpsGate` holds the op read
     * until the test opens it.
     */
    const fakeDevice = (
        op13: string | undefined,
        op9: string,
        opts: { failWrites?: boolean, failIndex?: number, landThenFail?: boolean, getOpsGate?: Promise<void> } = {}
    ) => {
        const ops = Array.from({ length: 14 }, () => '0')
        ops[9] = op9
        if (op13 === undefined) ops.length = 13
        else ops[13] = op13
        const writes: string[] = []
        const session: FlashLedHoldSession = {
            getOps: jest.fn(async () => {
                await opts.getOpsGate
                return ops.slice()
            }),
            execute: jest.fn(async <T,>(ctor: () => CommandContext<T>) => {
                const command = ctor().build()
                const setop = /^AI setop (\d+) (\d+)$/.exec(command)
                if (opts.failWrites || (setop && Number(setop[1]) === opts.failIndex)) throw new Error('DEVICE_DISCONNECTED')
                if (setop) ops[Number(setop[1])] = setop[2]
                writes.push(command)
                if (opts.landThenFail) throw new Error('TIMEOUT')
                return true as unknown as T
            }),
        }
        return { session, writes, op13: () => ops[13], op9: () => ops[9] }
    }

    const disconnect = (deviceId: string) =>
        bleEventBus.emitEvent({ type: 'DEVICE_SIGNAL', signal: DeviceSignal.DISCONNECT, deviceId, ts: Date.now() })

    beforeEach(async () => {
        flashLedHold.clear()
        await AsyncStorage.clear()
    })

    it('holds the test LED and brightness and puts both back on release', async () => {
        const device = fakeDevice('0', '5')

        await expect(flashLedHold.acquire(device.session, DEVICE, IR)).resolves.toBe(true)
        expect(device.op13()).toBe('2')
        expect(device.op9()).toBe('50')
        expect(flashLedHold.holds(DEVICE)).toBe(true)

        await flashLedHold.release(device.session, DEVICE)
        expect(device.writes).toEqual(['AI setop 13 2', 'AI setop 9 50', 'AI setop 13 0', 'AI setop 9 5'])
        expect(flashLedHold.holds(DEVICE)).toBe(false)

        // Nothing owed afterwards.
        const later = fakeDevice('2', '50')
        await flashLedHold.restorePending(later.session, DEVICE)
        expect(later.writes).toEqual([])
    })

    it('writes and puts back only the one that differs', async () => {
        const device = fakeDevice('2', '5')

        await flashLedHold.acquire(device.session, DEVICE, IR)
        await flashLedHold.release(device.session, DEVICE)

        expect(device.writes).toEqual(['AI setop 9 50', 'AI setop 9 5'])
    })

    it('writes nothing when the device already reads the test values, and has nothing to put back', async () => {
        const device = fakeDevice('2', '50')

        await flashLedHold.acquire(device.session, DEVICE, IR)
        await flashLedHold.release(device.session, DEVICE)

        expect(device.writes).toEqual([])
    })

    it('does not hold, and writes nothing, when op13 cannot be read', async () => {
        const device = fakeDevice(undefined, '5')

        await expect(flashLedHold.acquire(device.session, DEVICE, IR)).resolves.toBe(false)

        expect(device.writes).toEqual([])
        expect(flashLedHold.holds(DEVICE)).toBe(false)
    })

    it('is one hold however many times it is acquired', async () => {
        const device = fakeDevice('0', '5')

        await flashLedHold.acquire(device.session, DEVICE, IR)
        await flashLedHold.acquire(device.session, DEVICE, { led: 1, brightness: 100 })

        expect(device.writes).toEqual(['AI setop 13 2', 'AI setop 9 50'])
        expect(device.session.getOps).toHaveBeenCalledTimes(1)
    })

    // #383: the app died mid-test and the camera kept the test's LED.
    it('owes the restore after a dropped link, and the next test on the device pays it', async () => {
        const first = fakeDevice('0', '5')
        await flashLedHold.acquire(first.session, DEVICE, IR)

        disconnect(DEVICE)
        expect(flashLedHold.holds(DEVICE)).toBe(false)

        // Reconnected, the camera still on the test's values. The next test
        // asks for the white LED and still goes back to off and 5 %.
        const again = fakeDevice('2', '50')
        await flashLedHold.acquire(again.session, DEVICE, { led: 1, brightness: 50 })
        await flashLedHold.release(again.session, DEVICE)

        expect(again.writes).toEqual(['AI setop 13 1', 'AI setop 13 0', 'AI setop 9 5'])
        expect([again.op13(), again.op9()]).toEqual(['0', '5'])
    })

    it('pays a restore left owed by a dropped link when a flow asks, once', async () => {
        const first = fakeDevice('0', '5')
        await flashLedHold.acquire(first.session, DEVICE, IR)
        disconnect(DEVICE)

        const reconnected = fakeDevice('2', '50')
        await flashLedHold.restorePending(reconnected.session, DEVICE)
        expect(reconnected.writes).toEqual(['AI setop 13 0', 'AI setop 9 5'])

        const later = fakeDevice('0', '5')
        await flashLedHold.restorePending(later.session, DEVICE)
        expect(later.writes).toEqual([])
    })

    it('leaves a value someone set since the drop alone, and pays the other', async () => {
        const first = fakeDevice('0', '5')
        await flashLedHold.acquire(first.session, DEVICE, IR)
        disconnect(DEVICE)

        // Capture Picture chose the white LED in between; op9 is still the test's.
        const reconnected = fakeDevice('1', '50')
        await flashLedHold.restorePending(reconnected.session, DEVICE)

        expect(reconnected.writes).toEqual(['AI setop 9 5'])
        expect(reconnected.op13()).toBe('1')
    })

    it('keeps the one restore that failed owed, and pays it later', async () => {
        const first = fakeDevice('0', '5')
        await flashLedHold.acquire(first.session, DEVICE, IR)

        const flaky = fakeDevice('2', '50', { failIndex: 9 })
        await flashLedHold.release(flaky.session, DEVICE)
        expect(flaky.writes).toEqual(['AI setop 13 0'])
        expect(flashLedHold.holds(DEVICE)).toBe(false)

        const alive = fakeDevice('0', '50')
        await flashLedHold.restorePending(alive.session, DEVICE)
        expect(alive.writes).toEqual(['AI setop 9 5'])
    })

    it('survives an app restart: the owed values come back from disk', async () => {
        const first = fakeDevice('0', '5')
        await flashLedHold.acquire(first.session, DEVICE, IR)

        flashLedHold.clear() // memory gone, storage kept

        const reconnected = fakeDevice('2', '50')
        await flashLedHold.restorePending(reconnected.session, DEVICE)
        expect(reconnected.writes).toEqual(['AI setop 13 0', 'AI setop 9 5'])
    })

    it('owes the restore before it writes, so a write whose reply was lost is still put back', async () => {
        const lost = fakeDevice('0', '5', { landThenFail: true })
        await expect(flashLedHold.acquire(lost.session, DEVICE, IR)).rejects.toThrow('TIMEOUT')
        expect(lost.op13()).toBe('2')
        expect(flashLedHold.holds(DEVICE)).toBe(false)

        // op9 was never written, so only op13 is the test's on the device.
        const next = fakeDevice('2', '5')
        await flashLedHold.restorePending(next.session, DEVICE)
        expect(next.writes).toEqual(['AI setop 13 0'])
    })

    it('keeps the restore owed when the op table cannot be read', async () => {
        const first = fakeDevice('0', '5')
        await flashLedHold.acquire(first.session, DEVICE, IR)
        disconnect(DEVICE)

        const unreadable = fakeDevice('2', '50')
        ;(unreadable.session.getOps as jest.Mock).mockRejectedValueOnce(new Error('TIMEOUT'))
        await flashLedHold.restorePending(unreadable.session, DEVICE)
        expect(unreadable.writes).toEqual([])

        await flashLedHold.restorePending(unreadable.session, DEVICE)
        expect(unreadable.writes).toEqual(['AI setop 13 0', 'AI setop 9 5'])
    })

    // A deployment writes op13 from the project, and the project's LED can be
    // the very one a dropped test held: without `forget`, the next motion test
    // would take the project's IR flash off a deployed camera.
    it('forget leaves a deployed LED alone, whatever a dropped test left owed', async () => {
        const bench = fakeDevice('0', '5')
        await flashLedHold.acquire(bench.session, DEVICE, IR)
        disconnect(DEVICE)

        await flashLedHold.forget(DEVICE)

        const deployed = fakeDevice('2', '50')
        await flashLedHold.restorePending(deployed.session, DEVICE)

        expect(deployed.writes).toEqual([])
        expect(deployed.op13()).toBe('2')
    })

    it('forget makes the release of a test still running a no-op', async () => {
        const device = fakeDevice('0', '5')
        await flashLedHold.acquire(device.session, DEVICE, IR)

        await flashLedHold.forget(DEVICE)
        await flashLedHold.release(device.session, DEVICE)

        expect(device.writes).toEqual(['AI setop 13 2', 'AI setop 9 50'])
        expect(flashLedHold.holds(DEVICE)).toBe(false)
    })

    // The motion test's cleanup pays owed restores, and a quick restart can
    // run the previous test's cleanup while the next hold is being taken.
    it('restorePending leaves an owed restore to a hold still being taken', async () => {
        const first = fakeDevice('0', '5')
        await flashLedHold.acquire(first.session, DEVICE, IR)
        disconnect(DEVICE)

        let open!: () => void
        const gate = new Promise<void>(resolve => { open = resolve })
        const again = fakeDevice('2', '50', { getOpsGate: gate })
        const taking = flashLedHold.acquire(again.session, DEVICE, IR)
        await flashLedHold.restorePending(again.session, DEVICE)
        open()
        await taking
        await flashLedHold.release(again.session, DEVICE)

        expect(again.writes).toEqual(['AI setop 13 0', 'AI setop 9 5'])
    })

    it('restorePending waits for an active hold rather than restoring under it', async () => {
        const device = fakeDevice('0', '5')
        await flashLedHold.acquire(device.session, DEVICE, IR)

        await flashLedHold.restorePending(device.session, DEVICE)

        expect(device.writes).toEqual(['AI setop 13 2', 'AI setop 9 50'])
        expect(flashLedHold.holds(DEVICE)).toBe(true)
    })

    it('keeps devices apart', async () => {
        const a = fakeDevice('0', '5')
        await flashLedHold.acquire(a.session, DEVICE, IR)
        expect(flashLedHold.holds('dev_b')).toBe(false)

        const b = fakeDevice('2', '50')
        await flashLedHold.restorePending(b.session, 'dev_b')
        expect(b.writes).toEqual([])
    })
})
