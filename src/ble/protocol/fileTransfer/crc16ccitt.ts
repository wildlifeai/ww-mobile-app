/**
 * CRC-16/CCITT-FALSE
 *
 * Polynomial: 0x1021
 * Initial value: 0xFFFF
 * Input/Output reflection: No
 * Final XOR: 0x0000
 *
 * Test vector: "123456789" (9 bytes) → 0x29B1
 *
 * This is the variant commonly called "CRC-CCITT (0xFFFF)" or "CRC-16/CCITT-FALSE".
 * It is NOT the XMODEM variant (init=0x0000) or the augmented variant.
 *
 * The HX6538 will implement the same algorithm. Both sides must produce
 * identical CRC values for the same input data.
 */
/* eslint-disable no-bitwise -- Bitwise ops required for CRC-16 algorithm */
export function crc16ccitt(data: Uint8Array): number {
  let crc = 0xFFFF
  const poly = 0x1021

  for (const byte of data) {
    crc ^= (byte << 8) & 0xFFFF
    for (let i = 0; i < 8; i++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ poly) & 0xFFFF
      } else {
        crc = (crc << 1) & 0xFFFF
      }
    }
  }

  return crc
}
/* eslint-enable no-bitwise */
