/**
 * deviceCheck: the ship check for a finished WW500, run from the app.
 *
 * One pass over everything a manufacturer can prove from outside the case:
 * the cameras' self-test after a restart (first, because a camera that does
 * not answer makes every photo step meaningless, and those steps are skipped
 * then), firmware and both camera images, the clocks, the SD card, the
 * LEDs, the light sensor, motion detection, both cameras' photos, the colour
 * camera's focus lens and the IR flash. Each step reports pass, warn or fail and
 * the check carries on, so one run lists every fault on the unit.
 *
 * Three things only a person can judge are asked, not measured: whether the
 * LEDs lit, and whether both photos show the test card framed alike. The app
 * has no JPEG decoder, so the photos are judged by what the camera reports
 * (file size, and the HM0360's own mean brightness) plus the operator's eye.
 * See `utils/deviceCheck/` for the rules and where their numbers came from.
 *
 * Everything the check changes on the device is put back: op8 and op34 through
 * their holds (which survive a dropped link), op18 and op11 after the motion
 * step, op9 and op13 after the IR shot, and the camera that was running when
 * the check started.
 */
import type { CommandContext } from '../protocol/commandRegistry'
import { commandRegistry } from '../protocol/commandRegistry'
import { bleEventBus, BleEvent } from '../protocol/eventBus'
import { awaitAeRegisters } from '../protocol/awaitAeRegisters'
import { selfTestCache } from '../protocol/selfTestCache'
import { keepAwake, DEFAULT_HOLD_MS } from '../session/keepAwake'
import { flashHold, FLASH_MODE_ALWAYS_ON } from '../session/flashHold'
import { mdIntervalHold } from '../session/mdIntervalHold'
import { downloadPhoto } from './downloadPhoto'
import { OP_PARAMETER } from '../../hooks/useDeviceSettings'
import { decodeSelfTest, formatSelfTestBits, parseSelfTestBits, SelfTestBit } from '../../utils/deviceSelfTest'
import { CAMERA_VARIANT_LABELS, CameraVariant, parseVariant } from '../../utils/cameraVariant'
import { SWEEP_UP, SWEEP_DOWN, SweepPoint, LensVerdict, lensVerdict, parseDirSizes } from '../../utils/deviceCheck/lensSweep'
import { photoProblem } from '../../utils/deviceCheck/photoStats'
import { log, logWarn } from '../../utils/logger'

export type CheckStepId =
    | 'cameras' | 'identity' | 'health' | 'clock' | 'storage' | 'leds' | 'light'
    | 'motion' | 'colour' | 'mono' | 'ir' | 'framing'

export type CheckStatus = 'pending' | 'running' | 'pass' | 'warn' | 'fail' | 'skipped'

export type CheckPhoto = 'RP3' | 'HM0360' | 'IR'

export interface CheckStepState {
    status: CheckStatus
    /** One line for the operator: the reading on a pass, what is wrong otherwise */
    summary: string
}

/** The steps in the order they run, with the name the operator sees. */
export const CHECK_STEPS: { id: CheckStepId; title: string }[] = [
    { id: 'cameras', title: 'Cameras connected (self-test after a restart)' },
    { id: 'identity', title: 'Firmware and camera images' },
    { id: 'colour', title: 'Colour camera and focus lens' },
    { id: 'health', title: 'Battery and temperature' },
    { id: 'clock', title: 'Clocks' },
    { id: 'storage', title: 'SD card' },
    { id: 'leds', title: 'LEDs' },
    { id: 'light', title: 'Light sensor' },
    { id: 'motion', title: 'Motion detection' },
    { id: 'mono', title: 'Black & white camera' },
    { id: 'ir', title: 'IR flash' },
    { id: 'framing', title: 'Both cameras see the card' },
]

/** The subset of a BLE session the check needs. `createBleSession` satisfies it. */
export interface DeviceCheckSession {
    execute: <T>(commandConstructor: () => CommandContext<T>, options?: { signal?: AbortSignal }) => Promise<T>
    getOps: (options?: { force?: boolean }) => Promise<string[]>
    waitForSleep: (timeoutMs?: number) => Promise<boolean>
    waitForWake: (timeoutMs?: number) => Promise<boolean>
}

