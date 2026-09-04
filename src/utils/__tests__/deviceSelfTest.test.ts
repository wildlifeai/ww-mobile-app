import {
    selfTestWarnings,
    decodeSelfTest,
    isBootPreset,
    parseSelfTestBits,
    formatSelfTestBits,
    ERROR_BITS_LINE,
    CRITICAL_AI_MASK,
    KNOWN_BITS_MASK,
    SelfTestBit,
} from '../deviceSelfTest'

describe('deviceSelfTest', () => {
    it('parses the device line and a bare hex value', () => {
        expect(parseSelfTestBits('Error bits = 0x0A00')).toBe(0x0a00)
        expect(parseSelfTestBits('0x0001')).toBe(1)
        expect(parseSelfTestBits('Wake')).toBeNull()
        expect(parseSelfTestBits(null)).toBeNull()
    })

    it('matches only the Error bits line', () => {
        expect(ERROR_BITS_LINE.test('Error bits = 0x0000')).toBe(true)
        expect(ERROR_BITS_LINE.test('  error bits = 0xabcd')).toBe(true)
        expect(ERROR_BITS_LINE.test('Wakeup_event = 0x0000')).toBe(false)
    })

    it('formats the way the device prints', () => {
        expect(formatSelfTestBits(0)).toBe('0x0000')
        expect(formatSelfTestBits(0x0a00)).toBe('0x0A00')
    })

    it('recognises the boot preset only when every AI bit is set', () => {
        expect(isBootPreset(0xff00)).toBe(true)
        expect(isBootPreset(0xff01)).toBe(true)
        expect(isBootPreset(0x0f00)).toBe(false)
        expect(isBootPreset(0)).toBe(false)
    })

    it('names each known bit with the wording the banners have always used', () => {
        expect(selfTestWarnings(0)).toEqual([])
        expect(selfTestWarnings(1 << SelfTestBit.LOW_BATTERY)).toEqual(['Low Battery detected (Bit 0)'])
        expect(selfTestWarnings((1 << SelfTestBit.AI_NO_SD_CARD) | (1 << SelfTestBit.LORAWAN_ERROR)))
            .toEqual(['LoRaWAN Error (Bit 2)', 'Device has no SD card detected (Bit 11)'])
    })

    it('reports a bit it does not know as an unknown issue, alongside the known ones', () => {
        expect(selfTestWarnings(1 << 15)).toEqual(['Unknown hardware issue (Code: 0x8000)'])
        expect(selfTestWarnings((1 << 15) | 1)).toEqual([
            'Low Battery detected (Bit 0)',
            'Unknown hardware issue (Code: 0x8001)',
        ])
    })

    it('keeps the masks in step with the table', () => {
        expect(KNOWN_BITS_MASK).toBe(0x3f1f)
        expect(CRITICAL_AI_MASK).toBe(0x2300)
        expect(decodeSelfTest(CRITICAL_AI_MASK).every(i => i.severity !== undefined)).toBe(true)
    })
})
