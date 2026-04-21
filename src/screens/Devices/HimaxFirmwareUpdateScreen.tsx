import { useState, useCallback, useEffect, useRef } from 'react'
import { View, StyleSheet, ScrollView } from 'react-native'
import { Button, Appbar, ActivityIndicator } from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRoute, useNavigation } from '@react-navigation/native'

import { useExtendedTheme } from '../../theme'
import { useAppSelector } from '../../redux'
import { WWText } from '../../components/ui/WWText'
import { logError } from '../../utils/logger'
import { createBleSession } from '../../ble/session/createBleSession'
import { commandRegistry } from '../../ble/protocol/commandRegistry'
import { bleEventBus } from '../../ble/protocol/eventBus'

export const HimaxFirmwareUpdateScreen = () => {
    const route = useRoute<any>()
    const navigation = useNavigation<any>()
    const { colors, spacing } = useExtendedTheme()
    
    const deviceId = route.params?.deviceId
    const device = useAppSelector(state => state.devices[deviceId || ''])

    const [isUpdating, setIsUpdating] = useState(false)
    const [status, setStatus] = useState<string>('Ready to update.')
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [updateComplete, setUpdateComplete] = useState(false)
    const [progressLogs, setProgressLogs] = useState<string[]>([])

    const unmountedRef = useRef(false)

    useEffect(() => {
        return () => {
            unmountedRef.current = true
        }
    }, [])

    // Listen selectively for Himax update logs (e.g. from UART) to give user context
    useEffect(() => {
        if (!isUpdating) return
        
        const onRx = (event: any) => {
            if (event.type === 'RAW_RX' && event.deviceId === device?.id) {
                const line = event.line
                if (
                    line.includes('Erasing') || 
                    line.toLowerCase().includes('writing') || 
                    line.toLowerCase().includes('error') ||
                    line.toLowerCase().includes('firmware update') ||
                    line.toLowerCase().includes('verified') ||
                    line.includes('bytes written')
                ) {
                    setProgressLogs(prev => {
                        const newLogs = [...prev, line]
                        return newLogs.slice(-5) // keep last 5
                    })
                }
            }
        }
        bleEventBus.on('rawRx', onRx)
        return () => { bleEventBus.removeListener('rawRx', onRx) }
    }, [isUpdating, device?.id])

    const startUpdate = useCallback(async () => {
        if (!device?.connected) {
            setErrorMsg('Device disconnected.')
            return
        }

        setIsUpdating(true)
        setErrorMsg(null)
        setUpdateComplete(false)
        setStatus('Preparing to update from SD card (output.img)...')
        setProgressLogs([])

        // Heartbeat pause and transport lock are handled automatically
        // by the protocol layer (aifirmware has isLongRunning + requiresExclusiveLock)

        try {
            const session = createBleSession(device)
            setStatus('Sending AI firmware update command...\nThis usually takes a few minutes.')
            
            // 2. Invoke the aifirmware command which performs the ERASE and FLASH
            await session.execute(() => commandRegistry.aifirmware('output.img'))
            
            if (unmountedRef.current) return

            setStatus('Update successful! Rebooting device...')
            setUpdateComplete(true)

            // 3. Reboot the device to boot into the new slot
            setTimeout(async () => {
                if (unmountedRef.current) return
                try {
                    const postSession = createBleSession(device)
                    await postSession.execute(() => commandRegistry.reset())
                } catch (e) {
                    // Usually throws because BLE drops exactly when reset happens. This is OK.
                }
                if (!unmountedRef.current) {
                    navigation.navigate('Home', { initialTab: 'devices' })
                }
            }, 2000)

        } catch (err: any) {
            if (!unmountedRef.current) {
                logError('[HimaxFirmwareUpdate] Update failed:', err)
                setErrorMsg(err.message || String(err))
                setStatus('Update failed.')
            }
        } finally {
            if (!unmountedRef.current) {
                setIsUpdating(false)
            }
        }
    }, [device, navigation])

    return (
        <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
            <Appbar.Header style={{ backgroundColor: colors.surface }}>
                <Appbar.BackAction onPress={() => navigation.goBack()} disabled={isUpdating} />
                <Appbar.Content title="AI Firmware Update" />
            </Appbar.Header>

            <ScrollView contentContainerStyle={[styles.content, { padding: spacing }]}>
                
                <WWText variant="titleLarge" style={{ marginBottom: spacing }}>
                    SD Card Update
                </WWText>
                
                <WWText style={{ marginBottom: spacing }}>
                    This flow updates the Himax AI processor using an `output.img` file stored in the `/MANIFEST/` directory of the device's SD Card.
                </WWText>
                <WWText style={{ marginBottom: spacing * 2, color: colors.error }}>
                    Do not close the app or disconnect the device during this process. It takes approximately 1-2 minutes.
                </WWText>

                <View style={[styles.statusBox, { backgroundColor: colors.surfaceVariant, marginBottom: spacing * 2 }]}>
                    <WWText variant="titleMedium" style={[styles.statusTitle, { color: colors.onSurfaceVariant }]}>Status</WWText>
                    <WWText style={{ color: colors.onSurfaceVariant }}>{status}</WWText>
                    
                    {isUpdating && (
                        <View style={styles.marginTop16}>
                            <ActivityIndicator animating={true} color={colors.primary} size="large" />
                        </View>
                    )}

                    {progressLogs.length > 0 && (
                        <View style={styles.marginTop16}>
                            {progressLogs.map((logLine) => (
                                <WWText key={`${logLine}-${Math.random().toString()}`} variant="bodySmall" style={[styles.logText, { color: colors.onSurfaceVariant }]}>
                                    → {logLine}
                                </WWText>
                            ))}
                        </View>
                    )}

                    {errorMsg && (
                        <WWText style={[styles.marginTop16, { color: colors.error }]}>Error: {errorMsg}</WWText>
                    )}
                </View>

                {!updateComplete && (
                    <Button 
                        mode="contained" 
                        onPress={startUpdate} 
                        disabled={isUpdating || !device?.connected}
                        loading={isUpdating}
                    >
                        <WWText>Start Update</WWText>
                    </Button>
                )}

            </ScrollView>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flexGrow: 1,
    },
    statusBox: {
        padding: 16,
        borderRadius: 8,
    },
    statusTitle: {
        marginBottom: 8,
    },
    marginTop16: {
        marginTop: 16,
    },
    logText: {
        opacity: 0.7,
    }
})
