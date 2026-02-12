import { useCallback } from "react"
import { useBle } from "./useBle"
import { CommandControlTypes, CommandNames } from "../ble/types"
import { ExtendedPeripheral } from "../redux/slices/devicesSlice"
import { formatGPSString } from '../utils/gpsUtils'
import { log, logError, logWarn } from '../utils/logger'
import { createCommand, createAction } from './useBleCommandFactory'


export const useBleCommands = () => {
    const { write, disconnectDevice } = useBle()

    // --- Device Info (using factory) ---
    const getBatteryLevel = createCommand(write, CommandNames.battery)
    const getDeviceVer = createCommand(write, CommandNames.ver)
    const getDeviceName = createCommand(write, CommandNames.device)
    const getDeviceId = createCommand(write, CommandNames.id)
    const getStatus = createCommand(write, CommandNames.status)
    const getOps = createCommand(write, CommandNames.getops)
    const getAiVer = createCommand(write, CommandNames.ai_ver)
    const getUtc = createCommand(write, CommandNames.getutc)

    // --- System Actions ---
    const runDfu = createAction(write, CommandNames.dfu)
    const runReset = createAction(write, CommandNames.reset)
    const runErase = createAction(write, CommandNames.erase)

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

    const setUtc = createAction(write, CommandNames.SET_UTC, { timeout: 10000 })


    // --- LoRaWAN ---
    const getDevEui = createCommand(write, CommandNames.deveui)
    const getAppEui = createCommand(write, CommandNames.appeui)
    const getAppKey = createCommand(write, CommandNames.appkey)
    const pingNetwork = createAction(write, CommandNames.ping)


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
                const match = response.match(/(\d+)\s*[Kk]\s*total\s*drive\s*space/i)
                if (match) {
                    const total = parseInt(match[1], 10)
                    // We don't get 'free' space from this specific command string usually, 
                    // but let's assume if we get a valid total, the card is present.
                    // If we want more details we might need to adjust the regex or command.
                    return { total, free: 0 } 
                }
            }
            return null
        } catch (error) {
            logError('[BLE CMD] Failed to write aiinfo command:', error)
            throw error
        }
    }, [write])

    const captureTestImage = useCallback(async (peripheral: ExtendedPeripheral) => {
        await write(peripheral, [[CommandNames.AI_CAPTURE, { control: CommandControlTypes.WRITE, value: "1 0" }]])
    }, [write])


    // --- Debug ---
    const runSelfTest = createCommand(write, CommandNames.selftest, { control: CommandControlTypes.WRITE })

    const enableCamera = createAction(write, CommandNames.ENABLE_CAMERA, { timeout: 10000 })
    
    const disableCamera = createAction(write, CommandNames.DISABLE_CAMERA, { timeout: 10000 })

    const getHeartbeat = useCallback(async (peripheral: ExtendedPeripheral) => {
        // Use 'wake' command instead of 'heartbeat' to ensure AI processor inactivity timer is reset
        // 'heartbeat' command only checks the BLE/MCU status but doesn't necessarily wake the AI
        log('[BLE CMD] Sending keep-alive (wake) to:', peripheral.id)
        await write(peripheral, [[CommandNames.wake, { control: CommandControlTypes.WRITE }]], { timeout: 8000 })
    }, [write])

    const wake = createAction(write, CommandNames.wake, { timeout: 5000 })

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
        log('[BLE CMD] Clearing GPS location on device:', peripheral.id)
        // Use formatGPSString to generate properly formatted DMS string
        // Firmware expects format like: "0°0'0.00\"_N_0°0'0.00\"_E_0.00_Above"
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
                    const results = await write(peripheral, [[CommandNames.setop, { control: CommandControlTypes.WRITE, value: `${opIndex} ${value}` }]])
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
        setGpsLocation,
        clearGpsLocation,
    }
}
