import { Buffer } from "buffer"
import { log } from "./logger"

export class ImageReassembler {
    private static instance: ImageReassembler
    private buffer: Buffer = Buffer.alloc(0)
    private expectedPacketNum: number = 1
    private isReceiving: boolean = false
    private lastPacketTime: number = 0
    private readonly TIMEOUT_MS = 2000 // Reset if no packet for 2 seconds

    private constructor() { }

    public static getInstance(): ImageReassembler {
        if (!ImageReassembler.instance) {
            ImageReassembler.instance = new ImageReassembler()
        }
        return ImageReassembler.instance
    }

    public processPacket(data: number[]): void {
        const now = Date.now()

        // Check for timeout/reset
        if (this.isReceiving && (now - this.lastPacketTime > this.TIMEOUT_MS)) {
            log("ImageReassembler: Timeout, resetting buffer")
            this.reset()
        }

        // Header: [0x06, PacketNum, PayloadLen, ...Payload]
        const packetNum = data[1]
        const payloadLen = data[2]
        const payload = data.slice(3, 3 + payloadLen)

        // Check for new transmission start
        if (packetNum === 1) {
            if (this.isReceiving) {
                log("ImageReassembler: Received packet 1 while already receiving, resetting")
            }
            this.reset()
            this.isReceiving = true
            log("ImageReassembler: Started receiving image")
        } else if (!this.isReceiving) {
            log(`ImageReassembler: Ignored orphan packet ${packetNum}`)
            return
        }

        // Check packet sequence
        if (packetNum !== this.expectedPacketNum) {
            log(`ImageReassembler: Sequence error. Expected ${this.expectedPacketNum}, got ${packetNum}`)
            // We might want to reset or just log error? 
            // For now, let's reset to avoid corrupted images
            this.reset()
            return
        }

        // Append data
        this.buffer = Buffer.concat([this.buffer, Buffer.from(payload)])
        this.expectedPacketNum++
        this.lastPacketTime = now

        log(`ImageReassembler: Processed packet ${packetNum}, total size: ${this.buffer.length}`)
    }

    public getImageData(): string | null {
        if (this.buffer.length === 0) return null
        return this.buffer.toString('base64')
    }

    public reset(): void {
        this.buffer = Buffer.alloc(0)
        this.expectedPacketNum = 1
        this.isReceiving = false
    }
}
