import { act, renderHook } from '@testing-library/react-native'

import { useFirmwareUpdate } from '../useFirmwareUpdate'
import { createBleSession } from '../../../../ble/session/createBleSession'
import { runFileTransferPipeline } from '../../../../ble/protocol/fileTransfer'
import ReferenceDataService from '../../../../services/ReferenceDataService'

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

const COLOUR = {
    id: 'fw-rp3', version: 'WW500_C02 10:56:08 Oct  9 2026', buildDate: null, cameraVariant: 'RP3',
    locationPath: 'himax/rp3.img', crcChecksum: null, fileSizeBytes: null,
} as any
const NIGHT = {
    id: 'fw-hm', version: 'WW500_C02 10:55:58 Oct  9 2026', buildDate: null, cameraVariant: 'HM0360',
    locationPath: 'himax/hm0360.img', crcChecksum: null, fileSizeBytes: null,
} as any

/**
 * #436: the engineer view's transfer card named the build picked under
 * "Advanced: flash a specific image", while each pass of the pair update sends
 * its own image. The hook now keeps the pass's image in state for the cards.
 * Bench, 9 October 2026: the log said R6A09A09.IMG while the card said H6A09A09.IMG.
 */
describe('useFirmwareUpdate passImage', () => {
    const device = { id: 'AA:BB', name: 'WILD-DJZQ', connected: true } as any
    let finishTransfer: (() => void) | null

    /** Let the async flow run as far as it can without the timers moving. */
    const settle = async () => {
        for (let i = 0; i < 200; i++) await Promise.resolve()
    }

    beforeEach(() => {
        finishTransfer = null
        // The camera boots the slot each write selects once `AI reset` and
        // `AI dpd` restart it, which the update checks before image 2 (#374)
        const labels = ['RP3 (day/colour)', 'HM0360 (night/IR)']
        let selector = 0
        let running = 0
        ;(createBleSession as jest.Mock).mockImplementation(() => ({
            execute: jest.fn(async (build: any) => {
                const line: string = build().build()
                if (line === 'battery') return 80
                if (line === 'AI ver') return 'WW500_C02 10:09:08 Oct  9 2026'
                if (line === 'AI dir') return []
                if (line === 'AI slots') {
                    return { activeSlot: selector, running: labels[running], slotA: labels[0], slotB: labels[1], autoSwitch: false }
                }
                if (line.startsWith('AI firmware ')) {
                    selector = 1 - selector
                    labels[selector] = line.startsWith('AI firmware H') ? 'HM0360 (night/IR)' : 'RP3 (day/colour)'
                }
                if (line === 'AI dpd') running = selector
                return true
            }),
            waitForSleep: jest.fn(async () => true),
            waitForWake: jest.fn(async () => true),
        }))
        ;(ReferenceDataService.getLatestFirmware as jest.Mock).mockResolvedValue(COLOUR)
        ;(ReferenceDataService.getActiveFirmwares as jest.Mock).mockResolvedValue([COLOUR, NIGHT])
        ;(ReferenceDataService.getLatestHimaxByVariant as jest.Mock).mockImplementation(async (v: string) => (v === 'RP3' ? COLOUR : NIGHT))
        ;(runFileTransferPipeline as jest.Mock).mockImplementation((_device: any, options: any) => {
            options.onProgress({ percentage: 40, bytesSent: 200, totalBytes: 500, elapsedMs: 1000, estimatedRemainingMs: 1500, phase: 'transferring' })
            return new Promise(resolve => { finishTransfer = () => resolve({ crc: 0x1234 }) })
        })
    })

    it('names the image each pass of a pair update sends, the one the transfer is given', async () => {
        const { result } = renderHook(() => useFirmwareUpdate({ target: 'himax', device }))
        await act(async () => { await settle() })
        expect(result.current.isPreflightDone).toBe(true)

        let update: Promise<void> = Promise.resolve()
        await act(async () => {
            update = result.current.startUpdate({ himaxSource: 'download' })
            await settle()
        })

        // The camera runs the colour image, so the night image goes first
        expect(runFileTransferPipeline).toHaveBeenLastCalledWith(device, expect.objectContaining({ filename: 'H6A09A55.IMG' }))
        expect(result.current.fileTransferProgress).not.toBeNull()
        expect(result.current.passImage).toEqual({ filename: 'H6A09A55.IMG', locationPath: 'himax/hm0360.img' })

        // Flash, the AI reset's 4 s wait, then the second image
        await act(async () => {
            finishTransfer!()
            await settle()
            jest.advanceTimersByTime(4000)
            await settle()
        })

        expect(runFileTransferPipeline).toHaveBeenLastCalledWith(device, expect.objectContaining({ filename: 'R6A09A56.IMG' }))
        expect(result.current.passImage).toEqual({ filename: 'R6A09A56.IMG', locationPath: 'himax/rp3.img' })

        await act(async () => {
            finishTransfer!()
            await settle()
            jest.advanceTimersByTime(4000)
            await settle()
            await update
        })
        expect(result.current.isComplete).toBe(true)
    })
})
