import * as FileSystem from 'expo-file-system/legacy'
import database from '../database'
import AiModel from '../database/models/AiModel'
import { getSupabaseClient } from './supabase'
import { log, logError } from '../utils/logger'

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
     * Checks if the AI model file exists locally and matches the expected size.
     * If not, downloads it from Supabase storage.
     * Returns the local URI to the file.
     */
    async ensureModelDownloaded(model: AiModel): Promise<string> {
        await this.init()

        if (!model.storagePath) {
            throw new Error(`AI model ${model.id} has no storage_path specified`)
        }

        const filename = this.getLocalFilename(model)
        const localUri = AIMODELS_DIR + filename

        // 1. Check if file already exists
        const fileInfo = await FileSystem.getInfoAsync(localUri)
        if (fileInfo.exists) {
            // 2. Verify file size matches (with tolerance)
            const expectedSize = model.fileSizeBytes || 0
            const actualSize = fileInfo.size || 0
            const sizeDiff = Math.abs(actualSize - expectedSize)

            if (expectedSize > 0 && sizeDiff <= FILE_SIZE_TOLERANCE_BYTES) {
                log(`✅ AI model already downloaded and verified: ${localUri}`)
                return localUri
            }

            log(`⚠️ AI model size mismatch (expected: ${expectedSize}, actual: ${actualSize}). Redownloading...`)
            await FileSystem.deleteAsync(localUri, { idempotent: true })
        }

        // 3. Download from Supabase
        log(`Downloading AI model from Supabase: ${model.storagePath}`)
        const supabase = await getSupabaseClient()

        try {
            const { data, error } = await supabase.storage
                .from('ai-models')
                .createSignedUrl(model.storagePath, 60) // 60 seconds validity

            if (error || !data?.signedUrl) {
                throw new Error(`Could not get signed URL: ${error?.message}`)
            }

            log(`Got signed URL, starting download...`)

            const downloadResumable = FileSystem.createDownloadResumable(
                data.signedUrl,
                localUri,
                {}
            )

            const result = await downloadResumable.downloadAsync()
            
            if (!result || !result.uri) {
                throw new Error('Download failed to return a URI')
            }

            log(`✅ AI model downloaded successfully: ${result.uri}`)
            return result.uri
        } catch (error) {
            logError('❌ AI model download failed:', error)
            // Cleanup partial file if needed
            try {
                await FileSystem.deleteAsync(localUri, { idempotent: true })
            } catch (cleanupError) {
                logError('❌ Failed to cleanup partial AI model file:', cleanupError)
            }
            throw error
        }
    }

    /**
     * Reads a downloaded AI model file as raw bytes for BLE file transfer.
     */
    async readModelAsBytes(localUri: string): Promise<Uint8Array> {
        const base64 = await FileSystem.readAsStringAsync(localUri, {
            encoding: FileSystem.EncodingType.Base64,
        })
        const binary = atob(base64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i)
        }
        return bytes
    }

    /**
     * Deletes a local AI model file
     */
    async deleteLocalModel(model: AiModel): Promise<void> {
        await this.init()
        const filename = this.getLocalFilename(model)
        const localUri = AIMODELS_DIR + filename
        await FileSystem.deleteAsync(localUri, { idempotent: true })
    }

    /**
     * Gets an AI model by its database ID
     */
    async getModelById(modelId: string): Promise<AiModel | null> {
        try {
            const model = await database.get<AiModel>('ai_models').find(modelId)
            return model
        } catch (error) {
            logError(`Failed to find AiModel with ID ${modelId}:`, error)
            return null
        }
    }

    private getLocalFilename(model: AiModel): string {
        // Sanitize version to prevent path traversal
        const sanitizedVersion = model.version.replace(/[^a-zA-Z0-9.-]/g, '_')
        const originalFilename = model.storagePath.split('/').pop() || 'unknown'
        
        return `model_${sanitizedVersion}_${originalFilename}`
    }
}

export default new AiModelService()
