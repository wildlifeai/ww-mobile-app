import * as FileSystem from 'expo-file-system/legacy'
import FirmwareService from '../FirmwareService'
import { getSupabaseClient } from '../supabase'

jest.mock('../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))
// '../supabase', 'expo-file-system/legacy' and AsyncStorage are mocked globally

const fs = FileSystem as jest.Mocked<typeof FileSystem>

const RP3 = {
    id: 'fw-rp3',
    type: 'himax',
    version: 'WW500_C02 10:59:43 Sep 28 2026',
    cameraVariant: 'RP3',
    locationPath: 'himax/RP3_WW500_C02_10_59_43_Sep_28_2026_output.img',
    fileSizeBytes: 450560,
} as any
const CACHED = 'himax_WW500_C02_10_59_43_Sep_28_2026_RP3_WW500_C02_10_59_43_Sep_28_2026_output.img'

/**
 * The offline pre-download (#333) fills the cache `useFirmwareUpdate` reads, so
 * it has to use the same name and the same size check, and it must never
 * delete a file an update is using.
 */
describe('FirmwareService cache', () => {
    beforeEach(() => {
        jest.resetAllMocks()
        fs.makeDirectoryAsync.mockResolvedValue(undefined as any)
        fs.deleteAsync.mockResolvedValue(undefined as any)
    })

    it('names the image as the update expects and checks it by size', async () => {
        expect(FirmwareService.getLocalFilename(RP3)).toBe(CACHED)

        fs.getInfoAsync.mockResolvedValue({ exists: true, isDirectory: false, size: 450560, uri: CACHED } as any)
        await expect(FirmwareService.isFirmwareDownloaded(RP3)).resolves.toBe(true)

        fs.getInfoAsync.mockResolvedValue({ exists: true, isDirectory: false, size: 12000, uri: CACHED } as any)
        await expect(FirmwareService.isFirmwareDownloaded(RP3)).resolves.toBe(false)
    })

    it('deletes nothing while an update holds the cache', async () => {
        const release = FirmwareService.holdCache()
        await expect(FirmwareService.deleteCachedFile('ble_old.zip')).resolves.toBe(false)
        expect(fs.deleteAsync).not.toHaveBeenCalled()

        release()
        release()
        expect(FirmwareService.isCacheHeld()).toBe(false)
        await expect(FirmwareService.deleteCachedFile('ble_old.zip')).resolves.toBe(true)
        expect(fs.deleteAsync).toHaveBeenCalledWith(expect.stringMatching(/firmware\/ble_old\.zip$/), { idempotent: true })
    })

    it('lets an update wait for the pre-download of the same image instead of writing it twice', async () => {
        let onPhone = false
        fs.getInfoAsync.mockImplementation(async (uri: string) => ({
            exists: onPhone || !uri.endsWith('.img'), isDirectory: false, size: 450560, uri,
        }) as any)
        const createSignedUrl = jest.fn(async () => ({ data: { signedUrl: 'https://storage/signed' }, error: null }))
        ;(getSupabaseClient as jest.Mock).mockReturnValue({ storage: { from: () => ({ createSignedUrl }) } })
        const gate: { finish?: () => void } = {}
        fs.createDownloadResumable.mockImplementation(((_url: string, uri: string) => ({
            downloadAsync: () => new Promise(resolve => {
                gate.finish = () => { onPhone = true; resolve({ uri, status: 200 }) }
            }),
            pauseAsync: jest.fn(),
        })) as any)

        const prefetch = FirmwareService.ensureFirmwareDownloaded(RP3)
        const states: string[] = []
        const update = FirmwareService.ensureFirmwareDownloaded(RP3, { onStateChange: s => states.push(s) })
        for (let i = 0; i < 100 && !gate.finish; i++) await Promise.resolve()
        gate.finish?.()
        jest.useRealTimers()
        await Promise.all([prefetch, update])
        jest.useFakeTimers()

        expect(fs.createDownloadResumable).toHaveBeenCalledTimes(1)
        expect(states).toEqual(['downloading', 'completed'])
    })
})
