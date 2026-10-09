/**
 * deviceCheck: the ship check for a finished WW500, run from the app.
 *
 * One pass over everything a manufacturer can prove from outside the case:
 * the cameras' self-test after a restart (first, because a camera that does
 * not answer makes every photo step meaningless, and those steps are skipped
 * then), firmware and both camera images, the clocks, the SD card, the
 * LEDs, the light sensor, motion detection, both cameras' photos, the colour
 * camera's focus lens and both flashes. Each step reports pass, warn or fail and
 * the check carries on, so one run lists every fault on the unit.
 *
 * What only a person can judge is asked, not measured: whether the LEDs lit,
 * whether each flash photo is lit beside its plain one, and whether both
 * cameras show the test card framed alike. The app has no JPEG decoder, so the
 * photos are judged by what the camera reports (file size, and the HM0360's
 * own mean brightness) plus the operator's eye. See `utils/deviceCheck/` for
 * the rules and where their numbers came from.
 *
 * It starts by writing the factory defaults, as Reset to Defaults does but
 * keeping the AI model, the deployment ID and GPS, so no setting left by a
 * deployment or a bench session can change a step. What it changes after that
 * goes back to those defaults, so the unit leaves on them: op8 and op34
 * through their holds (which survive a dropped link), op12 after the LED test,
 * op18 and op11 after the motion step, op9 and op13 after each flash photo,
 * and the camera that was running when the check started.
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
import { executeResetToDefaults } from './resetToDefaults'
import { OP_PARAMETER } from '../../hooks/useDeviceSettings'
import { decodeSelfTest, formatSelfTestBits, KNOWN_BITS_MASK, parseSelfTestBits, SelfTestBit } from '../../utils/deviceSelfTest'
import { CAMERA_VARIANT_LABELS, CameraVariant, parseVariant } from '../../utils/cameraVariant'
import { SWEEP_UP, SWEEP_DOWN, SweepPoint, LensVerdict, lensVerdict, parseDirSizes } from '../../utils/deviceCheck/lensSweep'
import { photoProblem } from '../../utils/deviceCheck/photoStats'
import { log, logWarn } from '../../utils/logger'

export type CheckStepId =
    | 'cameras' | 'identity' | 'health' | 'clock' | 'storage' | 'leds' | 'light'
    | 'motion' | 'colour' | 'white' | 'mono' | 'ir' | 'framing'

export type CheckStatus = 'pending' | 'running' | 'pass' | 'warn' | 'fail' | 'skipped'

/** The photos the check shows: each camera's plain one, and each lit by its flash. */
export type CheckPhoto = 'RP3' | 'WHITE' | 'HM0360' | 'IR'

export interface CheckStepState {
    status: CheckStatus
    /** One line for the operator: the reading on a pass, what is wrong otherwise */
    summary: string
}

/**
 * The steps in the order they run: the name in the results, and what the
 * screen says while the step runs.
 */
