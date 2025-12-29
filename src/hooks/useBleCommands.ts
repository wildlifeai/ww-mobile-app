import { useCallback } from "react"
import { useBle } from "./useBle"
import { CommandControlTypes, CommandNames } from "../ble/types"
import { ExtendedPeripheral } from "../redux/slices/devicesSlice"
import { formatGPSString } from '../utils/gpsUtils'

export const useBleCommands = () => {
    const { write, disconnectDevice } = useBle()

    // --- Device Info ---
    const getBatteryLevel = useCallback(async (peripheral: ExtendedPeripheral) => {
        console.log('[BLE CMD] Sending battery level request to device:', peripheral.id)
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
            console.warn('[runDisconnect] BLE write failed, proceeding to local disconnect:', e)
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
        console.log('[BLE CMD] Sending SD card check request (aiinfo) to device:', peripheral.id)
        try {
            // Send as raw string command like Engineer Console does
            await write(peripheral, ['AI info'])
            console.log('[BLE CMD] aiinfo command write completed successfully')
        } catch (error) {
            console.error('[BLE CMD] Failed to write aiinfo command:', error)
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
        console.log('[BLE CMD] Sending enable camera command to:', peripheral.id)
        await write(peripheral, [[CommandNames.ENABLE_CAMERA, { control: CommandControlTypes.WRITE }]])
    }, [write])

    const disableCamera = useCallback(async (peripheral: ExtendedPeripheral) => {
        console.log('[BLE CMD] Sending disable camera command to:', peripheral.id)
        await write(peripheral, [[CommandNames.DISABLE_CAMERA, { control: CommandControlTypes.WRITE }]])
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
        await write(peripheral, [[CommandNames.setop, { control: CommandControlTypes.WRITE, value: `${index} ${value}` }]])
    }, [write])

    const setGpsLocation = useCallback(
        async (peripheral: ExtendedPeripheral, latitude: number, longitude: number, altitude: number) => {
            try {
                const gpsString = formatGPSString(latitude, longitude, altitude)
                console.log('[BLE] Setting GPS location:', { latitude, longitude, altitude, gpsString })

                await write(peripheral, [[CommandNames.setgps, { control: CommandControlTypes.WRITE, value: gpsString }]])

                console.log('[BLE] GPS location set successfully')
            } catch (error) {
                console.error('[BLE] Failed to set GPS location:', error)
                throw error
            }
        },
        [write]
    )

    const clearGpsLocation = useCallback(async (peripheral: ExtendedPeripheral) => {
        console.log('[BLE CMD] Clearing GPS location on device:', peripheral.id)
        // Sending setgps "0 0 0" to clear (firmware expects 3 args)
        await write(peripheral, [[CommandNames.setgps, { control: CommandControlTypes.WRITE, value: "0 0 0" }]])
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
            console.log('[BLE CMD] Sending Deployment ID via OPs (20-27). ID:', id)

            let ops: number[]
            if (!id) {
                // Clear ID case: Send all zeros
                ops = [0, 0, 0, 0, 0, 0, 0, 0]
            } else {
                // Parse UUID
                const { parseUuidToOps } = require('../utils/helpers') // Lazy import to avoid cycle if any
                ops = parseUuidToOps(id)
            }

            // Send 8 commands
            // Start index 20
            for (let i = 0; i < 8; i++) {
                const opIndex = 20 + i
                const value = ops[i]
                console.log(`[BLE CMD] Setting OP${opIndex} = ${value} (chunk ${i + 1}/8)`)
                // Reuse existing setOperationalParam logic manually to avoid hook recursion issues if any
                // or just call write directly
                await write(peripheral, [[CommandNames.setop, { control: CommandControlTypes.WRITE, value: `${opIndex} ${value}` }]])

                // The first command (OP20) might wake the device from DPD.
                // If we send the next command too fast (global PAUSE is 50ms), the firmware might drop it.
                // We add an explicit delay after the first chunk to allow for wake-up.
                if (i === 0) {
                    console.log('[BLE CMD] Pausing for device wake-up (optimized)...')
                    await new Promise(r => setTimeout(r, 200))
                }
            }
            console.log('[BLE CMD] Deployment ID OPs sent successfully')
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
        setMotionDetectInterval,
        disableMotionDetect,
        setTimelapseInterval,
        disableTimelapse,
    }
}
