import React, { useState, useEffect, useRef, useCallback } from 'react'
import { View, StyleSheet, Alert } from 'react-native'
import { useAppSelector } from '../../redux'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { Text, useTheme } from 'react-native-paper'
import { WWScreenView } from '../../components/ui/WWScreenView'
import { WWText } from '../../components/ui/WWText'
import { WWButton } from '../../components/ui/WWButton'
import { RootStackParamList } from '../../navigation/types'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { DeploymentService } from '../../services/DeploymentService'
import { useDeviceSettings } from '../../hooks/useDeviceSettings'
import { useBleActions } from '../../providers/BleEngineProvider'

import { withObservables } from '@nozbe/watermelondb/react'
import { selectCurrentUser } from '../../redux/slices/authSlice'
import { StatusInitializationHeader } from '../Devices/components/InitializationHeader'
import Device from '../../database/models/Device'
import { DeviceService } from '../../services/DeviceService'
import type Deployment from '../../database/models/Deployment'
import { FinishProgressDialog } from '../Devices/components/FinishProgressDialog'
import { log, logWarn } from '../../utils/logger'
import { useEndDeployment } from './hooks/useEndDeployment'

import { DeploymentMonitorView } from './components/DeploymentMonitorView'
import { IconButton } from 'react-native-paper'

import { createBleSession } from '../../ble/session/createBleSession'
import { commandRegistry } from '../../ble/protocol/commandRegistry'

type StopMonitoringDetailsStepRouteProp = RouteProp<RootStackParamList, 'StopMonitoringDetailsStep'>

interface InnerProps {
    deployment: Deployment
    deviceId: string
    bleDeviceId: string
}


