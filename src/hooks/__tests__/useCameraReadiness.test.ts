import { renderHook, waitFor, act } from '@testing-library/react-native'

import { useCameraReadiness } from '../useCameraReadiness'
import { createBleSession } from '../../ble/session/createBleSession'
import { bleEventBus } from '../../ble/protocol/eventBus'

jest.mock('../../ble/session/createBleSession')
jest.mock('../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))

const device = { id: 'dev-1', name: 'WILD-TEST', connected: true } as any

/** Emit a line as if the device had sent it unprompted. */
const broadcast = (line: string, deviceId = device.id) =>
    act(() => {
        bleEventBus.emitEvent({ type: 'TEXT_LINE', line, ts: Date.now(), deviceId })
    })

/**
 * Stub one BLE session. `selftest` resolves to the raw error-bits string and
 * `getops` to the op array, matching what the real commands return.
 *
 * `getOps` is the session's cache-aware reader. It is stubbed to go straight to
 * `execute` so these tests keep asserting the commands that reach the wire; the
 * cache has its own tests in ble/protocol/__tests__/opCache.test.ts.
 */
const mockSession = (selftest: string, ops: string[]) => {
    const execute = jest.fn(async (build: () => any) => {
        const name = build().name
        if (name === 'selftest') return selftest
        if (name === 'getops') return ops
        return true
    })
    const getOps = jest.fn(async () => execute(() => ({ name: 'getops' })))
    ;(createBleSession as jest.Mock).mockReturnValue({ execute, getOps })
    return execute
}

/** 32 op values, all zero except the ones a test cares about. */
const opsWith = (overrides: Record<number, string>): string[] =>
    Array.from({ length: 32 }, (_, i) => overrides[i] ?? '0')

describe('useCameraReadiness', () => {
    beforeEach(() => jest.clearAllMocks())

    // The rule this hook exists to honour: connecting to a device in the Engineer
    // Console must not send anything. Only choosing a camera flow may.
    it('sends nothing at all until it is enabled', async () => {
        const execute = mockSession('Error bits = 0x0000', opsWith({ 10: '1' }))

        const { result } = renderHook(() => useCameraReadiness({ device, enabled: false }))

        await waitFor(() => expect(result.current.status).toBe('unknown'))
        expect(execute).not.toHaveBeenCalled()
        expect(createBleSession).not.toHaveBeenCalled()
    })

    it('reports ready when the self-test is clean and op10 is 1', async () => {
        mockSession('Error bits = 0x0000', opsWith({ 10: '1' }))

        const { result } = renderHook(() => useCameraReadiness({ device, enabled: true }))

        await waitFor(() => expect(result.current.status).toBe('ready'))
        expect(result.current.issues).toEqual([])
    })

    // op10 = 0 sets no self-test bit in firmware, so a self-test alone cannot see
    // this. It is the case a stopped deployment leaves behind.
    it('reports cameraOff when op10 is 0 and nothing is broken', async () => {
        mockSession('Error bits = 0x0000', opsWith({ 10: '0' }))

        const { result } = renderHook(() => useCameraReadiness({ device, enabled: true }))

        await waitFor(() => expect(result.current.status).toBe('cameraOff'))
        expect(result.current.issues).toEqual([])
    })

    it('reports the fault when the main camera bit is set', async () => {
        // bit 8 = AI_NO_MAIN_CAMERA
        mockSession('Error bits = 0x0100', opsWith({ 10: '1' }))

        const { result } = renderHook(() => useCameraReadiness({ device, enabled: true }))

        await waitFor(() => expect(result.current.status).toBe('faulted'))
        expect(result.current.issues.some(i => i.severity === 'error')).toBe(true)
    })

    // Turning on a camera that cannot initialise would just fail again, so the
    // fault has to win and the "turn it on" action must not be offered.
    it('prefers the fault over the switch when both are true', async () => {
        mockSession('Error bits = 0x0100', opsWith({ 10: '0' }))

        const { result } = renderHook(() => useCameraReadiness({ device, enabled: true }))

        await waitFor(() => expect(result.current.status).toBe('faulted'))
    })

    // A flaky link must not lock an engineer out of the screen.
    it('falls back to unknown when the check itself fails', async () => {
        ;(createBleSession as jest.Mock).mockReturnValue({
            execute: jest.fn().mockRejectedValue(new Error('TIMEOUT')),
        })

        const { result } = renderHook(() => useCameraReadiness({ device, enabled: true }))

        await waitFor(() => expect(result.current.status).toBe('unknown'))
    })

    it('treats firmware with no op10 as camera on', async () => {
        mockSession('Error bits = 0x0000', ['0', '0', '0'])   // short op array

        const { result } = renderHook(() => useCameraReadiness({ device, enabled: true }))

        await waitFor(() => expect(result.current.status).toBe('ready'))
    })

    it('does not run twice for one connection', async () => {
        const execute = mockSession('Error bits = 0x0000', opsWith({ 10: '1' }))

        const { result, rerender } = renderHook(() => useCameraReadiness({ device, enabled: true }))
        await waitFor(() => expect(result.current.status).toBe('ready'))

        rerender({})
        rerender({})

        expect(execute).toHaveBeenCalledTimes(2)   // one selftest, one getops
    })
})

describe('useCameraReadiness, self-test broadcasts', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        bleEventBus.removeAllListeners()
    })

    // The bug this fixes, seen on the bench 2 September: a poll reported a camera
    // fault, the device broadcast a clean result 900ms later, and the banner kept
    // showing the fault because only command replies were being read.
    it('clears a fault when the device later broadcasts a clean result', async () => {
        mockSession('Error bits = 0x0100', opsWith({ 10: '1' }))

        const { result } = renderHook(() => useCameraReadiness({ device, enabled: true }))
        await waitFor(() => expect(result.current.status).toBe('faulted'))

        broadcast('Error bits = 0x0000')

        await waitFor(() => expect(result.current.status).toBe('ready'))
        expect(result.current.issues).toEqual([])
    })

    it('raises a fault that appears only after the check ran', async () => {
        mockSession('Error bits = 0x0000', opsWith({ 10: '1' }))

        const { result } = renderHook(() => useCameraReadiness({ device, enabled: true }))
        await waitFor(() => expect(result.current.status).toBe('ready'))

        broadcast('Error bits = 0x0100')   // camera failed to init on a later wake

        await waitFor(() => expect(result.current.status).toBe('faulted'))
    })

    // parseSelfTestBits alone matches any "0x" in any string, so the listener has
    // to anchor on the label. Ordinary device chatter carries plenty of hex.
    it('ignores unrelated device lines that happen to contain hex', async () => {
        mockSession('Error bits = 0x0000', opsWith({ 10: '1' }))

        const { result } = renderHook(() => useCameraReadiness({ device, enabled: true }))
        await waitFor(() => expect(result.current.status).toBe('ready'))

        broadcast('Wakeup_event = 0x0000, WakeupEvt1 = 0x0001 WAKE signal')
        broadcast("IMAGE Task received event 'Image Event Start Capture' (0x0a01)")
        broadcast('000: 80 01 08 00 67 65 74 6f')

        await waitFor(() => expect(result.current.status).toBe('ready'))
        expect(result.current.issues).toEqual([])
    })

    // The BLE processor pre-sets every AI bit at boot and clears them only once
    // the Himax reports. Treating that as a reading would show five simultaneous
    // hardware failures on a perfectly healthy device.
    it('ignores the boot preset with every AI bit set', async () => {
        mockSession('Error bits = 0x0000', opsWith({ 10: '1' }))

        const { result } = renderHook(() => useCameraReadiness({ device, enabled: true }))
        await waitFor(() => expect(result.current.status).toBe('ready'))

        broadcast('Error bits = 0xFF00')

        await waitFor(() => expect(result.current.status).toBe('ready'))
        expect(result.current.issues).toEqual([])
    })

    // Only the all-set pattern is the preset. Real multi-fault values must survive.
    it('still reports a genuine multi-bit AI fault', async () => {
        mockSession('Error bits = 0x0000', opsWith({ 10: '1' }))

        const { result } = renderHook(() => useCameraReadiness({ device, enabled: true }))
        await waitFor(() => expect(result.current.status).toBe('ready'))

        broadcast('Error bits = 0x0300')   // bits 8 and 9: main camera and HM0360

        await waitFor(() => expect(result.current.status).toBe('faulted'))
        expect(result.current.issues).toHaveLength(2)
    })

    it('ignores broadcasts from a different device', async () => {
        mockSession('Error bits = 0x0000', opsWith({ 10: '1' }))

        const { result } = renderHook(() => useCameraReadiness({ device, enabled: true }))
        await waitFor(() => expect(result.current.status).toBe('ready'))

        broadcast('Error bits = 0x0100', 'some-other-device')

        await waitFor(() => expect(result.current.status).toBe('ready'))
    })

    // The bug the 2 September bench run exposed: `selftest` was sent before the
    // getops that wakes the device, so it always went out ~200ms before the
    // broadcast arrived and the skip never once fired. Asking for op10 first
    // gives the device a reason to announce its self-test, which answers the
    // second question for free.
    it('skips the selftest when the wake broadcasts during the check', async () => {
        const execute = jest.fn(async (build: () => any) => {
            const name = build().name
            if (name === 'getops') {
                // The wake this command causes makes the device announce itself.
                bleEventBus.emitEvent({
                    type: 'TEXT_LINE', line: 'Error bits = 0x0000', ts: Date.now(), deviceId: device.id,
                })
                return opsWith({ 10: '1' })
            }
            if (name === 'selftest') return 'Error bits = 0x0000'
            return true
        })
        const getOps = jest.fn(async () => execute(() => ({ name: 'getops' })))
        ;(createBleSession as jest.Mock).mockReturnValue({ execute, getOps })

        const { result } = renderHook(() => useCameraReadiness({ device, enabled: true }))

        await waitFor(() => expect(result.current.status).toBe('ready'))
        expect(execute).toHaveBeenCalledTimes(1)
        expect(execute.mock.calls.every(c => (c[0] as () => any)().name === 'getops')).toBe(true)
    })

    // The saving: once the device has told us, the entry check stops asking.
    it('skips the selftest command when a broadcast already told us', async () => {
        const execute = mockSession('Error bits = 0x0000', opsWith({ 10: '1' }))

        const { result, rerender } = renderHook(
            ({ on }: { on: boolean }) => useCameraReadiness({ device, enabled: on }),
            { initialProps: { on: false } },
        )

        broadcast('Error bits = 0x0000')
        rerender({ on: true })

        await waitFor(() => expect(result.current.status).toBe('ready'))
        expect(execute).toHaveBeenCalledTimes(1)   // getops only, no selftest
    })

    // A slot switch boots a different image on a different sensor, so an explicit
    // recheck must re-ask rather than trust what it already holds.
    it('re-reads the selftest when check is called explicitly', async () => {
        const execute = mockSession('Error bits = 0x0000', opsWith({ 10: '1' }))

        const { result } = renderHook(() => useCameraReadiness({ device, enabled: true }))
        await waitFor(() => expect(result.current.status).toBe('ready'))
        expect(execute).toHaveBeenCalledTimes(2)

        await act(async () => { await result.current.check() })

        expect(execute).toHaveBeenCalledTimes(4)   // selftest + getops again
    })
})
