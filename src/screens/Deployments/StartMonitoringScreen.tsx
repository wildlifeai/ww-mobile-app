import { useEffect, useCallback, useMemo, useRef } from 'react'
import { StyleSheet, View } from 'react-native'

import { useNavigation, useRoute, RouteProp, useIsFocused } from '@react-navigation/native'
import { WWScreenView } from '../../components/ui/WWScreenView'
import { WWButton } from '../../components/ui/WWButton'
import { RootStackParamList } from '../../navigation/types'
import { Card, Text, Button, IconButton, useTheme } from 'react-native-paper'
import { WWSelect } from '../../components/ui/WWSelect'
import { WWIcon } from '../../components/ui/WWIcon'
import { StatusInitializationHeader } from '../Devices/components/InitializationHeader'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useGetAiModelsQuery } from '../../redux/api/projectsApi'

import { LoRaWANSection } from './components/LoRaWANSection'

import { MetadataSection } from './components/MetadataSection'
import { HelpDialog } from '../../components/ui/HelpDialog'
import { FinishProgressDialog } from '../Devices/components/FinishProgressDialog'
import { AdvancedSettingsSection } from './components/AdvancedSettingsSection'
import { DeploymentMonitorView } from './components/DeploymentMonitorView'

import { useStartDeployment } from './hooks/useStartDeployment'
import { useFirmwareStatus } from '../Devices/hooks/useFirmwareStatus'
import { ExtendedPeripheral } from '../../redux/slices/devicesSlice'


type StartMonitoringDetailsRouteProp = RouteProp<RootStackParamList, 'StartMonitoringDetailsStep'>;

