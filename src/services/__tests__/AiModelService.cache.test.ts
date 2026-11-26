import * as FileSystem from 'expo-file-system/legacy'
import NetInfo from '@react-native-community/netinfo'
import { createHash } from 'crypto'
import AiModelService from '../AiModelService'
import { getSupabaseClient } from '../supabase'

jest.mock('../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))
// '../supabase', 'expo-file-system/legacy' and NetInfo are mocked globally

/** The phone's files by name, for the tests that need their bytes. */
const mockPhone = new Map<string, Uint8Array>()
jest.mock('expo-file-system', () => ({
    File: class {
        mockUri: string
        constructor(mockUri: string) {
            this.mockUri = mockUri
        }
        async bytes() {
            const bytes = mockPhone.get(this.mockUri.split('/').pop()!)
            if (!bytes) throw new Error(`No file ${this.mockUri}`)
            return bytes
        }
    },
}))
// Plain functions, so the resetAllMocks below leaves them working
jest.mock('expo-crypto', () => ({
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    digest: async (_algorithm: string, data: Uint8Array) => {
        const hash = jest.requireActual<typeof import('crypto')>('crypto').createHash('sha256').update(data).digest()
        return hash.buffer.slice(hash.byteOffset, hash.byteOffset + hash.byteLength)
    },
}))

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

    /**
     * #531: the cache name is fixed per row, so a new file at the same
     * `model_path` lands under the old one's name. On cloud dev the Rat
     * Detection row had no size, and phones kept the ZIP it held before
     * 1 October. The two files here are the same size on purpose: only the
     * hash tells them apart.
     */
    describe('size and hash', () => {
        const OLD = new Uint8Array(72752).fill(1)
        const NEW = new Uint8Array(72752).fill(2)
        const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
        const ONLINE = { type: 'wifi', isConnected: true, isInternetReachable: true }
        const NO_SIGNED_URL = { data: null, error: { message: 'Network request failed' } }

        /** A row per test: the service remembers this session's downloads by file name. */
        const row = (id: string, fields: object) =>
            ({ id, serverId: id, name: 'Rat Detection', modelPath: 'org/rat.tfl', fileSizeBytes: 0, ...fields }) as any

        /** The phone's files, and a storage that serves `served` at every path. */
        function given(files: Record<string, Uint8Array>, served: Uint8Array) {
            mockPhone.clear()
            for (const [name, bytes] of Object.entries(files)) mockPhone.set(name, bytes)
            const nameOf = (uri: string) => uri.split('/').pop()!
            fs.getInfoAsync.mockImplementation(async (uri: string) => {
                const bytes = mockPhone.get(nameOf(uri))
                return (bytes ? { exists: true, isDirectory: false, size: bytes.length, uri } : { exists: false, isDirectory: false, uri }) as any
            })
            fs.deleteAsync.mockImplementation(async (uri: string) => { mockPhone.delete(nameOf(uri)) })
            fs.moveAsync.mockImplementation(async ({ from, to }: { from: string, to: string }) => {
                mockPhone.set(nameOf(to), mockPhone.get(nameOf(from))!)
                mockPhone.delete(nameOf(from))
            })
            fs.createDownloadResumable.mockImplementation(((_url: string, uri: string) => ({
                downloadAsync: async () => {
                    mockPhone.set(nameOf(uri), served)
                    return { uri, status: 200 }
                },
            })) as any)
        }
        const givenConnection = (state: object) => (NetInfo.fetch as jest.Mock).mockResolvedValue(state)

        beforeEach(() => givenConnection(ONLINE))

        it('replaces a cached model whose hash differs from the row', async () => {
            const model = row('hash-differs', { fileSizeBytes: NEW.length, fileHash: sha256(NEW) })
            given({ 'model_hash-differs.tfl': OLD }, NEW)
            await expect(AiModelService.isDownloaded(model)).resolves.toBe(false)

            await AiModelService.ensureFilesDownloaded(model)

            expect(createSignedUrl).toHaveBeenCalledTimes(1)
            expect(mockPhone.get('model_hash-differs.tfl')).toBe(NEW)
            await expect(AiModelService.isDownloaded(model)).resolves.toBe(true)
        })

        it('keeps a cached model whose hash matches, without asking storage', async () => {
            const model = row('hash-matches', { fileHash: sha256(NEW).toUpperCase() })
            given({ 'model_hash-matches.tfl': NEW }, OLD)

            await expect(AiModelService.isDownloaded(model)).resolves.toBe(true)
            await AiModelService.ensureFilesDownloaded(model)

            expect(createSignedUrl).not.toHaveBeenCalled()
            expect(mockPhone.get('model_hash-matches.tfl')).toBe(NEW)
        })

        it('does not keep a download whose hash differs from the row', async () => {
            const model = row('download-differs', { fileHash: sha256(NEW) })
            given({}, OLD)

            await expect(AiModelService.ensureFilesDownloaded(model)).rejects.toThrow("not the model's file")
            expect(mockPhone.has('model_download-differs.tfl')).toBe(false)
        })

        it('does not use a copy the hash proves wrong, even offline', async () => {
            const model = row('wrong-offline', { fileHash: sha256(NEW) })
            given({ 'model_wrong-offline.tfl': OLD }, NEW)
            givenConnection({ type: 'none', isConnected: false, isInternetReachable: false })
            createSignedUrl.mockResolvedValue(NO_SIGNED_URL)

            await expect(AiModelService.isDownloaded(model)).resolves.toBe(false)
            await expect(AiModelService.ensureFilesDownloaded(model)).rejects.toThrow('signed URL')
        })

        it('downloads a model with no size and no hash again when online, once a session', async () => {
            const model = row('no-size-online', {})
            given({ 'model_no-size-online.tfl': OLD }, NEW)
            await expect(AiModelService.isDownloaded(model)).resolves.toBe(false)

            await AiModelService.ensureFilesDownloaded(model)
            expect(mockPhone.get('model_no-size-online.tfl')).toBe(NEW)
            await expect(AiModelService.isDownloaded(model)).resolves.toBe(true)

            await AiModelService.ensureFilesDownloaded(model)
            expect(createSignedUrl).toHaveBeenCalledTimes(1)
        })

        it.each([
            ['no connection', 'none', { type: 'none', isConnected: false, isInternetReachable: false }],
            ['a connection that reaches nothing', 'unreachable', { type: 'wifi', isConnected: true, isInternetReachable: false }],
        ])('uses a model with no size and no hash as it is with %s', async (_what, id, state) => {
            const model = row(`no-size-${id}`, {})
            const name = `model_no-size-${id}.tfl`
            given({ [name]: OLD }, NEW)
            givenConnection(state)

            await expect(AiModelService.isDownloaded(model)).resolves.toBe(true)
            const files = await AiModelService.ensureFilesDownloaded(model)

            expect(createSignedUrl).not.toHaveBeenCalled()
            expect(files.modelUri.endsWith(name)).toBe(true)
            expect(mockPhone.get(name)).toBe(OLD)
        })

        it('falls back to a copy with no size and no hash when the download fails', async () => {
            const model = row('no-size-fails', {})
            given({ 'model_no-size-fails.tfl': OLD }, NEW)
            createSignedUrl.mockResolvedValue(NO_SIGNED_URL)

            const files = await AiModelService.ensureFilesDownloaded(model)

            expect(files.modelUri.endsWith('model_no-size-fails.tfl')).toBe(true)
            expect(mockPhone.get('model_no-size-fails.tfl')).toBe(OLD)
        })
    })
})
