import { useEffect, useRef, useLayoutEffect, useCallback, useReducer, useState } from 'react'
import { View, Text } from 'react-native'
import { useRoute, useNavigation } from '@react-navigation/native'

import { Portal, Appbar, Button } from 'react-native-paper'
import { useAppSelector, useAppDispatch } from '../../redux'
import { clearLogs, LogEntry } from '../../redux/slices/logsSlice'
import { useExtendedTheme } from '../../theme'
import { SafeAreaView } from 'react-native-safe-area-context'

import { BleConsoleOutput, ConsoleEntry } from '../../components/BleConsoleOutput'
import { CommandReferenceModal } from '../../components/CommandReferenceModal'
import { FlowsReferenceModal } from '../../components/FlowsReferenceModal'
import { bleEventBus, BleEvent } from '../../ble/protocol/eventBus'
import { WWBleDisconnectedBanner } from '../../components/ui/WWBleDisconnectedBanner'

import { styles } from './components/EngineerConsoleScreen.styles'
import { consoleReducer, initialConsoleState } from './hooks/useConsoleReducer'
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
    const reduxDispatch = useAppDispatch()

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

    // The three console actions, icon only (#302): Commands, Flows and Clear.
    // The header title is the device's name, so the width goes to the name,
    // and the labels the buttons used to carry said nothing the icons do not.
    // A row under a fixed "Engineer Console" title held all of this before,
    // with the name a second time and a status dot the banner below already
    // covers. Clear empties both the console view and the device's log in
    // Redux, which nothing else reads: the view is rebuilt from that log on
    // every open, so clearing the view alone would come undone on the next
    // visit.
    const headerRight = useCallback(() => (
        <View style={styles.headerActions}>
            <Appbar.Action
                icon="console-line"
                accessibilityLabel="Commands"
                iconColor={colors.onBackground}
                onPress={() => dispatch({ type: 'SET_IS_HELP_VISIBLE', payload: true })}
            />
            <Appbar.Action
                icon="chart-timeline-variant"
                accessibilityLabel="Flows"
                iconColor={colors.onBackground}
                onPress={() => dispatch({ type: 'SET_IS_FLOWS_VISIBLE', payload: true })}
            />
            <Appbar.Action
                icon="trash-can-outline"
                accessibilityLabel="Clear console"
                iconColor={colors.onBackground}
                onPress={() => {
                    dispatch({ type: 'CLEAR_HISTORY' })
                    if (deviceId) reduxDispatch(clearLogs({ id: deviceId }))
                }}
            />
        </View>
    ), [colors.onBackground, deviceId, reduxDispatch])

    useLayoutEffect(() => {
        navigation.setOptions({
            title: device?.name || 'Unknown Device',
            headerLeft,
            headerRight,
        })
    }, [navigation, headerLeft, headerRight, device?.name])

    // Connection ownership: this screen OWNS the link and drops it on the way out.
    //
    // `handleBack` in useEngineerConsoleActions disconnects the device and then
    // navigates to the Devices tab, and the hardware back button is bound to the
    // same handler. Both back affordances therefore end the BLE session, and the
    // device needs its button pressed again to advertise before anything can
    // reconnect.
    //
    // This comment used to say the opposite - that the console is a child screen
    // which must not disconnect, with a pointer to a src/ble/CONNECTION_OWNERSHIP.md
    // that does not exist - and it cost a bench session a dropped link on
    // 5 September 2026. The flows reached from here (Capture Picture, Motion
    // Detection, Light Sensor) ARE children and come back to this screen with the
    // link intact; it is leaving the console itself that disconnects.

    // The last Redux entry already shown, by identity rather than by count:
    // the slice keeps the last 1000 entries and trims from the front, so once
    // it was full the count never changed and the console went silent after
    // its thousandth line (found 22 September 2026). Entries the reducer did
    // not touch keep their identity across a trim; a fresh mount starts empty.
    const lastProcessedRef = useRef<LogEntry | null>(null)

    // Monitor logs and update console history
    useEffect(() => {
        if (!logs || logs.length === 0) return
        const last = lastProcessedRef.current
        const idx = last ? logs.indexOf(last) : -1
        // Not found means more than a slice's worth arrived since the last
        // look, or the log was cleared and refilled; timestamps are the tie.
        const newEntries = idx !== -1
            ? logs.slice(idx + 1)
            : last ? logs.filter(e => e.timestamp > last.timestamp) : logs
        lastProcessedRef.current = logs[logs.length - 1]

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
            <WWBleDisconnectedBanner connected={!!device?.connected} dfuInProgress={!!device?.dfuInProgress} />

            {/* The one thing the old header row did that the nav header
                cannot: offer a connect while the link is down. */}
            {!device.connected && (
                <Button
                    mode="contained"
                    onPress={handleConnect}
                    disabled={consoleState.isConnecting}
                    loading={consoleState.isConnecting}
                    style={styles.connectButton}
                    buttonColor={colors.primary}
                    textColor="#FFFFFF"
                >
                    <Text>Connect to Console</Text>
                </Button>
            )}

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
