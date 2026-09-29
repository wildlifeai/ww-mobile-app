import { renderHook } from '@testing-library/react-native'

import { useBleHeartbeat } from '../useBleHeartbeat'
import { bleEventBus } from '../../ble/protocol/eventBus'
import { BLE_PROTOCOL_TIMINGS } from '../../ble/protocol/protocolConstants'

const mockWriteRaw = jest.fn(async () => {})
jest.mock('../useBle', () => ({ useBle: () => ({ writeRaw: mockWriteRaw }) }))
jest.mock('../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))

const device = { id: 'dev-1', name: 'WILD-TEST', connected: true } as any
const IDLE = BLE_PROTOCOL_TIMINGS.HEARTBEAT_IDLE_MS

const pings = () => mockWriteRaw.mock.calls.filter((c: any[]) => c[1] === 'get heartbeat').length
const rx = (line: string) => bleEventBus.emitEvent({ type: 'RAW_RX', line, ts: Date.now(), deviceId: device.id })

/**
 * #312. The nRF drops the link after 60 s with nothing sent either way. The
 * ping went at 58 s, so a JS timer running a second or two late lost the link,
 * six times in one bench session on 15 September 2026.
 */
describe('useBleHeartbeat', () => {
    beforeEach(() => {
        jest.useFakeTimers()
        mockWriteRaw.mockClear()
        bleEventBus.removeAllListeners()
    })

    afterEach(() => {
        jest.useRealTimers()
    })

    it('pings with half the nRF window to spare', () => {
        expect(IDLE).toBeLessThanOrEqual(30_000)
        const { unmount } = renderHook(() => useBleHeartbeat(device))

        jest.advanceTimersByTime(IDLE - 1)
        expect(pings()).toBe(0)
        jest.advanceTimersByTime(1)
        expect(pings()).toBe(1)
        unmount()
    })

    it('a line from the device restarts the countdown', () => {
        const { unmount } = renderHook(() => useBleHeartbeat(device))

        jest.advanceTimersByTime(IDLE - 5_000)
        rx('HM0360 motion in 3 blocks:')
        jest.advanceTimersByTime(IDLE - 1)
        expect(pings()).toBe(0)
        jest.advanceTimersByTime(1)
        expect(pings()).toBe(1)
        unmount()
    })

    // The device never hears the queue go busy or idle. Counting those let a
    // command that timed out after 30 s push the ping 30 s past the last
    // thing the nRF actually received.
    it('the app\'s own queue events do not restart it', () => {
        const { unmount } = renderHook(() => useBleHeartbeat(device))

        jest.advanceTimersByTime(IDLE - 5_000)
        bleEventBus.emitEvent({ type: 'QUEUE_STATE_CHANGED', isBusy: true, ts: Date.now() })
        bleEventBus.emitEvent({ type: 'QUEUE_STATE_CHANGED', isBusy: false, ts: Date.now() })
        jest.advanceTimersByTime(5_000)
        expect(pings()).toBe(1)
        unmount()
    })

    it('stops when the device disconnects', () => {
        const { rerender, unmount } = renderHook(
            ({ d }: { d: any }) => useBleHeartbeat(d),
            { initialProps: { d: device } },
        )
        rerender({ d: { ...device, connected: false } })
        jest.advanceTimersByTime(IDLE * 3)
        expect(pings()).toBe(0)
        unmount()
    })
})
