import * as FileSystem from 'expo-file-system/legacy'
import { Q } from '@nozbe/watermelondb'
import database from '../database'
import Firmware from '../database/models/Firmware'
import { getSupabaseClient } from './supabase'
import { log, logError, logWarn } from '../utils/logger'
import AsyncStorage from '@react-native-async-storage/async-storage'

const FIRMWARE_DIR = FileSystem.documentDirectory + 'firmware/'
/** Tolerance in bytes when comparing file sizes (accounts for minor filesystem differences) */
const FILE_SIZE_TOLERANCE_BYTES = 100

export type DownloadState = 'idle' | 'downloading' | 'paused' | 'completed' | 'failed'

export interface DownloadProgressData {
    progress: number | null // 0-1, null for indeterminate
    speedBytesPerSec: number
    estimatedRemainingMs: number
}

export interface DownloadOptions {
    onProgress?: (data: DownloadProgressData) => void
    onStateChange?: (state: DownloadState) => void
    signal?: AbortSignal
}

const ensureMinimumTime = async (startMs: number, minMs: number) => {
    const elapsed = Date.now() - startMs
    if (elapsed < minMs) {
        await new Promise(resolve => setTimeout(resolve, minMs - elapsed))
    }
}

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
    async ensureFirmwareDownloaded(firmware: Firmware, options?: DownloadOptions): Promise<string> {
        await this.init()
        const startMs = Date.now()

        const filename = this.getLocalFilename(firmware)
        const localUri = FIRMWARE_DIR + filename

        const fileInfo = await FileSystem.getInfoAsync(localUri)

        if (fileInfo.exists) {
            const fileSize = fileInfo.size
            if (fileSize !== undefined && Math.abs(fileSize - firmware.fileSizeBytes) < FILE_SIZE_TOLERANCE_BYTES) {
                log(`✅ Firmware already downloaded: ${localUri}`)
                options?.onStateChange?.('completed')
                await ensureMinimumTime(startMs, 500)
                return localUri
            } else {
                log(`⚠️ File size mismatch (Expected: ${firmware.fileSizeBytes}, Got: ${fileSize}). Re-downloading...`)
                await FileSystem.deleteAsync(localUri, { idempotent: true })
                await AsyncStorage.removeItem(`firmwareDownload_${firmware.id}`)
            }
        }

        options?.onStateChange?.('downloading')
        log(`⬇️ Downloading firmware to ${localUri}...`)

        let downloadResumable: FileSystem.DownloadResumable | null = null
        let isAborted = false

        // Cancel support
        if (options?.signal) {
            options.signal.addEventListener('abort', async () => {
                isAborted = true
                if (downloadResumable) {
                    try {
                        const snapshot = await downloadResumable.pauseAsync()
                        if (snapshot) {
                            await AsyncStorage.setItem(`firmwareDownload_${firmware.id}`, JSON.stringify(snapshot))
                        }
                    } catch (e) {
                        logError('Failed to pause download on abort', e)
                    }
                }
            })
        }

        try {
            let lastBytes = 0
            let lastTime = Date.now()

            const progressCallback = (downloadProgress: FileSystem.DownloadProgressData) => {
                const now = Date.now()
                const { totalBytesWritten, totalBytesExpectedToWrite } = downloadProgress

                let progressValue: number | null = null
                let speed = 0
                let eta = 0

                if (totalBytesExpectedToWrite > 0) {
                    progressValue = totalBytesWritten / totalBytesExpectedToWrite
                }

                const timeDelta = (now - lastTime) / 1000 // seconds
                if (timeDelta > 0.5) { // update speed every 500ms
                    const bytesDelta = totalBytesWritten - lastBytes
                    speed = bytesDelta / timeDelta
                    if (speed > 0 && progressValue !== null) {
                        eta = ((totalBytesExpectedToWrite - totalBytesWritten) / speed) * 1000
                    }
                    lastBytes = totalBytesWritten
                    lastTime = now

                    options?.onProgress?.({
                        progress: progressValue,
                        speedBytesPerSec: speed,
                        estimatedRemainingMs: eta
                    })
                } else if (progressValue !== null && options?.onProgress) {
                     // Still update just progress for smooth bar
                     options.onProgress({
                         progress: progressValue,
                         speedBytesPerSec: speed,
                         estimatedRemainingMs: eta
                     })
                }
            }

            // Check resumable state
            const snapshotStr = await AsyncStorage.getItem(`firmwareDownload_${firmware.id}`)
            if (snapshotStr) {
                try {
                    const snapshot = JSON.parse(snapshotStr)
                    downloadResumable = new FileSystem.DownloadResumable(
                        snapshot.url,
                        snapshot.fileUri,
                        snapshot.options,
                        progressCallback,
                        snapshot.resumeData
                    )
                    log(`Resuming download for ${firmware.locationPath}`)
                } catch (e) {
                    logWarn('Failed to parse download snapshot, starting fresh', e)
                    await AsyncStorage.removeItem(`firmwareDownload_${firmware.id}`)
                }
            }

            if (!downloadResumable) {
                const supabase = getSupabaseClient()
                log(`Getting signed URL for path: ${firmware.locationPath}`)

                const { data, error } = await supabase.storage
                    .from('firmware')
                    .createSignedUrl(firmware.locationPath, 60) // 60 seconds validity

                if (error || !data?.signedUrl) {
                    throw new Error(`Could not get signed URL: ${error?.message}`)
                }

                log(`Got signed URL, starting download...`)

                downloadResumable = FileSystem.createDownloadResumable(
                    data.signedUrl,
                    localUri,
                    {},
                    progressCallback
                )
            }

            if (isAborted) throw new Error('Download aborted')

            const result = await downloadResumable.downloadAsync()
            
            if (isAborted) throw new Error('Download aborted')

            if (!result || !result.uri) {
                throw new Error('Download failed to return a URI')
            }

            // Check size again
            const finalInfo = await FileSystem.getInfoAsync(result.uri)
            if (finalInfo.exists && finalInfo.size !== undefined) {
                 if (Math.abs(finalInfo.size - firmware.fileSizeBytes) > FILE_SIZE_TOLERANCE_BYTES) {
                     throw new Error(`Downloaded file size mismatch. Expected ${firmware.fileSizeBytes}, Got ${finalInfo.size}`)
                 }
            }

            log(`✅ Firmware downloaded successfully: ${result.uri}`)
            await AsyncStorage.removeItem(`firmwareDownload_${firmware.id}`)
            options?.onStateChange?.('completed')
            await ensureMinimumTime(startMs, 500)
            return result.uri
        } catch (error: any) {
            if (isAborted) {
                options?.onStateChange?.('paused')
                throw new Error('Download aborted by user')
            }
            options?.onStateChange?.('failed')
            logError('❌ Firmware download failed:', error)
            // Save state if resumable
            if (downloadResumable) {
                try {
                    const snapshot = await downloadResumable.pauseAsync()
                    if (snapshot) {
                         await AsyncStorage.setItem(`firmwareDownload_${firmware.id}`, JSON.stringify(snapshot))
                    }
                } catch (e) {
                    // Ignore pause errors on failure
                }
            }
            throw error
        }
    }

    /**
     * Deletes a local firmware file
     */
    async deleteLocalFirmware(firmware: Firmware): Promise<void> {
        await this.init()
        const filename = this.getLocalFilename(firmware)
        const localUri = FIRMWARE_DIR + filename
        await FileSystem.deleteAsync(localUri, { idempotent: true })
        await AsyncStorage.removeItem(`firmwareDownload_${firmware.id}`)
    }

    private getLocalFilename(firmware: Firmware): string {
        const sanitizedType = firmware.type.replace(/[^a-zA-Z0-9.-]/g, '_')
        const sanitizedVersion = firmware.version.replace(/[^a-zA-Z0-9.-]/g, '_')
        const originalFilename = firmware.locationPath.split('/').pop() || 'unknown'
        
        return `${sanitizedType}_${sanitizedVersion}_${originalFilename}`
    }

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
