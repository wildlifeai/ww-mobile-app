import React, { useState, useCallback, useEffect, useRef, useReducer } from 'react'
import { View, StyleSheet } from 'react-native'
import { useAppSelector } from '../../redux'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { Appbar, TextInput, Card, useTheme, Text } from 'react-native-paper'
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
import { useBleInitialization } from '../../hooks/useBleInitialization'
import { log, logWarn } from '../../utils/logger'
import { useEndDeployment } from './hooks/useEndDeployment'


type EndDeploymentDetailsStepRouteProp = RouteProp<RootStackParamList, 'EndDeploymentDetailsStep'>

interface InnerProps {
    deployment: Deployment
    deviceId: string
    bleDeviceId: string
}

type InitState = {
    isInitializing: boolean
    initProgress: number
    initStep: string
    initErrors: { setUtc?: string; deviceHealth?: string[] }
}

type InitAction = 
    | { type: 'START_INIT' }
    | { type: 'SET_PROGRESS'; step: string; progress: number }
    | { type: 'SET_ERRORS'; errors: { setUtc?: string; deviceHealth?: string[] } }
    | { type: 'FINISH_INIT' }

const initReducer = (state: InitState, action: InitAction): InitState => {
    switch (action.type) {
        case 'START_INIT':
            return {
                ...state,
                isInitializing: true,
                initStep: 'Initializing...',
                initProgress: 0.2
            }
        case 'SET_PROGRESS':
            return {
                ...state,
                initStep: action.step,
                initProgress: action.progress
            }
        case 'SET_ERRORS':
            return {
                ...state,
                initErrors: action.errors
            }
        case 'FINISH_INIT':
            return {
                ...state,
                isInitializing: false
            }
        default:
            return state
    }
}

const EndDeploymentDetailsStepComponent: React.FC<InnerProps> = ({ deployment }) => {
    const theme = useTheme()
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
    const route = useRoute<EndDeploymentDetailsStepRouteProp>()
    const { deviceId = '', bleDeviceId = '' } = route.params || {}
    useBleActions()
    const { runDisconnect, setDeploymentIdAsOps, clearGpsLocation, getAllOperationalParams } = useBleCommands()

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

    // Connection Guard Refs
    const isNavigatingAway = useRef(false)
    const hasRunInitialization = useRef(false)

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
    
    // Initialization State (for InitializationHeader)
    const [deviceDb, setDeviceDb] = useState<Device | undefined>()
    const [{ isInitializing, initProgress, initStep, initErrors }, dispatchInit] = useReducer(initReducer, {
        isInitializing: true,
        initProgress: 0,
        initStep: '',
        initErrors: {}
    })
    

    
    useEffect(() => {
        DeviceService.getDeviceById(deviceId).then(setDeviceDb)
    }, [deviceId])

    // Standard BLE initialization (Set UTC, Check Hardware) - runs on screen load
    useEffect(() => {
        const initializeDevice = async () => {
            if (!storeDevice?.connected || hasRunInitialization.current) return
            hasRunInitialization.current = true
            dispatchInit({ type: 'START_INIT' })
            
            log('[EndDeployment] Running standard BLE initialization...')
            
            const result = await initialize(storeDevice, {
                onProgress: (step, progress) => {
                    dispatchInit({ type: 'SET_PROGRESS', step, progress: 0.2 + (progress * 0.8) })
                }
            })

            if (!result.success) {
                logWarn('[EndDeployment] BLE initialization had errors:', result.errors)
                dispatchInit({
                    type: 'SET_ERRORS',
                    errors: {
                        setUtc: result.errors.setUtc,
                        deviceHealth: result.errors.deviceHealth
                    }
                })
            } else {
                log('[EndDeployment] Initialization complete. Time set and hardware verified.')
            }

            // Mark initialization as done
            setTimeout(() => {
                dispatchInit({ type: 'FINISH_INIT' })
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



    const renderInfoLeft = useCallback((props: any) => <Appbar.Action {...props} icon="information" />, [])

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
                            <WWText variant="labelMedium"><Text>Deployment Name:</Text></WWText>
                            <WWText variant="bodyLarge"><Text>{deployment.name}</Text></WWText>
                        </View>
                        <View style={styles.infoRow}>
                            <WWText variant="labelMedium"><Text>Started:</Text></WWText>
                            <WWText variant="bodyLarge"><Text>{new Date(deployment.deploymentStart).toLocaleDateString()}</Text></WWText>
                        </View>
                    </Card.Content>
                </Card>

                {/* Retrieval Notes Input */}
                <Card style={styles.card}>
                    <Card.Content>
                        <WWText variant="titleMedium" style={styles.notesTitle}><Text>Retrieval Notes</Text></WWText>
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
