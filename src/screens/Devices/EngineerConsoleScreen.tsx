import { useEffect, useRef, useLayoutEffect, useCallback, useReducer } from 'react'
import { View, Text } from 'react-native'
import { useRoute, useNavigation } from '@react-navigation/native'

import { Portal, Appbar } from 'react-native-paper'
import { useAppSelector } from '../../redux'
import { useExtendedTheme } from '../../theme'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useBle } from '../../hooks/useBle'
import { useCapturePreview } from '../../hooks/useCapturePreview'
import { BleConsoleOutput, ConsoleEntry } from '../../components/BleConsoleOutput'
import { CommandReferenceModal } from '../../components/CommandReferenceModal'
import { ImagePreviewModal } from '../../components/ImagePreviewModal'
import { log } from '../../utils/logger'

import { styles } from './components/EngineerConsoleScreen.styles'
import { consoleReducer, initialConsoleState } from './hooks/useConsoleReducer'
import { ConsoleHeader } from './components/ConsoleHeader'
import { ConsoleInput } from './components/ConsoleInput'
import { useEngineerConsoleActions } from './hooks/useEngineerConsoleActions'

export const EngineerConsoleScreen = () => {
    const route = useRoute<any>()
    const navigation = useNavigation<any>()

    const { colors } = useExtendedTheme()
    const deviceId = route.params?.deviceId

    const device = useAppSelector(state => state.devices[deviceId || ''])
    const logs = useAppSelector(state => state.logs[deviceId || ''] || [])

    const { write, disconnectDevice } = useBle()
    const [consoleState, dispatch] = useReducer(consoleReducer, initialConsoleState)
    const isNavigatingAway = useRef(false)

    // Use capture preview hook
    const { capturedImageUri: previewImageUri, isCapturing: isWaitingForCapture, startCapture } = useCapturePreview({
        device: device,
        write: write,
        onImageReceived: (imageUri) => {
            log('[EngineerConsole] Image received:', imageUri)
            dispatch({ type: 'SET_SHOW_PREVIEW_MODAL', payload: true })
        }
    })

    const {
        handleSend,
        handleConnect,
        onRunHelpCommand,
        handleBack
    } = useEngineerConsoleActions({
        device,
        consoleState,
        dispatch,
        startCapture,
        navigation
    })

    const headerLeft = useCallback(() => (
        <Appbar.BackAction
            iconColor={colors.onBackground}
            onPress={handleBack}
        />
    ), [colors.onBackground, handleBack])

    // Handle Header Back Button
    useLayoutEffect(() => {
        navigation.setOptions({
            headerLeft: headerLeft,
        })
    }, [navigation, headerLeft])

    // Intercept Back Navigation (swipe/pop) to ensure device disconnection
    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', async (e: any) => {
            if (isNavigatingAway.current) return

            e.preventDefault()

            if (device?.connected) {
                log('[EngineerConsole] Back navigated - disconnecting device...')
                isNavigatingAway.current = true
                await disconnectDevice(device)
            }

            navigation.dispatch(e.data.action)
        })

        return unsubscribe
    }, [navigation, device, disconnectDevice])

    const lastProcessedLogLength = useRef<number>(0)

    // Monitor logs and update console history
    useEffect(() => {
        if (!logs || logs.length === lastProcessedLogLength.current) return

        // Find only the new entries
        const newEntries = logs.slice(lastProcessedLogLength.current)

        // Update the last processed log reference
        lastProcessedLogLength.current = logs.length

        // Only process if there are actually new lines
        if (newEntries.length === 0) return

        // Add new lines to console history
        const historyEntries: ConsoleEntry[] = newEntries.map(entry => {
            let type: 'command' | 'response' | 'error' | 'info' = 'response'
            
            // Map redux log types to console types
            if (entry.type === 'tx') type = 'command'
            else if (entry.type === 'rx') type = 'response'
            else if (entry.type === 'error') type = 'error'
            else if (entry.type === 'info') type = 'info'
            
            return {
                id: Date.now().toString() + Math.random(),
                timestamp: new Date(entry.timestamp),
                type,
                content: entry.content
            }
        })

        dispatch({
            type: 'APPEND_LOGS_AND_AUTOMATION',
            payload: { newEntries: historyEntries, isWaitingForCapture }
        })

    }, [logs, isWaitingForCapture, device, write])


    if (!device) {
        return (
            <SafeAreaView style={styles.centerContainer} edges={['top', 'bottom']}>
                <Text style={styles.errorText}>Device not found</Text>
            </SafeAreaView>
        )
    }

    return (
        <SafeAreaView style={styles.container} edges={['left', 'right']}>
            <ConsoleHeader
                deviceName={device?.name || null}
                deviceId={device.id}
                isConnected={device.connected}
                isConnecting={consoleState.isConnecting}
                onConnect={handleConnect}
                onShowHelp={() => dispatch({ type: 'SET_IS_HELP_VISIBLE', payload: true })}
            />

            <View style={styles.consoleContainer}>
                <BleConsoleOutput entries={consoleState.consoleHistory} />
            </View>

            <ConsoleInput
                inputText={consoleState.inputText}
                isConnected={device.connected && !consoleState.isConnecting}
                onInputChange={(text) => dispatch({ type: 'SET_INPUT_TEXT', payload: text })}
                onSend={() => handleSend()}
            />

            <Portal>
                <CommandReferenceModal
                    visible={consoleState.isHelpVisible}
                    onDismiss={() => dispatch({ type: 'SET_IS_HELP_VISIBLE', payload: false })}
                    onRunCommand={onRunHelpCommand}
                />

            </Portal>

            <ImagePreviewModal
                visible={consoleState.showPreviewModal}
                imageUri={previewImageUri}
                onDismiss={() => dispatch({ type: 'SET_SHOW_PREVIEW_MODAL', payload: false })}
            />
        </SafeAreaView>
    )
}
