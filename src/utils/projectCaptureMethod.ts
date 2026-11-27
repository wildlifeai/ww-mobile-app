/**
 * What a project's capture method writes to the camera. `capture_method_id`
 * comes from the `capture_methods` reference table: 1 motion detection
 * (activity), 2 timelapse, 3 both. Anything else, including none, writes no
 * capture settings, so the camera would never take a picture by itself (#561).
 */
export type ProjectCaptureMethod = 'activity' | 'timelapse' | 'mixed' | 'unknown'

export const captureMethodOf = (captureMethodId: number | null | undefined): ProjectCaptureMethod => {
    if (captureMethodId === 1) return 'activity'
    if (captureMethodId === 2) return 'timelapse'
    if (captureMethodId === 3) return 'mixed'
    return 'unknown'
}

/** Start Monitoring's reason for refusing a project with no capture method it knows (#561) */
export const NO_CAPTURE_METHOD =
    'This project has no capture method, so the camera would take no pictures. A project admin can set one in the project settings.'

/** The refusal for this project's capture method, or null when it has one */
export const captureMethodRefusal = (captureMethodId: number | null | undefined): string | null =>
    captureMethodOf(captureMethodId) === 'unknown' ? NO_CAPTURE_METHOD : null
