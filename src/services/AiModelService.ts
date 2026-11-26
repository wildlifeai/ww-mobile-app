import * as FileSystem from 'expo-file-system/legacy'
import { File } from 'expo-file-system'
import * as Crypto from 'expo-crypto'
import database from '../database'
import AiModel from '../database/models/AiModel'
import { getSupabaseClient } from './supabase'
import { isKnownWithoutInternet } from './connectivityWatch'
import { log, logError, logWarn } from '../utils/logger'
import { base64ToUint8Array } from '../utils/binaryUtils'

const AIMODELS_DIR = FileSystem.documentDirectory + 'aimodels/'
/** Tolerance in bytes when comparing file sizes (accounts for minor filesystem differences) */
const FILE_SIZE_TOLERANCE_BYTES = 100
/** The form of `ai_models.file_hash`: the SHA-256 of the file's bytes, in hex. */
const SHA256_HEX = /^[0-9a-f]{64}$/

/**
 * What the row says the model binary is, 0 and null where it does not say.
 * The labels file has neither on the row, and is passed as `null`: any whole
 * copy of it is used.
 */
interface Expected {
    size: number
    sha256: string | null
}

/**
 * - `current`: matches the row's size and hash, or the row has neither and
 *   this app session downloaded the file
 * - `unchecked`: the row has no size and no hash, and the file is from an
 *   earlier session or a backup restore
 * - `wrong`: differs from the row's size or hash
 */
type CacheState = 'absent' | 'current' | 'unchecked' | 'wrong'

class AiModelService {
    private initialized = false
    /** Downloads under way, by local path, so two callers never write the same file at once. */
    private inFlight = new Map<string, Promise<string>>()
    /** The storage path of each file this app session downloaded, by local path. */
    private fetched = new Map<string, string>()