export interface DeviceCheckDeps {
    session: DeviceCheckSession
    deviceId: string
    /** Lens position where the reference unit was sharpest, or null when none is recorded */
    referencePeak: number | null
    /** Boot the other firmware image; true once the device is running `target` */
    switchCamera: (target: 'RP3' | 'HM0360') => Promise<boolean>
    /** A yes/no question for the operator */
    ask: (question: string) => Promise<boolean>
    /** What the operator should do now, or null when nothing */
    instruct: (text: string | null) => void
    onStep: (id: CheckStepId, state: CheckStepState) => void
    /** A photo to show: one from each camera, and the black & white one lit by the IR flash */
    onPhoto: (photo: CheckPhoto, uri: string) => void
    /**
     * The lens verdict, and whether the lens moved freely leaving the reference
     * aside, which is when this unit could serve as the reference.
     */
    onLens: (verdict: LensVerdict, movesFreely: boolean) => void
    /** True once the operator has stopped the check */
    cancelled: () => boolean
    /** The pause between the LED colours, so each one can be seen; replaceable in tests */
    pause?: (ms: number) => Promise<void>
}

/** The device's sleep timer for the whole check. The lens position is lost when the AI processor sleeps. */
export const CHECK_KEEP_AWAKE_MS = DEFAULT_HOLD_MS
/** op34 off: no flash on the camera steps, so a dark bench cannot change the sweep's photos */
const FLASH_MODE_OFF = 0
/** op13 2 lights the IR LED */
const FLASH_LED_IR = 2
/** op18 bit 3: the motion burst writes no files */
const TEST_BIT_SKIP_FILE_CREATION = 8

/** BLE die temperature outside this range fails the unit. */
export const TEMP_RANGE_C: [number, number] = [-20, 70]
/** Each clock must read back within this of the time just set. */
export const CLOCK_TOLERANCE_MS = 5000

/** Long enough for three 200 ms flashes, and a gap before the next colour */
const LED_GAP_MS = 1500
const MOTION_FRAMES = 10
/** How long the burst has to say `About to capture` before it is sent again, and how many times */
const BURST_ACK_MS = 10000
const BURST_ATTEMPTS = 4
/** The burst itself: 10 frames at 500 ms plus the light check and the wake, with headroom */
const BURST_DONE_MS = 40000
const MOTION_INTERVAL_MS = 500
/** Photos taken before the sweep, so the colour camera's exposure settles first */
const WARM_UPS = 3
const CAPTURE_INTERVAL_MS = 500
const SLEEP_WAIT_MS = CHECK_KEEP_AWAKE_MS + 5000
/** A capture's register block can follow a wake, a light check and the capture itself */
const AE_WAIT_MS = 40000
const BOOT_SELFTEST_WAIT_MS = 10000
const BOOT_WAKE_WAIT_MS = 15000

/** The two camera bits: the image's main camera, and the HM0360 the colour image uses for motion. */
// eslint-disable-next-line no-bitwise
const CAMERA_BITS = (1 << SelfTestBit.AI_NO_MAIN_CAMERA) | (1 << SelfTestBit.AI_NO_HM0360)
// eslint-disable-next-line no-bitwise
const hasBit = (bits: number, bit: number) => (bits & (1 << bit)) !== 0
// eslint-disable-next-line no-bitwise
const hasCameraFault = (bits: number) => (bits & CAMERA_BITS) !== 0

/**
 * A self-test reading in the operator's words. Bit 8 is whichever camera the
 * running image drives, so it is named from `running`; bit 9 is the HM0360,
 * which the colour image also checks because it detects motion for it. A
 * camera bit or any other error fails; warning bits only warn.
 */
