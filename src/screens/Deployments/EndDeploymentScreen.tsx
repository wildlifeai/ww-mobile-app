import React, { useState, useEffect, useRef } from 'react'
import { View, StyleSheet, FlatList } from 'react-native'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import { useAppSelector } from '../../redux'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { TextInput, Card, useTheme, Text } from 'react-native-paper'
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


    // Back button handler: Disconnect BLE before navigating away
    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', async (e) => {
            if (isNavigatingAway.current || isEnding) return // Already handled

            // Prevent immediate navigation
            e.preventDefault()
            
            // Disconnect device
            const currentDevice = bleDeviceRef.current
            if (currentDevice?.connected) {
                log('[EndDeployment] Back button pressed - disconnecting device...')
                isNavigatingAway.current = true
                await runDisconnect(currentDevice)
            }
            
            // Now allow navigation
            navigation.dispatch(e.data.action)
        })

        return unsubscribe
    }, [navigation, isEnding, runDisconnect])



    // Info left render removed

    if (!deployment) {
        return (
            <WWScreenView>
                <WWText><Text>Loading deployment details...</Text></WWText>
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

                {/* Deployment Info Card */}
                <Card style={styles.card}>
                    <Card.Content style={styles.deploymentCardContent}>
                        <View style={styles.infoRow}>
                            <WWText variant="labelMedium"><Text>Deployment Name:</Text></WWText>
                            <WWText variant="bodyLarge"><Text>{deployment.name}</Text></WWText>
                        </View>
                        <View style={styles.infoRow}>
                            <WWText variant="labelMedium"><Text>Deployment Start:</Text></WWText>
                            <WWText variant="bodyLarge"><Text>{new Date(deployment.deploymentStart).toLocaleDateString()}</Text></WWText>
                        </View>
                    </Card.Content>
                </Card>

                {/* Live Activity Log */}
                <Card style={styles.card}>
                    <Card.Content>
                        <WWText variant="titleMedium" style={styles.notesTitle}><Text>Live Activity Log</Text></WWText>
                        <View style={[styles.activityLogBox, { backgroundColor: theme.colors.surfaceVariant }]}>
                            {activityLog.length === 0 ? (
                                <View style={styles.emptyLogContainer}>
                                    <MaterialCommunityIcons name="radar" size={32} color={theme.colors.onSurfaceVariant} style={styles.radarIcon} />
                                    <Text style={[styles.emptyLogText, { color: theme.colors.onSurfaceVariant }]}>Waiting for device activity...</Text>
                                </View>
                            ) : (
                                <FlatList
                                    data={activityLog.slice(0, 50)}
                                    keyExtractor={item => item.id}
                                    nestedScrollEnabled
                                    renderItem={({ item }: { item: ActivityLogEntry }) => (
                                        <View style={styles.logEntry}>
                                            <MaterialCommunityIcons name={item.icon} size={16} color={theme.colors.primary} style={styles.logEntryIcon} />
                                            <Text style={[styles.logEntryLabel, { color: theme.colors.onSurface }]} numberOfLines={1}>{item.label}</Text>
                                            <Text style={[styles.logEntryTime, { color: theme.colors.onSurfaceVariant }]}>
                                                {new Date(item.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                            </Text>
                                        </View>
                                    )}
                                />
                            )}
                        </View>
                    </Card.Content>
                </Card>

                {/* Retrieval Notes Input */}
                <Card style={styles.card}>
                    <Card.Content>
                        <WWText variant="titleMedium" style={styles.notesTitle}><Text>Notes</Text></WWText>
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
                        style={styles.endButton}
                        onPress={handleEndDeployment}
                        loading={isEnding}
                        disabled={isEnding}
                    >
                        <Text>{isEnding ? "Ending..." : "End Deployment"}</Text>
                    </WWButton>

                    <WWButton
                        mode="outlined"
                        onPress={() => navigation.goBack()}
                        disabled={isEnding}
                        style={styles.cancelButton}
                    >
                        <Text>Cancel</Text>
                    </WWButton>
                </View>

                <FinishProgressDialog
                    visible={isFinishing}
                    progress={finishProgress}
                    step={finishStep}
                    logs={finishLogs}
                    isComplete={isEndDeploymentSuccess}
                    onDismiss={handleFinishDismiss}
                    loadingTitle="Ending Deployment"
                    successTitle="Deployment Ended"
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
        padding: 16
    },
    card: { marginBottom: 16 },
    deploymentCardContent: { paddingTop: 16 },
    infoRow: { marginBottom: 8 },
    footer: {
        marginTop: 24,
        marginBottom: 32
    },
    endButton: {
        backgroundColor: '#D32F2F',
        paddingVertical: 8
    },
    cancelButton: {
        borderColor: '#666',
        marginTop: 12
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
