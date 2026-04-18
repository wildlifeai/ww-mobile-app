import { useCallback, useMemo } from "react"
import { useBle } from "./useBle"
import { CommandControlTypes, CommandNames, COMMANDS } from "../ble/types"
import { ExtendedPeripheral } from "../redux/slices/devicesSlice"
import { formatGPSString } from '../utils/gpsUtils'
import { log, logError, logWarn } from '../utils/logger'
import { createCommand, createAction } from './useBleCommandFactory'
import { isCommandClearedError } from "../ble/commandManager"


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
    const getDeploymentIdAsString = useMemo(() => createCommand(write, CommandNames.getdid), [write])

    // --- System Actions ---
    const runDfu = useMemo(() => createAction(write, CommandNames.dfu), [write])
    const runReset = useMemo(() => createAction(write, CommandNames.reset), [write])
    const runErase = useMemo(() => createAction(write, CommandNames.erase), [write])
    const updateHimaxFirmware = useMemo(() => createCommand(write, CommandNames.ai_firmware, { timeout: 120000 }), [write])
    const getHimaxVersion = useMemo(() => createCommand(write, CommandNames.ai_ver, { timeout: 10000 }), [write])

    const runDisconnect = useCallback(async (peripheral: ExtendedPeripheral) => {
        try {
            await write(peripheral, [[CommandNames.dis, { control: CommandControlTypes.WRITE }]])
        } catch (e: any) {
            if (isCommandClearedError(e)) {
                log('[runDisconnect] Device disconnected gracefully')
            } else {
                logWarn('[runDisconnect] BLE write failed, proceeding to local disconnect:', e)
            }
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
    const getLorawanMetrics = useMemo(() => createCommand(write, CommandNames.network), [write])


    // --- AI ---
    const checkSdCard = useCallback(async (peripheral: ExtendedPeripheral): Promise<{ total: number; free: number } | null> => {
        log('[BLE CMD] Sending SD card check request (aiinfo) to device:', peripheral.id)
        try {
            // Wake the AI processor in case it's in Deep Power Down due to a missing SD card previously
            try {
                await write(peripheral, [[CommandNames.wake, { control: CommandControlTypes.WRITE }]], { timeout: 3000, maxRetries: 0 })
                // Give the firmware a moment to wake and mount the SD card
                await new Promise(resolve => setTimeout(resolve, 1500))
            } catch (e) {
                // Ignore wake failures, it is purely speculative 
            }

            // Use structured command to get response
            const responses = await write(peripheral, [[CommandNames.aiinfo, { control: CommandControlTypes.WRITE }]])
            const response = responses[0]
            
            if (response) {
                const match = response.match(COMMANDS[CommandNames.aiinfo].readRegex!)
                if (match) {
                    const total = parseInt(match[1], 10)
                    const free = parseInt(match[2], 10)
                    log(`[BLE CMD] Parsed SD Card: total=${total}KB, free=${free}KB`)
                    return { total, free } 
                }
            }
            return null
        } catch (error: any) {
            if (error?.message && error.message.includes('Device Sleep')) {
                logWarn('[BLE CMD] AI processor is sleeping, likely no SD card present')
                return null
            }
            logError('[BLE CMD] Failed to write aiinfo command:', error)
            return null // Return null gracefully
        }
    }, [write])

    const getCameraType = useMemo(
        () => createCommand(write, CommandNames.camera_type),
        [write]
    )



    // --- Debug ---
    const runSelfTest = useMemo(() => createCommand(write, CommandNames.selftest, { 
        control: CommandControlTypes.WRITE,
        timeout: 10000 // Increased to 10s to wait for device initialization
    }), [write])

    const enableCamera = useMemo(() => createAction(write, CommandNames.ENABLE_CAMERA, { timeout: 10000 }), [write])
    
    const disableCamera = useMemo(() => createAction(write, CommandNames.DISABLE_CAMERA, { timeout: 10000 }), [write])

    const setMdSensitivity = useMemo(() => createAction(write, CommandNames.md, { maxRetries: 0 }), [write])

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

    const getOperationalParam = useCallback(async (peripheral: ExtendedPeripheral, index: number): Promise<string | null> => {
        // "AI getop <index>" -> Response: "Op[<index>] = <value>"
        // Enable retries for OpParams as they are often requested during state transitions
        const responses = await write(peripheral, [[CommandNames.getop, { control: CommandControlTypes.WRITE, value: index.toString() }]], { maxRetries: 1 })
        const response = responses[0]
        if (response) {
             const match = response.match(COMMANDS[CommandNames.getop].readRegex!)
             if (match) {
                 return match[2].trim() // Returns the value part
             }
        }
        return null
    }, [write])

    const getAllOperationalParams = useCallback(async (peripheral: ExtendedPeripheral): Promise<string[] | null> => {
        // "AI getop -1" -> Response: "OpParam -1 = 0 10 200 ..."
        const responses = await write(peripheral, [[CommandNames.getop_all, { control: CommandControlTypes.WRITE }]], { maxRetries: 1 })
        const response = responses[0]
        if (response) {
            const match = response.match(COMMANDS[CommandNames.getop_all].readRegex!)
            if (match) {
                // Split by spaces and filter empties
                return match[1].trim().split(/\s+/)
            }
        }
        return null
    }, [write])

    const getOrFetchOperationalParams = useCallback(async (
        peripheral: ExtendedPeripheral, 
        cachedOps?: string[] | null, 
        logContext: string = '[BLE CMD]'
    ): Promise<string[] | null> => {
        let currentOps: string[] | null = cachedOps ?? null
        if (!currentOps) {
            try {
                currentOps = await getAllOperationalParams(peripheral)
                if (currentOps) {
                    log(`${logContext} Pre-fetched bulk ops`)
                }
            } catch (err) {
                logWarn(`${logContext} Warning: bulk fetch failed, proceeding blindly`, err)
            }
        } else {
            log(`${logContext} Using cached ops`)
        }
        return currentOps
    }, [getAllOperationalParams])

    const setOperationalParam = useCallback(async (peripheral: ExtendedPeripheral, index: number, value: string) => {
        // Use structured command so useBle can find the correct regex pattern automatically
        // We blindly set the parameter to avoid the roundtrip delay of a read-before-write
        await write(peripheral, [[CommandNames.setop, { control: CommandControlTypes.WRITE, value: `${index} ${value}` }]])
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

    // NOTE: setDeploymentIdAsOps (OP indices 20-27) has been removed.
    // Firmware no longer uses OP-based deployment ID chunks.
    // Use setDeploymentIdAsString (AI setdid) exclusively.

    const setDeploymentIdAsString = useCallback(
        async (peripheral: ExtendedPeripheral, id: string | null) => {
            log('[BLE CMD] Sending Deployment ID via string (setdid). ID:', id)
            const valueToSend = id || '00000000-0000-0000-0000-000000000000'
            await write(peripheral, [[CommandNames.setdid, { control: CommandControlTypes.WRITE, value: valueToSend }]])
            log('[BLE CMD] Deployment ID string sent successfully')
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
        setDeploymentIdAsString,
        getDeploymentIdAsString,
        // LoRaWAN
        getDevEui,
        getAppEui,
        getAppKey,
        pingNetwork,
        getLorawanMetrics,
        // AI
        checkSdCard,
        getCameraType,
        setMotionDetectInterval,
        disableMotionDetect,
        setTimelapseInterval,
        disableTimelapse,
        // Debug
        runSelfTest,
        flashLed,
        disconnectDevice,
        enableCamera,
        disableCamera,
        setMdSensitivity,
        // Settings
        setOperationalParam,
        getOperationalParam,
        getAllOperationalParams,
        getOrFetchOperationalParams,
        setGpsLocation,
        clearGpsLocation,
        // Himax
        updateHimaxFirmware,
        getHimaxVersion,
    }
}
