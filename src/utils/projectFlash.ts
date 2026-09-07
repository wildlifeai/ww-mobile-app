/**
 * projectFlash — the project's capture flash settings, translated to op values.
 *
 * The `projects` row carries the flash as four columns (ww-backend migration
 * 20260904121047): `flash_mode`, `flash_led` and, for the time-of-day mode,
 * `flash_window_start_minutes_utc` and `flash_window_minutes`. The device
 * carries the same four as op34, op13, op35 and op36.
 *
 * Everything that has to cross that boundary lives here, so the mapping is
 * written once. The op indices themselves stay in `OP_PARAMETER`
 * (`useDeviceSettings.ts`), which mirrors the firmware's `OP_PARAMETERS_E`.
 *
 * Why the device needs all four written at deployment: `Start Monitoring`
 * resets the device to `FACTORY_DEFAULTS`, which holds op13 = 0 and op34 = 0.
 * Nothing else writes them, so before this existed every deployment went out
 * with no capture flash and, since the firmware's `ledFlashIsActive()` also
 * gates the STROBE-driven IR for motion frames, blind at night (#282).
 */

/** `projects.flash_mode` — the check constraint's four values. */
export type ProjectFlashMode = 'off' | 'light_sensor' | 'always_on' | 'time_of_day'

/** `projects.flash_led` — the check constraint's two values. */
export type ProjectFlashLed = 'white' | 'ir'

/**
 * op34 FLASH_MODE, by column value. Mirrors `FLASH_MODE_E` in the firmware's
 * `ledFlash.c` (ae_review 4bcb722c).
 */
export const FLASH_MODE_OP_VALUE: Record<ProjectFlashMode, number> = {
    off: 0,
    light_sensor: 1,
    always_on: 2,
    time_of_day: 3,
}

/** op13 FLASH_LED, by column value. 0 (no LED) is expressed as `flash_mode: 'off'`. */
export const FLASH_LED_OP_VALUE: Record<ProjectFlashLed, number> = {
    white: 1,
    ir: 2,
}

/**
 * What a project resolves to when its row predates the columns or carries a
 * value outside the check constraint.
 *
 * Deliberately NOT `light_sensor`, even though that is the column's default in
 * the backend migration. The firmware's AE light check is still being worked on
 * (Victor, 5 September 2026), so nothing in the app may fall back to a mode
 * that depends on it. `off` is the same thing the firmware itself defaults to,
 * and it is the only fallback that cannot fire an LED nobody chose.
 *
 * A project that wants a flash says so in its own row. When the light check is
 * trusted again, this constant is the one place to revisit.
 */
export const DEFAULT_FLASH_MODE: ProjectFlashMode = 'off'
/** Which LED an unset row would use, if its mode were not `off`. */
export const DEFAULT_FLASH_LED: ProjectFlashLed = 'ir'

/** Human labels, for the project card and the deployment log. */
export const FLASH_MODE_LABELS: Record<ProjectFlashMode, string> = {
    off: 'Off',
    light_sensor: 'Light sensor',
    always_on: 'Always on',
    time_of_day: 'Time of day',
}

export const FLASH_LED_LABELS_BY_COLUMN: Record<ProjectFlashLed, string> = {
    white: 'white',
    ir: 'IR',
}

/** The shape read off a project row; every field is optional so a stale local record still resolves. */
export interface ProjectFlashColumns {
    flash_mode?: string | null
    flash_led?: string | null
    flash_window_start_minutes_utc?: number | null
    flash_window_minutes?: number | null
}

/** The four op values a deployment writes. */
export interface FlashOpValues {
    /** op34 FLASH_MODE */
    mode: number
    /** op13 FLASH_LED */
    led: number
    /** op35 FLASH_TOD_START, minutes after midnight UTC */
    windowStart: number
    /** op36 FLASH_TOD_DURATION, minutes */
    windowMinutes: number
}

export const isFlashMode = (value: unknown): value is ProjectFlashMode =>
    typeof value === 'string' && value in FLASH_MODE_OP_VALUE

export const isFlashLed = (value: unknown): value is ProjectFlashLed =>
    typeof value === 'string' && value in FLASH_LED_OP_VALUE

