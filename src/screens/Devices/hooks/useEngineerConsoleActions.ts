import { useCallback, useEffect } from 'react'
import { BackHandler } from 'react-native'
import { useBle } from '../../../hooks/useBle'
import { log, logWarn } from '../../../utils/logger'
import { CommandNames, COMMANDS } from '../../../ble/types'
import { ConsoleEntry } from '../../../components/BleConsoleOutput'

export const useEngineerConsoleActions = ({
    device,
    consoleState,
    dispatch,
    navigation,
}: {
    device: any
    consoleState: any
    dispatch: any
    navigation: any
}) => {
    const { writeRaw, disconnectDevice, connectDevice } = useBle()

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
        try {
            await writeRaw(device, commandToSend)
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

    const onRunHelpCommand = async (cmdName: CommandNames) => {
        // Dismiss both modals (command could come from either)
        dispatch({ type: 'SET_IS_HELP_VISIBLE', payload: false })
        dispatch({ type: 'SET_IS_FLOWS_VISIBLE', payload: false })

        const cmd = COMMANDS[cmdName]
        if (!cmd) return

        // Handle navigation-based flows
        if (cmdName === CommandNames.CAMERA_SETTINGS_TEST) {
            navigation.navigate('CameraSettingsTestScreen', { deviceId: device?.id })
            return
        }
        if (cmdName === CommandNames.MOTION_DETECTION_PREVIEW) {
            navigation.navigate('StandaloneMotionDetectionScreen', { deviceId: device?.id })
            return
        }
        if (cmdName === CommandNames.CAPTURE_PREVIEW) {
            navigation.navigate('StandaloneCapturePreviewScreen', { deviceId: device?.id })
            return
        }
        if (cmdName === CommandNames.UPDATE_HIMAX_FIRMWARE) {
            navigation.navigate('FirmwareUpdateScreen', { deviceId: device?.id, target: 'himax' })
            return
        }
        if (cmdName === CommandNames.UPDATE_BLE_FIRMWARE) {
            navigation.navigate('FirmwareUpdateScreen', { deviceId: device?.id, target: 'ble' })
            return
        }
        if (cmdName === CommandNames.FILE_TRANSFER_TEST) {
            navigation.navigate('FileTransferTestScreen', { deviceId: device?.id })
            return
        }
        if (cmdName === CommandNames.MODEL_VALIDATION_TEST) {
            navigation.navigate('ModelValidationTestScreen', { deviceId: device?.id })
            return
        }
        if (cmdName === CommandNames.TRANSFER_CONFIG) {
            navigation.navigate('ConfigTransferScreen', { deviceId: device?.id })
            return
        }
        if (cmdName === CommandNames.TRANSFER_AI_MODEL) {
            navigation.navigate('AiModelTransferScreen', { deviceId: device?.id })
            return
        }
        if (cmdName === CommandNames.FIRMWARE_STATUS) {
            navigation.navigate('FirmwareStatusScreen', { deviceId: device?.id })
            return
        }

        // Handle local commands
        if (cmdName === CommandNames.CLEAR_CONSOLE) {
            dispatch({ type: 'CLEAR_HISTORY' })
            return
        }

        // Execute BLE commands normally
        if (cmd.writeCommand) {
            handleSend(cmd.writeCommand())
        } else if (cmd.readCommand) {
            handleSend(cmd.readCommand)
        }
    }

    return {
        handleSend,
        handleConnect,
        onRunHelpCommand,
        handleBack
    }
}
