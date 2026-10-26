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
    emit(Array.from({ length: 32 }, (_, i) => (i === blocks ? '01' : '00')).join(' '))
}

/** The camera at op33 as given; a setop 33 succeeds unless `refuse33`. Returns the lines sent. */
const mockSession = (op33: string, refuse33 = false) => {
    const sent: string[] = []
    const execute = jest.fn(async (build: () => any) => {
        const cmd = build()
        const line: string = cmd.build()
        sent.push(line)
        switch (cmd.name) {
            case 'getops': return ops(op33)
            case 'setop':
                if (refuse33 && line.startsWith('AI setop 33 ')) throw new Error('setop failed: Error: 300 is not a valid value for op 33.')
                return true
            case 'capture':
                emit("About to capture 3 images with an interval of '1000' milliseconds")
                return new Promise(() => {})
            default: return true
        }
    })
    ;(createBleSession as jest.Mock).mockReturnValue({
        execute,
        getOps: jest.fn(async () => ops(op33)),
        waitForSleep: jest.fn(async () => true),
    })
    return sent
}

const start = async (threshold?: number) => {
    const rendered = renderHook(() => useMotionDetectionStream({ device }))
    await act(async () => { await rendered.result.current.startTest(2, 1000, 3, 0, 5, threshold) })
    return rendered.result
}

/**
 * On the firmware of Seeed PR #276 the camera wakes only when more cells than
 * op33 show motion (default 4), so the test marks the frames that would have
 * woken it, rather than every frame with a moving cell (#500).
 */
describe('useMotionDetectionStream wake threshold', () => {
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

    it('marks only the frames above the camera threshold as waking it', async () => {
        const sent = mockSession('4')
        const result = await start()

        act(() => { grid(3); grid(5); grid(4) })
        act(() => emit('Captured 3 images. Last is IMG.JPG (File write 0ms avg.)'))

        expect(result.current.wakeThreshold).toBe(4)
        expect(result.current.frameHistory.map(f => f.wouldWake)).toEqual([false, true, false])
        expect(sent.some(line => line.startsWith('AI setop 33 '))).toBe(false)
    })

    it('writes the threshold the operator chose, and judges the frames by it', async () => {
        const sent = mockSession('4')
        const result = await start(2)

        act(() => { grid(3); grid(1) })
        act(() => emit('Captured 3 images. Last is IMG.JPG (File write 0ms avg.)'))

        expect(sent).toContain('AI setop 33 2')
        expect(sent.indexOf('AI setop 33 2')).toBeLessThan(sent.indexOf('AI capture 3 1000'))
        expect(result.current.wakeThreshold).toBe(2)
        expect(result.current.frameHistory.map(f => f.wouldWake)).toEqual([true, false])
    })

    it('keeps the camera threshold when the write is refused', async () => {
        mockSession('4', true)
        const result = await start(300)

        expect(result.current.wakeThreshold).toBe(4)
    })

    it('works as before on firmware without a threshold, and writes nothing to op33', async () => {
        const sent = mockSession('0')
        const result = await start(2)

        act(() => { grid(0); grid(3) })
        act(() => emit('Captured 3 images. Last is IMG.JPG (File write 0ms avg.)'))

        expect(result.current.wakeThreshold).toBeNull()
        expect(result.current.frameHistory.map(f => f.wouldWake)).toEqual([null])
        expect(sent.some(line => line.startsWith('AI setop 33 '))).toBe(false)
    })
})
