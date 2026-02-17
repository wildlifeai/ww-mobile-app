import { useCallback, useMemo } from "react"
import { useBle } from "./useBle"
import { CommandControlTypes, CommandNames, COMMANDS } from "../ble/types"
import { ExtendedPeripheral } from "../redux/slices/devicesSlice"
import { formatGPSString } from '../utils/gpsUtils'
import { log, logError, logWarn } from '../utils/logger'
import { createCommand, createAction } from './useBleCommandFactory'


export const useBleCommands = () => {
    const { write, disconnectDevice } = useBle()

    // --- Device Info (using factory) ---
    const getBatteryLevel = useMemo(() => createCommand(write, CommandNames.battery), [write])
    const getDeviceVer = useMemo(() => createCommand(write, CommandNames.ver, { timeout: 10000 }), [write])
    const getDeviceName = useMemo(() => createCommand(write, CommandNames.device), [write])
    const getDeviceId = useMemo(() => createCommand(write, CommandNames.id), [write])
    const getStatus = useMemo(() => createCommand(write, CommandNames.status), [write])
    const getOps = useMemo(() => createCommand(write, CommandNames.getops), [write])
    const getAiVer = useMemo(() => createCommand(write, CommandNames.ai_ver), [write])
    const getUtc = useMemo(() => createCommand(write, CommandNames.getutc), [write])

    // --- System Actions ---
    const runDfu = useMemo(() => createAction(write, CommandNames.dfu), [write])
    const runReset = useMemo(() => createAction(write, CommandNames.reset), [write])
    const runErase = useMemo(() => createAction(write, CommandNames.erase), [write])

    const runDisconnect = useCallback(async (peripheral: ExtendedPeripheral) => {
        try {
            await write(peripheral, [[CommandNames.dis, { control: CommandControlTypes.WRITE }]])
        } catch (e) {
            logWarn('[runDisconnect] BLE write failed, proceeding to local disconnect:', e)
        } finally {
            // Always trigger app-side disconnect
            await disconnectDevice(peripheral)
        }
    }, [write, disconnectDevice])

    const setUtc = useMemo(() => createAction(write, CommandNames.SET_UTC, { 
        timeout: 10000 
    }), [write])


    // --- LoRaWAN ---
    const getDevEui = useMemo(() => createCommand(write, CommandNames.deveui), [write])
    const getAppEui = useMemo(() => createCommand(write, CommandNames.appeui), [write])
    const getAppKey = useMemo(() => createCommand(write, CommandNames.appkey), [write])
    const pingNetwork = useMemo(() => createAction(write, CommandNames.ping), [write])


    // --- AI ---
    const checkSdCard = useCallback(async (peripheral: ExtendedPeripheral): Promise<{ total: number; free: number } | null> => {
        log('[BLE CMD] Sending SD card check request (aiinfo) to device:', peripheral.id)
        try {
            // Use structured command to get response
            // The readRegex in types.ts is: /(\d+)\s*[Kk]\s*total\s*drive\s*space/i
            const responses = await write(peripheral, [[CommandNames.aiinfo, { control: CommandControlTypes.WRITE }]])
            const response = responses[0]
            
            if (response) {
                // Parse the response "15200 K total drive space" -> 15200
                // Note: The regex in types.ts might capture just the first number.
                // We should probably rely on the regex capture if available, but here we get the full string match usually.
                const match = response.match(COMMANDS[CommandNames.aiinfo].readRegex!)
                if (match) {
                    const total = parseInt(match[1], 10)
                    const free = parseInt(match[2], 10)
                    log(`[BLE CMD] Parsed SD Card: total=${total}KB, free=${free}KB`)
                    return { total, free } 
                }
            }
            return null
        } catch (error) {
            logError('[BLE CMD] Failed to write aiinfo command:', error)
            throw error
        }
    }, [write])

    const getCameraType = useMemo(
        () => createCommand(write, CommandNames.camera_type),
        [write]
    )

    const captureTestImage = useCallback(async (peripheral: ExtendedPeripheral) => {
        await write(peripheral, [[CommandNames.AI_CAPTURE, { control: CommandControlTypes.WRITE, value: "1 0" }]])
    }, [write])


    // --- Debug ---
    const runSelfTest = useMemo(() => createCommand(write, CommandNames.selftest, { 
        control: CommandControlTypes.WRITE,
        timeout: 10000 // Increased to 10s to wait for device initialization
    }), [write])

    const enableCamera = useMemo(() => createAction(write, CommandNames.ENABLE_CAMERA, { timeout: 10000 }), [write])
    
    const disableCamera = useMemo(() => createAction(write, CommandNames.DISABLE_CAMERA, { timeout: 10000 }), [write])

    const getHeartbeat = useCallback(async (peripheral: ExtendedPeripheral) => {
        await write(peripheral, [[CommandNames.wake, { control: CommandControlTypes.WRITE }]], { timeout: 8000 })
    }, [write])

    const wake = useMemo(() => createAction(write, CommandNames.wake, { timeout: 5000 }), [write])

    /**
     * Flash one of the device LEDs
     * @param count Number of times to flash
     * @param durationMs Duration of each flash in milliseconds
     */
    const flashLed = useCallback(async (peripheral: ExtendedPeripheral, color: 'red' | 'green' | 'blue', count: number = 2, durationMs: number = 500) => {
        const value = `${count} ${durationMs}`
        let commandName = CommandNames.flashr
        switch (color) {
            case 'green': commandName = CommandNames.flashg; break;
            case 'blue': commandName = CommandNames.flashb; break;
        }
        await write(peripheral, [[commandName, { control: CommandControlTypes.WRITE, value }]])
    }, [write])

    const setOperationalParam = useCallback(async (peripheral: ExtendedPeripheral, index: number, value: string) => {
        // Use structured command so useBle can find the correct regex pattern automatically
        // Optimization: Pass expectedPattern: false to skip waiting for regex match (fire-and-forget)
        // This speeds up sequential writes significantly
        await write(peripheral, [[CommandNames.setop, { control: CommandControlTypes.WRITE, value: `${index} ${value}` }]], { expectedPattern: false })
    }, [write])

    const getOperationalParam = useCallback(async (peripheral: ExtendedPeripheral, index: number): Promise<string | null> => {
        // "AI getop <index>" -> Response: "Op[<index>] = <value>"
        const responses = await write(peripheral, [[CommandNames.getop, { control: CommandControlTypes.WRITE, value: index.toString() }]])
        const response = responses[0]
        if (response) {
             const match = response.match(COMMANDS[CommandNames.getop].readRegex!)
             if (match) {
                 return match[2].trim() // Returns the value part
             }
        }
        return null
    }, [write])

    const setGpsLocation = useCallback(
        async (peripheral: ExtendedPeripheral, latitude: number, longitude: number, altitude: number) => {
            try {
                const gpsString = formatGPSString(latitude, longitude, altitude)
                log('[BLE] Setting GPS location:', { latitude, longitude, altitude, gpsString })

                await write(peripheral, [[CommandNames.setgps, { control: CommandControlTypes.WRITE, value: gpsString }]])

                log('[BLE] GPS location set successfully')
            } catch (error) {
                logError('[BLE] Failed to set GPS location:', error)
                throw error
            }
        },
        [write]
    )

    const clearGpsLocation = useCallback(async (peripheral: ExtendedPeripheral) => {
        const gpsString = formatGPSString(0, 0, 0)
        await write(peripheral, [[CommandNames.setgps, { control: CommandControlTypes.WRITE, value: gpsString }]])
    }, [write])

    const setMotionDetectInterval = useCallback(async (peripheral: ExtendedPeripheral, intervalMs: number) => {
        await write(peripheral, [[CommandNames.SET_MOTION_DETECT_INTERVAL, { control: CommandControlTypes.WRITE, value: intervalMs.toString() }]])
    }, [write])

    const disableMotionDetect = useCallback(async (peripheral: ExtendedPeripheral) => {
        await write(peripheral, [[CommandNames.DISABLE_MOTION_DETECT, { control: CommandControlTypes.WRITE }]])
    }, [write])

    const setTimelapseInterval = useCallback(async (peripheral: ExtendedPeripheral, intervalSec: number) => {
        await write(peripheral, [[CommandNames.SET_TIMELAPSE_INTERVAL, { control: CommandControlTypes.WRITE, value: intervalSec.toString() }]])
    }, [write])

    const disableTimelapse = useCallback(async (peripheral: ExtendedPeripheral) => {
        await write(peripheral, [[CommandNames.DISABLE_TIMELAPSE, { control: CommandControlTypes.WRITE }]])
    }, [write])

    const setDeploymentIdAsOps = useCallback(
        async (peripheral: ExtendedPeripheral, id: string | null) => {
            log('[BLE CMD] Sending Deployment ID via OPs (20-27). ID:', id)

            let ops: number[]
            if (!id) {
                // Clear ID case: Send all zeros
                ops = [0, 0, 0, 0, 0, 0, 0, 0]
            } else {
                // Parse UUID
                const { parseUuidToOps } = require('../utils/helpers') // Lazy import to avoid cycle if any
                ops = parseUuidToOps(id)
            }

            // Send 8 commands with strict delays between each
            for (let i = 0; i < 8; i++) {
                const opIndex = 20 + i
                const value = ops[i]

                log(`[BLE CMD] Setting OP${opIndex} = ${value} (chunk ${i + 1}/8)`)

                // Use the new serialized write method instead of raw writeToDevice
                try {
                    // Optimization: Pass expectedPattern: false to skip regex waiting (fire-and-forget)
                    // This prevents timeouts if the device response is slow or slightly mismatched
                    const results = await write(peripheral, [[CommandNames.setop, { control: CommandControlTypes.WRITE, value: `${opIndex} ${value}` }]], { expectedPattern: false })
                    // Check if write returned an error string (since useBle swallows errors)
                    const result = results[0]
                    if (result && typeof result === 'string' && result.startsWith('ERROR:')) {
                        throw new Error(result)
                    }
                } catch (error) {
                    logError(`[BLE CMD] Failed to write chunk ${i + 1}:`, error)
                    throw error
                }
            }
            log('[BLE CMD] Deployment ID OPs sent successfully')
        },
        [write]
    )

    return {
        // Device
        getBatteryLevel,
        getDeviceVer,
        getDeviceName,
        getDeviceId,
        getStatus,
        getOps,
        getAiVer,
        // System
        runDfu,
        runReset,
        runErase,
        runDisconnect,
        setUtc,
        getUtc,
        setDeploymentIdAsOps,
        // LoRaWAN
        getDevEui,
        getAppEui,
        getAppKey,
        pingNetwork,
        // AI
        checkSdCard,
        getCameraType,
        captureTestImage,
        setMotionDetectInterval,
        disableMotionDetect,
        setTimelapseInterval,
        disableTimelapse,
        // Debug
        runSelfTest,
        getHeartbeat,
        wake,
        flashLed,
        disconnectDevice,
        enableCamera,
        disableCamera,

        // Settings
        setOperationalParam,
        getOperationalParam,
        setGpsLocation,
        clearGpsLocation,
    }
}
