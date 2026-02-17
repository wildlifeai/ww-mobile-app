import { Buffer } from "buffer"
import { log, logError, logWarn } from "./logger"
import EventEmitter from "eventemitter3"
import * as FileSystem from 'expo-file-system/legacy'

export class ImageReassembler {
    private chunks: Buffer[] = []
    private totalBytesReceived: number = 0
    private isReceiving: boolean = false
    private lastPacketTime: number = 0
    private readonly TIMEOUT_MS = 5000 // 5 seconds inter-packet timeout
    private totalExpectedBytes: number = 0
    private watchdog: NodeJS.Timeout | null = null
    private emitter: EventEmitter

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
                log("ImageReassembler: Watchdog timeout. Finalizing partial.")
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
            log(`ImageReassembler: Finalizing partial/stalled transfer (${this.totalBytesReceived} bytes)`)
            this.finalize()
        } else {
             this.reset()
        }
    }

    public processPacket(data: number[]): void {
        const now = Date.now()

        // Strict state check - no auto-start
        if (!this.isReceiving) {
            return
        }
        
        this.lastPacketTime = now

        // Protocol: [0x06, PacketNum, ...Payload]
        // Note: Ignoring packetNum for maximum robustness as requested. 
        // We just append all payloads in order they arrive.
        
        // Everything after packetNum (index 1) is payload
        const payload = data.slice(2)
        
        if (payload.length === 0) {
            log('ImageReassembler: Empty payload')
            return
        }
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
            log(`ImageReassembler: Transfer complete! Received ${this.totalBytesReceived}/${this.totalExpectedBytes}`)
            this.finalize()
        }
    }

    /**
     * Force finalization of the current transfer.
     * Useful if some packets were lost but the transfer has ended.
     */
    public forceFinalize(): void {
        if (!this.isReceiving) return
        log(`ImageReassembler: Received force_finalize signal. Partial total: ${this.totalBytesReceived}/${this.totalExpectedBytes}`)
        this.finalize()
    }

    private async finalize(): Promise<void> {
        try {
            const finalBuffer = Buffer.concat(this.chunks)
            const base64 = finalBuffer.toString('base64')
            
            const timestamp = Date.now()
            
            // Ensure valid directory
            let cacheDir = FileSystem.cacheDirectory
            
            if (!cacheDir) {
                cacheDir = FileSystem.documentDirectory
            }
            
            if (!cacheDir) {
                logError('ImageReassembler: Both cacheDirectory and documentDirectory are null/undefined')
                return 
            }

            const fileUri = `${cacheDir}capture_${timestamp}.jpg`
            
            await FileSystem.writeAsStringAsync(fileUri, base64, {
                encoding: FileSystem.EncodingType.Base64
            })

            const isComplete = this.totalExpectedBytes > 0 && this.totalBytesReceived >= this.totalExpectedBytes
            const statusLabel = isComplete ? 'SUCCESS' : 'PARTIAL'
            log(`ImageReassembler: Image saved to ${fileUri} [${statusLabel}] (${this.totalBytesReceived}/${this.totalExpectedBytes} bytes)`)
            this.emitter.emit('onImageComplete', fileUri)
            
        } catch (error) {
            logError('ImageReassembler: Failed to save image', error)
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
    }
    
    public destroy() {
        this.stopWatchdog()
        this.emitter.off('force_finalize', this.forceFinalizeHandler)
    }
}
