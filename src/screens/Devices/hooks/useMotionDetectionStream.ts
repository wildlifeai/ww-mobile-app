import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { unstable_batchedUpdates } from 'react-native'

import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { log, logError, logWarn } from '../../../utils/logger'
import { bleEventBus, BleEvent } from '../../../ble/protocol/eventBus'
import { commandRegistry, isMdRefusal } from '../../../ble/protocol/commandRegistry'
import { bleTransport } from '../../../ble/protocol/bleTransportController'
import { createBleSession } from '../../../ble/session/createBleSession'
import { flashHold } from '../../../ble/session/flashHold'
import { keepAwake } from '../../../ble/session/keepAwake'
import { mdIntervalHold } from '../../../ble/session/mdIntervalHold'
import { OP_PARAMETER } from '../../../hooks/useDeviceSettings'

/** Maximum number of frames per test run. */
const MAX_CAPTURE_COUNT = 60

/**
 * TEST_BIT_SKIP_FILE_CREATION (bit 3 = 0x08)
 * When set in OP_PARAMETER_TEST_MODE_BITS, the firmware skips JPEG file creation
 * but still streams AE regs and MD grid data over BLE for every frame.
 * This dramatically reduces per-frame processing time (no SD card writes).
 */
const TEST_BIT_SKIP_FILE_CREATION = 8

interface UseMotionDetectionStreamOptions {
    device: ExtendedPeripheral | undefined
}

/** Block characters for grid rendering — monospace text, zero Views. */
const ACTIVE_CHAR = '█'
const INACTIVE_CHAR = '·'
const EMPTY_GRID = Array(16).fill(INACTIVE_CHAR.repeat(16)).join('\n')

/**
 * Undo what a test run set up: op18 back to 0, then the op11, op8 and flash
 * holds. Each step runs whether or not the one before it landed, and a hold
 * that cannot be written back stays owed in its module for the next flow on
 * that device (#271, #320). Every way out of a test ends here.
 *
 * op11 goes first of the holds, and an op11 restore left owed by a dropped
 * link or a lost reply is paid here too: raised on a stopped camera, op11
 * turns motion capture back on in the field (#274).
 */
const cleanUpAfterTest = (device: ExtendedPeripheral, why: string): Promise<void> => {
    const session = createBleSession(device)
    return session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.TEST_MODE_BITS, value: 0 }))
        .then(
            () => log(`[MotionDetectionStream] TEST_MODE_BITS reset to 0 (${why})`),
            (e: any) => logWarn(`[MotionDetectionStream] Failed to reset test mode bits (${why}):`, e)
        )
        .then(() => mdIntervalHold.release(session, device.id))
        .then(() => mdIntervalHold.restorePending(session, device.id))
        .then(() => keepAwake.release(session, device.id))
        .then(() => flashHold.release(session, device.id))
        .catch((e: any) => logWarn(`[MotionDetectionStream] Failed to release the test holds (${why}):`, e))
}

/** A snapshot of one frame's motion detection grid. */
export interface FrameSnapshot {
    frameIndex: number
    /** Precomputed display string (16 lines of 16 chars). Ready to render as <Text>. */
    gridString: string
    blockCount: number
}

/**
 * What became of the sensitivity a test asked for, when the card should say
 * so. `refused`: the camera build rejected `AI md`, so every level detects the
 * same on it. `unconfirmed`: no answer came, so the level may or may not have
 * taken. Nothing to say when op17 already held the level or the camera
 * confirmed it (#272).
 */
export type SensitivityNote = { kind: 'refused' | 'unconfirmed'; message: string } | null

const SENSITIVITY_NAMES = ['Off', 'Low', 'Medium', 'High']

