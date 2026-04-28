/**
 * Binary conversion utilities for BLE file transfers.
 *
 * React Native provides a Buffer polyfill via the 'buffer' package.
 * Using Buffer.from() is significantly faster than atob() + manual loop
 * for large files (AI models, firmware images).
 */
import { Buffer } from 'buffer'

/**
 * Converts a base64-encoded string to a Uint8Array.
 * Used by FirmwareService and AiModelService when reading downloaded
 * files for BLE file transfer.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
    const buf = Buffer.from(base64, 'base64')
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
}
