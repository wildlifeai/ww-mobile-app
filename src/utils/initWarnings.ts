/**
 * The initialisation banner's lines, sorted by what the person at the camera
 * should do about them (StatusInitializationHeader, on Start and Stop
 * Monitoring).
 *
 * A fault (a camera that did not answer, a failed time sync, an unknown
 * self-test bit) is listed under "Hardware:" with a request to report it. A
 * minor line is something they fix or can ignore and that never blocks a start:
 * a low battery, newer firmware, a card nearly full. Those carry no request to
 * report, and a banner holding only those can be dismissed. Until 26 October
 * 2026 every line asked for a report, and people reported their batteries.
 *
 * The lines are plain strings, built here and matched here by their start, so
 * a check that words one differently stops being minor rather than silently
 * dropping out of the banner.
 */

const BATTERY_LOW = 'Battery is low'
/** The BLE firmware line; the AI one below does not start with it. */
export const NEWER_BLE_FIRMWARE = 'Newer firmware available'
export const NEWER_AI_FIRMWARE = 'Newer AI firmware available'
const SD_CARD_ALMOST_FULL = 'SD Card is almost full'

const MINOR = [BATTERY_LOW, NEWER_BLE_FIRMWARE, NEWER_AI_FIRMWARE, SD_CARD_ALMOST_FULL]

/** A low battery is the user's to fix, so the line says what to do. With the level when the app read one. */
export function batteryLowWarning(level?: number): string {
    return `${BATTERY_LOW}${level === undefined ? '' : ` (${level}%)`}. Replace the batteries before deploying.`
}

export const sdCardAlmostFullWarning = (percentFull: number): string =>
    `${SD_CARD_ALMOST_FULL} (${percentFull.toFixed(1)}% used)`

export const isMinorWarning = (line: string): boolean => MINOR.some(start => line.startsWith(start))

/**
 * Sorts the banner's lines. Self-test bit 0 and a low reading can both say the
 * battery is low: one line is kept, the reading, as it carries the level.
 */
export function sortInitWarnings(lines: readonly string[]): { battery: string | null; minor: string[]; faults: string[] } {
    const battery = lines.filter(l => l.startsWith(BATTERY_LOW))
    return {
        battery: battery.find(l => l.includes('%)')) ?? battery[0] ?? null,
        minor: lines.filter(l => isMinorWarning(l) && !l.startsWith(BATTERY_LOW)),
        faults: lines.filter(l => !isMinorWarning(l)),
    }
}
