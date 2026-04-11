import React, { useState, useEffect, useRef } from 'react'
import { View, StyleSheet, ScrollView, Alert } from 'react-native'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import { useAppSelector } from '../../redux'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { TextInput, useTheme, Text, Card } from 'react-native-paper'
import { WWScreenView } from '../../components/ui/WWScreenView'
import { WWText } from '../../components/ui/WWText'
import { WWButton } from '../../components/ui/WWButton'
import { RootStackParamList } from '../../navigation/types'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { DeploymentService } from '../../services/DeploymentService'
import { useBleCommands } from '../../hooks/useBleCommands'
import { useDeviceSettings } from '../../hooks/useDeviceSettings'
import { useBleActions } from '../../providers/BleEngineProvider'

import { withObservables } from '@nozbe/watermelondb/react'
import { selectCurrentUser } from '../../redux/slices/authSlice'
import { InitializationHeader } from '../Devices/components/InitializationHeader'
import Device from '../../database/models/Device'
import { DeviceService } from '../../services/DeviceService'
import type Deployment from '../../database/models/Deployment'
import { FinishProgressDialog } from '../Devices/components/FinishProgressDialog'
import { log } from '../../utils/logger'
import { useEndDeployment } from './hooks/useEndDeployment'

import { useDeploymentMonitor, ActivityLogEntry } from './hooks/useDeploymentMonitor'

