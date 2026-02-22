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
import { LocationSection } from './components/LocationSection'
import { MetadataSection } from './components/MetadataSection'
import { HelpDialog } from '../../components/ui/HelpDialog'
import { FinishProgressDialog } from '../Devices/components/FinishProgressDialog'

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
        isNavigatingAway, handleLocationChange, handleImageCaptured,
        handleNameChange, handleNotesChange, handleLocationDescriptionChange,
        handleCameraHeightChange, handleStartDeployment, handleFinishDismiss,
        helpVisible, helpTitle, helpContent, showHelp, handleDismissHelp
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

                        <Button
                            mode="outlined"
                            onPress={() => {
                                isNavigatingAway.current = true
                                    ; navigation.navigate('PrepareAndTest', {
                                        deviceId,
                                        bleDeviceId,
                                        nextRoute: 'DeploymentDetailsStep'
                                    })
                            }}
                            style={styles.editButton}
                            icon="cog"
                        >
                            <Text>Edit Device Preparation</Text>
                        </Button>
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

                <LocationSection
                    onLocationChange={handleLocationChange}
                    onShowHelp={showHelp}
                />

                <MetadataSection
                    name={formState.name}
                    notes={formState.notes}
                    locationDescription={formState.locationDescription}
                    cameraHeight={formState.cameraHeight}
                    onNameChange={handleNameChange}
                    onNotesChange={handleNotesChange}
                    onLocationDescriptionChange={handleLocationDescriptionChange}
                    onCameraHeightChange={handleCameraHeightChange}
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
