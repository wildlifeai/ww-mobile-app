import { useState, useEffect, useCallback, useRef } from 'react'
import { Alert } from 'react-native'

import { bleCommandManager } from '../../../ble/commandManager'
import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { log, logError } from '../../../utils/logger'

interface UseMotionDetectionStreamOptions {
    device: ExtendedPeripheral | undefined
    write: (peripheral: ExtendedPeripheral, data: (string | [any, any])[], options?: any) => Promise<string[]>
}

export const useMotionDetectionStream = ({ device, write }: UseMotionDetectionStreamOptions) => {
    // 16x16 grid initialized to false
    const [mdGrid, setMdGrid] = useState<boolean[][]>(Array(16).fill(Array(16).fill(false)))
    const [isTesting, setIsTesting] = useState(false)
    const [mdBlocksCount, setMdBlocksCount] = useState<number>(0)
    const [motionDetected, setMotionDetected] = useState(false)
    const testIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const motionTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    // Parsing state
    const hexBufferRef = useRef<number[]>([])
    const expectingHexRef = useRef<boolean>(false)

    useEffect(() => {
        const messageListener = (msg: string) => {
            // Detect Wake (MD) — HM0360 internal threshold exceeded
            if (/Wake \(MD\)/i.test(msg) || /^MD \d{4}-/i.test(msg.trim())) {
                log('[MotionDetectionStream] Motion threshold exceeded!')
                setMotionDetected(true)
                if (motionTimeoutRef.current) clearTimeout(motionTimeoutRef.current)
                motionTimeoutRef.current = setTimeout(() => setMotionDetected(false), 500)
            }

            // Detect the start of a motion frame
            if (msg.includes('HM0360 motion')) {
                hexBufferRef.current = [] // Reset buffer for new frame
                expectingHexRef.current = true
                
                // Try to extract the block count
                const countMatch = msg.match(/in\s+(\d+)\s+blocks/i)
                if (countMatch) {
                    setMdBlocksCount(parseInt(countMatch[1], 10))
                }
            }

            if (expectingHexRef.current) {
                // Extract any hex-like byte strings (two hex chars followed by space or end of string)
                // Need to be careful not to match random words, but since we are expecting it and 
                // device outputs "1a 80 39...", this \b[0-9a-fA-F]{2}\b pattern works well.
                const matches = msg.match(/\b[0-9a-fA-F]{2}\b/g)
                if (matches) {
                    const bytes = matches.map(h => parseInt(h, 16))
                    hexBufferRef.current.push(...bytes)
                }

                // If we've accumulated at least 32 bytes, we have our 16x16 grid!
                if (hexBufferRef.current.length >= 32) {
                    processHexGrid(hexBufferRef.current.slice(0, 32))
                    expectingHexRef.current = false // Wait for next frame
                }
            }
        }

        bleCommandManager.addMessageListener(messageListener)
        return () => {
            bleCommandManager.removeMessageListener(messageListener)
        }
    }, [])

    const processHexGrid = (bytes: number[]) => {
        const newGrid: boolean[][] = []
        for (let row = 0; row < 16; row++) {
            const rowBools: boolean[] = []
            // 2 bytes per row (16 bits)
            const byte1 = bytes[row * 2]
            const byte2 = bytes[row * 2 + 1]
            
            // Assuming MSB first for each byte's pixels
            for (let bit = 7; bit >= 0; bit--) {
                rowBools.push(((byte1 >> bit) & 1) === 1)
            }
            for (let bit = 7; bit >= 0; bit--) {
                rowBools.push(((byte2 >> bit) & 1) === 1)
            }
            newGrid.push(rowBools)
        }
        setMdGrid(newGrid)
    }

    const startTest = useCallback(async () => {
        if (!device) return
        setIsTesting(true)
        hexBufferRef.current = []
        expectingHexRef.current = false
        // Empty the grid
        setMdGrid(Array(16).fill(Array(16).fill(false)))
        setMdBlocksCount(0)

        try {
            log('[MotionDetectionStream] Starting MD Test Loop...')
            // 1. Ensure camera subsystem is enabled so pictures can trigger hardware
            await write(device, ['AI setop 10 1'])
            
            // Wait a moment for DPD to settle
            await new Promise(resolve => setTimeout(resolve, 1000))

            // 2. Set picture interval between images in a burst (500ms)
            // IMPORTANT: Must be < 1000ms to avoid firmware inactivity timer sending
            // a premature Sleep between frames, which breaks frame 2's motion output.
            await write(device, ['AI setop 6 500'])

            // 3. Enable MD interval so the HM0360 sensor engages motion detection mode
            await write(device, ['AI setop 11 1000'])

            // 4. Capture 2 frames per cycle: frame 1 = reference, frame 2 = motion comparison.
            // After DPD wake, the HM0360 has no previous frame, so a single-frame capture
            // always reports 0 motion blocks. Two frames lets it compare frame 2 vs frame 1.
            // Interval of 500ms keeps both frames within the 1000ms inactivity window.
            testIntervalRef.current = setInterval(() => {
                write(device, ['AI capture 2 500'], { maxRetries: 1, timeout: 10000 })
                    .catch(e => logError('[MotionDetection] capture loop iteration failed', e))
            }, 5000)

            // Trigger the first one immediately
            write(device, ['AI capture 2 500'], { maxRetries: 1, timeout: 10000 })
                .catch(e => logError('[MotionDetection] Initial capture failed', e))

        } catch (error) {
            logError('[MotionDetectionStream] Failed to start test:', error)
            setIsTesting(false)
            Alert.alert('Test Error', 'Failed to initialize the motion detection test loop.')
        }
    }, [device, write])

    const stopTest = useCallback(async () => {
        if (testIntervalRef.current) {
            clearInterval(testIntervalRef.current)
            testIntervalRef.current = null
        }
        setIsTesting(false)
        log('[MotionDetectionStream] Stopped MD Test Loop.')
        
        if (device) {
            try {
                // Disable the motion detection interval to stop the test on the device side.
                await write(device, ['AI setop 11 0'])
                log('[MotionDetectionStream] MD test mode disabled on device.')
            } catch (error) {
                logError('[MotionDetectionStream] Failed to send stop command to device:', error)
            }
        }
    }, [device, write])

    // Ensure we clean up interval on unmount
    useEffect(() => {
        return () => {
            if (testIntervalRef.current) {
                clearInterval(testIntervalRef.current)
            }
        }
    }, [])

    return {
        mdGrid,
        isTesting,
        startTest,
        stopTest,
        mdBlocksCount,
        motionDetected
    }
}
