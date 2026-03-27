import { useCallback } from 'react'
import { StyleSheet, View } from 'react-native'

import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { WWScreenView } from '../../components/ui/WWScreenView'
import { WWButton } from '../../components/ui/WWButton'
import { RootStackParamList } from '../../navigation/types'
import { Card, Text, Button, useTheme } from 'react-native-paper'
import { WWIcon } from '../../components/ui/WWIcon'
import { InitializationHeader } from '../Devices/components/InitializationHeader'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'

import { LoRaWANSection } from './components/LoRaWANSection'
import { CameraViewSection } from './components/CameraViewSection'
import { DeploymentMotionDetectionSection } from './components/DeploymentMotionDetectionSection'
import { MetadataSection } from './components/MetadataSection'
import { HelpDialog } from '../../components/ui/HelpDialog'
import { FinishProgressDialog } from '../Devices/components/FinishProgressDialog'
import { AdvancedSettingsSection } from './components/AdvancedSettingsSection'

import { useStartDeployment } from './hooks/useStartDeployment'


type DeploymentDetailsRouteProp = RouteProp<RootStackParamList, 'DeploymentDetailsStep'>;

export const DeploymentDetailsStep = () => {
    const theme = useTheme()
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
    const route = useRoute<DeploymentDetailsRouteProp>()

    const { devicePreparationId, deviceId, bleDeviceId } = route.params || {}

    const {
        formState, submitting, project, captureMethodName, sensitivityLabel,
        device, bleDevice, isInitializing, initProgress, initStep, initErrors,
        finishProgress, finishStep, finishLogs, isFinishing, isStartSuccess,
        handleImageCaptured,
        handleNameChange, handleNotesChange,
        handleCameraHeightChange, handleStartDeployment, handleFinishDismiss,
        helpVisible, helpTitle, helpContent, showHelp, handleDismissHelp,
        // Advanced Settings
        batteryLevel, sdCardStatus, latestBleFirmware, deviceFirmwareVersion,
        bleFirmwareUpdateAvailable, firmwareUpdateProgress, isUpdatingFirmware,
        isCheckingFirmware, isVerifyingUpdate, firmwareUpdateStatus,
        handleBatteryCheck, handleSdCardCheck, handleFirmwareCheck, handleBleFirmwareUpdate
    } = useStartDeployment({ deviceId, bleDeviceId, devicePreparationId, navigation })

    const renderProjectSettingsLeft = useCallback((props: any) => <WWIcon {...props} source="tune" />, [])
    const renderProjectSettingsRight = useCallback((props: any) => (
        <Button {...props} icon="help-circle-outline" onPress={() => showHelp('Project settings', 'Project and Capture Method are set during Project Creation and Device Preparation. To change these, you must restart the preparation.')}>
            <Text>Help</Text>
        </Button>
    ), [showHelp])


    // Sanity Check: Ensure required params are present
    if (!devicePreparationId) {
        return (
            <WWScreenView>
                <View style={styles.errorContainer}>
                    <Text variant="headlineMedium" style={styles.errorTitle}>Error</Text>
                    <Text variant="bodyLarge" style={styles.errorMessage}>
                        Missing Device Preparation ID. Unable to proceed with deployment.
                    </Text>
                    <Button mode="contained" onPress={() => navigation.goBack()}>
                        <Text>Go Back</Text>
                    </Button>
                </View>
            </WWScreenView>
        )
    }




    return (
        <WWScreenView style={styles.screenView}>
            <View style={styles.container}>
                {/* Device Synchronization Header */}
                {(device || bleDevice) && (
                    <InitializationHeader
                        device={device || { name: bleDevice?.name || 'Device', bluetoothId: bleDeviceId } as any}
                        isInitializing={isInitializing}
                        initProgress={initProgress}
                        initStep={initStep}
                        initErrors={initErrors}
                        theme={theme}
                        warningHintText="You can still proceed with deployment, but we recommend addressing these issues if possible."
                    />
                )}

                {/* Project & Configuration Header */}
                <Card style={styles.card}>
                    <Card.Title
                        title="Project settings"
                        left={renderProjectSettingsLeft}
                        right={renderProjectSettingsRight}
                    />
                    <Card.Content>
                        <View style={styles.infoRow}>
                            <Text variant="labelMedium">Project:</Text>
                            <Text variant="bodyLarge">{project ? project.name : 'Loading...'}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text variant="labelMedium">Capture Method:</Text>
                            <Text variant="bodyLarge">{captureMethodName || 'Loading...'}</Text>
                        </View>
                        {project?.capture_method_id === 1 && sensitivityLabel ? (
                            <View style={styles.infoRow}>
                                <Text variant="labelMedium">Motion Sensitivity:</Text>
                                <Text variant="bodyLarge">{sensitivityLabel}</Text>
                            </View>
                        ) : project?.capture_method_id === 2 && project?.timelapse_interval_seconds ? (
                            <View style={styles.infoRow}>
                                <Text variant="labelMedium">Time-lapse Interval:</Text>
                                <Text variant="bodyLarge">{project.timelapse_interval_seconds}s</Text>
                            </View>
                        ) : null}

                        {[
                            { label: 'Record GPS in Images', enabled: project?.record_gps_in_images },
                            { label: 'Using Bait', enabled: project?.is_baited },
                            { label: 'Monitoring Marked Individuals', enabled: project?.is_monitoring_marked_individuals },
                        ].map(({ label, enabled }) => (
                            enabled && (
                                <View key={label} style={styles.infoRow}>
                                    <Text variant="labelMedium">{label}:</Text>
                                    <Text variant="bodyLarge">Enabled</Text>
                                </View>
                            )
                        ))}

                    </Card.Content>
                </Card>

                <LoRaWANSection
                    device={bleDevice}
                    onShowHelp={showHelp}
                />

                <CameraViewSection
                    device={bleDevice}
                    onImageCaptured={handleImageCaptured}
                    onShowHelp={showHelp}
                />

                <DeploymentMotionDetectionSection
                    device={bleDevice}
                    project={project}
                    onShowHelp={showHelp}
                />

                <MetadataSection
                    name={formState.name}
                    notes={formState.notes}
                    cameraHeight={formState.cameraHeight}
                    onNameChange={handleNameChange}
                    onNotesChange={handleNotesChange}
                    onCameraHeightChange={handleCameraHeightChange}
                    onShowHelp={showHelp}
                />

                <AdvancedSettingsSection
                    batteryLevel={batteryLevel}
                    sdCardStatus={sdCardStatus}
                    latestBleFirmware={latestBleFirmware}
                    deviceFirmwareVersion={deviceFirmwareVersion}
                    bleFirmwareUpdateAvailable={bleFirmwareUpdateAvailable}
                    firmwareUpdateProgress={firmwareUpdateProgress}
                    isUpdatingFirmware={isUpdatingFirmware}
                    isCheckingFirmware={isCheckingFirmware}
                    isVerifyingUpdate={isVerifyingUpdate}
                    firmwareUpdateStatus={firmwareUpdateStatus}
                    handleBatteryCheck={handleBatteryCheck}
                    handleSdCardCheck={handleSdCardCheck}
                    handleFirmwareCheck={handleFirmwareCheck}
                    handleBleFirmwareUpdate={handleBleFirmwareUpdate}
                    isInitializing={isInitializing}
                    bleDeviceConnected={!!bleDevice?.connected}
                    theme={theme}
                    onShowHelp={showHelp}
                />

                <View style={styles.footer}>
                    <WWButton
                        mode="contained"
                        onPress={handleStartDeployment}
                        loading={submitting}
                        style={styles.deployButton}
                    >
                        <Text>Start Deployment</Text>
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
                loadingTitle="Starting Deployment"
                successTitle="Deployment Complete"
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
        // marginBottom: 16 // Removed to avoid double spacing with container gap
    },
    infoRow: {
        marginBottom: 4
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
