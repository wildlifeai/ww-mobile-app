import {
    selfTestWarnings,
    decodeSelfTest,
    isBootPreset,
    parseSelfTestBits,
    formatSelfTestBits,
    ERROR_BITS_LINE,
    CRITICAL_AI_MASK,
    KNOWN_BITS_MASK,
    FAULT_BITS_MASK,
    PROVISIONAL_BIT,
    isProvisional,
    SD_CARD_NOT_CHECKED_WARNING,
    SD_CARD_POWER_CYCLE_HINT,
    HM0360_POWER_CYCLE_HINT,
    NIGHT_SENSOR_WARNING,
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

    // ww-hardware PR #73: the BLE processor resets itself after a fault and
    // keeps a record. Until bit 5 was named, every connection to such a device
    // said "Unknown hardware issue (Code: 0x0020)" (#482).
    it('names bit 5, the fault reset, as a warning rather than an unknown code', () => {
        const bits = (1 << SelfTestBit.FAULT_RESET) | (1 << SelfTestBit.WATCHDOG_RESET)
        expect(bits).toBe(0x0028)
        expect(KNOWN_BITS_MASK & 0x0020).toBe(0x0020)
        expect(selfTestWarnings(bits)).toEqual([
            'Watchdog Reset occurred (Bit 3)',
            'The device restarted after a firmware fault (Bit 5)',
        ])
        const issue = decodeSelfTest(0x0020)[0]
        expect(issue.severity).toBe('warning')
        expect(issue.title).toMatch(/firmware fault/)
        expect(CRITICAL_AI_MASK & 0x0020).toBe(0)
    })

    it('names each known bit with the wording the banners have always used', () => {
        expect(selfTestWarnings(0)).toEqual([])
        expect(selfTestWarnings(1 << SelfTestBit.LOW_BATTERY)).toEqual(['Battery is low. Replace the batteries before deploying.'])
        expect(selfTestWarnings((1 << SelfTestBit.AI_NO_SD_CARD) | (1 << SelfTestBit.LORAWAN_ERROR)))
            .toEqual([
                'LoRaWAN Error (Bit 2)',
                'Device has no SD card detected (Bit 11). Power cycle the camera after inserting or reseating a card',
            ])
    })

    // A card put into a powered camera is never mounted, and bit 11 stays set
    // until a power cycle, so a message that only says "insert a card and
    // check again" describes the one thing that cannot work (#325).
    it('tells the operator to power cycle wherever it reports a missing SD card (#325)', () => {
        expect(SD_CARD_POWER_CYCLE_HINT).toMatch(/power cycle the camera/)

        const [issue] = decodeSelfTest(1 << SelfTestBit.AI_NO_SD_CARD)
        expect(issue.hint).toContain(SD_CARD_POWER_CYCLE_HINT)

        const [warning] = selfTestWarnings(1 << SelfTestBit.AI_NO_SD_CARD)
        expect(warning).toMatch(/power cycle/i)
        // Start Monitoring picks its "No SD Card" blocker by these words.
        expect(warning).toMatch(/no sd card/i)
    })

    // An HM0360 that did not start at power-on is cleared by a power cycle,
    // not by the cable every message used to point at first (#477).
    it('says to power cycle before checking the ribbon wherever it reports bit 9 (#477)', () => {
        const powerCycleFirst = (text: string) => {
            expect(text).toMatch(/power cycle the camera/i)
            expect(text.search(/power cycle/i)).toBeLessThan(text.search(/ribbon/i))
        }
        powerCycleFirst(HM0360_POWER_CYCLE_HINT)

        const [issue] = decodeSelfTest(1 << SelfTestBit.AI_NO_HM0360)
        powerCycleFirst(issue.hint)

        const [warning] = selfTestWarnings(1 << SelfTestBit.AI_NO_HM0360)
        powerCycleFirst(warning)
        expect(warning).toBe(NIGHT_SENSOR_WARNING)
        // Start Monitoring picks its camera blocker by these words.
        expect(warning).toContain('Camera Error')
    })

    it('reports a bit it does not know as an unknown issue, alongside the known ones', () => {
        expect(selfTestWarnings(1 << 7)).toEqual(['Unknown hardware issue (Code: 0x0080)'])
        expect(selfTestWarnings((1 << 7) | 1)).toEqual([
            'Battery is low. Replace the batteries before deploying.',
            'Unknown hardware issue (Code: 0x0081)',
        ])
    })

    // Seeed PR #240 added bit 14 on 29 September 2026 and the app called it
    // "Unknown" until ww-hardware issue 56. Since Seeed PR #286 it is kept until
    // a final reading has carried it, so it does reach the app: it is named and
    // it never blocks a deployment.
    it('names bit 14, the AI processor missing the BLE processor at boot, as a warning only', () => {
        expect(SelfTestBit.AI_NO_BLE).toBe(14)

        const issues = decodeSelfTest(0x4000)
        expect(issues).toHaveLength(1)
        expect(issues[0].bit).toBe(14)
        expect(issues[0].severity).toBe('warning')
        expect(issues[0].title).toMatch(/Camera processor could not reach the Bluetooth chip at start-up/)

        expect(CRITICAL_AI_MASK & 0x4000).toBe(0)
        expect(selfTestWarnings(0x4000)).toEqual(['AI processor lost contact with the BLE processor at boot (Bit 14)'])
    })

    // The numbers are checked against the firmware by scripts/check-selftest-bits.js;
    // this keeps the app's own tables agreeing with its enum.
    it('has exactly one issue row and one banner line for every fault bit it names', () => {
        const bits = Object.values(SelfTestBit)
            .filter((v): v is number => typeof v === 'number')
            .filter(bit => bit !== SelfTestBit.AI_PROVISIONAL)
        expect(bits.length).toBeGreaterThan(0)
        for (const bit of bits) {
            expect(decodeSelfTest(1 << bit).map(i => i.bit)).toEqual([bit])
            const warnings = selfTestWarnings(1 << bit)
            expect(warnings).toHaveLength(1)
            expect(warnings[0]).not.toMatch(/^Unknown/)
        }
        expect(FAULT_BITS_MASK).toBe(bits.reduce((mask, bit) => mask | (1 << bit), 0))
        expect(KNOWN_BITS_MASK).toBe(FAULT_BITS_MASK | PROVISIONAL_BIT)
    })

    // Seeed issue #290: a warm wake's first reading goes out before the SD card
    // is mounted, with bit 15 set, and the final one follows unasked. Bit 15 is
    // a state, not a fault, so it gives no banner, no issue and no unknown code.
    it('knows bit 15, the provisional reading, and never reports it', () => {
        expect(SelfTestBit.AI_PROVISIONAL).toBe(15)
        expect(PROVISIONAL_BIT).toBe(0x8000)
        expect(isProvisional(0x8000)).toBe(true)
        expect(isProvisional(0x8800)).toBe(true)
        expect(isProvisional(0x0800)).toBe(false)

        expect(decodeSelfTest(0x8000)).toEqual([])
        expect(selfTestWarnings(0x8000)).toEqual([])
        expect(selfTestWarnings(0x8100)).toEqual(['Main Camera Error (Bit 8)'])
        expect(CRITICAL_AI_MASK & PROVISIONAL_BIT).toBe(0)
        // The nRF's boot preset still sets the whole AI byte, bit 15 included
        expect(isBootPreset(0xff00)).toBe(true)
        expect(isBootPreset(0x8000)).toBe(false)
    })

    it('words the card-not-checked warning so Start Monitoring never takes it for a missing card', () => {
        expect(SD_CARD_NOT_CHECKED_WARNING).not.toMatch(/no sd card/i)
        expect(SD_CARD_NOT_CHECKED_WARNING).toMatch(/Bit 15/)
    })

    it('keeps the masks in step with the table', () => {
        // 0x0020 since bit 5, the BLE fault reset (#482)
        expect(FAULT_BITS_MASK).toBe(0x7f3f)
        // Bit 15 is known, never a fault (#521)
        expect(KNOWN_BITS_MASK).toBe(0xff3f)
        // Camera, HM0360, NN and, since #303, the SD card: 0x0800
        expect(CRITICAL_AI_MASK).toBe(0x2b00)
        expect(decodeSelfTest(CRITICAL_AI_MASK).every(i => i.severity !== undefined)).toBe(true)
    })

    it('treats a missing SD card as critical, and a low battery as not (#303)', () => {
        expect((CRITICAL_AI_MASK & (1 << SelfTestBit.AI_NO_SD_CARD)) !== 0).toBe(true)
        expect((CRITICAL_AI_MASK & (1 << SelfTestBit.LOW_BATTERY)) !== 0).toBe(false)
        expect(decodeSelfTest(1 << SelfTestBit.AI_NO_SD_CARD)[0].severity).toBe('error')
    })
})
