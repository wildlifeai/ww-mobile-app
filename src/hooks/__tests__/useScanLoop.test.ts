import { renderHook } from '@testing-library/react-native'

import { useScanLoop } from '../useScanLoop'

const mockStartScan = jest.fn()
const mockStopScan = jest.fn()

jest.mock('../../providers/BleEngineProvider', () => ({
    useBleActions: () => ({ startScan: mockStartScan, stopScan: mockStopScan }),
}))
// isScanning never changes here: the loop must not depend on it (#346)
jest.mock('../../redux', () => ({
    useAppSelector: (select: any) => select({ scanning: { isScanning: false } }),
    useAppDispatch: () => jest.fn(),
}))
jest.mock('react-native-ble-manager', () => ({ __esModule: true, default: { getDiscoveredPeripherals: jest.fn(async () => []) } }))
jest.mock('../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))

/**
 * #346: the Engineer Console's connect dialog ran one 3 s burst and then
 * stopped scanning while still showing "Scanning for devices", so a camera
 * switched on after that was never found.
 */
describe('useScanLoop', () => {
    beforeEach(() => {
        jest.useFakeTimers()
        mockStartScan.mockClear()
    })

    afterEach(() => {
        jest.useRealTimers()
    })

    it('keeps scanning in bursts for as long as it is active', () => {
        renderHook(() => useScanLoop({ active: true }))

        jest.advanceTimersByTime(300)
        expect(mockStartScan).toHaveBeenCalledTimes(1)
        expect(mockStartScan).toHaveBeenLastCalledWith(3, false)

        // Well past the camera's 30 s of fast advertising
        jest.advanceTimersByTime(60_000)
        expect(mockStartScan.mock.calls.length).toBeGreaterThanOrEqual(18)
    })

    it('scans for DFU devices when asked', () => {
        renderHook(() => useScanLoop({ active: true, scanDfu: true }))

        jest.advanceTimersByTime(300)
        expect(mockStartScan).toHaveBeenLastCalledWith(3, true)
    })

    it('starts no burst while inactive, and stops when it becomes inactive', () => {
        const { rerender } = renderHook(({ active }: { active: boolean }) => useScanLoop({ active }), {
            initialProps: { active: false },
        })
        jest.advanceTimersByTime(10_000)
        expect(mockStartScan).not.toHaveBeenCalled()

        rerender({ active: true })
        jest.advanceTimersByTime(300)
        expect(mockStartScan).toHaveBeenCalledTimes(1)

        rerender({ active: false })
        jest.advanceTimersByTime(10_000)
        expect(mockStartScan).toHaveBeenCalledTimes(1)
    })
})
