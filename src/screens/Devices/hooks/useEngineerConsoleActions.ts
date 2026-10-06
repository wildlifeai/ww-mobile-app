import { useCallback, useEffect } from 'react'
import { BackHandler } from 'react-native'
import { useBle } from '../../../hooks/useBle'
import { log, logWarn } from '../../../utils/logger'
import { CommandNames, COMMANDS } from '../../../ble/types'
import { bleEventBus, BleEvent } from '../../../ble/protocol/eventBus'
import { ConsoleEntry } from '../../../components/BleConsoleOutput'

/** How long the console waits for the camera to ask for the second `format`. */
export const FORMAT_CONFIRM_TIMEOUT_MS = 10000

/** Resolves true when the device sends a line matching `pattern`, false after `timeoutMs`. */
const waitForLine = (deviceId: string, pattern: RegExp, timeoutMs: number): Promise<boolean> =>
    new Promise(resolve => {
        const listener = (event: BleEvent & { type: 'TEXT_LINE' }) => {
            if (event.deviceId !== deviceId || !pattern.test(event.line)) return
            clearTimeout(timer)
            bleEventBus.removeListener('textLine', listener)
            resolve(true)
        }
        const timer = setTimeout(() => {
            bleEventBus.removeListener('textLine', listener)
            resolve(false)
        }, timeoutMs)
        bleEventBus.on('textLine', listener)
    })

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

    const onRunHelpCommand = async (cmdName: CommandNames, args: string[] = []) => {
        // Dismiss both modals (command could come from either)
        dispatch({ type: 'SET_IS_HELP_VISIBLE', payload: false })
        dispatch({ type: 'SET_IS_FLOWS_VISIBLE', payload: false })

        const cmd = COMMANDS[cmdName]
        if (!cmd) return

        // Handle navigation-based flows
        if (cmdName === CommandNames.CAPTURE_PICTURE) {
            navigation.navigate('CapturePictureScreen', { deviceId: device?.id })
            return
        }
        if (cmdName === CommandNames.MOTION_DETECTION_PREVIEW) {
            navigation.navigate('StandaloneMotionDetectionScreen', { deviceId: device?.id })
            return
        }
        if (cmdName === CommandNames.LIGHT_SENSOR) {
            navigation.navigate('LightSensorScreen', { deviceId: device?.id })
            return
        }
        if (cmdName === CommandNames.FLASH_SETTINGS) {
            navigation.navigate('FlashSettingsScreen', { deviceId: device?.id })
            return
        }
        if (cmdName === CommandNames.UPDATE_HIMAX_FIRMWARE) {
            navigation.navigate('FirmwareUpdateScreen', { deviceId: device?.id, target: 'himax', engineer: true })
            return
        }
        if (cmdName === CommandNames.UPDATE_BLE_FIRMWARE) {
            navigation.navigate('FirmwareUpdateScreen', { deviceId: device?.id, target: 'ble', engineer: true })
            return
        }
        if (cmdName === CommandNames.FILE_TRANSFER_TEST) {
            navigation.navigate('FileTransferTestScreen', { deviceId: device?.id })
            return
        }
        if (cmdName === CommandNames.MODEL_VALIDATION) {
            navigation.navigate('ModelValidationTestScreen', { deviceId: device?.id })
            return
        }
        if (cmdName === CommandNames.FIRMWARE_STATUS) {
            navigation.navigate('FirmwareStatusScreen', { deviceId: device?.id, engineer: true })
            return
        }
        if (cmdName === CommandNames.RESET_TO_DEFAULTS) {
            navigation.navigate('DeviceResetScreen', { deviceId: device?.id })
            return
        }
        if (cmdName === CommandNames.DEV_DEPLOYMENT_TEST) {
            navigation.navigate('DevDeploymentTestScreen', { deviceId: device?.id, bleDeviceId: device?.id })
            return
        }


        // A command that takes values is never sent without them. The Commands
        // list asks for them; this is the backstop, because the writers once
        // filled a gap with a default, and `AI md 0` turned motion triggering
        // off on the device (#300).
        if (cmd.params && args.length < cmd.params.length) {
            dispatch({
                type: 'APPEND_HISTORY',
                payload: {
                    id: Date.now().toString(),
                    timestamp: new Date(),
                    type: 'error',
                    content: `${cmd.name} not sent: it needs ${cmd.params.map(p => p.label).join(', ')}`,
                } as ConsoleEntry,
            })
            return
        }

        // The firmware formats only on a second `format` before the Himax
        // sleeps: the first arms it and asks again, and the arm is lost at
        // the next sleep, about a second later. Two taps cannot land in that
        // window, so Run sends the second itself once the camera asks for it.
        // The console is for people who know what a format does.
        if (cmdName === CommandNames.format) {
            if (!device) return
            const asked = waitForLine(device.id, /Run 'format' again/i, FORMAT_CONFIRM_TIMEOUT_MS)
            await handleSend('AI format')
            if (await asked) {
                await handleSend('AI format')
            } else {
                dispatch({
                    type: 'APPEND_HISTORY',
                    payload: {
                        id: Date.now().toString(),
                        timestamp: new Date(),
                        type: 'error',
                        content: 'format not confirmed: the camera did not ask for the second format, so the card was not erased',
                    } as ConsoleEntry,
                })
            }
            return
        }

        // Execute BLE commands normally
        if (cmd.writeCommand) {
            handleSend(cmd.writeCommand(args[0], args[1]))
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
