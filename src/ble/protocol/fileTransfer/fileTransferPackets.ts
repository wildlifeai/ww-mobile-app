/**
 * Packet builders for the BLE file transfer protocol.
 *
 * Packet format (3-byte header + payload):
 *   Byte 0: packet type (7=START, 8=DATA, 9=END, 10=LOOPBACK)
 *   Byte 1: packet number
 *   Byte 2: payload length
 *   Byte 3+: payload
 *
 * Maximum total packet size: 244 bytes (BLE MTU limit).
 */

import { FILE_START, FILE_DATA, FILE_END, FILE_LOOPBACK } from './fileTransferTypes'

function buildPacket(type: number, pktNum: number, payload: Uint8Array): Uint8Array {
  const packet = new Uint8Array(3 + payload.length)
  packet[0] = type
  packet[1] = pktNum
  packet[2] = payload.length
  packet.set(payload, 3)
  return packet
}

/**
 * Build a FILE_START packet.
 *
 * Payload layout:
 *   [0..3]  total file size, 32-bit little-endian
 *   [4..]   filename, null-terminated, 8.3 upper-case format
 */
export function buildFileStartPacket(filename: string, totalSize: number): Uint8Array {
  const nameBytes = new TextEncoder().encode(filename + '\0')
  const payload = new Uint8Array(4 + nameBytes.length)
  const view = new DataView(payload.buffer)
  view.setUint32(0, totalSize, true) // little-endian
  payload.set(nameBytes, 4)
  return buildPacket(FILE_START, 0, payload)
}

/**
 * Build a FILE_DATA packet.
 *
 * @param packetNum  Wire packet number (1–255, wraps 255→1)
 * @param chunk      File data bytes (≤241 bytes)
 */
export function buildFileDataPacket(packetNum: number, chunk: Uint8Array): Uint8Array {
  return buildPacket(FILE_DATA, packetNum, chunk)
}

/**
 * Build a FILE_END packet.
 *
 * Payload: CRC16-CCITT of entire file, 16-bit little-endian.
 */
export function buildFileEndPacket(crc: number): Uint8Array {
  const payload = new Uint8Array(2)
  new DataView(payload.buffer).setUint16(0, crc, true) // little-endian
  return buildPacket(FILE_END, 0, payload)
}

/**
 * Build a FILE_LOOPBACK packet for BLE round-trip latency measurement.
 *
 * The device echoes the entire packet back as a binary notification
 * WITHOUT involving I2C or the AI processor. No `ftx ack` string is sent.
 * Loopback packets are always accepted regardless of transfer state.
 *
 * @param seqNum   Sequence number for tracking (0–255)
 * @param payload  Arbitrary payload (device echoes it back unchanged)
 */
export function buildFileLoopbackPacket(seqNum: number, payload: Uint8Array): Uint8Array {
  return buildPacket(FILE_LOOPBACK, seqNum, payload)
}