export const describeSelfTest = (bits: number, running: CameraVariant): CheckStepState => {
    const code = formatSelfTestBits(bits)
    if (bits === 0) {
        return {
            status: 'pass',
            summary: running === 'HM0360'
                ? `${code}: the black & white camera answered. The colour camera is checked when its image starts.`
                : `${code}: both cameras answered.`,
        }
    }
    const main = running === 'RP3' ? 'the colour camera (RP3)' : running === 'HM0360' ? 'the black & white camera (HM0360)' : 'the main camera'
    const parts: string[] = []
    if (hasBit(bits, SelfTestBit.AI_NO_MAIN_CAMERA)) parts.push(`${main} did not answer`)
    if (running !== 'HM0360' && hasBit(bits, SelfTestBit.AI_NO_HM0360)) parts.push('the HM0360 sensor did not answer')
    // eslint-disable-next-line no-bitwise
    const others = decodeSelfTest(bits & ~CAMERA_BITS)
    parts.push(...others.map(i => i.title))
    const cameraFault = hasCameraFault(bits)
    const failed = cameraFault || others.some(i => i.severity === 'error')
    return {
        status: failed ? 'fail' : 'warn',
        summary: `${code}: ${parts.join(', ')}.${cameraFault ? ' Check the camera ribbon cables, power cycle the unit and run again.' : ''}`,
    }
}

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e))

const cameraLabel = (camera: CameraVariant) =>
    camera === 'unknown' ? 'an unlabelled image' : `${CAMERA_VARIANT_LABELS[camera]} (${camera})`

/**
 * The check as a whole: `fail` when any step failed, `warn` when any warned,
 * `incomplete` when a step was stopped or skipped, otherwise `pass`.
 */
export const overallVerdict = (states: Partial<Record<CheckStepId, CheckStepState>>): 'pass' | 'warn' | 'fail' | 'incomplete' => {
    const all = CHECK_STEPS.map(s => states[s.id]?.status ?? 'pending')
    if (all.includes('fail')) return 'fail'
    if (all.some(s => s === 'skipped' || s === 'pending' || s === 'running')) return 'incomplete'
    if (all.includes('warn')) return 'warn'
    return 'pass'
}

/** Resolves true when the device sends a line matching `pattern`. Never rejects; call `cancel` to stop listening. */
const listenFor = (deviceId: string, pattern: RegExp) => {
    let settle!: (seen: boolean) => void
    const seen = new Promise<boolean>(resolve => { settle = resolve })
    const onLine = (event: BleEvent & { type: 'TEXT_LINE' }) => {
        if (event.deviceId === deviceId && pattern.test(event.line)) done(true)
    }
    const done = (value: boolean) => {
        bleEventBus.removeListener('textLine', onLine)
        settle(value)
    }
    bleEventBus.on('textLine', onLine)
    return { seen, cancel: () => done(false) }
}

/** A failed step: the message is what the operator reads. */
class StepFailure extends Error {}

/**
 * Run the check. Resolves when every step has a result (or the operator
 * stopped it) and the device has been put back as it was.
 */
