import { parseBleFirmwareVersion } from '../../commandRegistry'
import { judgeBleFirmware, MIN_BLE_FIRMWARE_FOR_TRANSFER } from '../bleFirmwareFloor'

/**
 * The nRF's `ver` reply is the only thing that tells the app which relay it
 * is talking to, and the file transfer's window only works from 0.30.47 (#289).
 * The reply pads every part to two digits; the cloud's `ble` rows do not.
 */
describe('parseBleFirmwareVersion', () => {
    it.each([
        ['the whole reply', 'WW500-C02 V 00.30.51 08:16:11 Sep 18 2026', { major: 0, minor: 30, patch: 51 }],
        ['the padded token the version command returns', '00.30.51', { major: 0, minor: 30, patch: 51 }],
        ['an unpadded version, as the cloud writes it', '0.30.47', { major: 0, minor: 30, patch: 47 }],
        ['the pre-FIFO build on ww-hardware main', '00.23.29', { major: 0, minor: 23, patch: 29 }],
        ['a token with a build suffix', '00.30.51-rc1', { major: 0, minor: 30, patch: 51 }],
        ['a v-prefixed version', 'v0.30.48', { major: 0, minor: 30, patch: 48 }],
    ])('reads %s', (_label, reply, expected) => {
        expect(parseBleFirmwareVersion(reply)).toEqual(expected)
    })

    it.each([
        ['an empty string', ''],
        ['text with no version', 'Unrecognised command'],
        ['two parts', 'V 00.30'],
        ['four parts', '1.2.3.4'],
        ['a Himax `AI ver` reply', 'WW500_C02 10:59:43 May 20 2026'],
        ['null', null],
        ['undefined', undefined],
    ])('returns null for %s', (_label, reply) => {
        expect(parseBleFirmwareVersion(reply as string | null | undefined)).toBeNull()
    })
})

describe('judgeBleFirmware against the floor', () => {
    it('names the floor as 0.30.47', () => {
        expect(MIN_BLE_FIRMWARE_FOR_TRANSFER).toBe('0.30.47')
    })

    it.each([
        ['00.30.47', 'supported', '0.30.47'],
        ['00.30.51', 'supported', '0.30.51'],
        ['01.00.00', 'supported', '1.0.0'],
        ['00.30.46', 'too_old', '0.30.46'],
        ['00.23.29', 'too_old', '0.23.29'],
    ])('%s is %s', (reading, verdict, version) => {
        expect(judgeBleFirmware(reading)).toEqual({ verdict, version })
    })

    it('calls a reading it cannot parse unknown, not a pass or a refusal', () => {
        expect(judgeBleFirmware('garbage')).toEqual({ verdict: 'unknown' })
        expect(judgeBleFirmware(null)).toEqual({ verdict: 'unknown' })
    })
})
