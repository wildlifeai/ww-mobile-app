import * as FileSystem from 'expo-file-system'
import Firmware from '../database/models/Firmware'
import { getSupabaseClient } from './supabase'

const FIRMWARE_DIR = FileSystem.documentDirectory + 'firmware/'

class FirmwareService {
    private initialized = false

    private async init() {
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

        // locationPath is typically "type/filename.zip" e.g., "ble/firmware_v1.0.0.zip"
        // We use the full path structure locally to avoid filename collisions across types
        // actually, flattening might be easier, but let's just use the filename for now
        // assuming filenames are unique enough or we prepend type
        const filename = `${firmware.type}_${firmware.version}_${firmware.locationPath.split('/').pop()}`
        const localUri = FIRMWARE_DIR + filename

        const fileInfo = await FileSystem.getInfoAsync(localUri)

        if (fileInfo.exists) {
            // Verify size if possible (approximate check)
            if (Math.abs(fileInfo.size - firmware.fileSizeBytes) < 100) { // Tolerance of 100 bytes
                console.log(`✅ Firmware already downloaded: ${localUri}`)
                return localUri
            } else {
                console.log(`⚠️ File size mismatch (Expected: ${firmware.fileSizeBytes}, Got: ${fileInfo.size}). Re-downloading...`)
                await FileSystem.deleteAsync(localUri, { idempotent: true })
            }
        }

        console.log(`⬇️ Downloading firmware to ${localUri}...`)

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

            // Validate the URL actually exists before downloading 
            // (getPublicUrl returns a URL even if file doesn't exist)
            // fetch head check is handled by downloadAsync which throws on 404 usually? 
            // Actually FileSystem.downloadAsync might save the 404 page content, so we should check status.

            console.log(`Got public URL: ${data.publicUrl}, starting download...`)

            const downloadRes = await FileSystem.downloadAsync(
                data.publicUrl,
                localUri
            )

            if (downloadRes.status !== 200) {
                throw new Error(`Download failed with status ${downloadRes.status}`)
            }

            console.log(`✅ Firmware downloaded successfully`)
            return localUri
        } catch (error) {
            console.error('❌ Firmware download failed:', error)
            // Cleanup partial file if needed
            await FileSystem.deleteAsync(localUri, { idempotent: true })
            throw error
        }
    }

    /**
     * Deletes a local firmware file
     */
    async deleteLocalFirmware(firmware: Firmware): Promise<void> {
        await this.init()
        const filename = `${firmware.type}_${firmware.version}_${firmware.locationPath.split('/').pop()}`
        const localUri = FIRMWARE_DIR + filename
        await FileSystem.deleteAsync(localUri, { idempotent: true })
    }
}

export default new FirmwareService()
