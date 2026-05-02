import { useEffect, useRef, useLayoutEffect, useCallback, useReducer, useState } from 'react'
import { View, Text } from 'react-native'
import { useRoute, useNavigation } from '@react-navigation/native'

import { Portal, Appbar } from 'react-native-paper'
import { useAppSelector } from '../../redux'
import { useExtendedTheme } from '../../theme'
import { SafeAreaView } from 'react-native-safe-area-context'

import { BleConsoleOutput, ConsoleEntry } from '../../components/BleConsoleOutput'
import { CommandReferenceModal } from '../../components/CommandReferenceModal'
import { FlowsReferenceModal } from '../../components/FlowsReferenceModal'
import { bleEventBus, BleEvent } from '../../ble/protocol/eventBus'

import { styles } from './components/EngineerConsoleScreen.styles'
import { consoleReducer, initialConsoleState } from './hooks/useConsoleReducer'
import { ConsoleHeader } from './components/ConsoleHeader'
import { ConsoleInput } from './components/ConsoleInput'
import { useEngineerConsoleActions } from './hooks/useEngineerConsoleActions'

export const EngineerConsoleScreen = () => {
    const route = useRoute<any>()
    const navigation = useNavigation<any>()
    const [isQueueBusy, setIsQueueBusy] = useState(false)

    useEffect(() => {
        const handler = (event: BleEvent & { type: 'QUEUE_STATE_CHANGED' }) => {
            setIsQueueBusy(event.isBusy)
        }
        bleEventBus.on('queueStateChanged', handler)
        return () => { bleEventBus.removeListener('queueStateChanged', handler); }
    }, [])

    const { colors } = useExtendedTheme()
    const deviceId = route.params?.deviceId

    const device = useAppSelector(state => state.devices[deviceId || ''])
    const logs = useAppSelector(state => state.logs[deviceId || ''] || [])

    const [consoleState, dispatch] = useReducer(consoleReducer, initialConsoleState)

    const {
        handleSend,
        handleConnect,
        onRunHelpCommand,
        handleBack
    } = useEngineerConsoleActions({
        device,
        consoleState,
        dispatch,
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

    // Connection Ownership: Engineer Console is a CHILD screen.
    // It must NOT disconnect on back-navigation.
    // The parent screen (StartMonitoring / StopMonitoring) owns the BLE lifecycle.
    // See: src/ble/CONNECTION_OWNERSHIP.md

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
            payload: { newEntries: historyEntries, isWaitingForCapture: false }
        })

    }, [logs, device])  


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
                onShowFlows={() => dispatch({ type: 'SET_IS_FLOWS_VISIBLE', payload: true })}
            />

            <View style={styles.consoleContainer}>
                <BleConsoleOutput entries={consoleState.consoleHistory} />
            </View>

            <ConsoleInput
                inputText={consoleState.inputText}
                isConnected={device.connected && !consoleState.isConnecting && !isQueueBusy}
                onInputChange={(text) => dispatch({ type: 'SET_INPUT_TEXT', payload: text })}
                onSend={() => handleSend()}
            />

            <Portal>
                <CommandReferenceModal
                    visible={consoleState.isHelpVisible}
                    onDismiss={() => dispatch({ type: 'SET_IS_HELP_VISIBLE', payload: false })}
                    onRunCommand={onRunHelpCommand}
                />
                <FlowsReferenceModal
                    visible={consoleState.isFlowsVisible}
                    onDismiss={() => dispatch({ type: 'SET_IS_FLOWS_VISIBLE', payload: false })}
                    onRunFlow={onRunHelpCommand}
                />
            </Portal>
        </SafeAreaView>
    )
}
