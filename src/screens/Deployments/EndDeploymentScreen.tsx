import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { View, StyleSheet, Alert } from 'react-native'
import { useAppSelector } from '../../redux'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { Appbar, TextInput, Card, useTheme } from 'react-native-paper'
import { WWScreenView } from '../../components/ui/WWScreenView'
import { WWText } from '../../components/ui/WWText'
import { WWButton } from '../../components/ui/WWButton'
import { RootStackParamList } from '../../navigation'
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
import { useBleInitialization } from '../../hooks/useBleInitialization'
import { log, logError, logWarn } from '../../utils/logger'


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
    const { deviceId = '', bleDeviceId = '' } = route.params || {}
    useBleActions()
    const { runDisconnect, setDeploymentIdAsOps, clearGpsLocation } = useBleCommands()

    const { initialize } = useBleInitialization() 

    // Get full device object for BLE commands
    const devices = useAppSelector(state => state.devices)
    const storeDevice = devices[bleDeviceId]
    const { quiesceDevice } = useDeviceSettings({ device: storeDevice })

    // Get current user
    const user = useAppSelector(selectCurrentUser)


    // Track device in ref for use in intervals/callbacks to avoid stale closures
    const bleDeviceRef = useRef(storeDevice)
    useEffect(() => {
        bleDeviceRef.current = storeDevice
    }, [storeDevice])

    // Local state
    const [retrievalNotes, setRetrievalNotes] = useState('')
    const [isEnding, setIsEnding] = useState(false)
    
    // Progress Dialog State
    const [finishProgress, setFinishProgress] = useState(0)
    const [finishStep, setFinishStep] = useState('')
    const [finishLogs, setFinishLogs] = useState<string[]>([])
    const [isFinishing, setIsFinishing] = useState(false)
    const [isEndDeploymentSuccess, setIsEndDeploymentSuccess] = useState(false)

    const addFinishLog = useCallback((message: string) => {
        setFinishLogs(prev => [...prev, message])
    }, [])
    
    // Initialization State (for InitializationHeader)
    const [deviceDb, setDeviceDb] = useState<Device | undefined>()
    const [isInitializing, setIsInitializing] = useState(true)
    const [initProgress, setInitProgress] = useState(0)
    const [initStep, setInitStep] = useState('')
    const [initErrors, setInitErrors] = useState<{ setUtc?: string; deviceHealth?: string[] }>({})
    
    // Connection Guard Refs
    const isNavigatingAway = useRef(false)
    const hasRunInitialization = useRef(false)
    
    useEffect(() => {
        DeviceService.getDeviceById(deviceId).then(setDeviceDb)
    }, [deviceId])

    // Standard BLE initialization (Set UTC, Check Hardware) - runs on screen load
    useEffect(() => {
        const initializeDevice = async () => {
            if (!storeDevice?.connected || hasRunInitialization.current) return
            hasRunInitialization.current = true
            setIsInitializing(true)
            
            setInitStep('Initializing...')
            setInitProgress(0.2)
            log('[EndDeployment] Running standard BLE initialization...')
            
            const result = await initialize(storeDevice, {
                onProgress: (step, progress) => {
                    setInitStep(step)
                    setInitProgress(0.2 + (progress * 0.8)) // Scale progress
                }
            })

            if (!result.success) {
                logWarn('[EndDeployment] BLE initialization had errors:', result.errors)
                setInitErrors({
                    setUtc: result.errors.setUtc,
                    deviceHealth: result.errors.deviceHealth
                })
            } else {
                log('[EndDeployment] Initialization complete. Time set and hardware verified.')
            }

            // Mark initialization as done
            setTimeout(() => {
                setIsInitializing(false)
            }, 2000)
        }

        initializeDevice()
    }, [storeDevice, initialize])


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

    const handleEndDeployment = useCallback(async () => {
        // Sanity Check: Ensure BLE is still connected (unless it's a forced cleanup)
        if (!storeDevice || !storeDevice.connected) {
            Alert.alert(
                'Connection Lost',
                'The device appears to be disconnected. You cannot end the deployment on the device without a connection.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Force End (Database Only)',
                        style: 'destructive',
                        onPress: async () => {
                            // Allow forcing end if device is lost/damaged, but warn heavily
                            setIsEnding(true)
                            isNavigatingAway.current = true // Prevent alerts during force-end
                            setIsFinishing(true)
                            setFinishProgress(0.5)
                            setFinishStep('Force ending...')
                            setFinishLogs(['Device disconnected'])
                            addFinishLog('WARNING: Ending deployment without device connection')
                            
                            try {
                                const userId = user?.id || null
                                await DeploymentService.endDeployment(deployment.id, userId, retrievalNotes)
                                addFinishLog('Deployment ended in database')
                                setFinishProgress(1.0)
                                setIsEndDeploymentSuccess(true)
                            } catch (e) {
                                setIsFinishing(false)
                                Alert.alert('Error', 'Failed to force end')
                            } finally {
                                setIsEnding(false)
                            }
                        }
                    }
                ]
            )
            return
        }

        // Reset and Show Progress Dialog
        setIsEnding(true)
        setIsFinishing(true)
        setFinishProgress(0)
        setFinishStep('Starting...')
        setFinishLogs([])
        setIsEndDeploymentSuccess(false)

        try {
            // 1. Clear Configuration (ID)
            if (storeDevice) {
                addFinishLog('Clearing configuration...')
                setFinishStep('Clearing config...')
                setFinishProgress(0.2)
                
                log('[EndDeployment] Clearing Deployment ID...')
                let idCleared = false
                let attempts = 0
                while (!idCleared && attempts < 3) {
                    try {
                        attempts++
                        await setDeploymentIdAsOps(storeDevice, null)
                        log('[EndDeployment] ID cleared')
                        idCleared = true
                        addFinishLog('Configuration cleared')
                    } catch (e) {
                        logWarn(`[EndDeployment] Clear ID failed (attempt ${attempts}):`, e)
                        if (attempts < 3) {
                            addFinishLog(`Retry ${attempts}/3...`)
                            await new Promise(r => setTimeout(r, 1000))
                        }
                    }
                }

                if (!idCleared) addFinishLog('Warning: Config clear failed')

                // 2. Clear GPS (Legacy/Safety)
                try {
                    await clearGpsLocation(storeDevice)
                } catch (e) {
                    logWarn('[EndDeployment] Failed to clear GPS:', e)
                }
            }

            // 2. Update DB
            addFinishLog('Updating deployment record...')
            setFinishStep('Updating record...')
            setFinishProgress(0.3)
            
            const userId = user?.id || null
            await DeploymentService.endDeployment(deployment.id, userId, retrievalNotes)
            addFinishLog('Record updated successfully')

            // 3. Quiesce Device (Final Stop) - Optimized mode skips camera enable
            if (storeDevice) {
                addFinishLog('Finalizing stop...')
                setFinishStep('Finalizing...')
                setFinishProgress(0.6)
                
                try {
                    await quiesceDevice('[EndDeployment]', true)  // Use optimized mode (skip camera enable)
                    addFinishLog('Device stopped')
                } catch (e) {
                    logWarn('[EndDeployment] Final stop warning:', e)
                    addFinishLog('Warning: Final stop incomplete')
                }
            }

            // 4. Disconnect
            addFinishLog('Disconnecting...')
            setFinishStep('Disconnecting...')
            setFinishProgress(0.8)
            
            if (storeDevice) {
                try {
                    await runDisconnect(storeDevice)
                    addFinishLog('Device disconnected')
                } catch (e) {
                    logWarn('[EndDeployment] Disconnect error:', e)
                }
            }

            // Success State
            setFinishStep('Complete')
            setFinishProgress(1.0)
            setIsEndDeploymentSuccess(true)
            addFinishLog('Deployment ended successfully')

        } catch (error) {
            logError(error)
            setIsFinishing(false)
            Alert.alert("Error", "Failed to end deployment. Please try again.")
        } finally {
            setIsEnding(false)
        }
    }, [storeDevice, user, deployment.id, retrievalNotes, quiesceDevice, setDeploymentIdAsOps, clearGpsLocation, runDisconnect, addFinishLog])

    const handleFinishDismiss = useCallback(() => {
        setIsFinishing(false)
        if (isEndDeploymentSuccess) {
            // Reset navigation stack to Home
            navigation.reset({
                index: 0,
                routes: [{ name: 'Home' }],
            })
        }
    }, [isEndDeploymentSuccess, navigation])

    const renderInfoLeft = useCallback((props: any) => <Appbar.Action {...props} icon="information" />, [])

    if (!deployment) {
        return (
            <WWScreenView>
                <WWText>Loading deployment details...</WWText>
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
                    />
                )}

                {/* Deployment Info Card */}
                <Card style={styles.card}>
                    <Card.Title
                        title="Deployment Info"
                        left={renderInfoLeft}
                    />
                    <Card.Content>
                        <View style={styles.infoRow}>
                            <WWText variant="labelMedium">Deployment Name:</WWText>
                            <WWText variant="bodyLarge">{deployment.name}</WWText>
                        </View>
                        <View style={styles.infoRow}>
                            <WWText variant="labelMedium">Started:</WWText>
                            <WWText variant="bodyLarge">{new Date(deployment.deploymentStart).toLocaleDateString()}</WWText>
                        </View>
                    </Card.Content>
                </Card>

                {/* Retrieval Notes Input */}
                <Card style={styles.card}>
                    <Card.Content>
                        <WWText variant="titleMedium" style={styles.notesTitle}>Retrieval Notes</WWText>
                        <TextInput
                            mode="outlined"
                            placeholder="e.g. SD card full, Battery low, Device damaged..."
                            multiline
                            numberOfLines={8}
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
                        {isEnding ? "Ending..." : "End Deployment"}
                    </WWButton>

                    <WWButton
                        mode="outlined"
                        onPress={() => navigation.goBack()}
                        disabled={isEnding}
                        style={styles.cancelButton}
                    >
                        Cancel
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
        minHeight: 120,
    },
    notesTitle: {
        marginBottom: 8
    }
})

// Wrapper to fetch deployment
const enhance = withObservables(['route'], ({ route }: { route: EndDeploymentDetailsStepRouteProp }) => ({
    deployment: DeploymentService.observeDeploymentById(route.params?.deploymentId || '')
}))

export const EndDeploymentDetailsStep = enhance(EndDeploymentDetailsStepComponent)
