import { FLASH_MODE_TIME_OF_DAY, flashSettingsWrites, parsePercent, readFlashSettings } from '../flashSettings'

/** An op table as `AI getop -1` reports it, 37 entries, with the six set. */
const opTable = (overrides: Record<number, string> = {}): string[] => {
    const ops = Array.from({ length: 37 }, () => '0')
    Object.assign(ops, { 9: '5', 13: '2', 22: '25', 34: '1', 35: '360', 36: '720' }, overrides)
    return ops
}

describe('flashSettings', () => {
    it('reads the six values from the op table', () => {
        expect(readFlashSettings(opTable())).toEqual({
            mode: 1, led: 2, ledBrightness: 5, mdBrightness: 25, windowStartUtc: 360, windowMinutes: 720,
        })
    })

    it('reads nothing from firmware without the flash mode', () => {
        expect(readFlashSettings(opTable().slice(0, 34))).toBeNull()
        expect(readFlashSettings(null)).toBeNull()
        expect(readFlashSettings(opTable({ 34: 'x' }))).toBeNull()
    })

    it('writes only what changed', () => {
        const before = readFlashSettings(opTable())!
        expect(flashSettingsWrites(before, { ...before, ledBrightness: 50 })).toEqual([{ index: 9, value: 50 }])
        expect(flashSettingsWrites(before, before)).toEqual([])
    })

    it('writes the window only in time-of-day mode, and the mode after it', () => {
        const before = readFlashSettings(opTable())!
        const changedWindow = { ...before, windowStartUtc: 1230, windowMinutes: 30 }

        // In light-sensor mode the window means nothing, so it is not written
        expect(flashSettingsWrites(before, changedWindow)).toEqual([])

        expect(flashSettingsWrites(before, { ...changedWindow, mode: FLASH_MODE_TIME_OF_DAY })).toEqual([
            { index: 35, value: 1230 },
            { index: 36, value: 30 },
            { index: 34, value: 3 },
        ])
    })

    it('takes a percentage only as a whole number up to 100', () => {
        expect(parsePercent('0')).toBe(0)
        expect(parsePercent(' 75 ')).toBe(75)
        expect(parsePercent('100')).toBe(100)
        expect(parsePercent('101')).toBeNull()
        expect(parsePercent('-5')).toBeNull()
        expect(parsePercent('12.5')).toBeNull()
        expect(parsePercent('')).toBeNull()
    })
})
