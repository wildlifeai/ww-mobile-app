/**
 * flashSettings: the six op parameters the Flash settings flow edits, read
 * from the device's op table and turned back into the writes that change them.
 *
 * Asked for by Charles Palmer for flash experiments (6 October 2026): the
 * capture flash mode and its time-of-day window (op34 to op36), which LED the
 * capture flash uses (op13), its brightness (op9) and the brightness of the
 * motion-detection light (op22). op12 FLASH_DURATION is left out on purpose:
 * the firmware turns the LED off when the image arrives and reads op12 nowhere.
 */
import { OP_PARAMETER } from '../hooks/useDeviceSettings'

export interface FlashSettings {
    /** op34 FLASH_MODE: 0 off, 1 light sensor, 2 always on, 3 time of day */
    mode: number
    /** op13 FLASH_LED: 0 none, 1 white, 2 infrared */
    led: number
    /** op9 LED_BRIGHTNESS, percent */
    ledBrightness: number
    /** op22 MD_FLASH_BRIGHTNESS_PERCENT */
    mdBrightness: number
    /** op35 FLASH_TOD_START, minutes after midnight UTC */
    windowStartUtc: number
    /** op36 FLASH_TOD_DURATION, minutes on */
    windowMinutes: number
}

/** op34 value for the time-of-day mode, the one that uses op35 and op36 */
export const FLASH_MODE_TIME_OF_DAY = 3

const FIELD_OPS: { key: keyof FlashSettings; index: number }[] = [
    { key: 'led', index: OP_PARAMETER.FLASH_LED },
    { key: 'ledBrightness', index: OP_PARAMETER.LED_BRIGHTNESS },
    { key: 'mdBrightness', index: OP_PARAMETER.MD_FLASH_BRIGHTNESS_PERCENT },
    { key: 'windowStartUtc', index: OP_PARAMETER.FLASH_TOD_START },
    { key: 'windowMinutes', index: OP_PARAMETER.FLASH_TOD_DURATION },
    // Last, so the mode that uses the window is set after the window is
    { key: 'mode', index: OP_PARAMETER.FLASH_MODE },
]

/**
 * The six values from an `AI getop -1` table. Null when the firmware predates
 * the flash mode (fewer than 37 parameters) or any of the six is not a number,
 * so the screen can say so instead of showing a guess.
 */
export const readFlashSettings = (ops: string[] | null | undefined): FlashSettings | null => {
    if (!ops || ops.length <= OP_PARAMETER.FLASH_TOD_DURATION) return null
    const settings = {} as FlashSettings
    for (const { key, index } of FIELD_OPS) {
        const value = parseInt(ops[index] ?? '', 10)
        if (isNaN(value)) return null
        settings[key] = value
    }
    return settings
}

/**
 * The `setop` writes that take the device from `before` to `after`, only for
 * the values that differ. The window is written only in time-of-day mode,
 * where it means something; outside it the device's values are left alone.
 */
export const flashSettingsWrites = (
    before: FlashSettings,
    after: FlashSettings,
): { index: number; value: number }[] =>
    FIELD_OPS
        .filter(({ key }) =>
            after.mode === FLASH_MODE_TIME_OF_DAY || (key !== 'windowStartUtc' && key !== 'windowMinutes'))
        .filter(({ key }) => before[key] !== after[key])
        .map(({ key, index }) => ({ index, value: after[key] }))

/** A typed percentage as 0 to 100, or null when it is not a whole number in range. */
export const parsePercent = (text: string): number | null => {
    if (!/^\s*\d{1,3}\s*$/.test(text)) return null
    const value = parseInt(text, 10)
    return value <= 100 ? value : null
}
