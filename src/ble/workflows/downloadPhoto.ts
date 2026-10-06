/**
 * downloadPhoto: bring one photo off the camera's SD card and wait for it.
 *
 * Resolves with the cached file and the size the camera gave for it in its
 * `N bytes in FILE` reply, which is the reliable way to learn one photo's
 * size: `AI dir` lists the firmware's current folder, and saving CONFIG.TXT
 * after any op change leaves that in MANIFEST, not the photo folder (bench,
 * 6 October 2026). `txfile` changes into the photo folder itself.
 *
 * The same mechanics as `useCapturePreview`, without the screen state: send
 * `txfile`, let the shared `ImageReassembler` collect the binary packets, nudge
 * it to finish half a second after the device says `Finished sending`, and
 * resolve with the file it wrote to the cache. A stall of 30 s between packets
 * ends the wait, as it does on Capture Picture.
 *
 * The reassembler is shared: only one transfer may run at a time, which the
 * transport already guarantees (it holds every other command while a stream
 * runs).
 */
import { imageReassemblerEmitter } from '../emitters'
import { bleEventBus, BleEvent } from '../protocol/eventBus'
import { commandRegistry } from '../protocol/commandRegistry'
import { log } from '../../utils/logger'

const STALL_TIMEOUT_MS = 30000
const FINISH_GRACE_MS = 500

interface PhotoSession {
    execute: <T>(ctor: () => import('../protocol/commandRegistry').CommandContext<T>) => Promise<T>
}

export interface DownloadedPhoto {
    uri: string
    /** From the camera's reply; null when the reply was not seen */
    bytes: number | null
}

export const downloadPhoto = (session: PhotoSession, deviceId: string, fileName: string): Promise<DownloadedPhoto> =>
    new Promise<DownloadedPhoto>((resolve, reject) => {
        let stall: ReturnType<typeof setTimeout> | null = null
        let grace: ReturnType<typeof setTimeout> | null = null
        let bytes: number | null = null

        const finish = (error: Error | null, uri?: string) => {
            if (stall) clearTimeout(stall)
            if (grace) clearTimeout(grace)
            imageReassemblerEmitter.off('onImageComplete', onComplete)
            imageReassemblerEmitter.off('onImageProgress', onProgress)
            imageReassemblerEmitter.off('onImageError', onError)
            bleEventBus.removeListener('textLine', onLine)
            if (error) reject(error)
            else resolve({ uri: uri!, bytes })
        }
        const armStall = () => {
            if (stall) clearTimeout(stall)
            stall = setTimeout(() => imageReassemblerEmitter.emit('force_finalize'), STALL_TIMEOUT_MS)
        }
        const onComplete = (uri: string) => {
            log(`[downloadPhoto] ${fileName} -> ${uri}`)
            finish(null, uri)
        }
        const onProgress = () => armStall()
        const onError = (message: string) => finish(new Error(message))
        const onLine = (event: BleEvent & { type: 'TEXT_LINE' }) => {
            if (event.deviceId !== deviceId) return
            const size = /^(\d+) bytes in (\S+)/.exec(event.line.trim())
            if (size && size[2].toUpperCase() === fileName.toUpperCase()) bytes = parseInt(size[1], 10)
            if (!event.line.includes('Finished sending')) return
            if (grace) clearTimeout(grace)
            grace = setTimeout(() => imageReassemblerEmitter.emit('force_finalize'), FINISH_GRACE_MS)
        }

        imageReassemblerEmitter.on('onImageComplete', onComplete)
        imageReassemblerEmitter.on('onImageProgress', onProgress)
        imageReassemblerEmitter.on('onImageError', onError)
        bleEventBus.on('textLine', onLine)
        armStall()

        session.execute(() => commandRegistry.txfile(fileName)).catch((e) => finish(e instanceof Error ? e : new Error(String(e))))
    })
