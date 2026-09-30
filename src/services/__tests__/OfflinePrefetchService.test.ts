import AsyncStorage from '@react-native-async-storage/async-storage'
import NetInfo from '@react-native-community/netinfo'
import OfflinePrefetchService, { firmwareFilesToRemove, SYNC_MODE_KEY } from '../OfflinePrefetchService'
import AiModelService from '../AiModelService'
import FirmwareService from '../FirmwareService'
import ReferenceDataService from '../ReferenceDataService'
import database from '../../database'

jest.mock('../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))
jest.mock('../../database', () => ({ __esModule: true, default: { get: jest.fn() } }))
jest.mock('../AiModelService', () => ({
    __esModule: true,
    default: { isDownloaded: jest.fn(), ensureFilesDownloaded: jest.fn() },
}))
jest.mock('../FirmwareService', () => ({
    __esModule: true,
    default: {
        isCacheHeld: jest.fn(),
        getLocalFilename: jest.fn(),
        isFirmwareDownloaded: jest.fn(),
        ensureFirmwareDownloaded: jest.fn(),
        listCachedFiles: jest.fn(),
        deleteCachedFile: jest.fn(),
    },
}))
jest.mock('../ReferenceDataService', () => ({
    __esModule: true,
    default: { getFirmwareIds: jest.fn(), getLatestFirmware: jest.fn(), getLatestHimaxByVariant: jest.fn() },
}))

const models = AiModelService as jest.Mocked<typeof AiModelService>
const firmware = FirmwareService as jest.Mocked<typeof FirmwareService>
const refData = ReferenceDataService as jest.Mocked<typeof ReferenceDataService>

/** The same naming as FirmwareService.getLocalFilename. */
const cacheName = (fw: any) => `${fw.type}_${fw.version}_${fw.locationPath.split('/').pop()}`
const fw = (type: string, version: string, variant: string | null) => ({
    id: `${type}-${variant ?? 'none'}-${version}`,
    type,
    version,
    cameraVariant: variant,
    locationPath: `${type}/${variant ? `${variant}_` : ''}${version}_output.img`,
})

const BLE = fw('ble', '0.30.50', null)
const RP3 = fw('himax', 'B2', 'RP3')
const HM0360 = fw('himax', 'B2', 'HM0360')
const OLD_BLE = cacheName(fw('ble', '0.30.40', null))
const OLD_RP3 = cacheName(fw('himax', 'B1', 'RP3'))
const OLD_HM0360 = cacheName(fw('himax', 'B1', 'HM0360'))

const WIFI = { type: 'wifi', isConnected: true, isInternetReachable: true, details: { isConnectionExpensive: false } }
const givenConnection = (state: object) => (NetInfo.fetch as jest.Mock).mockResolvedValue(state)
const givenSyncMode = (mode: string | null) =>
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) => (key === SYNC_MODE_KEY ? mode : null))

/** Projects on the phone and the ai_models rows, as WatermelonDB would return them. */
function givenTables(projects: Array<{ modelId: string | null }>, aiModels: any[]) {
    ;(database.get as jest.Mock).mockImplementation((table: string) => ({
        query: () => ({ fetch: async () => (table === 'projects' ? projects : aiModels) }),
    }))
}

