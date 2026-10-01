/**
 * projectBurst: how many pictures a trigger takes and how far apart, from the
 * project to op values (#317).
 *
 * The `projects` row carries the burst as two columns (ww-backend #227):
 * `photos_per_trigger`, CHECK 1 to 10, default 3, and
 * `photo_interval_milliseconds`, CHECK 200 to 2000, default 1000. The device
 * carries them as op5 NUM_PICTURES and op6 PICTURE_INTERVAL, read on every
 * motion and timelapse trigger alike.
 *
 * The project value counts the photos the user sees, the JPEGs. With the raw
 * BMP on (TEST_BIT_SAVE_BMP in op18), the firmware alternates JPEG and BMP
 * through the same count, so op5 has to be twice the project value for each
 * JPEG to keep its BMP. Decided on 30 September 2026, recorded in #317.
 *
 * Why the deployment writes both: op5 is in RESET_PRESERVED_OPS, so the reset
 * leaves whatever the card held, and op6 is not, so the reset leaves the
 * factory 500 ms. Nothing else writes op6.
 *
 * A burst also decides op8, the inactivity before the camera sleeps. The
 * firmware sleeps while it waits for the next picture once op8 has run out
 * (Seeed #208, `handleEventForWaitForTimer` in image_task.c), and its
 * config_file.md says op6 must be less than op8. So a trigger that takes more
 * than one picture writes op8 = op6 + 1000 ms, and a single picture keeps the
 * usual 1000 ms (Victor, 1 October 2026).
 */

/** `projects.photos_per_trigger`, the column default. */
export const DEFAULT_PHOTOS_PER_TRIGGER = 3
/** `projects.photo_interval_milliseconds`, the column default. */
export const DEFAULT_PHOTO_INTERVAL_MS = 1000

/** op8 as every deployment writes it when a trigger takes a single picture. */
export const DEPLOYMENT_INTERVAL_BEFORE_DPD_MS = 1000
/** How much longer than the interval op8 is for a burst, so the camera is still awake for the next picture. */
export const BURST_AWAKE_MARGIN_MS = 1000

/** The backend's CHECK constraints, mirrored. */
export const PHOTOS_PER_TRIGGER_RANGE = { min: 1, max: 10 } as const
export const PHOTO_INTERVAL_MS_RANGE = { min: 200, max: 2000 } as const

/** The shape read off a project row; both optional so a stale local record still resolves. */
export interface ProjectBurstColumns {
    photos_per_trigger?: number | null
    photo_interval_milliseconds?: number | null
}

/** The three op values a deployment writes for the burst. */
export interface BurstOpValues {
    /** op5 NUM_PICTURES, doubled when the raw BMP is recorded */
    numPictures: number
    /** op6 PICTURE_INTERVAL, milliseconds */
    pictureIntervalMs: number
    /** op8 INTERVAL_BEFORE_DPD, milliseconds: long enough to wait out op6 when there is a next picture */
    intervalBeforeDpdMs: number
}

const inRange = (value: unknown, range: { min: number; max: number }): value is number =>
    typeof value === 'number' && Number.isInteger(value) && value >= range.min && value <= range.max

/**
 * The project's burst, each value falling back to the column default when it
 * is missing or outside the CHECK range. The server cannot hold such a value;
 * locally, 0 is what WatermelonDB keeps in a number column nobody wrote.
 */
export const resolveProjectBurst = (project?: ProjectBurstColumns | null): {
    photosPerTrigger: number
    intervalMs: number
} => ({
    photosPerTrigger: inRange(project?.photos_per_trigger, PHOTOS_PER_TRIGGER_RANGE)
        ? project!.photos_per_trigger as number
        : DEFAULT_PHOTOS_PER_TRIGGER,
    intervalMs: inRange(project?.photo_interval_milliseconds, PHOTO_INTERVAL_MS_RANGE)
        ? project!.photo_interval_milliseconds as number
        : DEFAULT_PHOTO_INTERVAL_MS,
})

/**
 * The same burst as op5, op6 and op8. op8 follows the captures the firmware
 * takes, op5, rather than the photos: with the raw BMP a single photo is two
 * captures op6 apart, and the camera has to stay awake between them too.
 */
export const resolveProjectBurstOps = (
    project?: ProjectBurstColumns | null,
    recordRawBmp = false,
): BurstOpValues => {
    const { photosPerTrigger, intervalMs } = resolveProjectBurst(project)
    const numPictures = recordRawBmp ? photosPerTrigger * 2 : photosPerTrigger
    return {
        numPictures,
        pictureIntervalMs: intervalMs,
        intervalBeforeDpdMs: numPictures > 1 ? intervalMs + BURST_AWAKE_MARGIN_MS : DEPLOYMENT_INTERVAL_BEFORE_DPD_MS,
    }
}

/** The deployment log line, e.g. "Pictures per trigger: 3, 1000 ms apart (awake 2000 ms)". */
export const describeProjectBurst = (project?: ProjectBurstColumns | null, recordRawBmp = false): string => {
    const { photosPerTrigger, intervalMs } = resolveProjectBurst(project)
    const { intervalBeforeDpdMs } = resolveProjectBurstOps(project, recordRawBmp)
    return photosPerTrigger === 1
        ? `Pictures per trigger: 1 (awake ${intervalBeforeDpdMs} ms)`
        : `Pictures per trigger: ${photosPerTrigger}, ${intervalMs} ms apart (awake ${intervalBeforeDpdMs} ms)`
}

/** Two words for the Start Monitoring feature row, e.g. "3 photos". */
export const shortBurstLabel = (project?: ProjectBurstColumns | null): string => {
    const { photosPerTrigger } = resolveProjectBurst(project)
    return photosPerTrigger === 1 ? '1 photo' : `${photosPerTrigger} photos`
}
