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

    private async init(): Promise<void> {
        if (this.initialized) return

        const dirInfo = await FileSystem.getInfoAsync(AIMODELS_DIR)
        if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(AIMODELS_DIR, { intermediates: true })
        }
        this.initialized = true
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
     * Helper to check and download a single file from Supabase
     */
    private async downloadFileIfMissing(storagePath: string, localUri: string, expectedSize: number): Promise<string> {
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

        try {
            const { data, error } = await supabase.storage
                .from('ai-models')
                .createSignedUrl(storagePath, 60) // 60 seconds validity

            if (error || !data?.signedUrl) {
                throw new Error(`Could not get signed URL: ${error?.message}`)
            }

            const downloadResumable = FileSystem.createDownloadResumable(data.signedUrl, localUri, {})
            const result = await downloadResumable.downloadAsync()
            
            if (!result || !result.uri) {
                throw new Error('Download failed to return a URI')
            }

            log(`✅ File downloaded successfully: ${result.uri}`)
            return result.uri
        } catch (error) {
            logError('❌ File download failed:', error)
            try {
                await FileSystem.deleteAsync(localUri, { idempotent: true })
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

    private getLocalFilename(model: AiModel, type: 'model' | 'labels'): string {
        // Use serverId for local caching — firmware filenames ({familyId}V{ver}.[ext])
        // are constructed in the transfer hook via ReferenceDataService.getFirmwareIds()
        const cacheKey = model.serverId || model.id
        
        if (type === 'model') {
            const ext = model.modelPath ? model.modelPath.split('.').pop() : 'tflite'
            return `model_${cacheKey}.${ext}`
        } else {
            const ext = model.labelsPath ? model.labelsPath.split('.').pop() : 'txt'
            return `labels_${cacheKey}.${ext}`
        }
    }
}

export default new AiModelService()
