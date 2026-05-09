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

    // Throttle live grid renders: at fast intervals (0.5s), the 256-cell grid
    // can't keep up with every frame. Only repaint at most every 500ms.
    const lastGridRenderRef = useRef<number>(0)
    const GRID_RENDER_THROTTLE_MS = 500

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
                        const grid = processHexGrid(hexBufferRef.current.slice(0, 32))
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
                        const shouldRenderGrid = (now - lastGridRenderRef.current) >= GRID_RENDER_THROTTLE_MS

                        unstable_batchedUpdates(() => {
                            setFrameCount(idx)
                            setMdBlocksCount(blocks)
                            setStatusMessage(`Capturing \u2014 frame ${idx} received`)
                            // Only repaint the 256-cell grid if enough time has passed
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
     */
    const startTest = useCallback(async (
        sensitivityLevel?: number,
        intervalMs: number = 1000,
        captureCount: number = 20
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
            setStatusMessage('Waking device…')
            setErrorMessage('')

            const session = createBleSession(device)

            // 1. Set MD sensitivity on the HM0360 via DIRECT BLE write.
            //    This bypasses the command queue because the md command has no
            //    reliable response — the nRF52 Wake(MD) firmware bug prevents
            //    the "MD sensitivity set to N" confirmation from arriving.
            //    We wait 1.1s after sending to let the nRF52 fully process the
            //    command before sending the next one.
            //    TODO: Remove the 1.1s delay once firmware sends a proper md response.
            if (sensitivityLevel !== undefined && sensitivityLevel > 0) {
                setStatusMessage(`Setting sensitivity to ${sensitivityLevel}…`)
                log(`[MotionDetectionStream] Setting MD sensitivity to ${sensitivityLevel} (direct BLE write)`)
                await writeToDevice(device, `AI md ${sensitivityLevel}`)
                    .catch(() => log('[MotionDetectionStream] md write failed (non-critical)'))
                await new Promise(r => setTimeout(r, 3300))
            }

            // 2. Enable TEST_BIT_SKIP_FILE_CREATION via direct BLE write.
            //    This MUST NOT wait for a response before sending capture.
            //    The round-trip latency of waiting for "Set OpParam 18 = 8"
            //    (Himax I2C → nRF52 BLE → app JS → BLE write → nRF52 I2C)
            //    is sometimes >1000ms, which races against the firmware's
            //    inactivity timer. If the timer fires first, the IMAGE task
            //    enters Save State and silently drops the capture event.
            //    Sending setop as fire-and-forget with a 500ms gap ensures
            //    both setop and capture arrive at the nRF52 within its
            //    internal I2C processing window.
            setStatusMessage('Configuring test mode…')
            log('[MotionDetectionStream] Setting test mode bits (direct BLE write)')
            await writeToDevice(device, `AI setop ${OP_PARAMETER.TEST_MODE_BITS} ${TEST_BIT_SKIP_FILE_CREATION}`)
                .catch(() => log('[MotionDetectionStream] setop write failed (non-critical)'))

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