const StopMonitoringDetailsStepComponent: React.FC<InnerProps> = ({ deployment }) => {
    const theme = useTheme()
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
    const route = useRoute<StopMonitoringDetailsStepRouteProp>()
    const { deviceId = '', bleDeviceId = '', initPayload } = route.params || {}
    useBleActions()

    // Get full device object for BLE commands
    const devices = useAppSelector(state => state.devices)
    const storeDevice = devices[bleDeviceId]
    const { quiesceDevice } = useDeviceSettings()

    // Get current user
    const user = useAppSelector(selectCurrentUser)

    // Track device in ref for use in intervals/callbacks to avoid stale closures
    const bleDeviceRef = useRef(storeDevice)
    useEffect(() => {
        bleDeviceRef.current = storeDevice
    }, [storeDevice])

    // Use ref for retrieval notes so useEndDeployment always gets the latest value
    const retrievalNotesRef = useRef('')
    const [retrievalNotes, setRetrievalNotes] = useState('')
    
    // Keep ref in sync with state
    useEffect(() => {
        retrievalNotesRef.current = retrievalNotes
    }, [retrievalNotes])

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

    // Set title to "<device name> - Monitoring"
    useEffect(() => {
        const deviceName = deviceDb?.name || storeDevice?.name || 'Device'
        navigation.setOptions({ title: `${deviceName} - Monitoring` })
    }, [deviceDb?.name, storeDevice?.name, navigation])

    // Handle "Continue Monitoring": shows alert then disconnects
    const handleContinueMonitoring = useCallback(() => {
        Alert.alert(
            'Wildlife Watcher Monitoring',
            'The bluetooth will be disconnected but the camera will continue monitoring for animals.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Disconnect',
                    style: 'default',
                    onPress: async () => {
                        const currentDevice = bleDeviceRef.current
                        isNavigatingAway.current = true
                        
                        if (currentDevice?.connected) {
                            log('[EndDeployment] Continue monitoring - disconnecting device...')
                            try {
                                const session = createBleSession(currentDevice)
                                await session.execute(commandRegistry.disconnect)
                            } catch (e) {
                                logWarn('[EndDeployment] Disconnect failed:', e)
                            }
                        }
                        
                        navigation.navigate('Home', { initialTab: 'deployment' })
                    }
                }
            ]
        )
    }, [navigation])

    // Handle "Stop Monitoring" from the modal: sets notes, then triggers end deployment
    // Use a ref flag so the effect fires after React re-renders with updated retrievalNotes
    const pendingStopRef = useRef(false)

    const handleStopMonitoring = useCallback((notes: string) => {
        if (notes === retrievalNotes) {
            // Notes unchanged (e.g. both empty): call directly since
            // setRetrievalNotes won't trigger a re-render / effect.
            handleEndDeployment()
        } else {
            setRetrievalNotes(notes)
            pendingStopRef.current = true
        }
    }, [retrievalNotes, handleEndDeployment])

    // Once retrievalNotes updates AND we're pending stop, trigger end deployment
    useEffect(() => {
        if (pendingStopRef.current) {
            pendingStopRef.current = false
            handleEndDeployment()
        }
    }, [retrievalNotes, handleEndDeployment])

    // Override header back button to show same alert as "Continue Monitoring"
    const headerLeft = useCallback(() => (
        <IconButton
            icon="arrow-left"
            onPress={handleContinueMonitoring}
        />
    ), [handleContinueMonitoring])

    useEffect(() => {
        navigation.setOptions({ headerLeft })
    }, [navigation, headerLeft])


    // Back button handler: Same alert as "Continue Monitoring"
    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', async (e) => {
            if (isNavigatingAway.current || isEnding || isEndDeploymentSuccess) return // Already handled

            // Prevent immediate navigation
            e.preventDefault()
            Alert.alert(
                "Wildlife Watcher Monitoring",
                "The bluetooth will be disconnected but the camera will continue monitoring for animals.",
                [
                    {
                        text: "Cancel",
                        style: "cancel"
                    },
                    {
                        text: "Disconnect",
                        style: "default",
                        onPress: async () => {
                        // Disconnect device
                        const currentDevice = bleDeviceRef.current
                        isNavigatingAway.current = true
                        
                        if (currentDevice?.connected) {
                            log('[EndDeployment] Back button pressed - disconnecting device...')
                            const session = createBleSession(currentDevice)
                            await session.execute(commandRegistry.disconnect)
                        }
                            
                            // Now allow navigation
                            navigation.dispatch(e.data.action)
                        }
                    }
                ]
            )
        })

        return () => unsubscribe()
    }, [navigation, isEnding, isEndDeploymentSuccess])



    if (!deployment) {
        return (
            <WWScreenView>
                <WWText><Text>Loading monitoring session details…</Text></WWText>
            </WWScreenView>
        )
    }

    // If device is disconnected, show force-end fallback (old form layout)
    if (!storeDevice?.connected) {
        return (
            <WWScreenView scrollable style={styles.screenView}>
                <View style={styles.container}>
                    {/* Initialization Header */}
                    {(deviceDb || storeDevice) && (
                        <StatusInitializationHeader
                            isInitializing={isInitializing}
                            initProgress={initProgress}
                            initStep={initStep}
                            initErrors={initErrors}
                            theme={theme}
                            warningHintText="You can still stop monitoring, but please report these errors."
                        />
                    )}<View style={styles.disconnectedBanner}>
                        <Text variant="bodyLarge" style={{ textAlign: 'center', marginBottom: 12 }}>
                            Device is not connected. You can force end the deployment in the database, but the device will need to be manually reset later.
                        </Text>
                    </View>

                    <View style={styles.footer}>
                        <WWButton
                            mode="contained"
                            style={styles.deployButton}
                            onPress={handleEndDeployment}
                            loading={isEnding}
                            disabled={isEnding}
                        >
                            <Text>{isEnding ? "Stopping…" : "Force End (Database Only)"}</Text>
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
                        hideOkButton={true}
                    />
                </View>
            </WWScreenView>
        )
    }

    // Device is connected: show DeploymentMonitorView (same as post-start monitoring)
    return (
        <>
            <DeploymentMonitorView
                device={storeDevice}
                captureMethodId={deployment.captureMethodId}
                deploymentStartTime={deployment.deploymentStart}
                onContinueMonitoring={handleContinueMonitoring}
                onStopMonitoring={handleStopMonitoring}
                isStoppingMonitoring={isEnding}
            />
            <FinishProgressDialog
                visible={isFinishing}
                progress={finishProgress}
                step={finishStep}
                logs={finishLogs}
                isComplete={isEndDeploymentSuccess}
                onDismiss={handleFinishDismiss}
                loadingTitle="Stopping Monitoring"
                successTitle="Monitoring Stopped"
                hideOkButton={true}
            />
        </>
    )
}

const styles = StyleSheet.create({
    screenView: {
        paddingTop: 0
    },
    container: {
        flex: 1,
        gap: 16,
    },
    footer: {
        marginTop: 24,
        marginBottom: 32
    },
    deployButton: {
        paddingVertical: 8
    },
    disconnectedBanner: {
        padding: 16,
        marginTop: 16,
    },
})

// Wrapper to fetch deployment
const enhance = withObservables(['route'], ({ route }: { route: StopMonitoringDetailsStepRouteProp }) => ({
    deployment: DeploymentService.observeDeploymentById(route.params?.deploymentId || '')
}))

export const StopMonitoringDetailsStep = enhance(StopMonitoringDetailsStepComponent)
