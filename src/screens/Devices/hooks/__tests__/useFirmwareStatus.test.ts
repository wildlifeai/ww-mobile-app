import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, renderHook } from '@testing-library/react-native'

import { useFirmwareStatus } from '../useFirmwareStatus'
import { createBleSession } from '../../../../ble/session/createBleSession'
import ReferenceDataService from '../../../../services/ReferenceDataService'
import type { HimaxUpdateRecord } from '../../../../utils/himaxFirmwareState'

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
const NIGHT_1056 = build('HM0360', 'WW500_C02 10:56:08 Oct  9 2026')

// The rule itself, with #437's cases that were pinned here on
// `himaxUpdateState`, is tested in utils/__tests__/himaxFirmwareState.test.ts

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

/**
 * #374: an update cut short between its two images left the camera on the
 * other camera's latest build, and Firmware Status read "Up to date". The
 * record of the update, on the phone that ran it, now says otherwise.
 */
describe('useFirmwareStatus with an unfinished update on this phone', () => {
    const device = { id: 'AA:BB', connected: true } as any
    const COLOUR_1009 = build('RP3', RUNNING)
    const NIGHT_1009 = build('HM0360', 'WW500_C02 10:09:02 Oct  9 2026')
    const KEY = 'himaxUpdate:pending:AA:BB'
    const record = (sent: number, flashed: number): HimaxUpdateRecord => ({
        startedAt: '2026-10-09T10:49:00.000Z',
        endVariant: 'HM0360',
        startActiveSlot: 1,
        startVersion: 'WW500_C02 10:02:35 Oct  8 2026',
        images: [
            { variant: 'RP3', version: COLOUR_1009.version, filename: 'R6A09A09.IMG' },
            { variant: 'HM0360', version: NIGHT_1009.version, filename: 'H6A09A09.IMG' },
        ],
        sent,
        flashed,
    })
    const settle = async () => {
        for (let i = 0; i < 100; i++) await Promise.resolve()
    }
    const camera = (aiVer: string, slots: string) => {
        const sent: string[] = []
        ;(createBleSession as jest.Mock).mockImplementation(() => ({
            execute: jest.fn(async (make: any) => {
                const cmd = make()
                const line: string = cmd.build()
                sent.push(line)
                if (line === 'ver') return '00.30.57'
                if (line === 'AI ver') return aiVer
                if (line === 'AI slots') {
                    cmd.collect(slots)
                    return cmd.parser()
                }
                throw new Error(`unexpected ${line}`)
            }),
        }))
        return sent
    }

    beforeEach(async () => {
        await AsyncStorage.clear()
        ;(ReferenceDataService.getLatestFirmware as jest.Mock).mockImplementation(async (type: string) =>
            (type === 'ble' ? build(null, '0.30.57') : COLOUR_1009))
        ;(ReferenceDataService.getLatestHimaxByVariant as jest.Mock).mockImplementation(async (variant: string) =>
            (variant === 'RP3' ? COLOUR_1009 : NIGHT_1009))
    })

    it('reads the camera of 9 October as an unfinished update, not up to date', async () => {
        await AsyncStorage.setItem(KEY, JSON.stringify(record(1, 1)))
        const sent = camera(RUNNING, "Active slot 0 running 'RP3 (day/colour)'. Slot A: 'RP3 (day/colour)', Slot B: 'HM0360 (night/IR)'. Auto-switch: off")

        const { result } = renderHook(() => useFirmwareStatus({ device }))
        await act(async () => { await settle() })

        expect(sent).toEqual(['ver', 'AI ver', 'AI slots'])
        expect(result.current.statuses.himax).toEqual(expect.objectContaining({
            isOutdated: true,
            unfinished: { endVariant: 'HM0360', done: 1, total: 2 },
        }))
    })

    it('says the same on the check that sends nothing, from the record alone (#268)', async () => {
        await AsyncStorage.setItem(KEY, JSON.stringify(record(1, 1)))

        const { result } = renderHook(() => useFirmwareStatus({ device, initialBleVersion: '00.30.57', initialHimaxVersion: RUNNING }))
        await act(async () => { await settle() })

        expect(createBleSession).not.toHaveBeenCalled()
        expect(result.current.statuses.himax.unfinished).toEqual({ endVariant: 'HM0360', done: 1, total: 2 })
        expect(result.current.statuses.himax.isOutdated).toBe(true)
    })

    it("drops the record once the camera runs the end camera's new build", async () => {
        await AsyncStorage.setItem(KEY, JSON.stringify(record(2, 2)))
        camera(NIGHT_1009.version, "Active slot 1 running 'HM0360 (night/IR)'. Slot A: 'RP3 (day/colour)', Slot B: 'HM0360 (night/IR)'. Auto-switch: off")

        const { result } = renderHook(() => useFirmwareStatus({ device }))
        await act(async () => { await settle() })

        expect(result.current.statuses.himax).toEqual(expect.objectContaining({ isOutdated: false, unfinished: null }))
        expect(await AsyncStorage.getItem(KEY)).toBeNull()
    })
})
