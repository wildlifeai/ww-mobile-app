/**
 * projectLorawanPing: the project's LoRaWAN check-in period, written to the
 * camera as op32 when the project requires LoRaWAN (#551).
 *
 * The `projects` row carries it as `lorawan_ping_minutes`, CHECK 60 to 1440,
 * default 240 (ww-backend #407). The website is its only editor: the app's
 * project form has no control for it, so a project created in the app gets the
 * default. Each deployment records what it wrote in its own
 * `lorawan_ping_minutes`, which the website's Silent state and the
 * `camera_silent` alert judge silence by.
 *
 * Every 4 hours is the period the firmware of ww-hardware PR #81 is designed
 * for, sending at most one detection and one health event per period (decided
 * 25 November 2026, #532). Shorter would use more of The Things Network's 10
 * downlinks a day per camera, since every check-in is acknowledged.
 */

/** `projects.lorawan_ping_minutes`, the column default: every 4 hours. */
export const DEFAULT_LORAWAN_PING_MINUTES = 240

/** The backend's CHECK, the range a downlink may also set op32 to (ww-backend #403). */
export const LORAWAN_PING_MINUTES_RANGE = { min: 60, max: 1440 } as const

/** The shape read off a project row; optional so a stale local record still resolves. */
export interface ProjectLorawanPingColumns {
    lorawan_ping_minutes?: number | null
}

/**
 * The project's check-in period in minutes, falling back to the column default
 * when it is missing or outside the CHECK range. The server cannot hold such a
 * value; locally, 0 is what WatermelonDB keeps in a number column nobody wrote.
 */
export const resolveLorawanPingMinutes = (project?: ProjectLorawanPingColumns | null): number => {
    const minutes = project?.lorawan_ping_minutes
    return typeof minutes === 'number'
        && Number.isInteger(minutes)
        && minutes >= LORAWAN_PING_MINUTES_RANGE.min
        && minutes <= LORAWAN_PING_MINUTES_RANGE.max
        ? minutes
        : DEFAULT_LORAWAN_PING_MINUTES
}
