import { File, Directory, Paths } from 'expo-file-system'
import Firmware from '../database/models/Firmware'
import { getSupabaseClient } from './supabase'
import { log } from '../utils/logger'


const FIRMWARE_DIR = new Directory(Paths.document, 'firmware')
/** Tolerance in bytes when comparing file sizes (accounts for minor filesystem differences) */
const FILE_SIZE_TOLERANCE_BYTES = 100

class FirmwareService {
    private initialized = false

    private init(): void {
        if (this.initialized) return

        if (!FIRMWARE_DIR.exists) {
            FIRMWARE_DIR.create({ intermediates: true })
        }
        this.initialized = true
    }

    /**
     * checks if firmware is downloaded and valid.
     * If not, downloads it from Supabase Storage.
     * Returns the local file URI.
     */
    async ensureFirmwareDownloaded(firmware: Firmware): Promise<string> {
        this.init()

        // locationPath is typically "type/filename.zip" e.g., "ble/firmware_v1.0.0.zip"
        // We use the full path structure locally to avoid filename collisions across types
        // actually, flattening might be easier, but let's just use the filename for now
        // assuming filenames are unique enough or we prepend type
        const filename = `${firmware.type}_${firmware.version}_${firmware.locationPath.split('/').pop()}`
        const localFile = new File(FIRMWARE_DIR, filename)

        if (localFile.exists) {
            const fileSize = localFile.size
            // Verify size if possible (approximate check)
            if (fileSize !== null && Math.abs(fileSize - firmware.fileSizeBytes) < FILE_SIZE_TOLERANCE_BYTES) {
                log(`✅ Firmware already downloaded: ${localFile.uri}`)
                return localFile.uri
            } else {
                log(`⚠️ File size mismatch (Expected: ${firmware.fileSizeBytes}, Got: ${fileSize}). Re-downloading...`)
                localFile.delete()
            }
        }

        log(`⬇️ Downloading firmware to ${localFile.uri}...`)

        try {
            const supabase = getSupabaseClient()
            log(`Getting signed URL for path: ${firmware.locationPath}`)

            // Use createSignedUrl now that RLS policies are fixed (TO public)
            // This allows authenticated users to download from the private firmware bucket
            const { data, error } = await supabase.storage
                .from('firmware')
                .createSignedUrl(firmware.locationPath, 60) // 60 seconds validity

            if (error || !data?.signedUrl) {
                throw new Error(`Could not get signed URL: ${error?.message}`)
            }

            log(`Got signed URL, starting download...`)

            // Use new File.downloadFileAsync API
            const downloadedFile = await File.downloadFileAsync(
                data.signedUrl,
                localFile,
                { idempotent: true }
            )

            log(`✅ Firmware downloaded successfully`)
            return downloadedFile.uri
        } catch (error) {
            logError('❌ Firmware download failed:', error)
            // Cleanup partial file if needed (wrap in try-catch to preserve original error)
            try {
                if (localFile.exists) {
                    localFile.delete()
                }
            } catch (cleanupError) {
                logError('❌ Failed to cleanup partial firmware file:', cleanupError)
            }
            throw error
        }
    }

    /**
     * Deletes a local firmware file
     */
    async deleteLocalFirmware(firmware: Firmware): Promise<void> {
        this.init()
        const filename = `${firmware.type}_${firmware.version}_${firmware.locationPath.split('/').pop()}`
        const localFile = new File(FIRMWARE_DIR, filename)
        if (localFile.exists) {
            localFile.delete()
        }
    }
}

export default new FirmwareService()
