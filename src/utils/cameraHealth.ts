/**
 * A deployed camera's state from its LoRaWAN check-ins, read the same way as on the website's
 * Realtime page, so a camera never says one thing in the app and another there (#518).
 *
 * Two copies, change them together:
 *
 * - The state rules are ww-website `frontend/src/lib/cameraState.ts` (ww-website#427).
 * - The reason words are ww-backend `camera_health_reason_text()`
 *   (`supabase/schemas/public/functions/56_camera_alerts.sql`, DATABASE_REFERENCE.md, Camera
 *   health), which the alerts send too. They are the backend's words, not the on-site check's
 *   (`decodeSelfTest`), on purpose (Victor, 27 Nov 2026). Bit 12 still reads "Microphone failed"
 *   there until ww-backend#399 renames it.
 *
 * The rules:
 *
 * - Finished once the deployment has ended.
 * - LoRaWAN off when the deployment's `lorawan_ping_minutes` is 0: never Silent.
 * - Silent after 3 ping periods with no message of any kind, 12 h at the 240 minutes a deployed
 *   camera pings. With no message yet it counts from the deployment's start. A deployment with
 *   no period recorded (null, every one made before #532) is Silent after 72 h, never before its
 *   first message. Silent overrides the health state.
 * - Awaiting before the first message.
 * - Otherwise the health state ww-backend works out (`deployment_latest_lorawan.health_state`,
 *   ww-backend#381): Fault, Warning or OK; Checking in for a camera that sends no health report.
 *   With no period recorded, a camera whose last message is over 24 h old is Stale unless it
 *   reports a Fault or Warning.
 */

export type HealthState = 'fault' | 'warning' | 'ok'

export type CameraState =
    | 'finished' | 'off' | 'silent' | 'awaiting' | 'fault' | 'warning' | 'stale' | 'ok' | 'checking_in'

/** With no period recorded: Stale after this many hours, Silent after `STALE_HOURS`. */
const FRESH_HOURS = 24
const STALE_HOURS = 72
/** Ping periods with no message before a camera is Silent. */
const SILENT_PERIODS = 3

export interface CameraFacts {
    /** The newest message of any kind, ISO. */
    lastSeen: string | null
    deploymentStart: string | null
    deploymentEnd: string | null
    /** `deployments.lorawan_ping_minutes`: 0 is LoRaWAN off, null not recorded. */
    pingMinutes: number | null
    health: HealthState | null
}

/** The view's `health_state` as a state, null for anything else. */
export function toHealthState(value: string | null | undefined): HealthState | null {
    return value === 'fault' || value === 'warning' || value === 'ok' ? value : null
}

/** Hours with no message before the camera is Silent; null when it never is (LoRaWAN off). */
function silentAfterHours(pingMinutes: number | null): number | null {
    if (pingMinutes === 0) return null
    if (pingMinutes == null) return STALE_HOURS
    return (SILENT_PERIODS * pingMinutes) / 60
}

export function cameraState(camera: CameraFacts, now = Date.now()): CameraState {
    const { lastSeen, deploymentStart, deploymentEnd, pingMinutes, health } = camera
    if (deploymentEnd && Date.parse(deploymentEnd) <= now) return 'finished'
    const silentAfter = silentAfterHours(pingMinutes)
    if (silentAfter == null) return 'off'
    const hoursSince = (iso: string) => (now - Date.parse(iso)) / 3_600_000
    const quietSince = lastSeen ?? (pingMinutes != null ? deploymentStart : null)
    if (quietSince && hoursSince(quietSince) > silentAfter) return 'silent'
    if (!lastSeen) return 'awaiting'
    if (health === 'fault' || health === 'warning') return health
    if (pingMinutes == null && hoursSince(lastSeen) > FRESH_HOURS) return 'stale'
    return health ?? 'checking_in'
}

/** Silent, Fault and Warning: the states the map rings. */
export function needsAttention(state: CameraState): boolean {
    return state === 'silent' || state === 'fault' || state === 'warning'
}

export const CAMERA_STATE: Record<CameraState, { color: string; label: string }> = {
    finished: { color: '#3B82F6', label: 'Finished' },
    off: { color: '#9CA3AF', label: 'LoRaWAN off' },
    silent: { color: '#EF4444', label: 'Silent' },
    awaiting: { color: '#9CA3AF', label: 'Awaiting' },
    fault: { color: '#EF4444', label: 'Fault' },
    warning: { color: '#F59E0B', label: 'Warning' },
    stale: { color: '#F59E0B', label: 'Stale' },
    ok: { color: '#22C55E', label: 'OK' },
    checking_in: { color: '#22C55E', label: 'Checking in' },
}

/** "No message for over 12 h": how long a camera went unheard before it was Silent. */
export function silenceText(pingMinutes: number | null): string {
    const hours = silentAfterHours(pingMinutes) ?? 0
    const span = hours >= 48 && hours % 24 === 0 ? `${hours / 24} days`
        : hours >= 1 ? `${Math.round(hours * 10) / 10} h`
            : `${Math.round(hours * 60)} min`
    return `No message for over ${span}`
}

// camera_health_reason_text's lists. Self-test bits 6, 7 and 15 have no words.
const SELF_TEST_BITS: Record<number, string> = {
    0: 'Battery low',
    1: 'AI processor not responding',
    2: 'LoRaWAN error',
    3: 'Restarted by its watchdog',
    4: 'Restarted after a brownout',
    5: 'Restarted after a firmware fault',
    8: 'Main camera failed',
    9: 'HM0360 camera failed',
    10: 'LED flash failed',
    11: 'SD card missing',
    12: 'Microphone failed',
    13: 'AI model failed',
    14: 'AI processor missed the BLE processor at start-up',
}

// Why the camera last restarted, for `unexpected_restart_<reason>`; the reasons that are no
// warning never reach here.
const RESTART_REASONS: Record<number, string> = {
    2: 'Restarted after a firmware error check',
    3: 'Restarted after an SDK assert',
    4: 'Restarted after a radio stack assert',
    5: 'Restarted after a hard fault',
    6: 'Restarted by its watchdog',
    10: 'Restarted after a software reset or lockup',
}

/** One of `health_reasons` in words. */
export function healthReasonText(code: string): string {
    if (code === 'sd_low') return 'SD card nearly full'
    if (code === 'ai_failures_rose') return 'AI processor did not respond'
    const bit = /^self_test_bit_(\d+)$/.exec(code)
    if (bit) return SELF_TEST_BITS[Number(bit[1])] ?? `Self-test bit ${bit[1]}`
    const restart = /^unexpected_restart_(\d+)$/.exec(code)
    if (restart) return RESTART_REASONS[Number(restart[1])] ?? `Restarted unexpectedly (reason ${restart[1]})`
    return code
}

/** The reasons in words, worst first as the view gives them, each once. */
export function healthReasonTexts(codes: readonly string[] | null | undefined): string[] {
    return [...new Set((codes ?? []).map(healthReasonText))]
}
