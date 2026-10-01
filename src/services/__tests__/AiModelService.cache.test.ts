import * as FileSystem from 'expo-file-system/legacy'
import AiModelService from '../AiModelService'
import { getSupabaseClient } from '../supabase'

jest.mock('../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))
// '../supabase' and 'expo-file-system/legacy' are mocked globally

const fs = FileSystem as jest.Mocked<typeof FileSystem>

const MODEL = {
    id: 'model-rat',
    serverId: 'model-rat',
    name: 'Rat Detection',
    modelPath: 'org/rat.tfl',
    labelsPath: 'org/rat.txt',
    fileSizeBytes: 72980,
} as any

/** Files on the phone, by name, with their sizes. */
function givenFiles(files: Record<string, number>) {
    fs.getInfoAsync.mockImplementation(async (uri: string) => {
        const name = Object.keys(files).find(f => uri.endsWith(f))
        return (name ? { exists: true, isDirectory: false, size: files[name], uri } : { exists: false, isDirectory: false, uri }) as any
    })
}

/**
 * The offline pre-download (#333) decides what to fetch with `isDownloaded`,
 * and the deployment then reads the same cache through `ensureFilesDownloaded`.
 * The two must agree, or a model the pre-download thought was here would be
 * downloaded again in the field, which is exactly what cannot happen there.
 */
describe('AiModelService cache', () => {
    let createSignedUrl: jest.Mock

    beforeEach(() => {
        jest.resetAllMocks()
        createSignedUrl = jest.fn(async () => ({ data: { signedUrl: 'https://storage/signed' }, error: null }))
        ;(getSupabaseClient as jest.Mock).mockReturnValue({ storage: { from: () => ({ createSignedUrl }) } })
        fs.makeDirectoryAsync.mockResolvedValue(undefined as any)
        fs.deleteAsync.mockResolvedValue(undefined as any)
        fs.moveAsync.mockResolvedValue(undefined as any)
    })

    it('counts a model as on the phone only with both files, the binary at its size', async () => {
        givenFiles({ 'model_model-rat.tfl': 72980, 'labels_model-rat.txt': 12 })
        await expect(AiModelService.isDownloaded(MODEL)).resolves.toBe(true)

        givenFiles({ 'model_model-rat.tfl': 72980 })
        await expect(AiModelService.isDownloaded(MODEL)).resolves.toBe(false)

        givenFiles({ 'model_model-rat.tfl': 4096, 'labels_model-rat.txt': 12 })
        await expect(AiModelService.isDownloaded(MODEL)).resolves.toBe(false)
    })

    it('uses the files on the phone without asking storage for anything', async () => {
        givenFiles({ 'model_model-rat.tfl': 72980, 'labels_model-rat.txt': 12 })

        const files = await AiModelService.ensureFilesDownloaded(MODEL)

        expect(createSignedUrl).not.toHaveBeenCalled()
        expect(files.modelUri).toMatch(/model_model-rat\.tfl$/)
        expect(files.labelsUri).toMatch(/labels_model-rat\.txt$/)
    })

    it('downloads beside the final name and moves the file into place once complete', async () => {
        givenFiles({})
        fs.createDownloadResumable.mockImplementation(((_url: string, uri: string) => ({
            downloadAsync: async () => {
                givenFiles({ [uri.split('/').pop()!]: uri.includes('model_') ? 72980 : 12 })
                return { uri, status: 200 }
            },
        })) as any)

        await AiModelService.ensureFilesDownloaded(MODEL)

        const targets = fs.createDownloadResumable.mock.calls.map(([, uri]) => uri)
        expect(targets.every(uri => uri.endsWith('.part'))).toBe(true)
        expect(fs.moveAsync.mock.calls.map(([m]) => m.to)).toEqual(targets.map(uri => uri.replace(/\.part$/, '')))
    })

    it('does not keep an error page as the model', async () => {
        givenFiles({})
        fs.createDownloadResumable.mockImplementation(((_url: string, uri: string) => ({
            downloadAsync: async () => ({ uri, status: 400 }),
        })) as any)

        await expect(AiModelService.ensureFilesDownloaded(MODEL)).rejects.toThrow('HTTP 400')
        expect(fs.moveAsync).not.toHaveBeenCalled()
    })

    it('downloads a file once when two callers ask for it at the same moment', async () => {
        givenFiles({})
        const gate: { finish?: () => void } = {}
        fs.createDownloadResumable.mockImplementation(((_url: string, uri: string) => ({
            downloadAsync: () => new Promise(resolve => {
                gate.finish = () => {
                    givenFiles({ 'model_model-rat.tfl.part': 72980, 'model_model-rat.tfl': 72980 })
                    resolve({ uri, status: 200 })
                }
            }),
        })) as any)

        const first = AiModelService.ensureFilesDownloaded({ ...MODEL, labelsPath: undefined })
        const second = AiModelService.ensureFilesDownloaded({ ...MODEL, labelsPath: undefined })
        for (let i = 0; i < 100 && !gate.finish; i++) await Promise.resolve()
        gate.finish?.()
        await Promise.all([first, second])

        expect(fs.createDownloadResumable).toHaveBeenCalledTimes(1)
    })
})