    private async init(): Promise<void> {
        if (this.initialized) return

        const dirInfo = await FileSystem.getInfoAsync(AIMODELS_DIR)
        if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(AIMODELS_DIR, { intermediates: true })
        }
        this.initialized = true
    }

    /**
     * True when every file the model needs (the binary, and the labels when it
     * has any) is already on the phone and would be used without a download:
     * the same check `ensureFilesDownloaded` makes, without the network. A
     * binary the row gives nothing to check against counts only with no
     * connection, or once this session has downloaded it. Used by the offline
     * pre-download and the readiness line on the monitoring screens.
     */
    async isDownloaded(model: AiModel): Promise<boolean> {
        if (!model.modelPath) return false
        await this.init()
        const binary = await this.inspect(AIMODELS_DIR + this.getLocalFilename(model, 'model'), model.modelPath, this.expectedOf(model))
        if (binary.state === 'unchecked' ? !await isKnownWithoutInternet() : binary.state !== 'current') return false
        if (model.labelsPath) {
            const labels = await this.inspect(AIMODELS_DIR + this.getLocalFilename(model, 'labels'), model.labelsPath, null)
            if (labels.state !== 'current') return false
        }
        return true
    }

    /**
     * Checks if both AI model files (.tflite and labels) exist locally.
     * If not, downloads them from Supabase storage.
     * Returns the local URIs to the files.
     */
    async ensureFilesDownloaded(model: AiModel): Promise<{ modelUri: string, labelsUri: string | null }> {
        await this.init()

        if (!model.modelPath) {
            throw new Error(`AI model ${model.id} has no model_path specified`)
        }

        const modelFilename = this.getLocalFilename(model, 'model')
        const labelsFilename = this.getLocalFilename(model, 'labels')

        const localModelUri = AIMODELS_DIR + modelFilename
        const localLabelsUri = AIMODELS_DIR + labelsFilename

        // 1. Download Model Binary
        const downloadedModelUri = await this.downloadFileIfMissing(model.modelPath, localModelUri, this.expectedOf(model))

        // 2. Download Labels Text (if path is provided)
        let downloadedLabelsUri: string | null = null
        if (model.labelsPath) {
            downloadedLabelsUri = await this.downloadFileIfMissing(model.labelsPath, localLabelsUri, null)
        }

        return {
            modelUri: downloadedModelUri,
            labelsUri: downloadedLabelsUri
        }
    }

    /**
     * Helper to check and download a single file from Supabase. A second
     * caller for the same file waits for the first download rather than
     * starting its own: the offline pre-download and a deployment can ask for
     * the same model at the same moment.
     */
    private async downloadFileIfMissing(storagePath: string, localUri: string, expected: Expected | null): Promise<string> {
        const pending = this.inFlight.get(localUri)
        if (pending) {
            log(`Download of ${localUri} already under way, waiting for it`)
            await pending.catch(() => undefined)
        }

        const run = this.downloadFile(storagePath, localUri, expected)
        this.inFlight.set(localUri, run)
        try {
            return await run
        } finally {
            if (this.inFlight.get(localUri) === run) this.inFlight.delete(localUri)
        }
    }

    private async downloadFile(storagePath: string, localUri: string, expected: Expected | null): Promise<string> {
        // The cache name is fixed per row, so a new file at the same
        // `model_path` lands under the old one's name. A copy whose row has no
        // size and no hash is not trusted while a download is possible: on
        // cloud dev in November 2026 phones kept the ZIP that Rat Detection
        // held before 1 October, long after storage served the TFLite (#531),
        // and Android Auto Backup can put an old copy back on a reinstall.
        // A copy that matches the row can still be the wrong file when storage
        // holds the wrong one (#428): `syncAiModel` checks the bytes before any
        // are sent, and a new download would bring the same file.
        const cached = await this.inspect(localUri, storagePath, expected)
        if (cached.state === 'current') {
            log(`✅ File already downloaded (${cached.detail}): ${localUri}`)
            return localUri
        }
        if (cached.state === 'unchecked' && await isKnownWithoutInternet()) {
            log(`No connection, using the copy on this phone (${cached.detail}): ${localUri}`)
            return localUri
        }
        if (cached.state === 'wrong') {
            log(`⚠️ The copy on this phone is not the model's file (${cached.detail}). Redownloading...`)
            await FileSystem.deleteAsync(localUri, { idempotent: true })
            this.fetched.delete(localUri)
        }

        try {
            return await this.download(storagePath, localUri, expected)
        } catch (error) {
            // Nothing says this copy is wrong, and without a download it is the only one
            if (cached.state === 'unchecked' && (await FileSystem.getInfoAsync(localUri)).exists) {
                logWarn(`Download failed, using the copy on this phone (${cached.detail}): ${localUri}`)
                return localUri
            }
            throw error
        }
    }

    private async download(storagePath: string, localUri: string, expected: Expected | null): Promise<string> {
        log(`Downloading file from Supabase: ${storagePath}`)
        const supabase = await getSupabaseClient()

        // Written beside the final name and moved into place once complete, so
        // a file under the final name is always a whole one. The labels file
        // has no size to check it against, and a download cut off by the app
        // being closed would otherwise be taken for the real thing next time.
        const partialUri = `${localUri}.part`
        try {
            const { data, error } = await supabase.storage
                .from('ai-models')
                .createSignedUrl(storagePath, 60) // 60 seconds validity

            if (error || !data?.signedUrl) {
                throw new Error(`Could not get signed URL: ${error?.message}`)
            }

            await FileSystem.deleteAsync(partialUri, { idempotent: true })
            const downloadResumable = FileSystem.createDownloadResumable(data.signedUrl, partialUri, {})
            const result = await downloadResumable.downloadAsync()

            if (!result || !result.uri) {
                throw new Error('Download failed to return a URI')
            }
            // An error page is a completed download too: without these checks
            // a 400 from storage became the model file
            if (result.status && (result.status < 200 || result.status >= 300)) {
                throw new Error(`Download failed with HTTP ${result.status}`)
            }
            const got = await this.inspect(result.uri, storagePath, expected)
            if (got.state === 'absent' || got.state === 'wrong') {
                throw new Error(`Downloaded file is not the model's file (${got.detail})`)
            }

            await FileSystem.deleteAsync(localUri, { idempotent: true })
            await FileSystem.moveAsync({ from: result.uri, to: localUri })
            this.fetched.set(localUri, storagePath)
            log(`✅ File downloaded successfully: ${localUri}`)
            return localUri
        } catch (error) {
            // A warning, not an error: offline this is expected, and the caller
            // decides how loud it is (a deployment stops, the pre-download retries
            // after the next sync).
            logWarn('File download failed:', error)
            try {
                await FileSystem.deleteAsync(partialUri, { idempotent: true })
            } catch (cleanupError) {
                logError('❌ Failed to cleanup partial file:', cleanupError)
            }
            throw error
        }
    }

    /**
     * Whether the file at `uri` is the one the row describes, with what was
     * found, for the log. The size is compared first, so a file of the wrong
     * size is never read.
     */
    private async inspect(uri: string, storagePath: string, expected: Expected | null): Promise<{ state: CacheState, detail: string }> {
        const info = await FileSystem.getInfoAsync(uri)
        if (!info.exists) return { state: 'absent', detail: 'no file' }
        const size = info.size || 0
        if (!expected) return { state: 'current', detail: `${size} bytes` }
        if (expected.size > 0 && Math.abs(size - expected.size) > FILE_SIZE_TOLERANCE_BYTES) {
            return { state: 'wrong', detail: `${size} bytes, the row says ${expected.size}` }
        }
        if (expected.sha256) {
            const actual = await this.sha256Of(uri)
            return actual === expected.sha256
                ? { state: 'current', detail: `${size} bytes, SHA-256 as the row says` }
                : { state: 'wrong', detail: `SHA-256 ${actual ?? 'unreadable'}, the row says ${expected.sha256}` }
        }
        if (expected.size > 0) return { state: 'current', detail: `${size} bytes, the size expected` }
        if (this.fetched.get(uri) === storagePath) return { state: 'current', detail: `${size} bytes, downloaded this session` }
        return { state: 'unchecked', detail: `${size} bytes, and the row has no size or hash to check it against` }
    }

    /**
     * The file's SHA-256 in lowercase hex, or null when it cannot be read. The
     * bytes come from the native side rather than through base64, which for a
     * 2 MB model would cost the JS thread far more than the hash: in Node on
     * 27 November 2026, 78 ms to decode with a JIT and about 1 s without one,
     * against 2 ms for the SHA-256.
     */
    private async sha256Of(uri: string): Promise<string | null> {
        try {
            const bytes = await new File(uri).bytes()
            const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes)
            return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
        } catch (e) {
            logWarn(`Could not read ${uri} to check its hash:`, e)
            return null
        }
    }

    /**
     * The binary's size and hash from the row. A hash that is not hex SHA-256
     * is set aside with a warning, so a value in another form cannot fail every
     * download of the model.
     */
    private expectedOf(model: AiModel): Expected {
        const hash = model.fileHash?.trim().toLowerCase() || null
        const valid = !!hash && SHA256_HEX.test(hash)
        if (hash && !valid) logWarn(`AI model "${model.name}" has a file_hash that is not a hex SHA-256, not checked: ${hash}`)
        return { size: model.fileSizeBytes || 0, sha256: valid ? hash : null }
    }

    /**
     * Reads a downloaded AI model file as raw bytes for BLE file transfer.
     */
    async readModelAsBytes(localUri: string): Promise<Uint8Array> {
        const base64 = await FileSystem.readAsStringAsync(localUri, {
            encoding: FileSystem.EncodingType.Base64,
        })
        return base64ToUint8Array(base64)
    }

    /**
     * Deletes a local AI model file
     */
    async deleteLocalModel(model: AiModel): Promise<void> {
        await this.init()
        const modelFilename = this.getLocalFilename(model, 'model')
        const labelsFilename = this.getLocalFilename(model, 'labels')
        for (const uri of [AIMODELS_DIR + modelFilename, AIMODELS_DIR + labelsFilename]) {
            await FileSystem.deleteAsync(uri, { idempotent: true })
            this.fetched.delete(uri)
        }
    }

    /**
     * Gets an AI model by its database ID
     */
    async getModelById(modelId: string): Promise<AiModel | null> {
        try {
            const model = await database.get<AiModel>('ai_models').find(modelId)
            return model
        } catch (error) {
            logWarn(`Failed to find AiModel with ID ${modelId}:`, error)
            return null
        }
    }

    /**
     * Extracts the file extensions for the given model from its path properties.
     */
    getModelFileExtensions(model: { modelPath?: string | null, labelsPath?: string | null }): { modelExt: string, labelsExt: string } {
        const getExt = (path: string | null | undefined, fallback: string) => {
            if (!path || !path.includes('.')) return fallback
            return path.split('.').pop() || fallback
        }
        return {
            modelExt: getExt(model.modelPath, 'tflite'),
            labelsExt: getExt(model.labelsPath, 'txt')
        }
    }

    private getLocalFilename(model: AiModel, type: 'model' | 'labels'): string {
        // Use serverId for local caching — firmware filenames ({familyId}V{ver}.[ext])
        // are constructed in the transfer hook via ReferenceDataService.getFirmwareIds()
        const cacheKey = model.serverId || model.id
        const { modelExt, labelsExt } = this.getModelFileExtensions(model)

        if (type === 'model') {
            return `model_${cacheKey}.${modelExt}`
        } else {
            return `labels_${cacheKey}.${labelsExt}`
        }
    }
}

export default new AiModelService()