/** The project's flash settings, with every value normalised to the column vocabulary. */
export const resolveProjectFlash = (project?: ProjectFlashColumns | null): {
    mode: ProjectFlashMode
    led: ProjectFlashLed
    windowStart: number
    windowMinutes: number
} => {
    const mode = isFlashMode(project?.flash_mode) ? project!.flash_mode as ProjectFlashMode : DEFAULT_FLASH_MODE
    const led = isFlashLed(project?.flash_led) ? project!.flash_led as ProjectFlashLed : DEFAULT_FLASH_LED

    // The window only means anything in time-of-day mode; in every other mode
    // the firmware ignores op35/op36, and writing a leftover window would show
    // up in the op table as a setting that is not in force.
    const rawStart = project?.flash_window_start_minutes_utc
    const rawMinutes = project?.flash_window_minutes
    const windowStart = mode === 'time_of_day' && typeof rawStart === 'number' && rawStart >= 0 && rawStart <= 1439
        ? Math.round(rawStart)
        : 0
    const windowMinutes = mode === 'time_of_day' && typeof rawMinutes === 'number' && rawMinutes >= 1 && rawMinutes <= 1440
        ? Math.round(rawMinutes)
        : 0

    return { mode, led, windowStart, windowMinutes }
}

/** The same settings as the op values a deployment writes (op34, op13, op35, op36). */
export const resolveProjectFlashOps = (project?: ProjectFlashColumns | null): FlashOpValues => {
    const { mode, led, windowStart, windowMinutes } = resolveProjectFlash(project)

    return {
        mode: FLASH_MODE_OP_VALUE[mode],
        // Mode "off" is the absence of a flash, and the firmware's own gate is
        // op13: leaving the LED set while the mode is off would still arm the
        // IR for motion frames, which is not what "off" means to the operator.
        led: mode === 'off' ? 0 : FLASH_LED_OP_VALUE[led],
        windowStart,
        windowMinutes,
    }
}

/** `hh:mm` UTC for a minutes-after-midnight value. */
export const formatUtcMinutes = (minutes: number): string => {
    const wrapped = ((Math.round(minutes) % 1440) + 1440) % 1440
    const hh = Math.floor(wrapped / 60).toString().padStart(2, '0')
    const mm = (wrapped % 60).toString().padStart(2, '0')
    return `${hh}:${mm}`
}

/**
 * `hh:mm` back to minutes after midnight, for the project form's window field.
 * Returns null for anything that is not a time in range, so the caller can
 * leave the column null rather than store a guess.
 */
export const parseUtcMinutes = (text?: string | null): number | null => {
    const match = /^\s*(\d{1,2})\s*:\s*(\d{2})\s*$/.exec(text ?? '')
    if (!match) return null
    const hours = Number(match[1])
    const minutes = Number(match[2])
    if (hours > 23 || minutes > 59) return null
    return hours * 60 + minutes
}

/** Two or three words for an icon label, e.g. "IR auto", "IR 22:00", "No flash". */
export const shortFlashLabel = (project?: ProjectFlashColumns | null): string => {
    const { mode, led, windowStart, windowMinutes } = resolveProjectFlash(project)

    if (mode === 'off') return 'No flash'

    const ledLabel = FLASH_LED_LABELS_BY_COLUMN[led]
    switch (mode) {
        case 'light_sensor':
            return `${ledLabel} auto`
        case 'always_on':
            return `${ledLabel} always`
        case 'time_of_day':
            return windowMinutes > 0 ? `${ledLabel} ${formatUtcMinutes(windowStart)}` : `${ledLabel} time of day`
    }
}

/**
 * One line for the deployment log and the project chip, e.g.
 * "IR flash, light sensor decides" or "Flash off".
 */
export const describeProjectFlash = (project?: ProjectFlashColumns | null): string => {
    const { mode, led, windowStart, windowMinutes } = resolveProjectFlash(project)

    if (mode === 'off') return 'Flash off'

    const ledLabel = FLASH_LED_LABELS_BY_COLUMN[led]
    switch (mode) {
        case 'light_sensor':
            return `${ledLabel} flash, light sensor decides`
        case 'always_on':
            return `${ledLabel} flash, always on`
        case 'time_of_day':
            return windowMinutes > 0
                ? `${ledLabel} flash, ${formatUtcMinutes(windowStart)} UTC for ${windowMinutes} min`
                : `${ledLabel} flash, time of day (no window set)`
    }
}