describe('OfflinePrefetchService', () => {
    const RAT = { id: 'model-rat', name: 'Rat Detection', version: 'v1', modelPath: 'o/rat.tfl' }
    const SKINK = { id: 'model-skink', name: 'Skink', version: 'v2', modelPath: 'o/skink.tfl' }

    beforeEach(() => {
        jest.resetAllMocks()
        givenConnection(WIFI)
        givenSyncMode(null)

        givenTables([{ modelId: RAT.id }, { modelId: SKINK.id }, { modelId: RAT.id }], [RAT, SKINK])
        refData.getFirmwareIds.mockResolvedValue({ firmwareModelId: 7, versionNumber: 1 })
        models.isDownloaded.mockResolvedValue(false)
        models.ensureFilesDownloaded.mockResolvedValue({ modelUri: 'm', labelsUri: 'l' })

        refData.getLatestFirmware.mockImplementation(async (type: string) => (type === 'ble' ? BLE : RP3) as any)
        refData.getLatestHimaxByVariant.mockImplementation(async (v: string) => (v === 'RP3' ? RP3 : HM0360) as any)
        firmware.isCacheHeld.mockReturnValue(false)
        firmware.getLocalFilename.mockImplementation(cacheName as any)
        firmware.isFirmwareDownloaded.mockResolvedValue(false)
        firmware.ensureFirmwareDownloaded.mockResolvedValue('uri')
        firmware.listCachedFiles.mockResolvedValue([])
        firmware.deleteCachedFile.mockResolvedValue(true)
    })

    it('does nothing at all offline', async () => {
        givenConnection({ type: 'none', isConnected: false, isInternetReachable: false, details: null })

        const summary = await OfflinePrefetchService.runOnce('test')

        expect(summary.connection).toBe('offline')
        expect(database.get).not.toHaveBeenCalled()
        expect(models.ensureFilesDownloaded).not.toHaveBeenCalled()
        expect(firmware.ensureFirmwareDownloaded).not.toHaveBeenCalled()
        expect(firmware.deleteCachedFile).not.toHaveBeenCalled()
    })

    it('downloads each project model once, and not the ones already on the phone', async () => {
        models.isDownloaded.mockImplementation(async (m: any) => m.id === RAT.id)

        const summary = await OfflinePrefetchService.runOnce('test')

        expect(models.ensureFilesDownloaded).toHaveBeenCalledTimes(1)
        expect(models.ensureFilesDownloaded).toHaveBeenCalledWith(SKINK)
        expect(summary.models).toEqual({ downloaded: 1, cached: 1, failed: 0, skipped: 0 })
    })

    it('skips a model the phone cannot resolve or load, as the deployment would refuse it', async () => {
        givenTables([{ modelId: RAT.id }, { modelId: 'model-gone' }, { modelId: SKINK.id }], [RAT, SKINK])
        refData.getFirmwareIds.mockImplementation(async (m: any) => {
            if (m.id === SKINK.id) throw new Error('no version_number')
            return { firmwareModelId: 7, versionNumber: 1 }
        })

        const summary = await OfflinePrefetchService.runOnce('test')

        expect(models.ensureFilesDownloaded).toHaveBeenCalledTimes(1)
        expect(models.ensureFilesDownloaded).toHaveBeenCalledWith(RAT)
        expect(summary.models.skipped).toBe(2)
    })

    it('keeps going quietly past a model that fails to download', async () => {
        models.ensureFilesDownloaded.mockRejectedValueOnce(new Error('Network request failed'))

        const summary = await OfflinePrefetchService.runOnce('test')

        expect(models.ensureFilesDownloaded).toHaveBeenCalledTimes(2)
        expect(summary.models).toEqual({ downloaded: 1, cached: 0, failed: 1, skipped: 0 })
        expect(firmware.ensureFirmwareDownloaded).toHaveBeenCalled()
    })

    it('fetches the latest BLE image and one Himax image per camera variant, then removes the older ones', async () => {
        firmware.listCachedFiles.mockResolvedValue([OLD_BLE, OLD_RP3, OLD_HM0360, cacheName(RP3)])
        firmware.isFirmwareDownloaded.mockImplementation(async (f: any) => f === RP3)

        const summary = await OfflinePrefetchService.runOnce('test')

        // RP3 is already here, so only BLE and HM0360 are fetched
        expect(firmware.ensureFirmwareDownloaded.mock.calls.map(([f]) => f)).toEqual([BLE, HM0360])
        expect(firmware.deleteCachedFile.mock.calls.map(([f]) => f).sort()).toEqual([OLD_BLE, OLD_HM0360, OLD_RP3].sort())
        expect(summary.firmware).toEqual({ downloaded: 2, cached: 1, failed: 0, skipped: 0 })
    })

    it('keeps the older image of a variant whose new image did not arrive', async () => {
        firmware.listCachedFiles.mockResolvedValue([OLD_RP3, OLD_HM0360])
        firmware.ensureFirmwareDownloaded.mockImplementation(async (f: any) => {
            if (f === HM0360) throw new Error('Network request failed')
            return 'uri'
        })

        await OfflinePrefetchService.runOnce('test')

        expect(firmware.deleteCachedFile).toHaveBeenCalledWith(OLD_RP3)
        expect(firmware.deleteCachedFile).not.toHaveBeenCalledWith(OLD_HM0360)
    })

    it('neither fetches nor removes firmware while an update holds the cache', async () => {
        firmware.isCacheHeld.mockReturnValue(true)
        firmware.listCachedFiles.mockResolvedValue([OLD_BLE])

        await OfflinePrefetchService.runOnce('test')

        expect(firmware.ensureFirmwareDownloaded).not.toHaveBeenCalled()
        expect(firmware.deleteCachedFile).not.toHaveBeenCalled()
        // Models are unaffected by a firmware update
        expect(models.ensureFilesDownloaded).toHaveBeenCalled()
    })

    it('uses mobile data by default, and not when Settings asks for Wi-Fi only', async () => {
        givenConnection({ type: 'cellular', isConnected: true, isInternetReachable: true, details: { isConnectionExpensive: true } })
        await OfflinePrefetchService.runOnce('test')
        expect(models.ensureFilesDownloaded).toHaveBeenCalled()

        jest.clearAllMocks()
        givenSyncMode('wifi')
        const summary = await OfflinePrefetchService.runOnce('test')

        expect(summary.connection).toBe('metered')
        expect(models.ensureFilesDownloaded).not.toHaveBeenCalled()
        expect(firmware.ensureFirmwareDownloaded).not.toHaveBeenCalled()
    })

    it('runs one pass at a time and goes round once more for a request made during it', async () => {
        const gate: { release?: () => void } = {}
        models.ensureFilesDownloaded.mockImplementationOnce(() => new Promise(resolve => {
            gate.release = () => resolve({ modelUri: 'm', labelsUri: 'l' })
        }))
        const runOnce = jest.spyOn(OfflinePrefetchService, 'runOnce')

        OfflinePrefetchService.request('sync')
        // Until the first pass is waiting on its first download
        for (let i = 0; i < 100 && !gate.release; i++) await Promise.resolve()
        OfflinePrefetchService.request('reference data')
        OfflinePrefetchService.request('sync')
        gate.release?.()
        await OfflinePrefetchService.whenIdle()

        expect(runOnce.mock.calls.map(([reason]) => reason)).toEqual(['sync', 'sync'])
    })
})