export const CHECK_STEPS: { id: CheckStepId; title: string; doing: string }[] = [
    { id: 'cameras', title: 'Cameras connected (self-test after a restart)', doing: 'Checking the cameras are connected' },
    { id: 'identity', title: 'Firmware and camera images', doing: 'Reading the firmware and camera images' },
    { id: 'colour', title: 'Colour camera and focus lens', doing: 'Checking the colour camera and its focus lens' },
    { id: 'white', title: 'White flash', doing: 'Taking a colour photo with the white flash' },
    { id: 'health', title: 'Battery and temperature', doing: 'Reading the battery and temperature' },
    { id: 'clock', title: 'Clocks', doing: 'Setting the clocks' },
    { id: 'storage', title: 'SD card', doing: 'Checking the SD card' },
    { id: 'leds', title: 'LEDs', doing: 'Checking the LEDs' },
    { id: 'light', title: 'Light sensor', doing: 'Checking the light sensor' },
    { id: 'motion', title: 'Motion detection', doing: 'Checking motion detection' },
    { id: 'mono', title: 'Black & white camera', doing: 'Checking the black & white camera' },
    { id: 'ir', title: 'IR flash', doing: 'Taking a black & white photo with the IR flash' },
    { id: 'framing', title: 'Both cameras see the card', doing: 'Comparing the two cameras' },
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
    /** A yes/no question for the operator, with the photos it is about */
    ask: (question: string, photos?: CheckPhoto[]) => Promise<boolean>
    /** A prompt with one button: true when the operator taps it within `ms`, false otherwise */
    waitForTap: (text: string, button: string, ms: number) => Promise<boolean>
    /** A message the operator dismisses with OK, while the check carries on */
    notify: (text: string) => void
    /** What the operator should do now, or null when nothing */
    instruct: (text: string | null) => void
    onStep: (id: CheckStepId, state: CheckStepState) => void
    /** A photo to show: one from each camera, and each of those lit by its flash */
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
/** op13: 1 lights the white LED, 2 the IR LED */
const FLASH_LED_WHITE = 1
const FLASH_LED_IR = 2
/** The white LED test's length, which `AI flash` also saves as op12 */
const LED_TEST_MS = 500
/** op18 bit 3: the motion burst writes no files */
const TEST_BIT_SKIP_FILE_CREATION = 8

/** BLE die temperature outside this range fails the unit. */
export const TEMP_RANGE_C: [number, number] = [-20, 70]
/** Each clock must read back within this of the time just set. */
export const CLOCK_TOLERANCE_MS = 5000
/**
 * The AI processor's clock further off than this did not take the time at all.
 * Closer than this it is the time lost while the camera slept, which the BLE
 * processor leaves alone: it only corrects a difference of more than 300 s
 * (ww-hardware `aiProcessor.h`, `PERMITTEDTIMEERROR`).
 */
export const AI_CLOCK_NOT_SET_MS = 300_000

/** Long enough for three 200 ms flashes, and a gap before the next colour */
const LED_GAP_MS = 1500
/**
 * A `flashb` period the BLE firmware takes as "on until told otherwise"
 * (LEDONFOREVER in ww-hardware), the call it makes itself on connecting: the
 * solid blue LED that says the app is connected.
 */
const LED_ON_FOR_GOOD_MS = 65535
/** How long the operator has to tap while waving, about the length of the burst */
const WAVE_TAP_MS = 5000
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
 * camera bit or any other error fails; warning bits only warn, and so does a
 * bit the app has no name for, which is reported by its code.
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
    // eslint-disable-next-line no-bitwise
    const unknown = bits & ~KNOWN_BITS_MASK
    if (unknown !== 0) parts.push(`unknown self-test code ${formatSelfTestBits(unknown)}`)
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
            .catch((e) => {
                // On the bench (WILD-HSAN, AI firmware of 15 September 2026) the
                // first colour photo after the restart started and never finished.
                if (messageOf(e) === 'TIMEOUT') throw new StepFailure('The camera started the photo but did not finish it.')
                throw e
            })
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
        const name = photo === 'IR' ? 'IR' : photo === 'WHITE' ? 'white flash' : CAMERA_VARIANT_LABELS[photo]
        deps.instruct(`Downloading the ${name} photo (about half a minute)`)
        const { uri, bytes } = await downloadPhoto(session, deviceId, fileName)
        photos[photo] = uri
        deps.onPhoto(photo, uri)
        return bytes ?? 0
    }

    /**
     * A photo with one flash LED forced on: op34 always on through the flash
     * hold, op13 the LED, op9 full brightness. The firmware picks these up when
     * it wakes, so the photo follows a sleep; `afterWake` runs first, for what
     * the sleep lost. op13 and op9 are put back, and op34 to off for the rest.
     */
    const flashPhoto = async (led: number, afterWake: () => Promise<void> = async () => undefined): Promise<string> => {
        const ops = await session.getOps()
        const saved = [[OP_PARAMETER.FLASH_LED, ops[OP_PARAMETER.FLASH_LED]], [OP_PARAMETER.LED_BRIGHTNESS, ops[OP_PARAMETER.LED_BRIGHTNESS]]] as const
        try {
            await flashHold.release(session, deviceId)
            await flashHold.acquire(session, deviceId, FLASH_MODE_ALWAYS_ON)
            await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.FLASH_LED, value: led }))
            await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.LED_BRIGHTNESS, value: 100 }))
            await session.waitForSleep(SLEEP_WAIT_MS)
            await afterWake()
            return await capture()
        } finally {
            for (const [index, value] of saved) {
                if (value === undefined) continue
                await session.execute(() => commandRegistry.setop({ index, value }))
                    .catch((e) => logWarn(`[DeviceCheck] could not restore op${index}:`, e))
            }
            await flashHold.release(session, deviceId)
                .then(() => flashHold.acquire(session, deviceId, FLASH_MODE_OFF))
                .catch((e) => logWarn('[DeviceCheck] could not put the flash hold back to off:', e))
        }
    }

    /** Where the sweep found the colour camera sharpest; the white flash photo is taken there. */
    let sharpestLens: number | null = null

    // Raised for the whole check and put back at the end. Both are written to
    // CONFIG.TXT, which both camera images read, so they hold across the
    // camera switches too.
    let holding = false
    // The sleep timer before the reset: the first sleep still runs on it.
    let firstSleepMs = CHECK_KEEP_AWAKE_MS
    // Why the settings could not all be reset, shown on the firmware step.
    let resetProblem: string | null = null
    try {
        const ops = await session.getOps()
        firstSleepMs = Math.max(CHECK_KEEP_AWAKE_MS, parseInt(ops[OP_PARAMETER.INTERVAL_BEFORE_DPD] ?? '', 10) || 0)
        // Before the holds, so they keep the defaults as the values to go
        // back to. The model, deployment ID and GPS are not settings a step
        // depends on, and the model is a slow transfer to put back.
        deps.instruct('Resetting the settings to factory defaults')
        try {
            await executeResetToDefaults(session, { currentOps: ops, preserveModel: true, skipIdentityReset: true })
        } catch (e) {
            logWarn('[DeviceCheck] could not reset the settings:', e)
            resetProblem = messageOf(e)
        }
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
            // `AI dpd` brings that sleep forward: a unit at op8 60 s took a
            // minute to restart without it and 5 s with it (7 October 2026).
            // Firmware without it still restarts, on its own timer, so the
            // wait allows for that. Nothing else may be sent while waiting,
            // or the sleep moves away.
            const restartMs = firstSleepMs + 10000
            deps.instruct('Restarting the camera to read its self-test')
            const since = Date.now()
            await session.execute(() => commandRegistry.aireset())
            await session.execute(() => commandRegistry.aidpd())
                .catch((e) => logWarn('[DeviceCheck] AI dpd failed, waiting for the sleep timer:', e))
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
            // The reset already enabled the camera and cleared the test bits; a
            // leftover of either fails every photo below.
            if (resetProblem) {
                return { status: 'warn', summary: `${summary} The settings could not all be reset to factory defaults (${resetProblem}), so a leftover setting may change a step.` }
            }
            const ops = await session.getOps()
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
            sharpestLens = best.position
            await fetchPhoto('RP3', best.file)
            return { status: verdict.status, summary: verdict.message }
        }, { needsCameras: true })

        // While the colour image still runs. Judged by eye, as the IR flash is.
        await step('white', async () => {
            if (!photos.RP3 || sharpestLens === null) {
                return { status: 'skipped', summary: 'Needs the colour photo first.' }
            }
            const lens = sharpestLens
            deps.instruct('Keep the camera and the test card still. The white LED flashes for each photo.')
            await bootCamera('RP3')
            // The sleep loses the lens position and the exposure, so both are
            // set up again as the colour step did, the warm-ups lit too.
            const file = await flashPhoto(FLASH_LED_WHITE, async () => {
                await session.execute(() => commandRegistry.vcm(lens))
                await capture(WARM_UPS)
            })
            const problem = photoProblem(await fetchPhoto('WHITE', file))
            if (problem) return { status: 'fail', summary: problem }
            const lit = await deps.ask('Is the white flash photo clearly brighter than the colour one beside it?', ['RP3', 'WHITE'])
            return lit
                ? { status: 'pass', summary: 'The white flash lit the photo.' }
                : { status: 'fail', summary: 'The white flash photo is no brighter. Check the white LED and its cable.' }
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
        // sets it to 2024 on purpose, a known wrong date (Seeed #152), and the
        // BLE processor does not put it right straight away (Seeed #56), so
        // without this the unit would leave with photos stamped 2024 (bench,
        // 6 October 2026).
        //
        // The AI processor's clock also stops while the camera sleeps (Seeed
        // #56), so it reads back a few seconds behind whenever the camera slept
        // between the set and the read: 4.3 to 5.6 s on 7 October. That is the
        // firmware's known limit, not this unit's fault, and getting the BLE
        // processor to correct it sooner is deferred to Seeed #251. So the step
        // fails the AI clock only when it did not take the time, and warns when
        // it lags.
        await step('clock', async () => {
            const offBy = (ms: number) => ms - Date.now()
            await session.execute(() => commandRegistry.setutc())
            const ble = offBy(Date.parse(await session.execute(() => commandRegistry.getutc())))
            if (isNaN(ble) || Math.abs(ble) > CLOCK_TOLERANCE_MS) {
                return { status: 'fail', summary: 'The BLE clock did not keep the time it was just given.' }
            }
            // Setting the RTC holds the AI processor's interrupts off for about
            // a second, and its reply was lost on the bench while the clock did
            // change. So a timeout is not a failure; the read-back decides.
            await session.execute(() => commandRegistry.aiSetutc())
                .catch((e) => { if (messageOf(e) !== 'TIMEOUT') throw e })
            const ai = offBy(await session.execute(() => commandRegistry.aiGetutc()))
            if (isNaN(ai) || Math.abs(ai) > AI_CLOCK_NOT_SET_MS) {
                return { status: 'fail', summary: "The AI processor's clock did not keep the time it was just given, so photos would carry the wrong time." }
            }
            if (Math.abs(ai) > CLOCK_TOLERANCE_MS) {
                const seconds = (Math.abs(ai) / 1000).toFixed(1)
                return {
                    status: 'warn',
                    summary: ai < 0
                        ? `The AI processor's clock read ${seconds} s behind. It stops while the camera sleeps, a known firmware limit, so photos can be stamped up to 5 minutes early.`
                        : `The AI processor's clock read ${seconds} s ahead of the time it was given.`,
                }
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
            // The flashes leave the blue LED off; it says the app is connected.
            await session.execute(() => commandRegistry.boardLed('b', 1, LED_ON_FOR_GOOD_MS))
                .catch((e) => logWarn('[DeviceCheck] could not turn the blue LED back on:', e))
            // `AI flash` answers with nothing; the command resolves on the
            // Sleep after it, and a timeout still means it was sent. It also
            // saves its length as op12, so the unit's own value goes back.
            const flashMs = (await session.getOps())[OP_PARAMETER.FLASH_DURATION]
            try {
                await session.execute(() => commandRegistry.aiflash(50, LED_TEST_MS))
                    .catch((e) => { if (messageOf(e) !== 'TIMEOUT') throw e })
            } finally {
                if (flashMs !== undefined && flashMs !== String(LED_TEST_MS)) {
                    await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.FLASH_DURATION, value: flashMs }))
                        .catch((e) => logWarn('[DeviceCheck] could not restore op12:', e))
                }
            }
            deps.instruct(null)

            const board = await deps.ask('Did the small LED flash red, then green, then blue?')
            const white = await deps.ask('Did the white LED light up?')
            if (board && white) return { status: 'pass', summary: 'All four LEDs lit.' }
            const missing = [board ? null : 'the red, green and blue LED', white ? null : 'the white LED'].filter(Boolean)
            return { status: 'fail', summary: `Not seen: ${missing.join(' and ')}.` }
        })

        await step('light', async () => {
            const wait = awaitAeRegisters(deviceId, AE_WAIT_MS)
            try {
                await session.execute(() => commandRegistry.light())
                    .catch(async (e) => {
                        // Sent as the processor fell asleep, `AI light` was lost,
                        // reply and reading both (bench, 7 October 2026). The
                        // registry never retries it, so the step does, once.
                        if (messageOf(e) !== 'TIMEOUT') throw e
                        await session.execute(() => commandRegistry.light())
                    })
            } catch (e) {
                wait.cancel()
                throw e
            }
            const ae = await wait.promise
            if (!ae) return { status: 'fail', summary: 'No light reading came back. Is the HM0360 sensor connected?' }
            return { status: 'pass', summary: `Mean brightness ${ae.aeMean}, gain ${ae.analogGain}.` }
        }, { needsCameras: true })

        // The operator taps while waving, within the burst. Without a tap the
        // frames say nothing about the detector (nobody waved: no motion in 10
        // frames on WILD-DJUU, 7 October 2026), so the step is not judged.
        await step('motion', async () => {
            const blocks: number[] = []
            // Set from the line listener when the burst starts.
            const tap: { tapped: Promise<boolean> | null } = { tapped: null }
            const onLine = (event: BleEvent & { type: 'TEXT_LINE' }) => {
                if (event.deviceId !== deviceId) return
                if (!tap.tapped && new RegExp(`About to capture\\s+${MOTION_FRAMES}\\s+images`, 'i').test(event.line)) {
                    // What the screen says once the tap is in.
                    deps.instruct('Keep waving until the Watcher says hi back.')
                    tap.tapped = deps.waitForTap('Wave your hand in front of the camera now, and tap while you wave.', "I'm waving", WAVE_TAP_MS)
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
                // The operator is still waving: tell them to stop straight
                // away. The rest of the check does not wait for their OK.
                if (await (tap.tapped ?? Promise.resolve(false))) {
                    deps.notify(blocks.some(n => n > 0)
                        ? 'The Watcher says hi back! You can stop waving now.'
                        : 'You can stop waving now.')
                }
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
            if (!(await (tap.tapped ?? Promise.resolve(false)))) {
                return { status: 'skipped', summary: 'Not checked: nobody tapped to say they were waving. Run the check again to test motion.' }
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
            const file = await flashPhoto(FLASH_LED_IR)
            const problem = photoProblem(await fetchPhoto('IR', file))
            if (problem) return { status: 'fail', summary: problem }
            const lit = await deps.ask('Is the IR photo clearly brighter than the black & white one beside it?', ['HM0360', 'IR'])
            return lit
                ? { status: 'pass', summary: 'The IR flash lit the photo.' }
                : { status: 'fail', summary: 'The IR photo is no brighter. Check the IR LED and its cable.' }
        }, { needsCameras: true })

        await step('framing', async () => {
            if (!photos.RP3 || !photos.HM0360) {
                return { status: 'skipped', summary: 'Needs a photo from each camera.' }
            }
            const alike = await deps.ask('Do both photos show the test card, centred alike?', ['RP3', 'HM0360'])
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
