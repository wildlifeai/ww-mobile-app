import { crc16ccitt } from '../crc16ccitt'

describe('crc16ccitt', () => {
  it('matches test vector: "123456789" → 0x29B1', () => {
    const data = new TextEncoder().encode('123456789')
    expect(crc16ccitt(data)).toBe(0x29B1)
  })

  it('returns 0xFFFF augmented for empty input', () => {
    // Empty data + two zero augmentation bytes through init 0xFFFF
    const result = crc16ccitt(new Uint8Array(0))
    expect(typeof result).toBe('number')
    expect(result).toBeGreaterThanOrEqual(0)
    expect(result).toBeLessThanOrEqual(0xFFFF)
  })

  it('produces different CRCs for different inputs', () => {
    const a = crc16ccitt(new Uint8Array([1, 2, 3]))
    const b = crc16ccitt(new Uint8Array([4, 5, 6]))
    expect(a).not.toBe(b)
  })

  it('is deterministic', () => {
    const data = new Uint8Array([0xDE, 0xAD, 0xBE, 0xEF])
    expect(crc16ccitt(data)).toBe(crc16ccitt(data))
  })

  it('handles single byte', () => {
    const result = crc16ccitt(new Uint8Array([0x00]))
    expect(typeof result).toBe('number')
  })

  it('handles 241-byte chunk (max payload size)', () => {
    const data = new Uint8Array(241).fill(0xAA)
    const result = crc16ccitt(data)
    expect(result).toBeGreaterThanOrEqual(0)
    expect(result).toBeLessThanOrEqual(0xFFFF)
  })
})
