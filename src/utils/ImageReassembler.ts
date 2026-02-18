import { Buffer } from "buffer"
import { log, logError, logWarn } from "./logger"
import EventEmitter from "eventemitter3"
import * as FileSystem from 'expo-file-system/legacy'

/** JPEG magic bytes: every valid JPEG starts with 0xFF 0xD8 */
const JPEG_MAGIC = [0xFF, 0xD8]

/** Minimum ratio of received/expected bytes to consider an image worth saving */
const MIN_COMPLETENESS_RATIO = 0.9

/** Binary packet marker from firmware (AI_PROCESSOR_MSG_RX_BINARY) */
const BINARY_MARKER = 0x06

/** Header size: [0x06, packetNum, payloadLength] */
const HEADER_SIZE = 3

export class ImageReassembler {
    private chunks: Buffer[] = []
    private totalBytesReceived: number = 0
    private isReceiving: boolean = false
    private lastPacketTime: number = 0
    private readonly TIMEOUT_MS = 3000 // 3 seconds inter-packet timeout
    private totalExpectedBytes: number = 0
    private watchdog: NodeJS.Timeout | null = null
    private emitter: EventEmitter

    // Packet sequence tracking
    private lastPacketNum: number = 0
    private packetCount: number = 0
    private missedPackets: number = 0

    private forceFinalizeHandler = () => {
        log('ImageReassembler: Received force_finalize signal')
        this.finalizePartial()
    }

    constructor(emitter: EventEmitter) {
        this.emitter = emitter
        // Listen for external force_finalize command
        this.emitter.on('force_finalize', this.forceFinalizeHandler)
    }

    private startWatchdog() {
        if (this.watchdog) clearInterval(this.watchdog)
        this.watchdog = setInterval(() => {
            if (this.isReceiving && Date.now() - this.lastPacketTime > this.TIMEOUT_MS) {
                logWarn(`ImageReassembler: Watchdog timeout (${this.TIMEOUT_MS}ms since last packet). Finalizing.`)
                this.finalizePartial()
            }
        }, 1000)
    }

    private stopWatchdog() {
         if (this.watchdog) {
             clearInterval(this.watchdog)
             this.watchdog = null
         }
    }

    public initialize(totalBytes: number): void {
        log(`ImageReassembler: Initializing transfer for ${totalBytes} bytes`)
        this.reset()
        this.totalExpectedBytes = totalBytes
        this.isReceiving = true
        this.lastPacketTime = Date.now()
        this.startWatchdog()
    }

    public finalizePartial(): void {
        if (this.totalBytesReceived > 0) {
            log(`ImageReassembler: Finalizing partial/stalled transfer (${this.totalBytesReceived}/${this.totalExpectedBytes} bytes, ${this.missedPackets} gaps)`)
            this.finalize()
        } else {
             this.reset()
        }
    }

    /**
     * Process a binary image packet from firmware.
     * 
     * Firmware packet format (3-byte header):
     *   byte[0] = 0x06 (AI_PROCESSOR_MSG_RX_BINARY)
     *   byte[1] = packetNum (1-based, incrementing, wraps at 255→1)
     *   byte[2] = payloadLength (length of data following, always < 255)
     *   byte[3..] = payload (actual image data)
     */
    public processPacket(data: number[]): void {
        const now = Date.now()

        // Strict state check - no auto-start
        if (!this.isReceiving) {
            return
        }
        
        // Validate minimum packet size (must have at least the 3-byte header)
        if (data.length < HEADER_SIZE) {
            logWarn(`ImageReassembler: Packet too small (${data.length} bytes), skipping`)
            return
        }

        // Validate marker byte
        if (data[0] !== BINARY_MARKER) {
            logWarn(`ImageReassembler: Invalid marker byte 0x${data[0].toString(16)}, expected 0x06`)
            return
        }

        this.lastPacketTime = now

        // Extract header fields
        const packetNum = data[1]
        const declaredPayloadLength = data[2]

        // Extract payload (everything after the 3-byte header)
        const payload = data.slice(HEADER_SIZE)

        if (payload.length === 0) {
            logWarn('ImageReassembler: Empty payload after header')
            return
        }

        // Validate declared payload length against actual
        if (declaredPayloadLength !== payload.length) {
            logWarn(`ImageReassembler: Payload length mismatch — header says ${declaredPayloadLength}, got ${payload.length}`)
            // Still process the packet (use actual received bytes) but log the discrepancy
        }

        // Track packet sequence (detect gaps)
        this.packetCount++
        if (this.lastPacketNum > 0) {
            // packetNum is 1-based and pre-incremented, wraps 255 → 1 (skips 0)
            const expectedNext = this.lastPacketNum >= 255 ? 1 : this.lastPacketNum + 1
            if (packetNum !== expectedNext) {
                const gap = packetNum > this.lastPacketNum 
                    ? packetNum - this.lastPacketNum - 1
                    : (255 - this.lastPacketNum) + packetNum // wrapped
                this.missedPackets += Math.max(gap, 1)
                logWarn(`ImageReassembler: Sequence gap — expected ${expectedNext}, got ${packetNum} (${this.missedPackets} total gaps)`)
            }
        }
        this.lastPacketNum = packetNum

        const chunk = Buffer.from(payload)
        this.processChunk(chunk)
    }

