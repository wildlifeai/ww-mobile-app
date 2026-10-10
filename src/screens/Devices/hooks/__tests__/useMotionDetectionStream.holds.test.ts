import { act, renderHook } from '@testing-library/react-native'

import { useMotionDetectionStream } from '../useMotionDetectionStream'
import { createBleSession } from '../../../../ble/session/createBleSession'
import { keepAwake } from '../../../../ble/session/keepAwake'
import { flashHold } from '../../../../ble/session/flashHold'
import { bleEventBus } from '../../../../ble/protocol/eventBus'
import { OP_PARAMETER } from '../../../../hooks/useDeviceSettings'

jest.mock('../../../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))
jest.mock('../../../../ble/session/createBleSession', () => ({ createBleSession: jest.fn() }))
jest.mock('../../../../ble/session/keepAwake', () => ({ keepAwake: { acquire: jest.fn(), release: jest.fn() } }))
jest.mock('../../../../ble/session/flashHold', () => ({ flashHold: { acquire: jest.fn(), release: jest.fn(), restorePending: jest.fn() } }))
jest.mock('../../../../ble/protocol/bleTransportController', () => ({ bleTransport: { clearAll: jest.fn() } }))

/**
 * The motion test keeps the device awake between frames by raising op8, which
 * is written to CONFIG.TXT and applies in the field. It used to keep the
 * original in a ref and write it back only after "Captured" or a stop, so a
 * dropped link, a killed app, a capture that never started or a failed setup
 * left the device awake after every motion capture (#271). It now holds
 * through keepAwake, which remembers the original on disk, and every way out
 * of a test releases the hold.
 */
describe('useMotionDetectionStream op8 hold', () => {
    const device = { id: 'AA:BB', connected: true } as any
    let lines: string[]
    let failOp18Clear: boolean

    const emit = (line: string) =>
        bleEventBus.emitEvent({ type: 'TEXT_LINE', line, ts: Date.now(), deviceId: device.id })

    /** Let the async setup run as far as it can without the timers moving. */
    const settle = async () => {
        for (let i = 0; i < 100; i++) await Promise.resolve()
    }

    beforeEach(() => {
        lines = []
        failOp18Clear = false
        ;(keepAwake.acquire as jest.Mock).mockResolvedValue(true)
        ;(keepAwake.release as jest.Mock).mockResolvedValue(undefined)
        ;(flashHold.release as jest.Mock).mockResolvedValue(undefined)
        ;(flashHold.restorePending as jest.Mock).mockResolvedValue(undefined)
        ;(createBleSession as jest.Mock).mockImplementation(() => ({
            execute: jest.fn(async (build: any) => {
                const line: string = build().build()
                lines.push(line)
                if (/getop -1/.test(line)) return Array.from({ length: 37 }, (_, i) => (i === OP_PARAMETER.INTERVAL_BEFORE_DPD ? '1000' : '0'))
                if (failOp18Clear && line === `AI setop ${OP_PARAMETER.TEST_MODE_BITS} 0`) throw new Error('DEVICE_DISCONNECTED')
                return true
            }),
        }))
    })

    afterEach(() => {
        bleEventBus.removeAllListeners('textLine')
    })

    it('holds through keepAwake for the interval plus 2 s, and never writes op8 itself', async () => {
        const { result } = renderHook(() => useMotionDetectionStream({ device }))

        await act(async () => {
            result.current.startTest(undefined, 4000, 3)
            await settle()
        })

        expect(keepAwake.acquire).toHaveBeenCalledWith(expect.anything(), device.id, 6000)
        expect(lines.filter(line => line.startsWith(`AI setop ${OP_PARAMETER.INTERVAL_BEFORE_DPD} `))).toEqual([])
    })

    it('releases the hold after "Captured", even when clearing op18 fails', async () => {
        failOp18Clear = true
        const { result } = renderHook(() => useMotionDetectionStream({ device }))

        await act(async () => {
            const started = result.current.startTest(undefined, 1000, 3)
            await settle()
            emit('About to capture 3 images')
            await started
        })
        await act(async () => {
            emit('Captured 3 images')
            await settle()
        })

        expect(keepAwake.release).toHaveBeenCalledWith(expect.anything(), device.id)
        expect(flashHold.release).toHaveBeenCalledWith(expect.anything(), device.id)
    })

    it('releases the hold when the operator stops the test', async () => {
        const { result } = renderHook(() => useMotionDetectionStream({ device }))

        await act(async () => {
            const started = result.current.startTest(undefined, 1000, 3)
            await settle()
            emit('About to capture 3 images')
            await started
        })
        await act(async () => {
            result.current.stopTest()
            await settle()
        })

        expect(lines).toContain(`AI setop ${OP_PARAMETER.TEST_MODE_BITS} 0`)
        expect(keepAwake.release).toHaveBeenCalledWith(expect.anything(), device.id)
    })

    it('cleans up when the operator leaves the screen mid-test', async () => {
        const { result, unmount } = renderHook(() => useMotionDetectionStream({ device }))

        await act(async () => {
            const started = result.current.startTest(undefined, 1000, 3)
            await settle()
            emit('About to capture 3 images')
            await started
        })
        await act(async () => {
            unmount()
            await settle()
        })

        expect(lines).toContain(`AI setop ${OP_PARAMETER.TEST_MODE_BITS} 0`)
        expect(keepAwake.release).toHaveBeenCalledWith(expect.anything(), device.id)
    })

    it('releases the hold and clears op18 when the capture is never acknowledged', async () => {
        const { result } = renderHook(() => useMotionDetectionStream({ device }))

        await act(async () => {
            const started = result.current.startTest(undefined, 1000, 3)
            for (let attempt = 0; attempt < 4; attempt++) {
                await settle()
                jest.advanceTimersByTime(10000)
            }
            await started
            await settle()
        })

        expect(result.current.errorMessage).toMatch(/not acknowledged/)
        expect(lines).toContain(`AI setop ${OP_PARAMETER.TEST_MODE_BITS} 0`)
        expect(keepAwake.release).toHaveBeenCalledWith(expect.anything(), device.id)
    })
})