export const StartMonitoringDetailsStep = () => {
    const theme = useTheme()
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
    const route = useRoute<StartMonitoringDetailsRouteProp>()

    const { projectId, deviceId, bleDeviceId, initPayload } = route.params || {}

    const isFirstFocus = useRef(true)
    const isFocused = useIsFocused()

    // Destructure everything from hook first
    const {
        formState, submitting, project, availableProjects, sensitivityLabel,
        device, bleDevice, isInitializing, initProgress, initStep, initErrors, setInitErrors, aiProcessorFailed,
        finishProgress, finishStep, finishLogs, isFinishing, isStartSuccess,
        handleImageCaptured,
        handleNotesChange, handleProjectChange,
        handleCameraHeightChange, handleStartDeployment, handleFinishDismiss,
        helpVisible, helpTitle, helpContent, showHelp, handleDismissHelp,
        // Dropdown & Additional Location State
        locationName, setLocationName, availableLocations, isCustomLocation, setIsCustomLocation,
        // Advanced Settings
        batteryLevel, sdCardStatus,
        handleBatteryCheck, handleSdCardCheck,
        isMonitoring, handleMonitorDisconnect, handleStopMonitoring, isStoppingMonitoring,
        deploymentStartTime,
        // DFU control
        isDfuInProgress,
    } = useStartDeployment({ deviceId, bleDeviceId, projectId, navigation, initPayload })

    useEffect(() => {
        const deviceName = device?.name || bleDevice?.name || 'Device'
        let title = deviceName
        if (isMonitoring) {
            title = `${deviceName} - Monitoring`
        }
        navigation.setOptions({ title })
    }, [device?.name, bleDevice?.name, navigation, isMonitoring])

    // Reset DFU flag when this screen regains focus (after returning from FirmwareUpdateScreen)
    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            if (isDfuInProgress.current) {
                isDfuInProgress.current = false
            }
        })
        return () => unsubscribe()
    }, [navigation, isDfuInProgress])

    const firmwareStatus = useFirmwareStatus({ 
        device: bleDevice as ExtendedPeripheral | undefined,
        initialBleVersion: initPayload?.deviceFirmwareVersion,
        initialHimaxVersion: initPayload?.himaxFirmwareVersion,
    })

    // Sync firmwareStatus updates with initErrors.deviceHealth
    useEffect(() => {
        if (!firmwareStatus.isChecking) {
            setInitErrors(prev => {
                let health = prev.deviceHealth || []
                if (!firmwareStatus.statuses.ble.isOutdated) {
                    health = health.filter(msg => !msg.includes('Newer firmware available'))
                }
                if (!firmwareStatus.statuses.himax.isOutdated) {
                    health = health.filter(msg => !msg.includes('Newer AI firmware available'))
                }
                if (health.length === (prev.deviceHealth?.length || 0)) return prev
                return { ...prev, deviceHealth: health }
            })
        }
    }, [firmwareStatus.statuses.ble.isOutdated, firmwareStatus.statuses.himax.isOutdated, firmwareStatus.isChecking, setInitErrors])

    // Re-check firmware status when this screen regains focus
    // (e.g. after returning from FirmwareUpdateScreen/FirmwareStatusScreen with a successful update)
    useEffect(() => {
        if (isFocused && bleDevice?.connected) {
            if (isFirstFocus.current) {
                isFirstFocus.current = false
                return // Skip active BLE query on initial mount-focus
            }
            firmwareStatus.checkStatus()
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isFocused, bleDevice?.connected])

    const isAnyFirmwareOutdated = !firmwareStatus.isChecking && (
        firmwareStatus.statuses.ble.isOutdated || 
        firmwareStatus.statuses.himax.isOutdated
    )

    const headerLeft = useCallback(() => (
        <IconButton
            icon="arrow-left"
            onPress={handleMonitorDisconnect}
        />
    ), [handleMonitorDisconnect])

    // Task 6: Override header back button when monitoring (like Engineer Console)
    useEffect(() => {
        navigation.setOptions({
            headerLeft: isMonitoring ? headerLeft : undefined,
        })
    }, [isMonitoring, navigation, headerLeft])

    const { data: aiModels } = useGetAiModelsQuery()
    const aiModelName = useMemo(() => {
        if (!project?.model_id || !aiModels) return null
        const model = aiModels.find(m => m.id === project.model_id)
        return model ? `${model.name} v${model.version}` : null
    }, [project?.model_id, aiModels])

    const hasCameraError = useMemo(() => {
        const warnings = initErrors.deviceHealth || []
        return warnings.some(w => w.includes('Camera Error') || w.includes('Camera system not enabled') || w.includes('Neural Network Error'))
    }, [initErrors.deviceHealth])

    const renderProjectSettingsRight = useCallback((props: any) => (
        <Button {...props} icon="help-circle-outline" onPress={() => showHelp('Associated Project', 'This section shows the project linked to this device and its active features.\n\n🔄 Motion icon: Activity detection is enabled\n⏱ Clock icon: Time-lapse capture is enabled\n📡 Waves icon: LoRaWAN connectivity is enabled\n🛰 Satellite icon: GPS location is recorded in images\n🧠 Brain icon: An AI model is assigned for analysis')}>
            <Text>Help</Text>
        </Button>
    ), [showHelp])


    // Sanity Check: Ensure required params are present
    if (!deviceId) {
        return (
            <WWScreenView>
                <View style={styles.errorContainer}>
                    <Text variant="headlineMedium" style={styles.errorTitle}>Error</Text>
                    <Text variant="bodyLarge" style={styles.errorMessage}>
                        Missing Device ID. Unable to proceed with monitoring.
                    </Text>
                    <Button mode="contained" onPress={() => navigation.goBack()}>
                        <Text>Go Back</Text>
                    </Button>
                </View>
            </WWScreenView>
        )
    }

    if (isMonitoring) {
        return (
            <>
                <DeploymentMonitorView
                    device={bleDevice as any}
                    captureMethodId={project?.capture_method_id}
                    deploymentStartTime={deploymentStartTime}
                    onContinueMonitoring={handleMonitorDisconnect}
                    onStopMonitoring={handleStopMonitoring}
                    isStoppingMonitoring={isStoppingMonitoring}
                />
                <FinishProgressDialog
                    visible={isFinishing}
                    progress={finishProgress}
                    step={finishStep}
                    logs={finishLogs}
                    isComplete={!isStoppingMonitoring && finishProgress >= 1}
                    onDismiss={() => {}}
                    loadingTitle="Stopping Monitoring"
                    successTitle="Monitoring Stopped"
                    hideOkButton={true}
                />
            </>
        )
    }

    return (
        <WWScreenView style={styles.screenView}>
            <View style={styles.container}>
                {/* Initialization Header */}
                {(device || bleDevice) && (
                    <StatusInitializationHeader
                        isInitializing={isInitializing}
                        initProgress={initProgress}
                        initStep={initStep}
                        initErrors={initErrors}
                        theme={theme}
                        warningHintText="You can still start monitoring, but please report these errors."
                    />
                )}

                {/* AI Processor Failure — Critical Blocker */}
                {aiProcessorFailed && (
                    <View style={{ backgroundColor: '#FFEBEE', marginBottom: 16, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#EF5350' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                            <WWIcon source="alert-octagon" size={24} color="#C62828" />
                            <Text variant="titleSmall" style={{ color: '#C62828', marginLeft: 8, flex: 1, fontWeight: 'bold' }}>
                                {hasCameraError ? 'Critical AI Processor Error' : 'AI Processor Not Responding'}
                            </Text>
                        </View>
                        <Text variant="bodySmall" style={{ color: '#C62828', marginBottom: 8 }}>
                            {hasCameraError 
                                ? 'The AI processor has reported a critical camera or hardware error. Starting monitoring is blocked. Please check the camera module connections or hardware configuration.'
                                : 'The AI processor (camera module) did not wake up after multiple attempts. The device cannot start monitoring without it. Please go back and try reconnecting to the device.'}
                        </Text>
                        <Button
                            mode="contained"
                            buttonColor="#C62828"
                            textColor="#FFFFFF"
                            icon="arrow-left"
                            onPress={() => navigation.goBack()}
                        >
                            <Text style={{ color: '#FFFFFF' }}>Back to Scanner</Text>
                        </Button>
                    </View>
                )}

                {/* Firmware Warning Banner */}
                {isAnyFirmwareOutdated && !aiProcessorFailed && (
                    <View style={{ backgroundColor: '#FFF3E0', marginBottom: 16, padding: 12, borderRadius: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                            <WWIcon source="alert-circle-outline" size={24} color="#E65100" />
                            <Text variant="titleSmall" style={{ color: '#E65100', marginLeft: 8, flex: 1 }}>
                                Firmware Update Available
                            </Text>
                        </View>
                        <Text variant="bodySmall" style={{ color: '#E65100', marginBottom: 8 }}>
                            One or more firmware components are outdated. We recommend updating them via the Engineer Console for optimal performance, but you may proceed with monitoring.
                        </Text>
                        <Button
                            mode="contained"
                            buttonColor="#E65100"
                            textColor="#FFFFFF"
                            onPress={() => {
                                isDfuInProgress.current = true
                                navigation.navigate('FirmwareStatusScreen', { deviceId: bleDeviceId!, restrictToLatest: true })
                            }}
                        >
                            <Text style={{ color: '#FFFFFF' }}>Update Firmware</Text>
                        </Button>
                    </View>
                )}

                {/* Associated Project */}
                <Card style={styles.card}>
                        <Card.Title
                        title="Associated Project"
                        right={renderProjectSettingsRight}
                    />
                    <Card.Content>
                        <View style={styles.projectSelectContainer}>
                            <WWSelect
                                label="Project"
                                value={project?.id || ''}
                                options={availableProjects.map((p) => ({ label: p.name, value: p.id }))}
                                onChange={handleProjectChange}
                                disabled={submitting || isInitializing}
                            />
                        </View>

                        {/* Feature icons row */}
                        <View style={styles.featureIconsRow}>
                            {project?.capture_method_id === 1 && (
                                <View style={styles.featureIcon}>
                                    <WWIcon source="motion-sensor" size={22} color={theme.colors.onSurfaceVariant} />
                                    <Text variant="labelSmall" style={styles.featureLabel}>
                                        {sensitivityLabel || 'Motion'}
                                    </Text>
                                </View>
                            )}
                            {project?.capture_method_id === 2 && (
                                <View style={styles.featureIcon}>
                                    <WWIcon source="timer-outline" size={22} color={theme.colors.onSurfaceVariant} />
                                    <Text variant="labelSmall" style={styles.featureLabel}>
                                        {project.timelapse_interval_seconds ? `${project.timelapse_interval_seconds}s` : 'Timelapse'}
                                    </Text>
                                </View>
                            )}
                            {project?.lorawan_required && (
                                <View style={styles.featureIcon}>
                                    <WWIcon source="access-point" size={22} color={theme.colors.onSurfaceVariant} />
                                    <Text variant="labelSmall" style={styles.featureLabel}>LoRaWAN</Text>
                                </View>
                            )}
                            {project?.record_gps_in_images && (
                                <View style={styles.featureIcon}>
                                    <WWIcon source="satellite-variant" size={22} color={theme.colors.onSurfaceVariant} />
                                    <Text variant="labelSmall" style={styles.featureLabel}>GPS</Text>
                                </View>
                            )}
                            {aiModelName && (
                                <View style={styles.featureIcon}>
                                    <WWIcon source="brain" size={22} color={theme.colors.onSurfaceVariant} />
                                    <Text variant="labelSmall" style={styles.featureLabel}>{aiModelName}</Text>
                                </View>
                            )}
                        </View>

                    </Card.Content>
                </Card>

                {project?.lorawan_required ? (
                    <LoRaWANSection
                        device={bleDevice}
                        onShowHelp={showHelp}
                    />
                ) : null}


                <MetadataSection
                    notes={formState.notes}
                    onNotesChange={handleNotesChange}
                    onShowHelp={showHelp}
                />

                <AdvancedSettingsSection
                    device={bleDevice}
                    project={project}
                    onImageCaptured={handleImageCaptured}
                    cameraHeight={formState.cameraHeight}
                    onCameraHeightChange={handleCameraHeightChange}
                    locationName={locationName}
                    onLocationNameChange={setLocationName}
                    availableLocations={availableLocations}
                    isCustomLocation={isCustomLocation}
                    setIsCustomLocation={setIsCustomLocation}
                    batteryLevel={batteryLevel}
                    sdCardStatus={sdCardStatus}
                    handleBatteryCheck={handleBatteryCheck}
                    handleSdCardCheck={handleSdCardCheck}
                    isInitializing={isInitializing}
                    bleDeviceConnected={!!bleDevice?.connected}
                    theme={theme}
                    onShowHelp={showHelp}
                    firmwareStatus={firmwareStatus}
                    onUpdateFirmware={(target) => {
                        const id = bleDevice?.id || deviceId
                        if (id) {
                            // Suppress the disconnect alert during BLE DFU
                            isDfuInProgress.current = true
                            navigation.navigate('FirmwareUpdateScreen', { deviceId: id, target, restrictToLatest: true })
                        }
                    }}
                />

                <View style={styles.footer}>
                    <WWButton
                        mode="contained"
                        onPress={handleStartDeployment}
                        loading={submitting}
                        disabled={aiProcessorFailed}
                        style={styles.deployButton}
                    >
                        <Text>Start Monitoring</Text>
                    </WWButton>
                </View>
            </View>

            <HelpDialog
                visible={helpVisible}
                title={helpTitle}
                content={helpContent}
                onDismiss={handleDismissHelp}
            />

            <FinishProgressDialog
                visible={isFinishing}
                progress={finishProgress}
                step={finishStep}
                logs={finishLogs}
                isComplete={isStartSuccess}
                onDismiss={handleFinishDismiss}
                loadingTitle="Starting Monitoring"
                successTitle="Monitoring Started"
                hideOkButton={true}
            />
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
    footer: {
        marginTop: 24,
        marginBottom: 32
    },
    deployButton: {
        paddingVertical: 8
    },
    card: {
    },
    featureIconsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 16,
        marginTop: 4,
    },
    featureIcon: {
        alignItems: 'center',
        gap: 4,
    },
    featureLabel: {
        opacity: 0.7,
        textAlign: 'center',
    },
    projectSelectContainer: {
        marginBottom: 16,
        marginTop: 4,
        zIndex: 10, 
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16
    },
    errorTitle: {
        marginBottom: 16
    },
    errorMessage: {
        marginBottom: 24,
        textAlign: 'center'
    },
    editButton: {
        marginTop: 12
    }
})
