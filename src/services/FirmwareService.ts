import { File, Directory, Paths } from 'expo-file-system'
import Firmware from '../database/models/Firmware'
import { getSupabaseClient } from './supabase'

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
                console.log(`✅ Firmware already downloaded: ${localFile.uri}`)
                return localFile.uri
            } else {
                console.log(`⚠️ File size mismatch (Expected: ${firmware.fileSizeBytes}, Got: ${fileSize}). Re-downloading...`)
                localFile.delete()
            }
        }

        console.log(`⬇️ Downloading firmware to ${localFile.uri}...`)

        try {
            const supabase = getSupabaseClient()
            console.log(`Getting signed URL for path: ${firmware.locationPath}`)

            // Use getPublicUrl as the bucket is verified to be public and signed URL generation was failing
            const { data } = supabase.storage
                .from('firmware')
                .getPublicUrl(firmware.locationPath)

            if (!data?.publicUrl) {
                throw new Error('Could not get public URL for firmware')
            }

            console.log(`Got public URL: ${data.publicUrl}, starting download...`)

            // Use new File.downloadFileAsync API
            const downloadedFile = await File.downloadFileAsync(
                data.publicUrl,
                localFile,
                { idempotent: true }
            )

            console.log(`✅ Firmware downloaded successfully`)
            return downloadedFile.uri
        } catch (error) {
            console.error('❌ Firmware download failed:', error)
            // Cleanup partial file if needed (wrap in try-catch to preserve original error)
            try {
                if (localFile.exists) {
                    localFile.delete()
                }
            } catch (cleanupError) {
                console.error('❌ Failed to cleanup partial firmware file:', cleanupError)
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
