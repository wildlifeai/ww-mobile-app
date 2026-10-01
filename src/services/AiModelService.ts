import * as FileSystem from 'expo-file-system/legacy'
import database from '../database'
import AiModel from '../database/models/AiModel'
import { getSupabaseClient } from './supabase'
import { log, logError, logWarn } from '../utils/logger'
import { base64ToUint8Array } from '../utils/binaryUtils'

const AIMODELS_DIR = FileSystem.documentDirectory + 'aimodels/'
/** Tolerance in bytes when comparing file sizes (accounts for minor filesystem differences) */
const FILE_SIZE_TOLERANCE_BYTES = 100

class AiModelService {
    private initialized = false
    /** Downloads under way, by local path, so two callers never write the same file at once. */
    private inFlight = new Map<string, Promise<string>>()

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
     * the same check `ensureFilesDownloaded` makes, without the network. Used by
     * the offline pre-download and the readiness line on the monitoring screens.
     */
    async isDownloaded(model: AiModel): Promise<boolean> {
        if (!model.modelPath) return false
        await this.init()
        if (!await this.isCached(AIMODELS_DIR + this.getLocalFilename(model, 'model'), model.fileSizeBytes || 0)) return false
        if (model.labelsPath && !await this.isCached(AIMODELS_DIR + this.getLocalFilename(model, 'labels'), 0)) return false
        return true
    }

    private async isCached(localUri: string, expectedSize: number): Promise<boolean> {
        const fileInfo = await FileSystem.getInfoAsync(localUri)
        if (!fileInfo.exists) return false
        const actualSize = fileInfo.size || 0
        return expectedSize === 0 || Math.abs(actualSize - expectedSize) <= FILE_SIZE_TOLERANCE_BYTES
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
        const downloadedModelUri = await this.downloadFileIfMissing(model.modelPath, localModelUri, model.fileSizeBytes || 0)

        // 2. Download Labels Text (if path is provided)
        let downloadedLabelsUri: string | null = null
        if (model.labelsPath) {
            downloadedLabelsUri = await this.downloadFileIfMissing(model.labelsPath, localLabelsUri, 0) // No size check for labels
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
    private async downloadFileIfMissing(storagePath: string, localUri: string, expectedSize: number): Promise<string> {
        const pending = this.inFlight.get(localUri)
        if (pending) {
            log(`Download of ${localUri} already under way, waiting for it`)
            await pending.catch(() => undefined)
        }

        const run = this.downloadFile(storagePath, localUri, expectedSize)
        this.inFlight.set(localUri, run)
        try {
            return await run
        } finally {
            if (this.inFlight.get(localUri) === run) this.inFlight.delete(localUri)
        }
    }

    private async downloadFile(storagePath: string, localUri: string, expectedSize: number): Promise<string> {
        const fileInfo = await FileSystem.getInfoAsync(localUri)

        if (fileInfo.exists) {
            const actualSize = fileInfo.size || 0
            const sizeDiff = Math.abs(actualSize - expectedSize)

            if (expectedSize === 0 || sizeDiff <= FILE_SIZE_TOLERANCE_BYTES) {
                log(`✅ File already downloaded and verified: ${localUri}`)
                return localUri
            }

            log(`⚠️ File size mismatch (expected: ${expectedSize}, actual: ${actualSize}). Redownloading...`)
            await FileSystem.deleteAsync(localUri, { idempotent: true })
        }

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
            if (expectedSize > 0 && !await this.isCached(result.uri, expectedSize)) {
                throw new Error(`Downloaded file is not the expected ${expectedSize} bytes`)
            }

            await FileSystem.deleteAsync(localUri, { idempotent: true })
            await FileSystem.moveAsync({ from: result.uri, to: localUri })
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
     * @deprecated Use ensureFilesDownloaded instead
     */
    async ensureModelDownloaded(model: AiModel): Promise<string> {
        const result = await this.ensureFilesDownloaded(model)
        return result.modelUri
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
        await FileSystem.deleteAsync(AIMODELS_DIR + modelFilename, { idempotent: true })
        await FileSystem.deleteAsync(AIMODELS_DIR + labelsFilename, { idempotent: true })
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
