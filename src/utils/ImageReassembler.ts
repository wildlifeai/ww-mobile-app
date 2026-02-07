import { Buffer } from "buffer"
import { log } from "./logger"
import { imageReassemblerEmitter } from "../ble/emitters"

export class ImageReassembler {
    private static instance: ImageReassembler
    private buffer: Buffer = Buffer.alloc(0)
    private expectedPacketNum: number = 1
    private isReceiving: boolean = false
    private lastPacketTime: number = 0
    private readonly TIMEOUT_MS = 5000 // 5 seconds timeout
    private totalExpectedBytes: number = 0

    private constructor() { }

    public static getInstance(): ImageReassembler {
        if (!ImageReassembler.instance) {
            ImageReassembler.instance = new ImageReassembler()
        }
        return ImageReassembler.instance
    }

    public initialize(totalBytes: number): void {
        log(`ImageReassembler: Initializing transfer for ${totalBytes} bytes`)
        this.reset()
        this.totalExpectedBytes = totalBytes
        this.isReceiving = true
        this.lastPacketTime = Date.now()
    }

    public processPacket(data: number[]): void {
        const now = Date.now()

        // Auto-start mechanism: If we receive a packet but aren't in receiving state,
        // assume it's the start of a new transfer. This handles cases where the
        // "Start" text message was dropped or parsed incorrectly.
        if (!this.isReceiving) {
            log("ImageReassembler: Auto-starting transfer (Size unknown)")
            this.reset()
            this.isReceiving = true
            this.lastPacketTime = now
        }

        // Timeout Check
        if (now - this.lastPacketTime > this.TIMEOUT_MS) {
            log("ImageReassembler: Timeout, restarting buffer")
            this.reset()
            this.isReceiving = true
            this.lastPacketTime = now
            // If we had a known size, we lost it on reset. Proceed with unknown size.
        }

        // Protocol observed in logs: [0x06, PacketNum, Len, ...Payload]
        // data[0] is 0x06 (Type)
        // data[1] is PacketNum (e.g. 0x01, 0x02...)
        // data[2] is Length (1 byte, e.g. 0xF1 = 241)


        const payloadLen = data[2]

        // Safety check on length
        if (payloadLen <= 0 || payloadLen > data.length - 3) {
            log(`ImageReassembler: Invalid payload length ${payloadLen}`)
            return
        }

        const payload = data.slice(3, 3 + payloadLen)

        // Append data
        this.buffer = Buffer.concat([this.buffer, Buffer.from(payload)])
        this.lastPacketTime = now

        log(`ImageReassembler: Rx ${payloadLen} bytes, total: ${this.buffer.length}/${this.totalExpectedBytes || '?'}`)

        // Check completion
        let isComplete = false
        if (this.totalExpectedBytes > 0 && this.buffer.length >= this.totalExpectedBytes) {
            isComplete = true
        } else if (this.totalExpectedBytes === 0) {
            // If size is unknown, check for JPEG EOI marker (0xFF 0xD9)
            // It is usually the very last two bytes.
            if (this.buffer.indexOf(Buffer.from([0xFF, 0xD9])) !== -1) {
                isComplete = true
            }
        }

        if (isComplete) {
            log("ImageReassembler: Transfer complete!")
            const base64 = this.buffer.toString('base64')
            imageReassemblerEmitter.emit('onImageComplete', base64)
            this.reset()
        }
    }

    public reset(): void {
        this.buffer = Buffer.alloc(0)
        // expectedPacketNum removed as protocol doesn't support it
        this.isReceiving = false
        this.totalExpectedBytes = 0
    }
}
