import { useCallback, useEffect } from 'react'
import { Alert, BackHandler } from 'react-native'
import { useBle } from '../../../hooks/useBle'
import { useBleCommands } from '../../../hooks/useBleCommands'
import { useGPSLocation } from '../../../hooks/useGPSLocation'
import { formatGPSString } from '../../../utils/gpsUtils'
import { log, logError, logWarn } from '../../../utils/logger'
import { CommandControlTypes, CommandNames, COMMANDS } from '../../../ble/types'
import { ConsoleEntry } from '../../../components/BleConsoleOutput'
import { handleFirmwareUpdate } from '../components/firmwareUpdateHelper'

export const useEngineerConsoleActions = ({
    device,
    consoleState,
    dispatch,
    startCapture,
    navigation,
}: {
    device: any
    consoleState: any
    dispatch: any
    startCapture: () => Promise<void>
    navigation: any
}) => {
    const { write, disconnectDevice, connectDevice } = useBle()

    // Destructure all the new commands
    const {
        getBatteryLevel, checkSdCard, pingNetwork, runSelfTest,
        getDeviceVer, getDeviceName, getDeviceId, getStatus,
        runDfu, runReset, runErase, runDisconnect, setUtc,
        getDevEui, getAppEui, getAppKey, flashLed,
    } = useBleCommands()
    
    // GPS location hook for SET_GPS command
    const { getLocation } = useGPSLocation()

    const handleBack = useCallback(async () => {
        if (device && device.connected) {
            log('Disconnecting device on back press...')
            try {
                // Determine if we need to call disconnectDevice or if removing from redundancy is enough
                await disconnectDevice(device)
            } catch (e) {
                logWarn('Disconnect error:', e)
            }
        }
        // Return to Devices tab
        navigation.navigate('Home', { initialTab: 'devices' })
    }, [device, disconnectDevice, navigation])

    // Handle Hardware Back Button
    useEffect(() => {
        const backHandler = BackHandler.addEventListener(
            'hardwareBackPress',
            () => {
                handleBack()
                return true
            }
        )
        return () => backHandler.remove()
    }, [handleBack])

    const handleSend = async (cmd?: string) => {
        const commandToSend = cmd || consoleState.inputText.trim()
        if (!commandToSend || !device) return

        if (!cmd) dispatch({ type: 'SET_INPUT_TEXT', payload: '' })

        // Add to history
        const newEntry: ConsoleEntry = {
            id: Date.now().toString(),
            timestamp: new Date(),
            type: 'command',
            content: commandToSend
        }
        dispatch({ type: 'APPEND_HISTORY', payload: newEntry })

        try {
            await write(device, [commandToSend])
        } catch (error) {
            const errorEntry: ConsoleEntry = {
                id: Date.now().toString(),
                timestamp: new Date(),
                type: 'error',
                content: `Error sending command: ${error}`
            }
            dispatch({ type: 'APPEND_HISTORY', payload: errorEntry })
        }
    }

    const handleQuickAction = async (action: string) => {
        log('[EngineerConsole] handleQuickAction called with:', action)
        if (!device) return

        let commandDisplay = action
        try {
            switch (action) {
                // --- Top Priority ---
                case 'Capture & Download':
                    commandDisplay = 'AI capture 1 1 (Auto-download)'
                    try {
                        log('[EngineerConsole] About to call startCapture()')
                        await startCapture()
                        log('[EngineerConsole] startCapture() completed')
                    } catch (error) {
                        logError('[EngineerConsole] startCapture() threw error:', error)
                    }
                    break
                case 'Get Last Image':
                    commandDisplay = 'AI txfile .'
                    await write(device, ['AI txfile .'])
                    break
                case 'Clear':
                    dispatch({ type: 'CLEAR_HISTORY' })
                    return

                // --- System ---
                case 'Sync Time': await setUtc(device); break;
                case 'DFU': await runDfu(device); break;
                case 'Reset': await runReset(device); break;
                case 'Erase': await runErase(device); break;
                case 'Disconnect': await runDisconnect(device); break;

                // --- Device ---
                case 'ID': await getDeviceId(device); break;
                case 'Ver': await getDeviceVer(device); break;
                case 'Name': await getDeviceName(device); break;
                case 'Battery': await getBatteryLevel(device); break;
                case 'Status': await getStatus(device); break;

                // --- LoRaWAN ---
                case 'Ping': await pingNetwork(device); break;
                case 'Get DevEUI': await getDevEui(device); break;
                case 'Get AppEUI': await getAppEui(device); break;
                case 'Get AppKey': await getAppKey(device); break;

                // --- AI ---
                case 'AI Info': await checkSdCard(device); break;

                // --- Debug ---
                case 'Self Test': await runSelfTest(device); break;
                case 'Flash Red': await flashLed(device, 'red', 1000, 3); break;
                case 'Flash Green': await flashLed(device, 'green', 1000, 3); break;
                case 'Flash Blue': await flashLed(device, 'blue', 1000, 3); break;

                default:
                    return
            }

            const newEntry: ConsoleEntry = {
                id: Date.now().toString(),
                timestamp: new Date(),
                type: 'command',
                content: `[Action] ${commandDisplay}`
            }
            dispatch({ type: 'APPEND_HISTORY', payload: newEntry })

        } catch (error) {
            const errorEntry: ConsoleEntry = {
                id: Date.now().toString(),
                timestamp: new Date(),
                type: 'error',
                content: `Error executing ${action}: ${error}`
            }
            dispatch({ type: 'APPEND_HISTORY', payload: errorEntry })
        }
    }

    const handleConnect = async () => {
        if (!device) return
        dispatch({ type: 'SET_IS_CONNECTING', payload: true })
        try {
            await connectDevice(device)
            const entry: ConsoleEntry = {
                id: Date.now().toString(),
                timestamp: new Date(),
                type: 'info',
                content: 'Connected to device'
            }
            dispatch({ type: 'APPEND_HISTORY', payload: entry })
        } catch (error) {
            const entry: ConsoleEntry = {
                id: Date.now().toString(),
                timestamp: new Date(),
                type: 'error',
                content: `Connection failed: ${error}`
            }
            dispatch({ type: 'APPEND_HISTORY', payload: entry })
        } finally {
            dispatch({ type: 'SET_IS_CONNECTING', payload: false })
        }
    }

    const onRunHelpCommand = async (cmdName: CommandNames) => { // Added async here
        dispatch({ type: 'SET_IS_HELP_VISIBLE', payload: false })

        // Handle special command types
        if (cmdName === CommandNames.CAPTURE_PREVIEW) {
            log('[EngineerConsole] CAPTURE_PREVIEW clicked, calling startCapture via hook')
            startCapture()
            return
        }

        if (cmdName === CommandNames.MOTION_DETECTION_PREVIEW) {
            log('[EngineerConsole] MOTION_DETECTION_PREVIEW clicked, navigating to standalone screen')
            navigation.navigate('StandaloneMotionDetectionScreen', { deviceId: device.id })
            return
        }

        if (cmdName === CommandNames.SET_GPS) {
            log('[EngineerConsole] SET_GPS clicked, getting phone location')
            try {
                // Add timeout to prevent hanging
                const locationPromise = getLocation()
                const timeoutPromise = new Promise<null>((_, reject) =>
                    setTimeout(() => reject(new Error('Location request timed out after 30 seconds')), 30000)
                )

                const loc = await Promise.race([locationPromise, timeoutPromise])

                if (!loc) {
                    logError('[EngineerConsole] Failed to get GPS location (returned null)')
                    return
                }

                log('[EngineerConsole] Location received, formatting GPS string...')
                const gpsString = formatGPSString(loc.latitude, loc.longitude, loc.altitude)
                log('[EngineerConsole] GPS string formatted:', gpsString)

                await write(device, [[CommandNames.setgps, { control: CommandControlTypes.WRITE, value: gpsString }]])
                log('[EngineerConsole] GPS command sent successfully:', { lat: loc.latitude, lon: loc.longitude, alt: loc.altitude })
            } catch (error) {
                logError('[EngineerConsole] GPS error:', error)
                Alert.alert('GPS Error', error instanceof Error ? error.message : 'Failed to set GPS location')
            }
            return
        }

        if (cmdName === CommandNames.UPDATE_BLE_FIRMWARE) {
            Alert.alert(
                'Update BLE Firmware',
                'This will download the latest firmware and flash it to the device. Ensure battery > 30%. Continue?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Update',
                        onPress: () => handleFirmwareUpdate(device, dispatch, write, disconnectDevice)
                    }
                ]
            )
            return
        }

        if (cmdName === CommandNames.CLEAR_CONSOLE) {
            handleQuickAction('Clear')
            return
        }

        // Default: execute the command normally
        const cmd = COMMANDS[cmdName]
        if (!cmd) return

        if (cmd.writeCommand) {
            handleSend(cmd.writeCommand())
        } else if (cmd.readCommand) {
            handleSend(cmd.readCommand)
        }
    }

    return {
        handleSend,
        handleQuickAction,
        handleConnect,
        onRunHelpCommand,
        handleBack
    }
}
