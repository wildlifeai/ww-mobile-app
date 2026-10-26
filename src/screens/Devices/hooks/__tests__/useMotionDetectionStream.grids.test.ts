import { renderHook, act } from '@testing-library/react-native'

import { useMotionDetectionStream } from '../useMotionDetectionStream'
import { createBleSession } from '../../../../ble/session/createBleSession'
import { keepAwake } from '../../../../ble/session/keepAwake'
import { mdIntervalHold } from '../../../../ble/session/mdIntervalHold'
import { bleEventBus } from '../../../../ble/protocol/eventBus'

jest.mock('../../../../ble/session/createBleSession')
jest.mock('../../../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))

const device = { id: 'dev-1', name: 'WILD-TEST', connected: true } as any

/** op8 at 1000 ms, op17 at 2, op33 as given, everything else 0. */
const ops = (op33: string): string[] =>
    Array.from({ length: 37 }, (_, i) => (i === 8 ? '1000' : i === 17 ? '2' : i === 33 ? op33 : '0'))

const emit = (line: string) =>
    bleEventBus.emitEvent({ type: 'TEXT_LINE', line, ts: Date.now(), deviceId: device.id })

/** One grid as the firmware sends it: the count line, then its 32 bytes. */
const grid = (blocks: number) => {
    emit(`HM0360 motion in ${blocks} blocks:`)
    emit(Array.from({ length: 32 }, (_, i) => (i === 0 && blocks > 0 ? '01' : '00')).join(' '))
}

const mockSession = (op33: string) => {
    const execute = jest.fn(async (build: () => any) => {
        const cmd = build()
        switch (cmd.name) {
            case 'getops': return ops(op33)
            case 'capture':
                emit("About to capture 5 images with an interval of '1000' milliseconds")
                return new Promise(() => {})
            default: return true
        }
    })
    ;(createBleSession as jest.Mock).mockReturnValue({
        execute,
        getOps: jest.fn(async () => ops(op33)),
        waitForSleep: jest.fn(async () => true),
    })
}

const start = async () => {
    const rendered = renderHook(() => useMotionDetectionStream({ device }))
    await act(async () => { await rendered.result.current.startTest(2, 1000, 5) })
    return rendered.result
}

/**
 * Image 1 of a burst has no earlier frame to compare with. Firmware before
 * Seeed PR #276 still sends its empty grid, which the test skips; that PR's
 * firmware sends none, so its first grid is image 2's and is the first frame.
 */
describe('useMotionDetectionStream first grid', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        keepAwake.clear()
        mdIntervalHold.clear()
        bleEventBus.removeAllListeners()
        jest.useFakeTimers()
    })
    afterEach(() => {
        jest.clearAllTimers()
        jest.useRealTimers()
    })

    it('skips the empty grid of image 1 on firmware that sends one', async () => {
        mockSession('0')
        const result = await start()

        act(() => grid(0))
        expect(result.current.frameCount).toBe(0)

        act(() => grid(6))
        expect(result.current.frameCount).toBe(1)
        expect(result.current.mdBlocksCount).toBe(6)
    })

    it('keeps the first grid on firmware with the motion wake threshold', async () => {
        mockSession('4')
        const result = await start()

        act(() => grid(6))
        expect(result.current.frameCount).toBe(1)
        expect(result.current.mdBlocksCount).toBe(6)
    })
})
