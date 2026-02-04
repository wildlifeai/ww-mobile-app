import { useCallback } from "react"
import { useBle } from "./useBle"
import { CommandControlTypes, CommandNames } from "../ble/types"
import { ExtendedPeripheral } from "../redux/slices/devicesSlice"
import { formatGPSString } from '../utils/gpsUtils'
import { log } from '../utils/logger'


export const useBleCommands = () => {
    const { write, disconnectDevice } = useBle()

    // --- Device Info ---
    const getBatteryLevel = useCallback(async (peripheral: ExtendedPeripheral) => {
        log('[BLE CMD] Sending battery level request to device:', peripheral.id)
        await write(peripheral, [[CommandNames.battery, { control: CommandControlTypes.READ }]])
    }, [write])

    const getDeviceVer = useCallback(async (peripheral: ExtendedPeripheral) => {
        await write(peripheral, [[CommandNames.ver, { control: CommandControlTypes.READ }]])
    }, [write])

    const getDeviceName = useCallback(async (peripheral: ExtendedPeripheral) => {
        await write(peripheral, [[CommandNames.device, { control: CommandControlTypes.READ }]])
    }, [write])

    const getDeviceId = useCallback(async (peripheral: ExtendedPeripheral) => {
        await write(peripheral, [[CommandNames.id, { control: CommandControlTypes.READ }]])
    }, [write])

    const getStatus = useCallback(async (peripheral: ExtendedPeripheral) => {
        await write(peripheral, [[CommandNames.status, { control: CommandControlTypes.READ }]])
    }, [write])

    const getOps = useCallback(async (peripheral: ExtendedPeripheral) => {
        await write(peripheral, [[CommandNames.getops, { control: CommandControlTypes.READ }]])
    }, [write])

    const getAiVer = useCallback(async (peripheral: ExtendedPeripheral) => {
        await write(peripheral, [[CommandNames.ai_ver, { control: CommandControlTypes.READ }]])
    }, [write])


    // --- System Actions ---
    const runDfu = useCallback(async (peripheral: ExtendedPeripheral) => {
        await write(peripheral, [[CommandNames.dfu, { control: CommandControlTypes.WRITE }]])
    }, [write])

    const runReset = useCallback(async (peripheral: ExtendedPeripheral) => {
        await write(peripheral, [[CommandNames.reset, { control: CommandControlTypes.WRITE }]])
    }, [write])

    const runErase = useCallback(async (peripheral: ExtendedPeripheral) => {
        await write(peripheral, [[CommandNames.erase, { control: CommandControlTypes.WRITE }]])
    }, [write])

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

    const setUtc = useCallback(async (peripheral: ExtendedPeripheral) => {
        await write(peripheral, [[CommandNames.SET_UTC, { control: CommandControlTypes.WRITE }]])
    }, [write])

    const getUtc = useCallback(async (peripheral: ExtendedPeripheral) => {
        await write(peripheral, [[CommandNames.getutc, { control: CommandControlTypes.READ }]])
    }, [write])


    // --- LoRaWAN ---
    const getDevEui = useCallback(async (peripheral: ExtendedPeripheral) => {
        await write(peripheral, [[CommandNames.deveui, { control: CommandControlTypes.READ }]])
    }, [write])

    const getAppEui = useCallback(async (peripheral: ExtendedPeripheral) => {
        await write(peripheral, [[CommandNames.appeui, { control: CommandControlTypes.READ }]])
    }, [write])

    const getAppKey = useCallback(async (peripheral: ExtendedPeripheral) => {
        await write(peripheral, [[CommandNames.appkey, { control: CommandControlTypes.READ }]])
    }, [write])

    const pingNetwork = useCallback(async (peripheral: ExtendedPeripheral) => {
        await write(peripheral, [[CommandNames.ping, { control: CommandControlTypes.WRITE }]])
    }, [write])


    // --- AI ---
    const checkSdCard = useCallback(async (peripheral: ExtendedPeripheral) => {
        log('[BLE CMD] Sending SD card check request (aiinfo) to device:', peripheral.id)
        try {
            // Send as raw string command like Engineer Console does
            await write(peripheral, ['AI info'])
            log('[BLE CMD] aiinfo command write completed successfully')
        } catch (error) {
            logError('[BLE CMD] Failed to write aiinfo command:', error)
            throw error
        }
    }, [write])

    const captureTestImage = useCallback(async (peripheral: ExtendedPeripheral) => {
        await write(peripheral, [[CommandNames.AI_CAPTURE, { control: CommandControlTypes.WRITE, value: "1 0" }]])
    }, [write])


    // --- Debug ---
    const runSelfTest = useCallback(async (peripheral: ExtendedPeripheral) => {
        await write(peripheral, [[CommandNames.selftest, { control: CommandControlTypes.WRITE }]])
    }, [write])

    const enableCamera = useCallback(async (peripheral: ExtendedPeripheral) => {
        log('[BLE CMD] Sending enable camera command to:', peripheral.id)
        // Bypass queue for immediate execution
        const { writeToDevice } = require('../utils/helpers')
        try {
            await writeToDevice(peripheral, `AI ${CommandNames.ENABLE_CAMERA}`)
        } catch (error) {
            // Fallback to queue if direct write fails (unlikely but safe) or just throw
            logError('[BLE CMD] Direct write failed for enableCamera:', error)
            await write(peripheral, [[CommandNames.ENABLE_CAMERA, { control: CommandControlTypes.WRITE }]])
        }
    }, [write])

    const disableCamera = useCallback(async (peripheral: ExtendedPeripheral) => {
        log('[BLE CMD] Sending disable camera command to:', peripheral.id)
        // Bypass queue for immediate execution
        const { writeToDevice } = require('../utils/helpers')
        try {
            await writeToDevice(peripheral, `AI ${CommandNames.DISABLE_CAMERA}`)
        } catch (error) {
            logError('[BLE CMD] Direct write failed for disableCamera:', error)
            await write(peripheral, [[CommandNames.DISABLE_CAMERA, { control: CommandControlTypes.WRITE }]])
        }
    }, [write])

    const getHeartbeat = useCallback(async (peripheral: ExtendedPeripheral) => {
        await write(peripheral, [[CommandNames.heartbeat, { control: CommandControlTypes.READ }]])
    }, [write])

    const flashLed = useCallback(async (peripheral: ExtendedPeripheral, color: 'red' | 'green' | 'blue', durationMs: number = 100, count: number = 5) => {
        const value = `${count} ${durationMs}`
        let commandName = CommandNames.flashr
        switch (color) {
            case 'green': commandName = CommandNames.flashg; break;
            case 'blue': commandName = CommandNames.flashb; break;
        }
        await write(peripheral, [[commandName, { control: CommandControlTypes.WRITE, value }]])
    }, [write])

    const setOperationalParam = useCallback(async (peripheral: ExtendedPeripheral, index: number, value: string) => {
        // Bypass queue for immediate execution to support robust timing in loops (e.g. useDeviceSettings)
        const { writeToDevice } = require('../utils/helpers')
        const commandStr = `AI setop ${index} ${value}`
        try {
            log(`[BLE CMD] Direct write: ${commandStr}`)
            await writeToDevice(peripheral, commandStr)
        } catch (error) {
            logError(`[BLE CMD] Direct write failed for setop ${index}:`, error)
            await write(peripheral, [[CommandNames.setop, { control: CommandControlTypes.WRITE, value: `${index} ${value}` }]])
        }
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

            // IMPORT WARNING: We need writeToDevice from helpers to bypass the useBle queue
            // The useBle queue batches commands with 20ms delays, which is too fast for the
            // firmware's wake/sleep cycle during this specific operation.
            const { writeToDevice } = require('../utils/helpers')

            // Send 8 commands with strict delays between each
            for (let i = 0; i < 8; i++) {
                const opIndex = 20 + i
                const value = ops[i]
                const commandStr = `AI setop ${opIndex} ${value}`

                log(`[BLE CMD] Setting OP${opIndex} = ${value} (chunk ${i + 1}/8)`)

                // Use direct writeToDevice to ensure we await the actual BLE transmission
                // and bypass the 500ms polling queue of useBle hook.
                try {
                    await writeToDevice(peripheral, commandStr)
                } catch (error) {
                    logError(`[BLE CMD] Failed to write chunk ${i + 1}:`, error)
                    throw error
                }

                // Add delay after each command to allow firmware to process/sleep/wake
                if (i < 7) {
                    // CRITICAL: First command (Wake) needs longer delay.
                    // Subsequent commands need enough time to process before next wake cycle triggers
                    const delay = i === 0 ? 600 : 150
                    await new Promise(r => setTimeout(r, delay))
                }
            }
            log('[BLE CMD] Deployment ID OPs sent successfully')
        },
        [] // No dependencies needed as we use direct import
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
        // Debug
        runSelfTest,
        getHeartbeat,
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
