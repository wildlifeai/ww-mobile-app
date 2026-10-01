/**
 * projectDetectionThreshold: the project's on-device detection threshold, from
 * the project's percent to op16 MODEL_THRESHOLD (#342).
 *
 * The `projects` row carries it as `detection_threshold_pct`, CHECK 50 to 99,
 * default 57 (ww-backend #246). The Himax compares the target class's int8
 * model output with op16. That output is softmax, quantised with scale 1/256
 * and zero point -128, so op16 = q means probability (q + 128) / 256, and a
 * percent becomes the smallest q that reaches it: ceil(pct * 2.56) - 128.
 * 57 gives 18, the factory value, so a project on the default deploys exactly
 * as before; 50 gives 0, the lowest the camera can be set; 99 gives 126.
 *
 * Why the deployment writes it: op16 is not in RESET_PRESERVED_OPS, so the
 * reset sets the factory 18 and a threshold tuned at the bench was lost at the
 * next Start Monitoring. Nothing else writes it. It only matters with a model
 * on the device, and is written whatever the model: with none, the firmware
 * never reads it.
 */

/** `projects.detection_threshold_pct`, the column default. op16 18, the factory value. */
export const DEFAULT_DETECTION_THRESHOLD_PCT = 57

/** The backend's CHECK constraint, mirrored. */
export const DETECTION_THRESHOLD_PCT_RANGE = { min: 50, max: 99 } as const

/** op16 on the device: the int8 output above its zero point, 0 (50%) to 127 (99.6%). */
export const MODEL_THRESHOLD_RANGE = { min: 0, max: 127 } as const

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

/**
 * op16 for a percent: ceil(pct * 2.56) - 128, kept inside 0 to 127. Computed
 * as ceil(pct * 256 / 100), the same value for every percent the column
 * allows, with no 2.56 in floating point to push a whole result up by one.
 */
export const op16FromPercent = (pct: number): number =>
    Math.min(
        MODEL_THRESHOLD_RANGE.max,
        Math.max(MODEL_THRESHOLD_RANGE.min, Math.ceil((pct * 256) / 100) - 128),
    )

/** The op16 a deployment writes for the project. */
export const resolveModelThresholdOp = (project?: ProjectDetectionThresholdColumns | null): number =>
    op16FromPercent(resolveDetectionThresholdPct(project))

/** The deployment log line, e.g. "Detection threshold: 57% (op16 18)". */
export const describeDetectionThreshold = (project?: ProjectDetectionThresholdColumns | null): string => {
    const pct = resolveDetectionThresholdPct(project)
    return `Detection threshold: ${pct}% (op16 ${op16FromPercent(pct)})`
}