    private processChunk(chunk: Buffer) {
        this.chunks.push(chunk)
        this.totalBytesReceived += chunk.length

        // Emit progress
        if (this.totalExpectedBytes > 0) {
             const progress = Math.min(this.totalBytesReceived / this.totalExpectedBytes, 1)
             this.emitter.emit('onImageProgress', progress)
        }

        // Check completion strictly by size
        if (this.totalExpectedBytes > 0 && this.totalBytesReceived >= this.totalExpectedBytes) {
            log(`ImageReassembler: Transfer complete! Received ${this.totalBytesReceived}/${this.totalExpectedBytes} (${this.missedPackets} gaps)`)
            this.finalize()
        }
    }

    private async finalize(): Promise<void> {
        try {
            const finalBuffer = Buffer.concat(this.chunks)
            
            // --- Integrity checks ---
            const completeness = this.totalExpectedBytes > 0 
                ? this.totalBytesReceived / this.totalExpectedBytes 
                : 1

            // Check JPEG magic bytes
            const hasJpegMagic = finalBuffer.length >= 2 
                && finalBuffer[0] === JPEG_MAGIC[0] 
                && finalBuffer[1] === JPEG_MAGIC[1]

            if (!hasJpegMagic) {
                logError(`ImageReassembler: Image data does not start with JPEG magic bytes (0xFF 0xD8). Got: 0x${finalBuffer[0]?.toString(16)} 0x${finalBuffer[1]?.toString(16)}`)
                this.emitter.emit('onImageError', `Invalid image data — not a JPEG (first bytes: 0x${finalBuffer[0]?.toString(16)} 0x${finalBuffer[1]?.toString(16)})`)
                return
            }

            if (completeness < MIN_COMPLETENESS_RATIO) {
                logError(`ImageReassembler: Image too incomplete — received ${this.totalBytesReceived}/${this.totalExpectedBytes} bytes (${(completeness * 100).toFixed(1)}%)`)
                this.emitter.emit('onImageError', `Image transfer incomplete — only ${(completeness * 100).toFixed(0)}% received (${this.missedPackets} packets lost)`)
                return
            }

            if (this.missedPackets > 0) {
                logWarn(`ImageReassembler: Image has ${this.missedPackets} sequence gaps — may be corrupt`)
            }

            // --- Save image ---
            const base64 = finalBuffer.toString('base64')
            const timestamp = Date.now()
            
            // Ensure valid directory
            let cacheDir = FileSystem.cacheDirectory
            
            if (!cacheDir) {
                cacheDir = FileSystem.documentDirectory
            }
            
            if (!cacheDir) {
                logError('ImageReassembler: Both cacheDirectory and documentDirectory are null/undefined')
                this.emitter.emit('onImageError', 'Cannot save image — no writable directory available')
                return 
            }

            const fileUri = `${cacheDir}capture_${timestamp}.jpg`
            
            await FileSystem.writeAsStringAsync(fileUri, base64, {
                encoding: FileSystem.EncodingType.Base64
            })

            const isComplete = completeness >= 1
            const statusLabel = isComplete ? 'SUCCESS' : 'PARTIAL'
            const gapInfo = this.missedPackets > 0 ? ` [${this.missedPackets} gaps]` : ''
            log(`ImageReassembler: Image saved to ${fileUri} [${statusLabel}]${gapInfo} (${this.totalBytesReceived}/${this.totalExpectedBytes} bytes)`)
            this.emitter.emit('onImageComplete', fileUri)
            
        } catch (error) {
            logError('ImageReassembler: Failed to save image', error)
            this.emitter.emit('onImageError', `Failed to save image: ${error}`)
        } finally {
            this.reset()
        }
    }

    public reset(): void {
        this.stopWatchdog()
        this.chunks = []
        this.totalBytesReceived = 0
        this.isReceiving = false
        this.totalExpectedBytes = 0
        this.lastPacketNum = 0
        this.packetCount = 0
        this.missedPackets = 0
    }
    
    public destroy() {
        this.stopWatchdog()
        this.emitter.off('force_finalize', this.forceFinalizeHandler)
    }
}
