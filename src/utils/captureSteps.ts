import { parseLightCheck } from '../ble/protocol/lightCheck'

/**
 * The steps of one Capture Picture run, and what the device has said about each.
 *
 * Pure state and transitions, no React: `useCaptureSteps` feeds device lines,
 * transfer progress and the app's own milestones in, and renders what comes out.
 *
 * The device narrates a capture unprompted, in this order: `About to capture`,
 * `AE light check: ... -> DARK|BRIGHT`, `Captured 1 images. Last is X.JPG`,
 * `N bytes in X.JPG`, one binary packet every 200 ms or so, `Finished sending`.
 * Each of those is a step changing state. Nothing here sends a command; the
 * rule is to use what the device already broadcasts rather than poll it.
 */

export type StepKey = 'settings' | 'capture' | 'light' | 'transfer'
export type StepStatus = 'pending' | 'active' | 'done' | 'failed'

export interface Step {
    key: StepKey
    label: string
    /** One short line under the label: what the device said, or what is being waited for */
    detail?: string
    status: StepStatus
}

export interface Transfer {
    totalBytes: number
    receivedBytes: number
    /** When the byte count arrived, ms epoch */
    startedAt: number
    /** When the last packet arrived, ms epoch */
    lastAt: number
}

export interface CaptureStepsState {
    steps: Step[]
    transfer: Transfer | null
    /** True from `begin` until the image is saved or something fails */
    running: boolean
}

/**
 * Bytes per second to assume until enough of the image has arrived to measure.
 * Four transfers on 3 September 2026 ran between 1.03 and 1.2 KB/s, bounded by
 * the nRF's console output per packet rather than by BLE.
 */
export const NOMINAL_RATE_BPS = 1100

/** Below this many bytes the measured rate is too noisy to beat the nominal one */
const MEASURE_AFTER_BYTES = 2048

const LABELS: Record<StepKey, string> = {
    settings: 'Flash settings',
    capture: 'Taking the picture',
    light: 'Light check',
    transfer: 'Transferring the picture',
}

const ORDER: StepKey[] = ['settings', 'capture', 'light', 'transfer']

export const idleState = (): CaptureStepsState => ({
    steps: ORDER.map(key => ({ key, label: LABELS[key], status: 'pending' })),
    transfer: null,
    running: false,
})

const update = (state: CaptureStepsState, key: StepKey, patch: Partial<Step>): CaptureStepsState => ({
    ...state,
    steps: state.steps.map(s => (s.key === key ? { ...s, ...patch } : s)),
})

const statusOf = (state: CaptureStepsState, key: StepKey): StepStatus =>
    state.steps.find(s => s.key === key)?.status ?? 'pending'

/** A run starts: settings first. */
export const begin = (): CaptureStepsState =>
    update({ ...idleState(), running: true }, 'settings', { status: 'active', detail: 'Reading the camera’s settings' })

/** The app has written (or confirmed) the flash settings; the capture is next. `note` overrides the detail. */
export const settingsApplied = (state: CaptureStepsState, changed: boolean, note?: string): CaptureStepsState => {
    const detail = note ?? (changed ? 'Written to the camera' : 'Already as chosen')
    const s = update(state, 'settings', { status: 'done', detail })
    return update(s, 'capture', { status: 'active', detail: 'Waiting for the camera to sleep, then waking it' })
}

/** The device woke. Only meaningful while the capture step is waiting for it. */
export const deviceWoke = (state: CaptureStepsState): CaptureStepsState =>
    statusOf(state, 'capture') === 'active'
        ? update(state, 'capture', { detail: 'Camera awake' })
        : state

const CAPTURED_RE = /Captured\s+(\d+)\s+images?\.\s*Last is\s+(\S+)/i
const BYTES_IN_RE = /^\s*(\d+)\s+bytes\s+in\s+([A-Za-z0-9_.-]+)/i