const formatMonitoringDuration = (startValue: Date | string | number) => {
    const start = startValue instanceof Date ? startValue.getTime() : new Date(startValue).getTime()
    const diffInSeconds = Math.max(0, Math.floor((Date.now() - start) / 1000))
    
    if (diffInSeconds < 60) {
        return `${diffInSeconds} ${diffInSeconds === 1 ? 'second' : 'seconds'}`
    }
    const minutes = Math.floor(diffInSeconds / 60)
    if (minutes < 60) {
        return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`
    }
    const hours = Math.floor(minutes / 60)
    if (hours < 24) {
        const remMin = minutes % 60
        if (remMin === 0) return `${hours} ${hours === 1 ? 'hour' : 'hours'}`
        return `${hours} ${hours === 1 ? 'hour' : 'hours'} and ${remMin} ${remMin === 1 ? 'minute' : 'minutes'}`
    }
    const days = Math.floor(hours / 24)
    if (days < 30) {
        const remHours = hours % 24
        if (remHours === 0) return `${days} ${days === 1 ? 'day' : 'days'}`
        return `${days} ${days === 1 ? 'day' : 'days'} and ${remHours} ${remHours === 1 ? 'hour' : 'hours'}`
    }
    const months = Math.floor(days / 30)
    const remDays = days % 30
    if (remDays === 0) return `${months} ${months === 1 ? 'month' : 'months'}`
    return `${months} ${months === 1 ? 'month' : 'months'} and ${remDays} ${remDays === 1 ? 'day' : 'days'}`
}

type EndDeploymentDetailsStepRouteProp = RouteProp<RootStackParamList, 'EndDeploymentDetailsStep'>

interface InnerProps {
    deployment: Deployment
    deviceId: string
    bleDeviceId: string
}


const EndDeploymentDetailsStepComponent: React.FC<InnerProps> = ({ deployment }) => {
    const theme = useTheme()
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
    const route = useRoute<EndDeploymentDetailsStepRouteProp>()
    const { deviceId = '', bleDeviceId = '', initPayload } = route.params || {}
    useBleActions()
    const { runDisconnect, setDeploymentIdAsOps, clearGpsLocation, getAllOperationalParams } = useBleCommands()

    // Get full device object for BLE commands
    const devices = useAppSelector(state => state.devices)
    const storeDevice = devices[bleDeviceId]
    const { quiesceDevice } = useDeviceSettings({ device: storeDevice })

    // Get current user
    const user = useAppSelector(selectCurrentUser)

    // Live activity log (same feed as monitor screen)
    const { activityLog } = useDeploymentMonitor(storeDevice)

    // Track device in ref for use in intervals/callbacks to avoid stale closures
    const bleDeviceRef = useRef(storeDevice)
    useEffect(() => {
        bleDeviceRef.current = storeDevice
    }, [storeDevice])

    // Local state
    const [retrievalNotes, setRetrievalNotes] = useState('')

    // Connection Guard Refs
    const isNavigatingAway = useRef(false)

    // End Deployment Logic Hook
    const {
        isEnding,
        finishProgress,
        finishStep,
        finishLogs,
        isFinishing,
        isEndDeploymentSuccess,
        handleEndDeployment,
        handleFinishDismiss
    } = useEndDeployment({
        deployment,
        user,
        storeDevice,
        retrievalNotes,
        navigation,
        quiesceDevice,
        setDeploymentIdAsOps,
        clearGpsLocation,
        runDisconnect,
        getAllOperationalParams,
        isNavigatingAway
    })
    
    // Initialization State (from payload)
    const [deviceDb, setDeviceDb] = useState<Device | undefined>()
    
    // We already initialized in the Scanner routing step
    const isInitializing = false
    const initProgress = 1
    const initStep = 'Complete'
    const initErrors = initPayload?.initErrors || {}

    useEffect(() => {
        DeviceService.getDeviceById(deviceId).then(setDeviceDb)
    }, [deviceId])

    useEffect(() => {
        const title = deviceDb?.name || storeDevice?.name || 'End Deployment'
        navigation.setOptions({ title })
    }, [deviceDb?.name, storeDevice?.name, navigation])


    // Back button handler: Disconnect BLE before navigating away
    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', async (e) => {
            if (isNavigatingAway.current || isEnding || isEndDeploymentSuccess) return // Already handled

            // Prevent immediate navigation
            e.preventDefault()
            Alert.alert(
                "Wildlife Watcher Monitoring",
                "The wildlife watcher will keep monitoring for animals in the background.",
                [
                    {
                        text: "Cancel",
                        style: "cancel"
                    },
                    {
                        text: "Understood",
                        style: "default",
                        onPress: async () => {
                            // Disconnect device
                            const currentDevice = bleDeviceRef.current
                            if (currentDevice?.connected) {
                                log('[EndDeployment] Back button pressed - disconnecting device...')
                                isNavigatingAway.current = true
                                await runDisconnect(currentDevice)
                            }
                            
                            // Now allow navigation
                            navigation.dispatch(e.data.action)
                        }
                    }
                ]
            )
        })

        return unsubscribe
    }, [navigation, isEnding, isEndDeploymentSuccess, runDisconnect])



    // Info left render removed

    if (!deployment) {
        return (
            <WWScreenView>
                <WWText><Text>Loading monitoring session details...</Text></WWText>
            </WWScreenView>
        )
    }

    return (
        <WWScreenView scrollable style={styles.screenView}>
            <View style={styles.container}>
                {/* Initialization Header (Set UTC, Hardware Check) */}
                 {(deviceDb || storeDevice) && (
                    <InitializationHeader
                        device={deviceDb || { name: storeDevice?.name || 'Device', bluetoothId: bleDeviceId } as any}
                        isInitializing={isInitializing}
                        initProgress={initProgress}
                        initStep={initStep}
                        initErrors={initErrors}
                        theme={theme}
                        hideDeviceDetails={true}
                    />
                )}

                {/* Deployment Info Section */}
                <Card style={styles.section}>
                    <Card.Content>

                        <View style={styles.infoRow}>
                            <WWText variant="bodyLarge"><Text>
                                Monitoring for {formatMonitoringDuration(deployment.deploymentStart)}
                            </Text></WWText>
                        </View>
                    </Card.Content>
                </Card>

                {/* Live Activity Log */}
                <Card style={styles.section}>
                    <Card.Title title="Monitoring Activity" />
                    <Card.Content>
                        <View style={[styles.activityLogBox, { backgroundColor: theme.colors.surface }]}>
                            {activityLog.length === 0 ? (
                                <View style={styles.emptyLogContainer}>
                                    <MaterialCommunityIcons name="radar" size={32} color={theme.colors.onSurfaceVariant} style={styles.radarIcon} />
                                    <Text style={[styles.emptyLogText, { color: theme.colors.onSurfaceVariant }]}>Waiting for device activity...</Text>
                                </View>
                            ) : (
                                <ScrollView nestedScrollEnabled>
                                    {activityLog.slice(0, 50).map((item: ActivityLogEntry) => (
                                        <View key={item.id} style={styles.logEntry}>
                                            <MaterialCommunityIcons name={item.icon} size={16} color={theme.colors.primary} style={styles.logEntryIcon} />
                                            <Text style={[styles.logEntryLabel, { color: theme.colors.onSurface }]} numberOfLines={1}>{item.label}</Text>
                                            <Text style={[styles.logEntryTime, { color: theme.colors.onSurfaceVariant }]}>
                                                {new Date(item.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                            </Text>
                                        </View>
                                    ))}
                                </ScrollView>
                            )}
                        </View>
                    </Card.Content>
                </Card>

                {/* Retrieval Notes Input */}
                <Card style={styles.section}>
                    <Card.Title title="Notes" />
                    <Card.Content>
                        <TextInput
                            mode="outlined"
                            placeholder="e.g. SD card full, Battery low, Device damaged..."
                            multiline
                            numberOfLines={11}
                            value={retrievalNotes}
                            onChangeText={setRetrievalNotes}
                            style={styles.input}
                            textColor="#000"
                        />
                    </Card.Content>
                </Card>

                {/* Action Buttons */}
                <View style={styles.footer}>
                    <WWButton
                        mode="contained"
                        style={styles.deployButton}
                        onPress={handleEndDeployment}
                        loading={isEnding}
                        disabled={isEnding}
                    >
                        <Text>{isEnding ? "Stopping..." : "Stop Monitoring"}</Text>
                    </WWButton>
                </View>

                <FinishProgressDialog
                    visible={isFinishing}
                    progress={finishProgress}
                    step={finishStep}
                    logs={finishLogs}
                    isComplete={isEndDeploymentSuccess}
                    onDismiss={handleFinishDismiss}
                    loadingTitle="Stopping"
                    successTitle="Stopped"
                />
            </View>
        </WWScreenView>
    )
}

const styles = StyleSheet.create({
    screenView: {
        paddingTop: 0
    },
    container: {
        flex: 1,
        gap: 16,
        // padding: 16 // Removed to avoid double padding with WWScreenView
    },
    section: { marginBottom: 16 },
    infoRow: { marginBottom: 8 },
    footer: {
        marginTop: 24,
        marginBottom: 32
    },
    deployButton: {
        paddingVertical: 8
    },
    input: {
        backgroundColor: '#fff',
        minHeight: 165,
    },
    notesTitle: {
        marginBottom: 8
    },
    activityLogBox: {
        borderRadius: 12,
        padding: 8,
        maxHeight: 220,
        minHeight: 100,
    },
    emptyLogContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 24,
    },
    emptyLogText: {
        marginTop: 8,
        fontSize: 13,
    },
    radarIcon: {
        opacity: 0.5
    },
    logEntry: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 4,
    },
    logEntryIcon: {
        marginRight: 8,
    },
    logEntryLabel: {
        flex: 1,
        fontSize: 13,
        fontWeight: '500',
    },
    logEntryTime: {
        fontSize: 11,
        marginLeft: 8,
    }
})

// Wrapper to fetch deployment
const enhance = withObservables(['route'], ({ route }: { route: EndDeploymentDetailsStepRouteProp }) => ({
    deployment: DeploymentService.observeDeploymentById(route.params?.deploymentId || '')
}))

export const EndDeploymentDetailsStep = enhance(EndDeploymentDetailsStepComponent)
