import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { unstable_batchedUpdates } from 'react-native'

import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { log, logError } from '../../../utils/logger'
import { bleEventBus, BleEvent } from '../../../ble/protocol/eventBus'
import { commandRegistry } from '../../../ble/protocol/commandRegistry'
import { bleTransport } from '../../../ble/protocol/bleTransportController'
import { createBleSession } from '../../../ble/session/createBleSession'
import { writeToDevice } from '../../../ble/transport'
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

/** A snapshot of one frame's motion detection grid. */
export interface FrameSnapshot {
    frameIndex: number
    grid: boolean[][]
    blockCount: number
}

export const useMotionDetectionStream = ({ device }: UseMotionDetectionStreamOptions) => {
    // 16x16 grid initialized to false
    const [mdGrid, setMdGrid] = useState<boolean[][]>(Array(16).fill(Array(16).fill(false)))
    const [isTesting, setIsTesting] = useState(false)
    const [testFinished, setTestFinished] = useState(false)
    const [mdBlocksCount, setMdBlocksCount] = useState<number>(0)
    const [motionDetected, setMotionDetected] = useState(false)
    const [frameCount, setFrameCount] = useState(0)
    const motionTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    // Pipeline status — shows the user what the system is doing at each stage
    const [statusMessage, setStatusMessage] = useState<string>('')
    const [errorMessage, setErrorMessage] = useState<string>('')

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

    // Pending frames accumulated during capture — committed to state on completion.
    // This avoids O(N²) array spreads and prevents N re-renders of the MiniGrid list.
    const pendingFramesRef = useRef<FrameSnapshot[]>([])

    // Original INTERVAL_BEFORE_DPD value before test extension.
    // Restored to this value when the test completes naturally.
    const originalDpdRef = useRef<number | null>(null)

    // Throttle live grid renders: at fast intervals (0.5s), the grid
    // can't keep up with every frame. Only repaint at most every 100ms.
    // (Reduced from 200ms because SkiaGrid renders directly to GPU
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

            // Detect Wake (MD) — HM0360 internal threshold exceeded
            if (/Wake \(MD\)/i.test(msg) || /^MD \d{4}-/i.test(msg.trim())) {
                log('[MotionDetectionStream] Motion threshold exceeded!')
                setMotionDetected(true)
                if (motionTimeoutRef.current) clearTimeout(motionTimeoutRef.current)
                motionTimeoutRef.current = setTimeout(() => setMotionDetected(false), 500)
            }

            // Detect natural completion: "Captured N images"
            if (/Captured\s+\d+\s+images/i.test(msg)) {
                log('[MotionDetectionStream] Firmware capture sequence completed naturally.')
                activeRef.current = false
                // Commit all pending frames to state in one batch
                const frames = pendingFramesRef.current
                pendingFramesRef.current = []
                unstable_batchedUpdates(() => {
                    setFrameHistory(frames)
                    // Show the last frame's grid in the live view
                    if (frames.length > 0) {
                        setMdGrid(frames[frames.length - 1].grid)
                    }
                    setIsTesting(false)
                    setTestFinished(true)
                    setStatusMessage('')
                })
                bleTransport.clearAll()
                log('[MotionDetectionStream] Command queue cleared — ready for next test.')

                // Restore INTERVAL_BEFORE_DPD if we extended it for this test
                if (originalDpdRef.current !== null && device) {
                    const restoreVal = originalDpdRef.current
                    originalDpdRef.current = null
                    log(`[MotionDetectionStream] Restoring DPD timeout to ${restoreVal}ms`)
                    writeToDevice(device, `AI setop ${OP_PARAMETER.INTERVAL_BEFORE_DPD} ${restoreVal}`)
                        .catch(() => log('[MotionDetectionStream] DPD restore failed (non-critical)'))
                }
            }

            // Detect firmware errors that prevent capture
            if (/Camera system not enabled/i.test(msg)) {
                log('[MotionDetectionStream] ERROR: Camera system not enabled')
                activeRef.current = false
                setIsTesting(false)
                setStatusMessage('')
                setErrorMessage('Camera system not enabled. Go to Device Settings and reset the Operational Parameters, then try again.')
                bleTransport.clearAll()
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
            if (msg.includes('HM0360 motion')) {
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

                        const grid = gridChanged
                            ? processHexGrid(rawBytes)
                            : pendingFramesRef.current.length > 0
                                ? pendingFramesRef.current[pendingFramesRef.current.length - 1].grid
                                : processHexGrid(rawBytes)

                        const snapshot: FrameSnapshot = {
                            frameIndex: frameIndexRef.current,
                            grid,
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
                                setMdGrid(grid)
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
        }
    }, [device])

    /** Parse 32 hex bytes into a 16×16 boolean grid (pure — no setState). */
    const processHexGrid = (bytes: number[]): boolean[][] => {
        // Each row is 2 bytes: byte[0] covers columns 0-7, byte[1] covers columns 8-15.
        // Within each byte, bit N → column N (LSB = col 0, MSB = col 7 within the byte).
        // This matches the firmware's text representation (dots and hashes).
        const newGrid: boolean[][] = []
        for (let row = 0; row < 16; row++) {
            const rowBools: boolean[] = []
            const byte1 = bytes[row * 2]
            const byte2 = bytes[row * 2 + 1]

            // Columns 0-7 from byte1
            for (let bit = 0; bit < 8; bit++) {
                // eslint-disable-next-line no-bitwise
                rowBools.push(((byte1 >> bit) & 1) === 1)
            }
            // Columns 8-15 from byte2
            for (let bit = 0; bit < 8; bit++) {
                // eslint-disable-next-line no-bitwise
                rowBools.push(((byte2 >> bit) & 1) === 1)
            }
            newGrid.push(rowBools)
        }
        return newGrid
    }

    /**
     * Start the motion detection test.
     * 
     * Sends a single `AI capture 999 <intervalMs>` command to the firmware.
     * The device captures 999 frames at the specified interval, streaming
     * MD grid data for every frame over BLE. No JPEG files are saved
     * (TEST_BIT_SKIP_FILE_CREATION is enabled).
     * 
     * @param sensitivityLevel - MD sensitivity (1=Low, 2=Med, 3=High)
     * @param intervalMs - Interval between frames in milliseconds (default 1000)
     * @param captureCount - Number of frames to capture
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
        setMdGrid(Array(16).fill(Array(16).fill(false)))
        setMdBlocksCount(0)
        setFrameCount(0)
        setFrameHistory([])
        pendingFramesRef.current = []
        blockCountRef.current = 0

        try {
            log(`[MotionDetectionStream] Starting MD test: sensitivity=${sensitivityLevel}, interval=${intervalMs}ms`)

            // Clear any stale commands from a previous test so the queue
            // is immediately ready for new commands.
            bleTransport.clearAll()
            setStatusMessage('Reading device parameters…')
            setErrorMessage('')

            const session = createBleSession(device)

            // 0. Query current OP values so we only send setops for changes.
            //    getops returns all OPs as a string[] indexed by OP number.
            //    This single I2C round-trip (with DPD wake) replaces up to 4
            //    individual setop round-trips when values are already correct.
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
            const currentDpd = currentOps ? parseInt(currentOps[OP_PARAMETER.INTERVAL_BEFORE_DPD] ?? '1000', 10) : 1000

            // 1. Set MD sensitivity on the HM0360 via DIRECT BLE write.
            //    This bypasses the command queue because the md command has no
            //    reliable response — the nRF52 Wake(MD) firmware bug prevents
            //    the "MD sensitivity set to N" confirmation from arriving.
            //    We wait 3.3s after sending to let the nRF52 fully process the
            //    command before sending the next one.
            //    TODO: Remove the 3.3s delay once firmware sends a proper md response.
            if (sensitivityLevel !== undefined && sensitivityLevel > 0) {
                setStatusMessage(`Setting sensitivity to ${sensitivityLevel}…`)
                log(`[MotionDetectionStream] Setting MD sensitivity to ${sensitivityLevel} (direct BLE write)`)
                await writeToDevice(device, `AI md ${sensitivityLevel}`)
                    .catch(() => log('[MotionDetectionStream] md write failed (non-critical)'))
                await new Promise(r => setTimeout(r, 3300))
            }

            // 2. Extend INTERVAL_BEFORE_DPD FIRST — this must be the first
            //    session command after the md delay. After md, the firmware
            //    enters DPD due to the Wake(MD) bug. The DPD extension wakes
            //    the device and keeps it alive for subsequent setop + capture.
            //    Without this, the 1000ms inactivity timer fires between
            //    commands, putting the IMAGE task into "Save State" which
            //    drops the capture event.
            const requiredDpd = intervalMs + 2000
            if (requiredDpd > currentDpd) {
                log(`[MotionDetectionStream] Extending DPD timeout: ${currentDpd}ms → ${requiredDpd}ms (interval=${intervalMs}ms)`)
                setStatusMessage('Extending sleep timeout…')
                await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.INTERVAL_BEFORE_DPD, value: requiredDpd }))
                originalDpdRef.current = currentDpd
            } else {
                log(`[MotionDetectionStream] DPD timeout ${currentDpd}ms already covers interval ${intervalMs}ms`)
                originalDpdRef.current = null
            }

            // 2b. Enable TEST_BIT_SKIP_FILE_CREATION via session (not direct write).
            //     Using session.execute ensures proper sequencing with the DPD
            //     extension above — direct writes collide with session writes on
            //     the nRF52, causing "Dropped BLE message - busy".
            setStatusMessage('Configuring test mode…')
            if (currentTestBits !== TEST_BIT_SKIP_FILE_CREATION) {
                log('[MotionDetectionStream] Setting test mode bits via session')
                await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.TEST_MODE_BITS, value: TEST_BIT_SKIP_FILE_CREATION }))
            } else {
                log('[MotionDetectionStream] Test mode bits already set — skipping')
            }

            // 2c. Set flash parameters only if they differ from current values.
            if (flashLed > 0) {
                if (currentFlashLed !== flashLed) {
                    log(`[MotionDetectionStream] Setting flash LED=${flashLed} (was ${currentFlashLed})`)
                    await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.FLASH_LED, value: flashLed }))
                } else {
                    log(`[MotionDetectionStream] Flash LED already ${flashLed} — skipping`)
                }
                if (currentBrightness !== ledBrightness) {
                    log(`[MotionDetectionStream] Setting LED brightness=${ledBrightness} (was ${currentBrightness})`)
                    await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.LED_BRIGHTNESS, value: ledBrightness }))
                } else {
                    log(`[MotionDetectionStream] LED brightness already ${ledBrightness} — skipping`)
                }
            }

            // Check before firing the capture
            if (!activeRef.current) {
                log('[MotionDetectionStream] Start aborted — stop was called during setup.')
                writeToDevice(device, `AI setop ${OP_PARAMETER.TEST_MODE_BITS} 0`).catch(() => {})
                return
            }

            // 500ms gap: let the nRF52 accept setop before sending capture.
            // Without this, the nRF52 drops the capture ("Dropped BLE message - busy").
            await new Promise(r => setTimeout(r, 500))

            // 3. Fire the capture command — don't await completion.
            //    The firmware handles all timing internally with its hardware timer.
            //    Natural completion ("Captured N images") is detected via the BLE
            //    event listener, which calls bleTransport.clearAll() to free the queue.
            setStatusMessage(`Starting capture — ${count} frames @ ${intervalMs}ms…`)
            session.execute(() => commandRegistry.capture(count, intervalMs))
                .catch(e => {
                    if (e?.message === 'Session Reset') return // Expected on natural completion
                    log(`[MotionDetectionStream] Capture command ended: ${e?.message || 'ok'}`)
                })

            setStatusMessage(`Capturing — waiting for frame 1/${count}…`)
            log(`[MotionDetectionStream] Capture ${count} frames @ ${intervalMs}ms — firmware running.`)

        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error)
            logError('[MotionDetectionStream] Failed to start test:', error)
            activeRef.current = false
            setIsTesting(false)
            setStatusMessage('')
            setErrorMessage(`Test failed to start: ${errMsg}`)
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
     * Test mode bits are cleaned up at the START of the next test.
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
    }, [])

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
        clearTestFinished: () => setTestFinished(false),
        clearError: () => setErrorMessage(''),
    }), [mdGrid, isTesting, testFinished, startTest, stopTest, mdBlocksCount, motionDetected, frameCount, frameHistory, statusMessage, errorMessage])
}
