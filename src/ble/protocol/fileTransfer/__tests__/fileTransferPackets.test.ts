import { buildFileStartPacket, buildFileDataPacket, buildFileEndPacket } from '../fileTransferPackets'
import { FILE_START, FILE_DATA, FILE_END } from '../fileTransferTypes'

describe('fileTransferPackets', () => {
  describe('buildFileStartPacket', () => {
    it('builds correct header bytes', () => {
      const pkt = buildFileStartPacket('TEST.BIN', 1024)
      expect(pkt[0]).toBe(FILE_START)  // type = 7
      expect(pkt[1]).toBe(0)           // packet number = 0 for START
    })

    it('encodes file size as 32-bit little-endian', () => {
      const pkt = buildFileStartPacket('A.B', 0x12345678)
      // payload starts at byte 3
      expect(pkt[3]).toBe(0x78)  // LE byte 0
      expect(pkt[4]).toBe(0x56)  // LE byte 1
      expect(pkt[5]).toBe(0x34)  // LE byte 2
      expect(pkt[6]).toBe(0x12)  // LE byte 3
    })

    it('includes null-terminated filename', () => {
      const pkt = buildFileStartPacket('MODEL.TFL', 100)
      // filename starts at payload[4] = byte 7
      const filenameBytes = Array.from(pkt.slice(7))
      const filenameStr = String.fromCharCode(...filenameBytes.slice(0, -1)) // strip null
      expect(filenameStr).toBe('MODEL.TFL')
      expect(filenameBytes[filenameBytes.length - 1]).toBe(0) // null terminator
    })

    it('payload length field is correct', () => {
      const pkt = buildFileStartPacket('X.Y', 256)
      // payload = 4 (size) + 3 (filename) + 1 (null) = 8
      expect(pkt[2]).toBe(8)
    })
  })

  describe('buildFileDataPacket', () => {
    it('builds correct header bytes', () => {
      const chunk = new Uint8Array([0xDE, 0xAD, 0xBE, 0xEF])
      const pkt = buildFileDataPacket(42, chunk)
      expect(pkt[0]).toBe(FILE_DATA) // type = 8
      expect(pkt[1]).toBe(42)        // packet number
      expect(pkt[2]).toBe(4)         // payload length
    })

    it('copies chunk data correctly', () => {
      const chunk = new Uint8Array([1, 2, 3, 4, 5])
      const pkt = buildFileDataPacket(1, chunk)
      expect(Array.from(pkt.slice(3))).toEqual([1, 2, 3, 4, 5])
    })

    it('handles max payload size (241 bytes)', () => {
      const chunk = new Uint8Array(241).fill(0xFF)
      const pkt = buildFileDataPacket(255, chunk)
      expect(pkt.length).toBe(244) // 3 header + 241 payload
      expect(pkt[0]).toBe(FILE_DATA)
      expect(pkt[1]).toBe(255)
      expect(pkt[2]).toBe(241)
    })

    it('handles packet number wrapping 255→1', () => {
      const pkt255 = buildFileDataPacket(255, new Uint8Array([0x00]))
      const pkt1 = buildFileDataPacket(1, new Uint8Array([0x00]))
      expect(pkt255[1]).toBe(255)
      expect(pkt1[1]).toBe(1)
    })
  })

  describe('buildFileEndPacket', () => {
    it('builds correct header bytes', () => {
      const pkt = buildFileEndPacket(0x29B1)
      expect(pkt[0]).toBe(FILE_END) // type = 9
      expect(pkt[1]).toBe(0)        // packet number = 0 for END
      expect(pkt[2]).toBe(2)        // payload length = 2 (CRC)
    })

    it('encodes CRC as 16-bit little-endian', () => {
      const pkt = buildFileEndPacket(0x29B1)
      expect(pkt[3]).toBe(0xB1)  // low byte
      expect(pkt[4]).toBe(0x29)  // high byte
    })

    it('total packet size is 5', () => {
      const pkt = buildFileEndPacket(0)
      expect(pkt.length).toBe(5) // 3 header + 2 CRC
    })
  })
})
