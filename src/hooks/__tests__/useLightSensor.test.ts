import { renderHook, waitFor, act } from '@testing-library/react-native'

import { useLightSensor } from '../useLightSensor'
import { createBleSession } from '../../ble/session/createBleSession'
import { bleEventBus } from '../../ble/protocol/eventBus'

jest.mock('../../ble/session/createBleSession')
jest.mock('../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))

const device = { id: 'dev-1', name: 'WILD-TEST', connected: true } as any

/** 32 op values, all zero. op26 = 0 keeps the on-connect refresh from writing anything. */
const zeroOps = (): string[] => Array.from({ length: 32 }, () => '0')

/**
 * Stub one BLE session. `light` behaves as the test says; every other command
 * resolves true. `getOps` feeds the on-connect refresh, matching the op array
 * the real cache-aware reader returns.
 */
const mockSession = (light: () => Promise<unknown>) => {
    const execute = jest.fn(async (build: () => any) => {
        const name = build().name
        if (name === 'light') return light()
        return true
    })
    const getOps = jest.fn(async () => zeroOps())
    ;(createBleSession as jest.Mock).mockReturnValue({ execute, getOps })
    return { execute, getOps }
}

/** The block the firmware sends after a light check, one line per event. */
const AE_BLOCK = [
    'HM0360 AE regs:',
    '  Integration time = 376 lines',
    '  Analog gain = 0',
    '  Digital gain = 71',
    '  AE Mean = 72',
    '  AEConverged?: Y',
]

const emit = (line: string) =>
    bleEventBus.emitEvent({ type: 'TEXT_LINE', line, ts: Date.now(), deviceId: device.id })

/** Mount and let the on-connect refresh finish, so its getOps cannot interleave with the command under test. */
const mount = async (getOps: jest.Mock) => {
    const rendered = renderHook(() => useLightSensor({ device }))
    await waitFor(() => expect(getOps).toHaveBeenCalled())
    await act(async () => {})
    return rendered
}

describe('useLightSensor.measureNow', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        bleEventBus.removeAllListeners()
    })

    // The 15 September 2026 bug. A Himax built from a branch without `AI light`
    // answered `Unrecognised`, and the hook reported a timeout 157 ms later:
    // cancelling the register wait resolved the raced promise before the
    // rejection could, so the `unsupported` branch was unreachable and the
    // capture fallback never ran.
    it('reports unsupported when the device does not know AI light', async () => {
        const { getOps } = mockSession(() => Promise.reject(new Error('Unrecognised')))
        const { result } = await mount(getOps)

        let outcome: string | undefined
        await act(async () => { outcome = await result.current.measureNow() })

        expect(outcome).toBe('unsupported')
    })

    // A refused or unanswered command is not an acknowledgement followed by
    // silence, and the screen words the two differently.
    it('reports failed, not timeout, when the command itself goes unanswered', async () => {
        const { getOps } = mockSession(() => Promise.reject(new Error('TIMEOUT')))
        const { result } = await mount(getOps)

        let outcome: string | undefined
        await act(async () => { outcome = await result.current.measureNow() })

        expect(outcome).toBe('failed')
    })

    it('reads the register block that follows the acknowledgement', async () => {
        const { getOps } = mockSession(async () => true)
        const { result } = await mount(getOps)

        let outcome: Promise<string> | undefined
        act(() => { outcome = result.current.measureNow() })
        // The block is telemetry, arriving after the ack, one line at a time.
        await act(async () => { AE_BLOCK.forEach(line => emit(line)) })

        await expect(outcome).resolves.toBe('ok')
        expect(result.current.aeData).toMatchObject({ aeMean: '72', aeConverged: 'Y', analogGain: '0', digitalGain: '71' })
    })

    // The genuine timeout: acknowledged, then nothing, as an RP3 image does
    // because its build has no HM0360 register block to send.
    it('times out when the acknowledgement is followed by silence', async () => {
        const { getOps } = mockSession(async () => true)
        const { result } = await mount(getOps)

        jest.useFakeTimers()
        try {
            let outcome: Promise<string> | undefined
            act(() => { outcome = result.current.measureNow() })
            await act(async () => { jest.advanceTimersByTime(15_000) })

            await expect(outcome).resolves.toBe('timeout')
        } finally {
            jest.useRealTimers()
        }
    })

    // Cancelling still has to happen, just after the race has settled: a
    // listener left on the shared bus would swallow the block meant for the
    // next measurement.
    it('removes its register listener after a rejected command', async () => {
        const { getOps } = mockSession(() => Promise.reject(new Error('Unrecognised')))
        const { result } = await mount(getOps)
        const before = bleEventBus.listenerCount('textLine')

        await act(async () => { await result.current.measureNow() })

        expect(bleEventBus.listenerCount('textLine')).toBe(before)
    })
})
