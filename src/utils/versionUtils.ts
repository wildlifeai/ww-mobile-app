/**
 * Converts MM.mm.bb format (from BLE) to semantic version M.m.b
 * Examples:
 * - "00.21.23" → "0.21.23"
 * - "01.05.01" → "1.5.1"
 */
export const convertBleToSemanticVersion = (bleVersion: string): string => {
    // Attempt to match the first pattern that looks like a version number (e.g., 00.30.03 or 1.2.3)
    const match = bleVersion.match(/(\d+)\.(\d+)\.(\d+)/)
    
    if (match) {
        const major = parseInt(match[1], 10)
        const minor = parseInt(match[2], 10)
        const build = parseInt(match[3], 10)
        return `${major}.${minor}.${build}`
    }

    // Handle "0" case or other fallback
    if (bleVersion === '0') return '0.0.0'

    return bleVersion
}

/** Highest release number first ("0.30.57" before "0.30.9"), the order BLE builds are picked in */
export const newestReleaseFirst = (a?: string | null, b?: string | null): number =>
    (b || '0.0.0').localeCompare(a || '0.0.0', undefined, { numeric: true, sensitivity: 'base' })

/** What the AI build order reads from a firmware row */
interface AiBuild {
    id?: string
    version?: string | null
    buildDate?: string | null
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** A compiler date such as "Oct  9 2026" (a one-digit day is space-padded) as ms at midnight, else null */
const dayOf = (date?: string | null): number | null => {
    const match = date?.trim().match(/^([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})$/)
    if (!match) return null
    const month = MONTHS.indexOf(match[1])
    const day = Number(match[2])
    return month >= 0 && day >= 1 && day <= 31 ? Date.UTC(Number(match[3]), month, day) : null
}

/**
 * When an AI (Himax) build was compiled, in ms, or null when neither field
 * says. The day is `build_date`, the image's `__DATE__` as the upload stored
 * it, else the date in the version (`WW500_C02 10:56:08 Oct  9 2026`). The
 * time of day is the version's, else midnight: `build_date` has none, and two
 * builds of one day are common. Read as UTC, so the phone's time zone cannot
 * change the order.
 */
export const aiBuildTime = ({ version, buildDate }: AiBuild): number | null => {
    const stamp = version?.match(/([01]\d|2[0-3]):([0-5]\d):([0-5]\d)\s+([A-Za-z]{3}\s+\d{1,2}\s+\d{4})/)
    const day = dayOf(buildDate) ?? dayOf(stamp?.[4])
    if (day === null) return null
    const time = stamp ? ((Number(stamp[1]) * 60 + Number(stamp[2])) * 60 + Number(stamp[3])) * 1000 : 0
    return day + time
}

/**
 * Newest AI build first, for `sort` (#457). The version starts with the time
 * of day, so sorting it as text ordered builds by time of day, then month
 * name, and never by date. A build with no readable date sorts after every
 * dated one. Two of the same instant, or two undated, go by release number as
 * BLE builds do, then by row id, so the pick never depends on the order the
 * rows were read in.
 */
export const newestAiBuildFirst = (a: AiBuild, b: AiBuild): number => {
    const timeA = aiBuildTime(a)
    const timeB = aiBuildTime(b)
    if (timeA !== timeB) {
        if (timeA === null) return 1
        if (timeB === null) return -1
        return timeB - timeA
    }
    return newestReleaseFirst(a.version, b.version) || (a.id ?? '').localeCompare(b.id ?? '')
}