/** Feed one text line from the device. Lines that mean nothing here return the same state. */
export const deviceLine = (state: CaptureStepsState, line: string, now: number): CaptureStepsState => {
    if (!state.running) return state

    if (/About to capture/i.test(line)) {
        return update(state, 'capture', { status: 'active', detail: 'Exposing' })
    }

    const light = parseLightCheck(line)
    if (light) {
        return update(state, 'light', {
            status: 'done',
            detail: light.dark ? 'Dark, flash on' : 'Bright, no flash',
        })
    }

    const captured = line.match(CAPTURED_RE)
    if (captured) {
        let s = update(state, 'capture', { status: 'done', detail: captured[2] })
        if (statusOf(s, 'light') === 'pending') {
            // No light check on this capture: the flash is off and auto-switch is off.
            s = update(s, 'light', { status: 'done', detail: 'Not needed, flash off' })
        }
        return update(s, 'transfer', { status: 'active', detail: 'Asking for the file' })
    }

    const bytesIn = line.match(BYTES_IN_RE)
    if (bytesIn) {
        const totalBytes = parseInt(bytesIn[1], 10)
        const transfer: Transfer = { totalBytes, receivedBytes: 0, startedAt: now, lastAt: now }
        return { ...update(state, 'transfer', { status: 'active' }), transfer }
    }

    if (/Finished sending/i.test(line) && state.transfer) {
        return update(state, 'transfer', { detail: 'Saving' })
    }

    return state
}

/** Transfer progress from the reassembler, 0 to 1. */
export const transferProgress = (state: CaptureStepsState, progress: number, now: number): CaptureStepsState => {
    if (!state.transfer) return state
    const receivedBytes = Math.min(state.transfer.totalBytes, Math.round(progress * state.transfer.totalBytes))
    return { ...state, transfer: { ...state.transfer, receivedBytes, lastAt: now } }
}

/** The image is on the phone. A picture from a transfer this run did not start changes nothing. */
export const imageSaved = (state: CaptureStepsState, now: number): CaptureStepsState => {
    if (!state.running) return state
    const t = state.transfer
    const detail = t
        ? `${formatBytes(t.totalBytes)} in ${((now - t.startedAt) / 1000).toFixed(1)} s`
        : 'Saved'
    return {
        ...update(state, 'transfer', { status: 'done', detail }),
        transfer: t ? { ...t, receivedBytes: t.totalBytes, lastAt: now } : null,
        running: false,
    }
}

/** Something went wrong: mark the step in progress as failed with the message. */
export const failed = (state: CaptureStepsState, message: string): CaptureStepsState => {
    const active = state.steps.find(s => s.status === 'active')
    const s = active ? update(state, active.key, { status: 'failed', detail: message }) : state
    return { ...s, running: false }
}

/** Bytes remaining, the rate in use, and the seconds left at that rate. */
export const transferEta = (t: Transfer, now: number): { remainingBytes: number; rateBps: number; seconds: number } => {
    const remainingBytes = Math.max(0, t.totalBytes - t.receivedBytes)
    const elapsed = (t.lastAt - t.startedAt) / 1000
    const rateBps = t.receivedBytes >= MEASURE_AFTER_BYTES && elapsed > 0
        ? t.receivedBytes / elapsed
        : NOMINAL_RATE_BPS
    // Count down between packets too, so the number moves once a second.
    const sinceLast = Math.max(0, (now - t.lastAt) / 1000)
    const seconds = Math.max(0, Math.ceil(remainingBytes / rateBps - sinceLast))
    return { remainingBytes, rateBps, seconds }
}

export const formatBytes = (bytes: number): string =>
    bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`

/** "11.8 KB, about 9 s left" while receiving; "11.8 KB" once done. */
export const describeTransfer = (t: Transfer, now: number): string => {
    const size = formatBytes(t.totalBytes)
    if (t.receivedBytes >= t.totalBytes) return size
    const { seconds } = transferEta(t, now)
    if (t.receivedBytes === 0) return `${size}, about ${seconds} s`
    return `${size}, about ${seconds} s left`
}
