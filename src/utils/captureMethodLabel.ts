/**
 * A capture method's words on screen. The `capture_methods` reference rows hold
 * identifiers ("activityDetection", "timeLapse", ww-backend seed.sql), which the
 * project screens showed as they are (#563). An unknown value is shown as stored.
 */
const CAPTURE_METHOD_LABELS: Record<string, string> = {
    activityDetection: 'Motion detection',
    timeLapse: 'Timelapse',
}

export const captureMethodLabel = (value: string | null | undefined): string =>
    (value && CAPTURE_METHOD_LABELS[value]) || value || ''