export const runDeviceCheck = async (deps: DeviceCheckDeps): Promise<void> => {
    const { session, deviceId } = deps
    const pause = deps.pause ?? delay

    const states = new Map<CheckStepId, CheckStepState>()
    const set = (id: CheckStepId, state: CheckStepState) => {
        states.set(id, state)
        deps.onStep(id, state)
    }
    const passed = (id: CheckStepId) => states.get(id)?.status === 'pass' || states.get(id)?.status === 'warn'

    /** Set by the first step: a camera did not answer, so the photo steps would only time out. */
    let cameraFault = false

    const step = async (id: CheckStepId, body: () => Promise<CheckStepState>, opts: { needsCameras?: boolean } = {}) => {
        if (deps.cancelled()) {
            set(id, { status: 'skipped', summary: 'Stopped before this step' })
            return
        }
        if (opts.needsCameras && cameraFault) {
            set(id, { status: 'skipped', summary: 'Skipped: fix the camera fault in the first step, then run again.' })
            return
        }
        set(id, { status: 'running', summary: '' })
        try {
            set(id, await body())
        } catch (e) {
            logWarn(`[DeviceCheck] ${id} failed:`, e)
            set(id, { status: 'fail', summary: messageOf(e) })
        } finally {
            deps.instruct(null)
        }
    }

    let startCamera: CameraVariant = 'unknown'
    let currentCamera: CameraVariant = 'unknown'
    let photoBytes = new Map<string, number>()
    const photos: Partial<Record<CheckPhoto, string>> = {}

    /**
     * Boot the camera a leg needs, and read the self-test the new image sends
     * as it boots: the camera bits are only real on a cold boot, so this is
     * where a missing sensor shows (see `captureFailureDetail` on Capture
     * Picture).
     */
    const bootCamera = async (target: 'RP3' | 'HM0360') => {
        if (currentCamera === target) return
        const since = Date.now()
        const switched = currentCamera !== 'unknown'
        // Unknown until the switch is confirmed, so a failed one is still undone at the end.
        currentCamera = 'unknown'
        if (!(await deps.switchCamera(target))) {
            throw new StepFailure(`Could not start the ${CAMERA_VARIANT_LABELS[target]} camera image.`)
        }
        currentCamera = target
        if (!switched) return
        const boot = await selfTestCache.waitForFresh(deviceId, since, BOOT_SELFTEST_WAIT_MS)
        const reading = boot ? describeSelfTest(boot.bits, target) : null
        if (reading?.status === 'fail') throw new StepFailure(reading.summary)
    }

    /** Take one photo and return its file name on the card. */
    const capture = async (count: number = 1): Promise<string> => {
        const name = await session.execute(() => commandRegistry.capture(count, CAPTURE_INTERVAL_MS))
        if (typeof name !== 'string') throw new StepFailure('The camera took the photo but did not name the file.')
        return name.toUpperCase()
    }

    /**
     * The motion burst, sent again until the camera says it started, as the
     * motion test does. With the detector armed through the setup sleep, a hand
     * in front of the camera wakes it first (`Wake (MD)`), and the burst sent
     * into that wake was never acknowledged: 45 s of nothing on the bench,
     * 6 October 2026. The count in the pattern keeps the camera's own motion
     * capture, which takes op5 pictures, from passing for the burst.
     */
    const runBurst = async () => {
        const started = new RegExp(`About to capture\\s+${MOTION_FRAMES}\\s+images`, 'i')
        const finished = new RegExp(`Captured\\s+${MOTION_FRAMES}\\s+images`, 'i')
        for (let attempt = 1; attempt <= BURST_ATTEMPTS; attempt++) {
            if (deps.cancelled()) throw new StepFailure('Stopped before the motion burst')
            const ack = listenFor(deviceId, started)
            const done = listenFor(deviceId, finished)
            const abort = new AbortController()
            const burst = session.execute(() => commandRegistry.captureBurst(MOTION_FRAMES, MOTION_INTERVAL_MS), { signal: abort.signal })
            burst.catch(() => undefined)
            const acked = await Promise.race([ack.seen, pause(BURST_ACK_MS).then(() => false)])
            ack.cancel()
            if (acked) {
                // The registry resolves on any `Captured N images`; a capture of
                // the camera's own could end it early, so wait for this count.
                const count = await burst.catch(() => 0)
                if (count !== MOTION_FRAMES) await Promise.race([done.seen, pause(BURST_DONE_MS)])
                done.cancel()
                return
            }
            done.cancel()
            abort.abort()
            logWarn(`[DeviceCheck] motion burst not acknowledged (attempt ${attempt} of ${BURST_ATTEMPTS})`)
        }
        throw new StepFailure(`The camera did not start the motion burst after ${BURST_ATTEMPTS} tries.`)
    }

    const readSizes = async () => {
        photoBytes = parseDirSizes(await session.execute(() => commandRegistry.dir()))
    }

    /** Download a photo and show it; resolves with its size, as the camera gave it. */
    const fetchPhoto = async (photo: CheckPhoto, fileName: string): Promise<number> => {
        const name = photo === 'IR' ? 'IR' : CAMERA_VARIANT_LABELS[photo]
        deps.instruct(`Downloading the ${name} photo (about half a minute)`)
        const { uri, bytes } = await downloadPhoto(session, deviceId, fileName)
        photos[photo] = uri
        deps.onPhoto(photo, uri)
        return bytes ?? 0
    }

    // Raised for the whole check and put back at the end. Both are written to
    // CONFIG.TXT, which both camera images read, so they hold across the
    // camera switches too.
    let holding = false
    // The sleep timer before the hold: the first sleep still runs on it.
    let firstSleepMs = CHECK_KEEP_AWAKE_MS
    try {
        const ops = await session.getOps()
        firstSleepMs = Math.max(CHECK_KEEP_AWAKE_MS, parseInt(ops[OP_PARAMETER.INTERVAL_BEFORE_DPD] ?? '', 10) || 0)
        // Exactly 3 s, not at least: the check waits for a sleep several times,
        // and a unit left at 60 s turned every one of those into a timeout.
        await keepAwake.acquire(session, deviceId, CHECK_KEEP_AWAKE_MS, { exact: true })
        await flashHold.acquire(session, deviceId, FLASH_MODE_OFF)
        holding = true
    } catch (e) {
        logWarn('[DeviceCheck] could not take the holds:', e)
    }

    try {
        await step('cameras', async () => {
            const slots = await session.execute(() => commandRegistry.slots())
            startCamera = parseVariant(slots.running)
            currentCamera = startCamera

            // The camera bits are only trustworthy from a cold boot: a sensor
            // missing at power-up was reported on the first wake and clean on
            // every warm wake after it (Capture Picture, 5 September 2026).
            // `AI reset` restarts the AI processor at its next sleep and keeps
            // the Bluetooth link, so its boot self-test is a fresh reading.
            // Nothing may be sent while waiting, or the sleep moves away.
            const restartMs = firstSleepMs + 10000
            deps.instruct(`Restarting the camera to read its self-test (up to ${Math.round((restartMs + BOOT_WAKE_WAIT_MS) / 1000)} s)`)
            const since = Date.now()
            await session.execute(() => commandRegistry.aireset())
            const restarted = (await session.waitForSleep(restartMs)) && (await session.waitForWake(BOOT_WAKE_WAIT_MS))
            const boot = restarted ? await selfTestCache.waitForFresh(deviceId, since, BOOT_SELFTEST_WAIT_MS) : null
            if (boot) {
                cameraFault = hasCameraFault(boot.bits)
                return describeSelfTest(boot.bits, startCamera)
            }
            // No restart seen: the last wake's reading is the best there is.
            const bits = parseSelfTestBits(await session.execute(() => commandRegistry.selftest())) ?? 0
            cameraFault = hasCameraFault(bits)
            const reading = describeSelfTest(bits, startCamera)
            return reading.status === 'pass'
                ? { status: 'warn', summary: `${reading.summary} The camera did not restart, so a camera unplugged since power-up may not show.` }
                : reading
        })

        await step('identity', async () => {
            const ble = await session.execute(() => commandRegistry.version())
            const ai = await session.execute(() => commandRegistry.aiver())
            const slots = await session.execute(() => commandRegistry.slots())
            if (startCamera === 'unknown') {
                startCamera = parseVariant(slots.running)
                currentCamera = startCamera
            }
            const a = parseVariant(slots.slotA)
            const b = parseVariant(slots.slotB)
            const summary = `BLE ${ble}, AI ${ai}. Running ${cameraLabel(startCamera)}.`

            if (a !== 'unknown' && a === b) {
                return { status: 'fail', summary: `${summary} Both slots hold the ${CAMERA_VARIANT_LABELS[a]} image, so the other camera cannot be tested. Load its image first.` }
            }
            const ops = await session.getOps()
            // Capture Picture's pre-flight (useCapturePreview), and not put back
            // either: a camera a stopped deployment left disabled, or test bits
            // a motion test left set, would fail every photo below.
            if (ops[OP_PARAMETER.CAMERA_ENABLED] !== undefined && ops[OP_PARAMETER.CAMERA_ENABLED] !== '1') {
                await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.CAMERA_ENABLED, value: 1 }))
            }
            if ((parseInt(ops[OP_PARAMETER.TEST_MODE_BITS] ?? '0', 10) || 0) !== 0) {
                await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.TEST_MODE_BITS, value: 0 }))
            }
            const autoSwitch = ops.length > OP_PARAMETER.SLOT_SWITCH && ops[OP_PARAMETER.SLOT_SWITCH] === '1'
            if (autoSwitch) {
                return { status: 'warn', summary: `${summary} Automatic camera switching is on, which can change camera during the check. A unit normally ships with it off.` }
            }
            if (a === 'unknown' || b === 'unknown') {
                return { status: 'warn', summary: `${summary} One slot is not labelled yet; it labels itself when the check boots it.` }
            }
            return { status: 'pass', summary }
        })

        await step('colour', async () => {
            await bootCamera('RP3')
            deps.instruct('Keep the camera and the test card still.')
            await session.execute(() => commandRegistry.vcm(512))
            await capture(WARM_UPS)

            const shots: { position: number; leg: 'up' | 'down'; file: string }[] = []
            for (const [leg, positions] of [['up', SWEEP_UP], ['down', SWEEP_DOWN]] as const) {
                for (const position of positions) {
                    if (deps.cancelled()) throw new StepFailure('Stopped during the lens sweep')
                    deps.instruct(`Keep the camera and the test card still. Lens at ${position} (${shots.length + 1} of ${SWEEP_UP.length + SWEEP_DOWN.length}).`)
                    await session.execute(() => commandRegistry.vcm(position))
                    shots.push({ position, leg, file: await capture() })
                }
            }
            // Straight after the photos, with no op change between: the last
            // photo written leaves the firmware in the photo folder, which is
            // the only folder `AI dir` lists.
            await readSizes()
            if (shots.some(s => !photoBytes.has(s.file))) {
                throw new StepFailure('The camera listed another folder, so the photo sizes could not be read. Run the check again.')
            }
            const points: SweepPoint[] = shots.map(s => ({ position: s.position, leg: s.leg, bytes: photoBytes.get(s.file) ?? 0 }))
            log(`[DeviceCheck] lens sweep ${points.map(p => `${p.leg}${p.position}=${p.bytes}`).join(' ')}`)
            const verdict = lensVerdict(points, deps.referencePeak)
            deps.onLens(verdict, lensVerdict(points, null).status === 'pass')

            // The sweep's sharpest photo is the one to show: no extra capture.
            const best = shots
                .filter(s => s.leg === 'up')
                .reduce((a, b) => ((photoBytes.get(b.file) ?? 0) > (photoBytes.get(a.file) ?? 0) ? b : a))
            const problem = photoProblem(photoBytes.get(best.file) ?? 0)
            if (problem) return { status: 'fail', summary: problem }
            await fetchPhoto('RP3', best.file)
            return { status: verdict.status, summary: verdict.message }
        }, { needsCameras: true })

        await step('health', async () => {
            const battery = await session.execute(() => commandRegistry.battery()).catch(() => null)
            const temp = await session.execute(() => commandRegistry.temp())
            const reading = `Battery ${battery === null ? 'unknown' : `${battery}%`}, ${temp.toFixed(1)} °C.`
            if (temp < TEMP_RANGE_C[0] || temp > TEMP_RANGE_C[1]) {
                return { status: 'fail', summary: `The BLE chip reads ${temp.toFixed(1)} °C, outside ${TEMP_RANGE_C[0]} to ${TEMP_RANGE_C[1]} °C.` }
            }
            return { status: 'pass', summary: reading }
        })

        // Both clocks are set and read back. The AI processor's has to be set
        // here, not left to the BLE processor: the restart in the first step
        // rewinds it to 2024, and the BLE processor only passes the time on
        // every 15 minutes (SENDUTCINTERVAL in ww-hardware), so without this
        // the unit would leave with photos stamped 2024 (bench, 6 October 2026).
        await step('clock', async () => {
            const off = (ms: number) => isNaN(ms) || Math.abs(ms - Date.now()) > CLOCK_TOLERANCE_MS
            await session.execute(() => commandRegistry.setutc())
            if (off(Date.parse(await session.execute(() => commandRegistry.getutc())))) {
                return { status: 'fail', summary: 'The BLE clock did not keep the time it was just given.' }
            }
            // Setting the RTC holds the AI processor's interrupts off for about
            // a second, and its reply was lost on the bench while the clock did
            // change. So a timeout is not a failure; the read-back decides.
            await session.execute(() => commandRegistry.aiSetutc())
                .catch((e) => { if (messageOf(e) !== 'TIMEOUT') throw e })
            if (off(await session.execute(() => commandRegistry.aiGetutc()))) {
                return { status: 'fail', summary: "The AI processor's clock did not keep the time it was just given, so photos would carry the wrong time." }
            }
            return { status: 'pass', summary: 'Both clocks set and read back.' }
        })

        await step('storage', async () => {
            const info = await session.execute(() => commandRegistry.aiinfo())
            if (info.error || !info.total) {
                return { status: 'fail', summary: 'The SD card did not answer. Reseat it and power cycle the camera.' }
            }
            const gb = (k: number) => (k / 1048576).toFixed(1)
            return { status: 'pass', summary: `${gb(info.free ?? 0)} GB free of ${gb(info.total)} GB.` }
        })

        await step('leds', async () => {
            deps.instruct('Watch the camera: its small LED flashes red, green and blue, then the white LED lights.')
            for (const colour of ['r', 'g', 'b'] as const) {
                await session.execute(() => commandRegistry.boardLed(colour, 3, 200))
                await pause(LED_GAP_MS)
            }
            // `AI flash` answers with nothing; the command resolves on the
            // Sleep after it, and a timeout still means it was sent.
            await session.execute(() => commandRegistry.aiflash(50, 500))
                .catch((e) => { if (messageOf(e) !== 'TIMEOUT') throw e })
            deps.instruct(null)

            const board = await deps.ask('Did the small LED flash red, then green, then blue?')
            const white = await deps.ask('Did the white LED light up?')
            if (board && white) return { status: 'pass', summary: 'All four LEDs lit.' }
            const missing = [board ? null : 'the red, green and blue LED', white ? null : 'the white LED'].filter(Boolean)
            return { status: 'fail', summary: `Not seen: ${missing.join(' and ')}.` }
        })

        await step('light', async () => {
            const wait = awaitAeRegisters(deviceId)
            try {
                await session.execute(() => commandRegistry.light())
            } catch (e) {
                wait.cancel()
                throw e
            }
            const ae = await wait.promise
            if (!ae) return { status: 'fail', summary: 'No light reading came back. Is the HM0360 sensor connected?' }
            return { status: 'pass', summary: `Mean brightness ${ae.aeMean}, gain ${ae.analogGain}.` }
        }, { needsCameras: true })

        await step('motion', async () => {
            const blocks: number[] = []
            const onLine = (event: BleEvent & { type: 'TEXT_LINE' }) => {
                if (event.deviceId !== deviceId) return
                if (new RegExp(`About to capture\\s+${MOTION_FRAMES}\\s+images`, 'i').test(event.line)) {
                    deps.instruct('Wave your hand in front of the camera now, until the next step starts.')
                }
                const m = /HM0360 motion in (\d+) blocks/i.exec(event.line)
                if (m) blocks.push(parseInt(m[1], 10))
            }
            try {
                await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.TEST_MODE_BITS, value: TEST_BIT_SKIP_FILE_CREATION }))
                // The detector takes its rate from op11 on the way to sleep,
                // so the burst only sees fresh grids after a sleep at this rate.
                await mdIntervalHold.acquire(session, deviceId, MOTION_INTERVAL_MS)
                deps.instruct('Keep still for a moment. You will be asked to wave.')
                await session.waitForSleep(SLEEP_WAIT_MS)
                bleEventBus.on('textLine', onLine)
                await runBurst()
            } finally {
                bleEventBus.removeListener('textLine', onLine)
                // Cleared at the start, so 0 is the value to go back to, and
                // the photos after this need it: with bit 3 set none is saved.
                await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.TEST_MODE_BITS, value: 0 }))
                    .catch((e) => logWarn('[DeviceCheck] could not clear op18:', e))
                await mdIntervalHold.release(session, deviceId)
                    .then(() => mdIntervalHold.restorePending(session, deviceId))
                    .catch((e) => logWarn('[DeviceCheck] could not restore op11:', e))
            }
            // The first frame after a wake has nothing to compare with and always reads 0.
            const most = blocks.length > 0 ? Math.max(...blocks) : 0
            if (blocks.length === 0) return { status: 'fail', summary: 'The camera sent no motion readings. Is the HM0360 sensor connected?' }
            if (most === 0) return { status: 'fail', summary: `No motion in ${blocks.length} frames. Wave closer to the camera and run again.` }
            return { status: 'pass', summary: `Motion seen, up to ${most} blocks in a frame.` }
        }, { needsCameras: true })

        await step('mono', async () => {
            await bootCamera('HM0360')
            await capture(2)
            const wait = awaitAeRegisters(deviceId, AE_WAIT_MS)
            let file: string
            try {
                file = await capture()
            } catch (e) {
                wait.cancel()
                throw e
            }
            const ae = await wait.promise
            const mean = ae ? parseInt(ae.aeMean, 10) : null
            const problem = photoProblem(await fetchPhoto('HM0360', file), mean)
            if (problem) return { status: 'fail', summary: problem }
            return { status: 'pass', summary: `Photo taken, mean brightness ${mean ?? 'not reported'}.` }
        }, { needsCameras: true })

        // Judged by eye beside the plain photo. The HM0360's own mean is no
        // measure of the flash: on the bench the IR shot read 72 against 78
        // without, because its auto exposure had already turned the gain down,
        // while the same frame reported motion in 29 blocks, the flash lighting
        // the scene (6 October 2026).
        await step('ir', async () => {
            if (!passed('mono') || !photos.HM0360) {
                return { status: 'skipped', summary: 'Needs the black & white photo first.' }
            }
            const ops = await session.getOps()
            const led = ops[OP_PARAMETER.FLASH_LED]
            const brightness = ops[OP_PARAMETER.LED_BRIGHTNESS]
            let file: string
            try {
                await flashHold.release(session, deviceId)
                await flashHold.acquire(session, deviceId, FLASH_MODE_ALWAYS_ON)
                await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.FLASH_LED, value: FLASH_LED_IR }))
                await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.LED_BRIGHTNESS, value: 100 }))
                // The firmware picks up the flash settings when it wakes.
                await session.waitForSleep(SLEEP_WAIT_MS)
                file = await capture()
            } finally {
                for (const [index, value] of [[OP_PARAMETER.FLASH_LED, led], [OP_PARAMETER.LED_BRIGHTNESS, brightness]] as const) {
                    if (value === undefined) continue
                    await session.execute(() => commandRegistry.setop({ index, value }))
                        .catch((e) => logWarn(`[DeviceCheck] could not restore op${index}:`, e))
                }
                await flashHold.release(session, deviceId)
                    .then(() => flashHold.acquire(session, deviceId, FLASH_MODE_OFF))
                    .catch((e) => logWarn('[DeviceCheck] could not put the flash hold back to off:', e))
            }
            const problem = photoProblem(await fetchPhoto('IR', file))
            if (problem) return { status: 'fail', summary: problem }
            const lit = await deps.ask('Is the IR photo clearly brighter than the black & white one beside it?')
            return lit
                ? { status: 'pass', summary: 'The IR flash lit the photo.' }
                : { status: 'fail', summary: 'The IR photo is no brighter. Check the IR LED and its cable.' }
        }, { needsCameras: true })

        await step('framing', async () => {
            if (!photos.RP3 || !photos.HM0360) {
                return { status: 'skipped', summary: 'Needs a photo from each camera.' }
            }
            const alike = await deps.ask('Look at the colour and black & white photos. Do both show the test card, centred alike?')
            return alike
                ? { status: 'pass', summary: 'Both cameras see the card alike.' }
                : { status: 'fail', summary: 'The cameras do not see the card alike. Check that both modules sit square in the case.' }
        }, { needsCameras: true })
    } finally {
        deps.instruct(null)
        if (startCamera !== 'unknown' && currentCamera !== startCamera) {
            deps.instruct(`Putting the ${CAMERA_VARIANT_LABELS[startCamera]} camera back`)
            await deps.switchCamera(startCamera).catch((e) => logWarn('[DeviceCheck] could not switch back:', e))
            deps.instruct(null)
        }
        if (holding) {
            await flashHold.release(session, deviceId).catch((e) => logWarn('[DeviceCheck] could not restore op34:', e))
            await keepAwake.release(session, deviceId).catch((e) => logWarn('[DeviceCheck] could not restore op8:', e))
        }
    }
}
