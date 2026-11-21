import { act, renderHook } from '@testing-library/react-native'

import { useSoftwareUpdate } from '../useSoftwareUpdate'
import type { HimaxUpdateRecord } from '../../../../utils/himaxFirmwareState'

/**
 * #529: Update software runs the steps of `softwarePlan` on the two update
 * hooks, AI image 1, Bluetooth, then the rest of the AI update, and a second
 * tap after a stop picks up from what the camera and the record say.
 */

const RP3 = { id: 'rp3', version: 'WW500_C02 02:53:39 Nov 21 2026', buildDate: 'Nov 21 2026', cameraVariant: 'RP3' }
const HM0360 = { id: 'hm', version: 'WW500_C02 02:53:46 Nov 21 2026', buildDate: 'Nov 21 2026', cameraVariant: 'HM0360' }
const OLD_AI = 'WW500_C02 01:06:33 Oct 31 2026'

const HALF_DONE: HimaxUpdateRecord = {
    startedAt: '2026-11-21T03:00:00.000Z',
    endVariant: 'HM0360',
    startActiveSlot: 0,
    startVersion: OLD_AI,
    images: [
        { variant: 'RP3', version: RP3.version, filename: 'R6B21253.IMG' },
        { variant: 'HM0360', version: HM0360.version, filename: 'H6B21253.IMG' },
    ],
    sent: 1,
    flashed: 1,
}

const mockHooks: Record<'ble' | 'himax', any> = { ble: null, himax: null }
jest.mock('../useFirmwareUpdate', () => ({
    useFirmwareUpdate: ({ target }: { target: 'ble' | 'himax' }) => mockHooks[target],
    firmware83Filename: () => 'NONE.IMG',
}))
jest.mock('../../../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))

const hook = (extra: Record<string, unknown>) => ({
    isPreflightDone: true,
    isUpdating: false,
    progress: 0,
    phase: 'idle',
    pairProgress: null,
    progressLogs: [],
    fileTransferProgress: null,
    errorMsg: null,
    batteryLevel: 80,
    previousVersion: null,
    latestFirmware: null,
    cameraSlots: null,
    updateRecord: null,
    availableDbFirmwares: [RP3, HM0360],
    sdCardFiles: [],
    startUpdate: jest.fn(async () => true),
    rerunPreflight: jest.fn(),
    ...extra,
})

const device = { id: 'D8:68:DA:FA:4A:3B', connected: true } as any

describe('useSoftwareUpdate', () => {
    beforeEach(() => {
        jest.useRealTimers()
        mockHooks.ble = hook({ previousVersion: '0.30.58', latestFirmware: { version: '0.30.61' } })
        mockHooks.himax = hook({ previousVersion: OLD_AI })
    })

    it('with both behind, writes AI image 1, then Bluetooth, then the rest of the AI update', async () => {
        const calls: string[] = []
        mockHooks.ble.startUpdate = jest.fn(async () => { calls.push('ble'); return true })
        mockHooks.himax.startUpdate = jest.fn(async (options: any) => {
            calls.push(options.stopAfterFirstImage ? 'ai image 1' : 'ai')
            return true
        })

        const { result } = renderHook(() => useSoftwareUpdate({ device }))
        expect(result.current.plan).toEqual(['ai_first_image', 'ble', 'ai'])

        await act(async () => { await result.current.start() })

        expect(calls).toEqual(['ai image 1', 'ble', 'ai'])
        expect(mockHooks.himax.startUpdate).toHaveBeenCalledWith({ himaxSource: 'download', stopAfterFirstImage: true })
        expect(result.current.state).toBe('complete')
        expect(result.current.progress).toBe(1)
    })

    it('runs only the step that is behind', async () => {
        mockHooks.himax = hook({ previousVersion: HM0360.version, cameraSlots: null })

        const { result } = renderHook(() => useSoftwareUpdate({ device }))
        expect(result.current.plan).toEqual(['ble'])

        await act(async () => { await result.current.start() })

        expect(mockHooks.ble.startUpdate).toHaveBeenCalledTimes(1)
        expect(mockHooks.himax.startUpdate).not.toHaveBeenCalled()
    })

    it('stops at a failed step, and a second tap reads the camera again and picks up from the record', async () => {
        mockHooks.ble.startUpdate = jest.fn(async () => false)
        mockHooks.ble.errorMsg = 'Bootloader not found'

        const { result, rerender } = renderHook(() => useSoftwareUpdate({ device }))
        await act(async () => { await result.current.start() })

        expect(result.current.state).toBe('failed')
        expect(result.current.errorMsg).toBe('Bootloader not found')

        // Image 1 went in before the Bluetooth step failed: the AI processor no
        // longer answers the old Bluetooth processor, and the record says half done
        mockHooks.ble.startUpdate = jest.fn(async () => true)
        mockHooks.himax = hook({ previousVersion: null, updateRecord: HALF_DONE })
        rerender({})
        expect(result.current.plan).toEqual(['ble', 'ai'])

        await act(async () => { await result.current.start() })

        expect(mockHooks.ble.rerunPreflight).toHaveBeenCalled()
        expect(mockHooks.himax.rerunPreflight).toHaveBeenCalled()
        expect(mockHooks.ble.startUpdate).toHaveBeenCalledTimes(1)
        expect(mockHooks.himax.startUpdate).toHaveBeenCalledWith({ himaxSource: 'download', stopAfterFirstImage: false })
        expect(result.current.state).toBe('complete')
    })
})
