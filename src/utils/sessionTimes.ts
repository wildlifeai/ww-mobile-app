/**
 * How long a monitoring session ran, and when it started and ended, as the
 * device summary shows them. A 4-minute session read "0 hours" and the times
 * were dates only (#575).
 */

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

/** A real date: set, parseable and after 2000, so an epoch-zero placeholder does not count */
const isValidDate = (date: unknown): boolean => {
    if (!date) return false
    const d = new Date(date as string | number | Date)
    return !isNaN(d.getTime()) && d.getTime() > 946684800000
}

const plural = (n: number, word: string) => `${n} ${word}${n !== 1 ? 's' : ''}`

/** "4 min", "1 hour 5 min", "2 days and 3 hours"; an open session runs to `now` */
export const formatSessionDuration = (start: unknown, end: unknown, now: Date = new Date()): string => {
    if (!isValidDate(start)) return '--'
    const startDate = new Date(start as string | number | Date)
    const endDate = isValidDate(end) ? new Date(end as string | number | Date) : now
    const diffMs = endDate.getTime() - startDate.getTime()
    if (diffMs < 0) return '--'

    const days = Math.floor(diffMs / DAY_MS)
    const hours = Math.floor((diffMs % DAY_MS) / HOUR_MS)
    const minutes = Math.floor((diffMs % HOUR_MS) / MINUTE_MS)

    if (days > 0) return `${plural(days, 'day')} and ${plural(hours, 'hour')}`
    if (hours > 0) return minutes > 0 ? `${plural(hours, 'hour')} ${minutes} min` : plural(hours, 'hour')
    return `${minutes} min`
}

/** The phone's local date, and the time to the minute */
export const formatSessionDate = (date: unknown): string => {
    if (!isValidDate(date)) return 'Unknown'
    const d = new Date(date as string | number | Date)
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}