export const useMotionDetectionStream = ({ device }: UseMotionDetectionStreamOptions) => {
    // 16x16 grid initialized to false
    const [mdGrid, setMdGrid] = useState<string>(EMPTY_GRID)
    const [isTesting, setIsTesting] = useState(false)
    const [testFinished, setTestFinished] = useState(false)
    const [mdBlocksCount, setMdBlocksCount] = useState<number>(0)
    const [motionDetected, setMotionDetected] = useState(false)
    const [frameCount, setFrameCount] = useState(0)
    const motionTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    // Pipeline status — shows the user what the system is doing at each stage
    const [statusMessage, setStatusMessage] = useState<string>('')
    const [errorMessage, setErrorMessage] = useState<string>('')
    const [sensitivityNote, setSensitivityNote] = useState<SensitivityNote>(null)

    // Frame history — ephemeral, cleared on new test / unmount
    const [frameHistory, setFrameHistory] = useState<FrameSnapshot[]>([])
    const blockCountRef = useRef<number>(0)

    // Parsing state
    const hexBufferRef = useRef<number[]>([])
    const expectingHexRef = useRef<boolean>(false)

    // Frame counter: tracks which frame we're on within the capture run.
    // Frame 1 after wake has no reference frame and always reports 0 motion blocks.
    // Only frame 2+ has meaningful delta data.
    const frameIndexRef = useRef<number>(0)

    // Whether we're actively processing incoming MD data.
    // Set to false on stopTest() so late-arriving frames are ignored.
    const activeRef = useRef<boolean>(false)

    // Whether this test's own capture has started ("About to capture N
    // images"). Until then a grid or a "Captured" is not ours: with op11 held
    // at the test rate through the setup sleep, a motion wake can take and
    // report a capture of its own first, and its "Captured 1 images" used to
    // end the test and release the holds under the real capture.
    const captureStartedRef = useRef<boolean>(false)

    // Pending frames accumulated during capture — committed to state on completion.
    // This avoids O(N²) array spreads and prevents N re-renders of the MiniGrid list.
    const pendingFramesRef = useRef<FrameSnapshot[]>([])



    // Throttle live grid renders: at fast intervals (0.5s), the grid
    // can't keep up with every frame. Only repaint at most every 100ms.
    // without React reconciliation or bridge overhead.)
    const lastGridRenderRef = useRef<number>(0)
    const GRID_RENDER_THROTTLE_MS = 100

    // Previous grid bytes for diff check — skip render if unchanged.
    const prevGridBytesRef = useRef<Uint8Array>(new Uint8Array(32))

    useEffect(() => {
        const messageListener = (event: BleEvent & { type: 'TEXT_LINE' }) => {
            if (!device || event.deviceId !== device.id) return;
            if (!activeRef.current) return; // Ignore frames after test stopped
            const msg = event.line;

            if (/About to capture\s+\d+\s+images/i.test(msg)) captureStartedRef.current = true

            // Detect Wake (MD) — HM0360 internal threshold exceeded
            if (/Wake \(MD\)/i.test(msg) || /^MD \d{4}-/i.test(msg.trim())) {
                log('[MotionDetectionStream] Motion threshold exceeded!')
                setMotionDetected(true)
                if (motionTimeoutRef.current) clearTimeout(motionTimeoutRef.current)
                motionTimeoutRef.current = setTimeout(() => setMotionDetected(false), 500)
            }

            // Detect natural completion: "Captured N images"
            if (/Captured\s+\d+\s+images/i.test(msg)) {
                if (!captureStartedRef.current) {
                    log(`[MotionDetectionStream] Ignored "${msg.trim()}": it came before this test's capture started`)
                    return
                }
                log('[MotionDetectionStream] Firmware capture sequence completed naturally.')
                activeRef.current = false
                // Commit all pending frames to state in one batch
                const frames = pendingFramesRef.current
                pendingFramesRef.current = []
                unstable_batchedUpdates(() => {
                    setFrameHistory(frames)
                    // Show the last frame's grid in the live view
                    if (frames.length > 0) {
                        setMdGrid(frames[frames.length - 1].gridString)
                    }
                    setIsTesting(false)
                    setTestFinished(true)
                    setStatusMessage('')
                })
                bleTransport.clearAll()
                log('[MotionDetectionStream] Command queue cleared — ready for next test.')

                // Reset test mode bits so subsequent captures save JPEG files.
                // Done async after DPD — will briefly wake the device.
                if (device) cleanUpAfterTest(device, 'done')
            }

            // Detect firmware errors that prevent capture
            if (/Camera system not enabled/i.test(msg)) {
                log('[MotionDetectionStream] ERROR: Camera system not enabled')
                activeRef.current = false
                setIsTesting(false)
                setStatusMessage('')
                setErrorMessage('Camera system not enabled. Go to Device Settings and reset the Operational Parameters, then try again.')
                bleTransport.clearAll()
                // The capture loop reads this as a stop and leaves the cleanup
                // to whoever stopped it, so it is done here: no "Captured" will
                // come, and the holds would otherwise stay on the device (#274).
                if (device) cleanUpAfterTest(device, 'camera not enabled')
                return
            }
            if (/No model found/i.test(msg) && /NN/i.test(msg)) {
                // Non-critical for MD test — just log
                log('[MotionDetectionStream] Note: No NN model loaded (OK for MD test)')
            }
            if (/Error bits = 0x[0-9a-fA-F]+/i.test(msg) && !/0x0000/.test(msg)) {
                setStatusMessage(`Device warning: ${msg.trim()}`)
            }

            // Detect the start of a motion frame
            if (msg.includes('HM0360 motion') && captureStartedRef.current) {
                hexBufferRef.current = [] // Reset buffer for new frame
                expectingHexRef.current = true
                
                // Extract block count — only use for frame 2+ (frame 1 is always 0)
                const countMatch = msg.match(/in\s+(\d+)\s+blocks/i)
                if (countMatch && frameIndexRef.current > 0) {
                    const count = parseInt(countMatch[1], 10)
                    blockCountRef.current = count
                }
            } else if (expectingHexRef.current) {
                // Extract hex bytes from the MD grid output
                const matches = msg.match(/\b[0-9a-fA-F]{2}\b/g)
                if (matches) {
                    const bytes = matches.map((h: string) => parseInt(h, 16))
                    hexBufferRef.current.push(...bytes)
                }

                // 32 bytes = complete 16x16 grid
                if (hexBufferRef.current.length >= 32) {
                    // Skip frame 1 (no reference frame after wake → always 0 motion)
                    if (frameIndexRef.current > 0) {
                        const rawBytes = hexBufferRef.current.slice(0, 32)

                        // Fast byte-level diff: skip grid processing if unchanged
                        const newBytes = new Uint8Array(rawBytes)
                        let gridChanged = false
                        for (let i = 0; i < 32; i++) {
                            if (newBytes[i] !== prevGridBytesRef.current[i]) {
                                gridChanged = true
                                break
                            }
                        }
                        prevGridBytesRef.current = newBytes

                        const gridString = gridChanged
                            ? bytesToGridString(rawBytes)
                            : pendingFramesRef.current.length > 0
                                ? pendingFramesRef.current[pendingFramesRef.current.length - 1].gridString
                                : bytesToGridString(rawBytes)

                        const snapshot: FrameSnapshot = {
                            frameIndex: frameIndexRef.current,
                            gridString,
                            blockCount: blockCountRef.current,
                        }
                        // Accumulate in ref — no re-render until test completes
                        pendingFramesRef.current.push(snapshot)

                        // Batch the minimal live-feedback state updates into a single render
                        const idx = frameIndexRef.current
                        const blocks = blockCountRef.current
                        const now = Date.now()
                        const shouldRenderGrid = gridChanged && (now - lastGridRenderRef.current) >= GRID_RENDER_THROTTLE_MS

                        unstable_batchedUpdates(() => {
                            setFrameCount(idx)
                            setMdBlocksCount(blocks)
                            setStatusMessage(`Capturing \u2014 frame ${idx} received`)
                            // Only repaint if data changed AND throttle allows
                            if (shouldRenderGrid) {
                                setMdGrid(gridString)
                                lastGridRenderRef.current = now
                            }
                        })
                    }
                    expectingHexRef.current = false
                    frameIndexRef.current++
                }
            }
        }

        bleEventBus.on('textLine', messageListener)
        return () => {
            bleEventBus.removeListener('textLine', messageListener)
            if (motionTimeoutRef.current) {
                clearTimeout(motionTimeoutRef.current)
                motionTimeoutRef.current = null
            }
        }
    }, [device])

    // Leaving the screen mid-test ends the test. The listener above goes with
    // the screen, so "Captured" would never be seen, and op18 = 8 and the op8
    // and op11 holds would stay behind with nothing left to clean them up
    // (#271, #274).
    const deviceRef = useRef(device)
    useEffect(() => { deviceRef.current = device }, [device])
    useEffect(() => () => {
        if (activeRef.current && deviceRef.current) {
            activeRef.current = false
            cleanUpAfterTest(deviceRef.current, 'left the screen')
        }
    }, [])

    /**
     * Convert 32 hex bytes into a precomputed 16-line display string.
     * Each row is 2 bytes: byte[0] → columns 0-7, byte[1] → columns 8-15.
     * LSB = col 0 within each byte. Output: '█' for motion, '·' for none.
     * The resulting string is stored immutably — the UI does zero computation.
     */
    const bytesToGridString = (bytes: number[]): string => {
        const rows: string[] = []
        for (let row = 0; row < 16; row++) {
            let line = ''
            const byte1 = bytes[row * 2]
            const byte2 = bytes[row * 2 + 1]
            for (let bit = 0; bit < 8; bit++) {
                // eslint-disable-next-line no-bitwise
                line += ((byte1 >> bit) & 1) ? ACTIVE_CHAR : INACTIVE_CHAR
            }
            for (let bit = 0; bit < 8; bit++) {
                // eslint-disable-next-line no-bitwise
                line += ((byte2 >> bit) & 1) ? ACTIVE_CHAR : INACTIVE_CHAR
            }
            rows.push(line)
        }
        return rows.join('\n')
    }

    /**
     * Start the motion detection test.
     *
     * Configures device OPs (test bits, flash, brightness) via session,
     * holds op8 and op11 for the run, sets MD sensitivity when op17 differs,
     * lets the device sleep so the HM0360 takes the test's rate, then fires a
     * capture command.
     * The device captures `captureCount` frames at `intervalMs` intervals,
     * streaming MD grid data over BLE. No JPEG files are saved
     * (TEST_BIT_SKIP_FILE_CREATION is enabled).
     *
     * @param sensitivityLevel - MD sensitivity (1=Low, 2=Med, 3=High)
     * @param intervalMs - Interval between frames in milliseconds (default 1000)
     * @param captureCount - Number of frames to capture (capped at MAX_CAPTURE_COUNT)
     * @param flashLed - Flash LED type (0=Off, 1=Visible, 2=IR)
     * @param ledBrightness - LED brightness (0-100%)
     */
    const startTest = useCallback(async (
        sensitivityLevel?: number,
        intervalMs: number = 1000,
        captureCount: number = 20,
        flashLed: number = 0,
        ledBrightness: number = 5,
    ) => {
        if (!device) return
        const count = Math.min(Math.max(1, Math.round(captureCount)), MAX_CAPTURE_COUNT)
        setIsTesting(true)
        setTestFinished(false)
        hexBufferRef.current = []
        expectingHexRef.current = false
        frameIndexRef.current = 0
        activeRef.current = true
        captureStartedRef.current = false
        setMdGrid(EMPTY_GRID)
        setMdBlocksCount(0)
        setFrameCount(0)
        setFrameHistory([])
        pendingFramesRef.current = []
        blockCountRef.current = 0
        // A refusal is the camera build's, so it stands for the whole visit.
        setSensitivityNote(prev => (prev?.kind === 'refused' ? prev : null))

        try {
            log(`[MotionDetectionStream] Starting MD test: sensitivity=${sensitivityLevel}, interval=${intervalMs}ms`)

            // Clear any stale commands from a previous test so the queue
            // is immediately ready for new commands.
            bleTransport.clearAll()
            setStatusMessage('Reading device parameters…')
            setErrorMessage('')

            const session = createBleSession(device)

            // 1. Read current OPs — device wakes from DPD for this call.
            setStatusMessage('Reading device parameters…')
            let currentOps: string[] | null = null
            try {
                currentOps = await session.execute(() => commandRegistry.getops())
                log(`[MotionDetectionStream] Current OPs: ${currentOps?.join(' ')}`)
            } catch (e) {
                log(`[MotionDetectionStream] getops failed, will set all params: ${e}`)
            }

            const currentTestBits = currentOps ? parseInt(currentOps[OP_PARAMETER.TEST_MODE_BITS] ?? '0', 10) : -1
            const currentFlashLed = currentOps ? parseInt(currentOps[OP_PARAMETER.FLASH_LED] ?? '0', 10) : -1
            const currentBrightness = currentOps ? parseInt(currentOps[OP_PARAMETER.LED_BRIGHTNESS] ?? '0', 10) : -1

            // 1a. Enable TEST_BIT_SKIP_FILE_CREATION — only if not already set.
            setStatusMessage('Configuring test mode…')
            const targetBits = TEST_BIT_SKIP_FILE_CREATION;
            const needsUpdate = currentTestBits === -1 || (currentTestBits & targetBits) !== targetBits;
            if (needsUpdate) {
                const newBits = currentTestBits === -1 ? targetBits : (currentTestBits | targetBits);
                log('[MotionDetectionStream] Setting test mode bits via session');
                await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.TEST_MODE_BITS, value: newBits }));
            } else {
                log('[MotionDetectionStream] Test mode bits already set — skipping')
            }

            // 1b. Set LED brightness if flash is enabled and value differs.
            if (flashLed > 0 && currentBrightness !== ledBrightness) {
                log(`[MotionDetectionStream] Setting LED brightness=${ledBrightness} (was ${currentBrightness})`)
                await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.LED_BRIGHTNESS, value: ledBrightness }))
            }

            // 1c. Set flash LED if enabled and value differs.
            if (flashLed > 0 && currentFlashLed !== flashLed) {
                log(`[MotionDetectionStream] Setting flash LED=${flashLed} (was ${currentFlashLed})`)
                await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.FLASH_LED, value: flashLed }))
            }

            // 1c-ii. Arm the flash for the run. op13 alone does not light
            // anything: the firmware's ledFlashIsActive() also asks the flash
            // mode, and in the shipped AE mode a lit bench keeps it off. Held
            // at always-on for the test and put back when the test ends, the
            // same hold Capture Picture takes (#283).
            if (flashLed > 0) {
                await flashHold.acquire(session, device.id)
                    .catch((e: any) => logWarn('[MotionDetectionStream] Could not arm the flash for the test:', e))
            }

            // 1d. Keep the device awake between test frames. Through keepAwake,
            // not a ref: op8 lives in CONFIG.TXT and applies in the field, and a
            // ref died with a dropped link or a killed app, leaving the device
            // awake after every motion capture (#271). keepAwake remembers the
            // original on disk and puts it back on the next hold or entry.
            // It reads op8 from the op cache the getops above just filled.
            const requiredDpd = Math.max(1000, intervalMs + 2000)
            if (currentOps) {
                await keepAwake.acquire(session, device.id, requiredDpd)
            }

            // 1e. Run the HM0360 at the test's rate (#274). The grid is its own
            // detector, and its rate comes from op11 when the device goes to
            // sleep, so without this the test inherits whatever the device
            // last slept with: after Stop Monitoring or a reset, one frame
            // every two seconds. Held through mdIntervalHold, like op8: op11
            // is a field setting, and left raised on a stopped camera it turns
            // motion capture back on. Not fatal: the test still runs, at the
            // inherited rate.
            let rateHeld = false
            if (currentOps) {
                rateHeld = await mdIntervalHold.acquire(session, device.id, intervalMs)
                    .catch((e: unknown) => {
                        logWarn('[MotionDetectionStream] Could not hold the detector at the test rate:', e)
                        return false
                    })
            }

            // Check before firing md
            if (!activeRef.current) {
                log('[MotionDetectionStream] Start aborted — stop was called during setup.')
                // stopTest's cleanup may have run before these holds were taken
                cleanUpAfterTest(device, 'aborted')
                return
            }

            // 2. Set MD sensitivity via session.
            //    Only when op17 does not already hold it: the level is saved on
            //    the card, so a repeat run has nothing to write, and today no
            //    `md` is ever acknowledged (the nRF drops the HM0360 build's
            //    reply, ww-hardware #52; the RP3 build refuses it, Seeed #211).
            //    A refusal or a lost reply is shown on the card, not swallowed:
            //    the grid is read as evidence for the level (#272).
            if (sensitivityLevel !== undefined && sensitivityLevel > 0) {
                const currentSensitivity = currentOps ? parseInt(currentOps[OP_PARAMETER.MD_SENSITIVITY] ?? '', 10) : NaN
                if (currentSensitivity === sensitivityLevel) {
                    log(`[MotionDetectionStream] MD sensitivity already ${sensitivityLevel}, not sending md`)
                } else {
                    const levelName = SENSITIVITY_NAMES[sensitivityLevel] ?? String(sensitivityLevel)
                    setStatusMessage(`Setting sensitivity to ${levelName}…`)
                    log(`[MotionDetectionStream] Setting MD sensitivity to ${sensitivityLevel} (op17 was ${isNaN(currentSensitivity) ? 'unknown' : currentSensitivity})`)
                    await session.execute(() => commandRegistry.md(sensitivityLevel))
                        .catch((e: unknown) => {
                            const reason = e instanceof Error ? e.message : String(e)
                            if (isMdRefusal(e)) {
                                logWarn(`[MotionDetectionStream] md refused by this camera build: ${reason}`)
                                setSensitivityNote({
                                    kind: 'refused',
                                    message: 'This camera build does not take a sensitivity: Low, Med and High detect the same on it.',
                                })
                            } else {
                                log(`[MotionDetectionStream] md not confirmed (non-critical): ${reason}`)
                                setSensitivityNote({
                                    kind: 'unconfirmed',
                                    message: `The camera did not confirm sensitivity ${levelName}, so it may not have taken.`,
                                })
                            }
                        })
                }
            }

            // 2b. Let the device sleep before the capture (#274). The HM0360
            //     takes its rate from op11 on the way into Deep Power Down, and
            //     op8 and the flash settings above apply at the next wake, so a
            //     capture sent into this awake window would run with none of
            //     them. `md`'s 5 s wait used to buy that sleep; since #272 it is
            //     often not sent. Nothing may be sent while waiting, since every
            //     command restarts the device's timer. Instant when the device
            //     is already asleep. The awake window can run on a previous
            //     run's hold, so the wait allows this run's hold and 2 s more;
            //     past that the capture goes anyway.
            if (rateHeld) {
                setStatusMessage('Letting the camera sleep so the detector takes the test rate…')
                const slept = await session.waitForSleep(Math.max(5000, requiredDpd + 2000))
                if (!slept) {
                    logWarn('[MotionDetectionStream] No Sleep before the capture; the detector may still run at its previous rate')
                }
            }

            // 3. Fire the capture command with retry logic.
            //    The device is asleep by now, or the wait above gave up. The
            //    capture command wakes it; we wait for 'About to capture'
            //    confirmation. If not received within 10s, retry up to 3 more times.
            const MAX_CAPTURE_ATTEMPTS = 4
            let captureConfirmed = false

            for (let attempt = 1; attempt <= MAX_CAPTURE_ATTEMPTS; attempt++) {
                if (!activeRef.current) break

                setStatusMessage(`Starting capture (attempt ${attempt}/${MAX_CAPTURE_ATTEMPTS})…`)
                log(`[MotionDetectionStream] Sending capture command (attempt ${attempt}/${MAX_CAPTURE_ATTEMPTS})`)

                // Set up a one-shot listener for the "About to capture" confirmation
                const confirmPromise = new Promise<void>(resolve => {
                    const onConfirm = (event: BleEvent & { type: 'TEXT_LINE' }) => {
                        if (!device || event.deviceId !== device.id) return
                        if (/About to capture/i.test(event.line)) {
                            bleEventBus.removeListener('textLine', onConfirm)
                            resolve()
                        }
                    }
                    bleEventBus.on('textLine', onConfirm)
                    // Clean up listener on timeout
                    setTimeout(() => bleEventBus.removeListener('textLine', onConfirm), 10000)
                })

                // Send capture — fire and forget (session handles the BLE write)
                bleTransport.clearAll()
                const captureSession = createBleSession(device)
                captureSession.execute(() => commandRegistry.capture(count, intervalMs), { maxRetries: 0 })
                    .catch(e => {
                        if (e?.message === 'Session Reset') return
                        log(`[MotionDetectionStream] Capture command ended: ${e?.message || 'ok'}`)
                    })

                // Wait up to 10s for confirmation
                const timeout = new Promise<'timeout'>(resolve =>
                    setTimeout(() => resolve('timeout'), 10000)
                )
                const result = await Promise.race([
                    confirmPromise.then(() => 'confirmed' as const),
                    timeout,
                ])

                if (result === 'confirmed') {
                    captureConfirmed = true
                    log(`[MotionDetectionStream] Capture confirmed on attempt ${attempt}`)
                    break
                } else {
                    log(`[MotionDetectionStream] Capture attempt ${attempt} timed out — no 'About to capture' received`)
                    bleTransport.clearAll()
                }
            }

            if (!captureConfirmed) {
                log('[MotionDetectionStream] All capture attempts failed')
                // A stop breaks the loop too, and stopTest has cleaned up already
                const stoppedByUser = !activeRef.current
                activeRef.current = false
                setIsTesting(false)
                setStatusMessage('')
                setErrorMessage('Capture command not acknowledged by device after 4 attempts.')
                if (!stoppedByUser) cleanUpAfterTest(device, 'no capture')
                return
            }

            setStatusMessage(`Capturing — waiting for frame 1/${count}…`)
            log(`[MotionDetectionStream] Capture ${count} frames @ ${intervalMs}ms — firmware running.`)

        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error)
            logError('[MotionDetectionStream] Failed to start test:', error)
            activeRef.current = false
            setIsTesting(false)
            setStatusMessage('')
            setErrorMessage(`Test failed to start: ${errMsg}`)
            cleanUpAfterTest(device, 'failed')
        }
    }, [device])

    /**
     * Stop the motion detection test.
     * 
     * Immediately stops processing incoming BLE data and hides the grid.
     * 
     * NOTE: The firmware capture sequence CANNOT be aborted from BLE.
     * During an active capture, the nRF52 BLE TX buffer is saturated with
     * frame data — sending commands during this flood risks a BLE disconnect.
     * Instead, we just stop processing on the app side. The device will
     * finish its remaining frames silently and go to DPD on its own.
     * op18 and the holds are put back now, by cleanUpAfterTest.
     */
    const stopTest = useCallback(() => {
        activeRef.current = false
        // Commit any frames that arrived before stop was pressed
        const frames = pendingFramesRef.current
        pendingFramesRef.current = []
        unstable_batchedUpdates(() => {
            if (frames.length > 0) setFrameHistory(frames)
            setIsTesting(false)
        })
        log('[MotionDetectionStream] Stopped MD test — no longer processing incoming frames.')
        log(`[MotionDetectionStream] Device will finish remaining capture frames in the background.`)

        // Reset test mode bits so subsequent captures save JPEG files.
        if (device) cleanUpAfterTest(device, 'stop')
    }, [device])

    return useMemo(() => ({
        mdGrid,
        isTesting,
        testFinished,
        startTest,
        stopTest,
        mdBlocksCount,
        motionDetected,
        frameCount,
        frameHistory,
        statusMessage,
        errorMessage,
        sensitivityNote,
        clearTestFinished: () => setTestFinished(false),
        clearError: () => setErrorMessage(''),
    }), [mdGrid, isTesting, testFinished, startTest, stopTest, mdBlocksCount, motionDetected, frameCount, frameHistory, statusMessage, errorMessage, sensitivityNote])
}
