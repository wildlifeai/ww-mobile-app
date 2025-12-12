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
        await write(peripheral, [[CommandNames.dis, { control: CommandControlTypes.WRITE }]])
        // Also trigger app-side disconnect
        await disconnectDevice(peripheral)
    }, [write, disconnectDevice])

    const setUtc = useCallback(async (peripheral: ExtendedPeripheral) => {
        await write(peripheral, [[CommandNames.SET_UTC, { control: CommandControlTypes.WRITE }]])
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


    return {
        // Device
        getBatteryLevel,
        getDeviceVer,
        getDeviceName,
        getDeviceId,
        getStatus,
        // System
        runDfu,
        runReset,
        runErase,
        runDisconnect,
        setUtc,
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

        // Settings
        setOperationalParam,
        setGpsLocation,
    }
}