describe('firmwareFilesToRemove', () => {
    const targets = [
        { filename: 'ble_0.30.50_0.30.50_app.zip', type: 'ble', variant: null },
        { filename: 'himax_B2_RP3_B2_output.img', type: 'himax', variant: 'RP3' },
        { filename: 'himax_B2_HM0360_B2_output.img', type: 'himax', variant: 'HM0360' },
    ]
    const all = new Set(targets.map(t => t.filename))

    it('never removes a target, or a file of a type it does not manage', () => {
        const files = [...all, 'config_1_CONFIG.TXT', 'notes.txt']
        expect(firmwareFilesToRemove(files, targets, all)).toEqual([])
    })

    it('removes an older image of a variant once the new one is complete', () => {
        const complete = new Set(['himax_B2_RP3_B2_output.img'])
        expect(firmwareFilesToRemove(['himax_B1_RP3_B1_output.img', 'himax_B1_HM0360_B1_output.img'], targets, complete))
            .toEqual(['himax_B1_RP3_B1_output.img'])
    })

    it('keeps a Himax image of unknown variant until both new images are complete', () => {
        const legacy = 'himax_A9_A9_output.img'
        expect(firmwareFilesToRemove([legacy], targets, new Set(['himax_B2_RP3_B2_output.img']))).toEqual([])
        expect(firmwareFilesToRemove([legacy], targets, all)).toEqual([legacy])
    })
})
