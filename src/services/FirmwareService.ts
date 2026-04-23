import * as FileSystem from 'expo-file-system/legacy'
import { Q } from '@nozbe/watermelondb'
import database from '../database'
import Firmware from '../database/models/Firmware'
import { getSupabaseClient } from './supabase'
import { log, logError } from '../utils/logger'

const FIRMWARE_DIR = FileSystem.documentDirectory + 'firmware/'
/** Tolerance in bytes when comparing file sizes (accounts for minor filesystem differences) */
const FILE_SIZE_TOLERANCE_BYTES = 100

class FirmwareService {
    private initialized = false

    private async init(): Promise<void> {
        if (this.initialized) return

        const dirInfo = await FileSystem.getInfoAsync(FIRMWARE_DIR)
        if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(FIRMWARE_DIR, { intermediates: true })
        }
        this.initialized = true
    }

    /**
     * checks if firmware is downloaded and valid.
     * If not, downloads it from Supabase Storage.
     * Returns the local file URI.
     */
    async ensureFirmwareDownloaded(firmware: Firmware): Promise<string> {
        await this.init()

        // Construct unique local filename
        // locationPath is typically "type/filename.zip"
        // locationPath is typically "type/filename.zip"
        const filename = this.getLocalFilename(firmware)
        const localUri = FIRMWARE_DIR + filename

        const fileInfo = await FileSystem.getInfoAsync(localUri)

        if (fileInfo.exists) {
            const fileSize = fileInfo.size
            
            // Verify size if possible (approximate check)
            if (fileSize !== undefined && Math.abs(fileSize - firmware.fileSizeBytes) < FILE_SIZE_TOLERANCE_BYTES) {
                log(`✅ Firmware already downloaded: ${localUri}`)
                return localUri
            } else {
                log(`⚠️ File size mismatch (Expected: ${firmware.fileSizeBytes}, Got: ${fileSize}). Re-downloading...`)
                await FileSystem.deleteAsync(localUri, { idempotent: true })
            }
        }

        log(`⬇️ Downloading firmware to ${localUri}...`)

        try {
            const supabase = getSupabaseClient()
            log(`Getting signed URL for path: ${firmware.locationPath}`)

            const { data, error } = await supabase.storage
                .from('firmware')
                .createSignedUrl(firmware.locationPath, 60) // 60 seconds validity

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

            log(`✅ Firmware downloaded successfully: ${result.uri}`)
            return result.uri
        } catch (error) {
            logError('❌ Firmware download failed:', error)
            // Cleanup partial file if needed
            try {
                await FileSystem.deleteAsync(localUri, { idempotent: true })
            } catch (cleanupError) {
                logError('❌ Failed to cleanup partial firmware file:', cleanupError)
            }
            throw error
        }
    }

    /**
     * Deletes a local firmware file
     */
    /**
     * Deletes a local firmware file
     */
    async deleteLocalFirmware(firmware: Firmware): Promise<void> {
        await this.init()
        const filename = this.getLocalFilename(firmware)
        const localUri = FIRMWARE_DIR + filename
        await FileSystem.deleteAsync(localUri, { idempotent: true })
    }

    private getLocalFilename(firmware: Firmware): string {
        // Sanitize type and version to prevent path traversal
        const sanitizedType = firmware.type.replace(/[^a-zA-Z0-9.-]/g, '_')
        const sanitizedVersion = firmware.version.replace(/[^a-zA-Z0-9.-]/g, '_')
        const originalFilename = firmware.locationPath.split('/').pop() || 'unknown'
        
        return `${sanitizedType}_${sanitizedVersion}_${originalFilename}`
    }

    /**
     * Reads a downloaded firmware file as raw bytes for BLE file transfer.
     */
    async readFirmwareAsBytes(localUri: string): Promise<Uint8Array> {
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
     * Resolves a firmware UUID by its type and version string.
     */
    async getFirmwareIdByVersion(type: 'ble' | 'himax' | 'config', version: string): Promise<string | null> {
        try {
            const firmwareCollection = database.get<Firmware>('firmware')
            const firmwares = await firmwareCollection.query(
                Q.where('type', type),
                Q.where('version', version),
                Q.where('is_active', true)
            ).fetch()

            return firmwares.length > 0 ? firmwares[0].id : null
        } catch (error) {
            logError(`Failed to resolve firmware ID for ${type} v${version}:`, error)
            return null
        }
    }
}

export default new FirmwareService()
