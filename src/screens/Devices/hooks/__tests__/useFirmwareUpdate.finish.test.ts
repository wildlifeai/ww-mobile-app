import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, renderHook } from '@testing-library/react-native'

import { firmware83Filename, useFirmwareUpdate } from '../useFirmwareUpdate'
import { createBleSession } from '../../../../ble/session/createBleSession'
import { runFileTransferPipeline } from '../../../../ble/protocol/fileTransfer'
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
jest.mock('react-native-ble-manager', () => ({
    __esModule: true,
    default: { addListener: jest.fn(() => ({ remove: jest.fn() })), scan: jest.fn(async () => {}), stopScan: jest.fn(async () => {}) },
}))
jest.mock('../../../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))
jest.mock('../../../../ble/session/createBleSession', () => ({ createBleSession: jest.fn() }))
jest.mock('../../../../ble/protocol/fileTransfer', () => ({ runFileTransferPipeline: jest.fn() }))
jest.mock('../../../../ble/workflows/configVerification', () => ({
    verifyConfigDefaults: jest.fn(async () => ({ verified: true, checkedCount: 0, mismatches: {} })),
}))
jest.mock('../../../../services/DfuService', () => ({ DfuService: { startDFU: jest.fn() } }))
jest.mock('../../../../services/FirmwareService', () => ({
    __esModule: true,
    default: {
        ensureFirmwareDownloaded: jest.fn(async () => 'file:///firmware/image.img'),
        readFirmwareAsBytes: jest.fn(async () => new Uint8Array(8)),
        holdCache: jest.fn(() => () => {}),
    },
}))
jest.mock('../../../../services/ReferenceDataService', () => ({
    __esModule: true,
    default: { getLatestFirmware: jest.fn(), getActiveFirmwares: jest.fn(), getLatestHimaxByVariant: jest.fn() },
}))
jest.mock('../../../../hooks/useBle', () => ({ useBle: () => ({ connectDevice: jest.fn(), disconnectDevice: jest.fn() }) }))
jest.mock('../../../../redux', () => ({ useAppDispatch: () => jest.fn() }))
jest.mock('expo-keep-awake', () => ({ activateKeepAwakeAsync: jest.fn(async () => {}), deactivateKeepAwake: jest.fn() }))

type Variant = 'RP3' | 'HM0360'
const NAME: Record<Variant, string> = { RP3: 'RP3 (day/colour)', HM0360: 'HM0360 (night/IR)' }
const firmware = (cameraVariant: Variant, version: string) => ({
    id: `fw-${cameraVariant}`, version, buildDate: null, cameraVariant,
    locationPath: `himax/${cameraVariant}.img`, crcChecksum: null, fileSizeBytes: null,
}) as any

const COLOUR = firmware('RP3', 'WW500_C02 10:56:08 Oct  9 2026')
const NIGHT = firmware('HM0360', 'WW500_C02 10:55:58 Oct  9 2026')
const COLOUR_OLD = 'WW500_C02 10:09:08 Oct  9 2026'
const NIGHT_OLD = 'WW500_C02 10:02:35 Oct  8 2026'
const NIGHT_FILE = firmware83Filename(NIGHT.version, null, 'HM0360')
const COLOUR_FILE = firmware83Filename(COLOUR.version, null, 'RP3')
const KEY = 'himaxUpdate:pending:AA:BB'
const NOT_RESTARTED = 'The camera did not restart into its new image. Nothing more was written.'

interface Image { variant: Variant; version: string }

/**
 * A WW500's AI processor as the update sees it: two slots, a selector that
 * `AI firmware` moves to the slot it writes (labelled `unknown` until a cold
 * boot), and `AI reset` then `AI dpd` booting the selected slot, for the
 * first `restarts` of them. Every command it receives is kept in `sent`, with
 * the record on disk at each `AI firmware`.
 */
const fakeCamera = (start: { selector: 0 | 1; running: 0 | 1; images: [Image, Image]; labels: [string, string] }, restarts = Infinity) => {
    const cam = { ...start, images: [...start.images], labels: [...start.labels], resetPending: false }
    const sent: string[] = []
    const recordAtFlash: Array<HimaxUpdateRecord | null> = []
    const files: Record<string, Image> = {
        [COLOUR_FILE]: { variant: 'RP3', version: COLOUR.version },
        [NIGHT_FILE]: { variant: 'HM0360', version: NIGHT.version },
    }
    const refuse: { next: string | null } = { next: null }
    const execute = jest.fn(async (build: any) => {
        const line: string = build().build()
        sent.push(line)
        if (line === 'battery') return 80
        if (line === 'AI dir') return []
        if (line === 'AI ver') return cam.images[cam.running].version
        if (line === 'AI slots') {
            return { activeSlot: cam.selector, running: NAME[cam.images[cam.running].variant], slotA: cam.labels[0], slotB: cam.labels[1], autoSwitch: false }
        }
        if (line.startsWith('AI firmware ')) {
            const stored = await AsyncStorage.getItem(KEY)
            recordAtFlash.push(stored ? JSON.parse(stored) : null)
            if (refuse.next) {
                const reason = refuse.next
                refuse.next = null
                throw new Error(reason)
            }
            const target = cam.selector === 0 ? 1 : 0
            cam.images[target] = files[line.split(' ')[2]]
            cam.labels[target] = 'unknown'
            cam.selector = target
            return true
        }
        if (line === 'AI reset') cam.resetPending = true
        if (line === 'AI dpd' && cam.resetPending && restarts-- > 0) {
            cam.running = cam.selector
            cam.labels[cam.selector] = NAME[cam.images[cam.selector].variant]
            cam.resetPending = false
        }
        return true
    })
    ;(createBleSession as jest.Mock).mockImplementation(() => ({
        execute,
        waitForSleep: jest.fn(async () => true),
        waitForWake: jest.fn(async () => true),
    }))
    return { cam, sent, recordAtFlash, refuse, flashes: () => sent.filter(line => line.startsWith('AI firmware ')) }
}

/** This phone's record of an update that started on the night camera in slot B and wrote the colour image first */
const pendingRecord = (sent: number, flashed: number): HimaxUpdateRecord => ({
    startedAt: '2026-10-09T10:49:00.000Z',
    endVariant: 'HM0360',
    startActiveSlot: 1,
    startVersion: NIGHT_OLD,
    images: [
        { variant: 'RP3', version: COLOUR.version, filename: COLOUR_FILE },
        { variant: 'HM0360', version: NIGHT.version, filename: NIGHT_FILE },
    ],
    sent,
    flashed,
})

const stored = async (): Promise<HimaxUpdateRecord | null> => {
    const value = await AsyncStorage.getItem(KEY)
    return value ? JSON.parse(value) : null
}

/**
 * #374: an AI update cut short between its two images left the camera on the
 * other camera, nothing offered to finish it, and "Try again" ran the whole
 * pair ordered by the camera then running, so it ended on the wrong one.
 */
describe('useFirmwareUpdate finishing an update that stopped between its images', () => {
    const device = { id: 'AA:BB', name: 'WILD-DJZQ', connected: true } as any

    /** Let the async flow run as far as it can; no timer has to move */
    const settle = async () => {
        for (let i = 0; i < 600; i++) await Promise.resolve()
    }

    const open = async () => {
        const hook = renderHook(() => useFirmwareUpdate({ target: 'himax', device }))
        await act(async () => { await settle() })
        expect(hook.result.current.isPreflightDone).toBe(true)
        return hook
    }

    const update = async (result: { current: ReturnType<typeof useFirmwareUpdate> }) => {
        await act(async () => {
            const run = result.current.startUpdate({ himaxSource: 'download' })
            await settle()
            await run
        })
    }

    beforeEach(async () => {
        await AsyncStorage.clear()
        ;(ReferenceDataService.getLatestFirmware as jest.Mock).mockResolvedValue(COLOUR)
        ;(ReferenceDataService.getActiveFirmwares as jest.Mock).mockResolvedValue([COLOUR, NIGHT])
        ;(ReferenceDataService.getLatestHimaxByVariant as jest.Mock).mockImplementation(async (v: string) => (v === 'RP3' ? COLOUR : NIGHT))
        ;(runFileTransferPipeline as jest.Mock).mockResolvedValue({ crc: 0x1234 })
    })

    it('restarts the camera, then writes only the end camera\'s image, and ends on it', async () => {
        // Stopped before image 1's reset: the camera booted the colour image at its next wake
        const camera = fakeCamera({
            selector: 0, running: 0,
            images: [{ variant: 'RP3', version: COLOUR.version }, { variant: 'HM0360', version: NIGHT_OLD }],
            labels: ['unknown', NAME.HM0360],
        })
        await AsyncStorage.setItem(KEY, JSON.stringify(pendingRecord(1, 1)))

        const { result } = await open()
        expect(result.current.updateRecord).toEqual(pendingRecord(1, 1))

        await update(result)

        expect(camera.flashes()).toEqual([`AI firmware ${NIGHT_FILE} 0x1234`])
        expect(camera.sent.indexOf('AI dpd')).toBeLessThan(camera.sent.indexOf(`AI firmware ${NIGHT_FILE} 0x1234`))
        expect(runFileTransferPipeline).toHaveBeenCalledTimes(1)
        expect(camera.cam.images[camera.cam.running]).toEqual({ variant: 'HM0360', version: NIGHT.version })
        expect(result.current.isComplete).toBe(true)
        expect(result.current.pairProgress).toEqual({ total: 2, done: 2 })
        expect(await stored()).toBeNull()
    })

    it('saves the image as sent before its command and installed after the OK, keeps that on a failure, and Try again ends on the start camera', async () => {
        // A healthy camera on the night image in slot B
        const camera = fakeCamera({
            selector: 1, running: 1,
            images: [{ variant: 'RP3', version: COLOUR_OLD }, { variant: 'HM0360', version: NIGHT_OLD }],
            labels: [NAME.RP3, NAME.HM0360],
        })
        // Image 2's transfer fails, and not in a way a retry covers
        ;(runFileTransferPipeline as jest.Mock)
            .mockResolvedValueOnce({ crc: 0x1234 })
            .mockRejectedValueOnce(new Error('ftx err 1'))

        const { result } = await open()
        await update(result)

        expect(result.current.isFailed).toBe(true)
        expect(result.current.pairProgress).toEqual({ total: 2, done: 1 })
        expect(camera.flashes()).toEqual([`AI firmware ${COLOUR_FILE} 0x1234`])
        expect(camera.recordAtFlash).toEqual([expect.objectContaining({ endVariant: 'HM0360', sent: 1, flashed: 0 })])
        expect(await stored()).toEqual(expect.objectContaining({ startActiveSlot: 1, startVersion: NIGHT_OLD, sent: 1, flashed: 1 }))
        expect(NAME[camera.cam.images[camera.cam.running].variant]).toBe(NAME.RP3)

        // Try again
        camera.sent.length = 0
        await update(result)

        expect(camera.flashes()).toEqual([`AI firmware ${NIGHT_FILE} 0x1234`])
        expect(camera.recordAtFlash[1]).toEqual(expect.objectContaining({ sent: 2, flashed: 1, startVersion: NIGHT_OLD }))
        expect(camera.cam.images[camera.cam.running]).toEqual({ variant: 'HM0360', version: NIGHT.version })
        expect(result.current.isComplete).toBe(true)
        expect(await stored()).toBeNull()
    })

    it('restarts a camera still on its old image after image 1 before writing image 2', async () => {
        // Image 1 written, the camera still awake on the night image it had
        const camera = fakeCamera({
            selector: 0, running: 1,
            images: [{ variant: 'RP3', version: COLOUR.version }, { variant: 'HM0360', version: NIGHT_OLD }],
            labels: ['unknown', NAME.HM0360],
        })
        await AsyncStorage.setItem(KEY, JSON.stringify(pendingRecord(1, 1)))

        const { result } = await open()
        await update(result)

        expect(camera.flashes()).toEqual([`AI firmware ${NIGHT_FILE} 0x1234`])
        // Written to slot B, the one the camera had left, not over the colour image in slot A
        expect(camera.cam.images).toEqual([{ variant: 'RP3', version: COLOUR.version }, { variant: 'HM0360', version: NIGHT.version }])
        expect(result.current.isComplete).toBe(true)
    })

    it('writes nothing to a camera that does not restart into its new image', async () => {
        const camera = fakeCamera({
            selector: 0, running: 1,
            images: [{ variant: 'RP3', version: COLOUR.version }, { variant: 'HM0360', version: NIGHT_OLD }],
            labels: ['unknown', NAME.HM0360],
        }, 0)
        await AsyncStorage.setItem(KEY, JSON.stringify(pendingRecord(1, 1)))

        const { result } = await open()
        await update(result)

        expect(camera.sent).toEqual(expect.arrayContaining(['AI reset', 'AI dpd']))
        expect(camera.flashes()).toEqual([])
        expect(result.current.isFailed).toBe(true)
        expect(result.current.errorMsg).toBe(NOT_RESTARTED)
        expect(await stored()).toEqual(pendingRecord(1, 1))
    })

    it('fails, and keeps the record, when the camera does not come back on the camera the update ends on', async () => {
        // The restart after image 1 happens, the one after image 2 does not
        const camera = fakeCamera({
            selector: 1, running: 1,
            images: [{ variant: 'RP3', version: COLOUR_OLD }, { variant: 'HM0360', version: NIGHT_OLD }],
            labels: [NAME.RP3, NAME.HM0360],
        }, 1)

        const { result } = await open()
        await update(result)

        expect(camera.flashes()).toEqual([`AI firmware ${COLOUR_FILE} 0x1234`, `AI firmware ${NIGHT_FILE} 0x1234`])
        expect(result.current.isComplete).toBe(false)
        expect(result.current.errorMsg).toBe(NOT_RESTARTED)
        expect(await stored()).toEqual(expect.objectContaining({ endVariant: 'HM0360', sent: 2, flashed: 2 }))
    })

    it('stops at a CRC refusal without waiting or trying the image again', async () => {
        const camera = fakeCamera({
            selector: 1, running: 1,
            images: [{ variant: 'RP3', version: COLOUR_OLD }, { variant: 'HM0360', version: NIGHT_OLD }],
            labels: [NAME.RP3, NAME.HM0360],
        })
        camera.refuse.next = 'aifirmware failed: Error: CRC mismatch - file 0x1234, expected 0x5678. Flash NOT modified.'

        const { result } = await open()
        await update(result)

        expect(camera.flashes()).toEqual([`AI firmware ${COLOUR_FILE} 0x1234`])
        expect(result.current.isFailed).toBe(true)
        // Nothing reached the camera, so the record is stale and the next check drops it
        expect(await stored()).toEqual(expect.objectContaining({ sent: 1, flashed: 0 }))
    })
})
