import { act, renderHook } from '@testing-library/react-native'

import { himaxUpdateState, useFirmwareStatus } from '../useFirmwareStatus'
import ReferenceDataService from '../../../../services/ReferenceDataService'

jest.mock('../../../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))
jest.mock('../../../../ble/session/createBleSession', () => ({ createBleSession: jest.fn() }))
jest.mock('../../../../services/ReferenceDataService', () => ({
    __esModule: true,
    default: { getLatestFirmware: jest.fn(), getLatestHimaxByVariant: jest.fn() },
}))

const build = (cameraVariant: 'RP3' | 'HM0360' | null, version: string) => ({ id: `fw-${version}`, version, cameraVariant }) as any

// WILD-DJZQ on the bench, 9 October 2026: running the 10:09 colour build when
// the dev deploy left the catalogue holding only the 10:56 night build
const RUNNING = 'WW500_C02 10:09:08 Oct  9 2026'
const COLOUR_1009 = build('RP3', RUNNING)
const COLOUR_1056 = build('RP3', 'WW500_C02 10:56:11 Oct  9 2026')
const NIGHT_1056 = build('HM0360', 'WW500_C02 10:56:08 Oct  9 2026')

/**
 * #437: the update installs both camera images or neither, so with one
 * camera's build in the catalogue there is nothing to update to. Firmware
 * Status counted the camera as outdated against that build and offered an
 * update whose button was disabled.
 */
describe('himaxUpdateState', () => {
    it('does not count a camera as outdated against one camera\'s build, and names the missing camera', () => {
        expect(himaxUpdateState(RUNNING, null, NIGHT_1056, NIGHT_1056)).toEqual({ isOutdated: false, missingVariant: 'RP3' })
        expect(himaxUpdateState(RUNNING, COLOUR_1056, null, COLOUR_1056)).toEqual({ isOutdated: false, missingVariant: 'HM0360' })
    })

    it('names no missing camera when the device runs the one build there is', () => {
        expect(himaxUpdateState(RUNNING, COLOUR_1009, null, COLOUR_1009)).toEqual({ isOutdated: false, missingVariant: null })
    })

    it('counts the camera as outdated once both cameras\' builds are there', () => {
        expect(himaxUpdateState(RUNNING, COLOUR_1056, NIGHT_1056, COLOUR_1056)).toEqual({ isOutdated: true, missingVariant: null })
    })

    it('keeps the either-camera rule for a complete pair', () => {
        expect(himaxUpdateState(NIGHT_1056.version, COLOUR_1056, NIGHT_1056, COLOUR_1056)).toEqual({ isOutdated: false, missingVariant: null })
    })

    it('says nothing about a version it could not read', () => {
        expect(himaxUpdateState(null, null, NIGHT_1056, NIGHT_1056)).toEqual({ isOutdated: false, missingVariant: null })
    })

    it('compares a catalogue without camera labels with its newest build', () => {
        const legacy = build(null, 'WW500_C02 10:56:08 Oct  9 2026')
        expect(himaxUpdateState(RUNNING, null, null, legacy)).toEqual({ isOutdated: true, missingVariant: null })
    })
})

describe('useFirmwareStatus with one camera\'s build in the catalogue', () => {
    const settle = async () => {
        for (let i = 0; i < 50; i++) await Promise.resolve()
    }

    it('reports the missing camera instead of an update', async () => {
        ;(ReferenceDataService.getLatestFirmware as jest.Mock).mockImplementation(async (type: string) =>
            (type === 'ble' ? build(null, '0.30.57') : NIGHT_1056))
        ;(ReferenceDataService.getLatestHimaxByVariant as jest.Mock).mockImplementation(async (variant: string) =>
            (variant === 'HM0360' ? NIGHT_1056 : null))

        const device = { id: 'AA:BB', connected: true } as any
        const { result } = renderHook(() => useFirmwareStatus({ device, initialBleVersion: '00.30.57', initialHimaxVersion: RUNNING }))
        await act(async () => { await settle() })

        expect(result.current.statuses.himax).toEqual(expect.objectContaining({
            currentVersion: RUNNING,
            isOutdated: false,
            missingVariant: 'RP3',
        }))
    })
})
