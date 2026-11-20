/**
 * projectDetectionThreshold: the project's on-device detection threshold, from
 * the project's percent to op16 MODEL_THRESHOLD (#342, #520).
 *
 * The `projects` row carries it as `detection_threshold_pct`, CHECK 50 to 99,
 * default 57 (ww-backend #246). Since Seeed PR #289 op16 is that percent
 * itself, 0 to 100: a detection is a frame where the model is at least this
 * sure of the target class, the same percentage the console and EXIF show.
 * The firmware rejects a value above 100 and its own default is 60.
 *
 * Firmware before that PR read op16 as the model's raw int8 output, 0 to 127,
 * so a percent written there is read as (pct + 128) / 256: 57 runs at 72%,
 * stricter, not broken. The app cannot tell the two apart (the AI `ver` reply
 * is only a build stamp), so the release order covers it: this app reaches
 * the stores before that firmware reaches the production catalogue.
 *
 * Why the deployment writes it: op16 is not in RESET_PRESERVED_OPS, so the
 * reset sets the factory value and a threshold tuned at the bench was lost at
 * the next Start Monitoring. Nothing else writes it. It only matters with a
 * model on the device, and is written whatever the model: with none, the
 * firmware never reads it.
 */

/** `projects.detection_threshold_pct`, the column default. */
export const DEFAULT_DETECTION_THRESHOLD_PCT = 57

/** The backend's CHECK constraint, mirrored. */
export const DETECTION_THRESHOLD_PCT_RANGE = { min: 50, max: 99 } as const

/** op16 on the device: a percent, 0 to 100 (Seeed PR #289). */
export const MODEL_THRESHOLD_RANGE = { min: 0, max: 100 } as const

/** The shape read off a project row; optional so a stale local record still resolves. */
export interface ProjectDetectionThresholdColumns {
    detection_threshold_pct?: number | null
}

/**
 * The project's percent, falling back to the column default when it is
 * missing or outside the CHECK range. The server cannot hold such a value;
 * locally, 0 is what WatermelonDB keeps in a number column nobody wrote.
 */
export const resolveDetectionThresholdPct = (project?: ProjectDetectionThresholdColumns | null): number => {
    const pct = project?.detection_threshold_pct
    return typeof pct === 'number'
        && Number.isInteger(pct)
        && pct >= DETECTION_THRESHOLD_PCT_RANGE.min
        && pct <= DETECTION_THRESHOLD_PCT_RANGE.max
        ? pct
        : DEFAULT_DETECTION_THRESHOLD_PCT
}

/** op16 for a percent: the percent itself, kept inside 0 to 100. */
export const op16FromPercent = (pct: number): number =>
    Math.min(MODEL_THRESHOLD_RANGE.max, Math.max(MODEL_THRESHOLD_RANGE.min, Math.round(pct)))

/** The op16 a deployment writes for the project. */
export const resolveModelThresholdOp = (project?: ProjectDetectionThresholdColumns | null): number =>
    op16FromPercent(resolveDetectionThresholdPct(project))

/** The deployment log line, e.g. "Detection threshold: 57% (op16 57)". */
export const describeDetectionThreshold = (project?: ProjectDetectionThresholdColumns | null): string => {
    const pct = resolveDetectionThresholdPct(project)
    return `Detection threshold: ${pct}% (op16 ${op16FromPercent(pct)})`
}
