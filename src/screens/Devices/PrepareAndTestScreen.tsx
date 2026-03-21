
import { View, StyleSheet } from 'react-native'
import { WWScreenView } from '../../components/ui/WWScreenView'
import { WWText } from '../../components/ui/WWText'
import { WWButton } from '../../components/ui/WWButton'
import { WWIcon } from '../../components/ui/WWIcon'
import { InitializationHeader } from './components/InitializationHeader'
import { ProjectSelectionSection } from './components/ProjectSelectionSection'
import { DiagnosticsSection } from './components/DiagnosticsSection'
import { FirmwareSection } from './components/FirmwareSection'
import { HardwareBetaSection } from './components/HardwareBetaSection'
import { FinishProgressDialog } from './components/FinishProgressDialog'
import { HelpDialog } from '../../components/ui/HelpDialog'
import { ActivityIndicator, useTheme, Text } from 'react-native-paper'
import { usePrepareAndTest } from './hooks/usePrepareAndTest'

export const PrepareAndTestScreen = () => {
    const theme = useTheme()
    
    const {
        device,
        selectedProject,
        loading,
        batteryLevel,
        sdCardStatus,
        cameraTestPassed,
        isFinishing,
        finishProgress,
        finishStep,
        finishLogs,
        latestBleFirmware,
        deviceFirmwareVersion,
        bleFirmwareUpdateAvailable,
        firmwareUpdateProgress,
        isUpdatingFirmware,
        isCheckingFirmware,
        isVerifyingUpdate,
        firmwareUpdateStatus,
        helpVisible,
        helpTitle,
        helpContent,
        showHelp,
        handleDismissHelp,
        initState,
        handleProjectChange,
        handleFinish,
        handleFinishComplete,
        handleBatteryCheck,
        handleSdCardCheck,
        handleFirmwareCheck,
        handleCameraTest,
        handleBleFirmwareUpdate,
        projects,
        bleDevice,
        capturedImageUri,
        isCapturingImage,
        captureProgress,
        captureStage,
        navigation
    } = usePrepareAndTest()

    if (loading) {
        return (
            <WWScreenView>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" />
                    <WWText variant="bodyMedium" style={styles.loadingText}>
                        <Text>Preparing device...</Text>
                    </WWText>
                </View>
            </WWScreenView>
        )
    }

    if (!device) {
        return (
            <WWScreenView>
                <View style={styles.loadingContainer}>
                    <WWIcon source="alert-circle-outline" size={64} color={theme.colors.error} />
                    <WWText variant="headlineSmall" style={[styles.loadingText, { color: theme.colors.error }]}>
                        <Text>Device Not Found</Text>
                    </WWText>
                    <WWText variant="bodyMedium" style={styles.errorText}>
                        <Text>Could not find device details in the local database. Please try pairing again.</Text>
                    </WWText>
                    <WWButton 
                        mode="contained" 
                        onPress={() => navigation.goBack()} 
                        style={styles.goBackButton}
                    >
                        <Text>Go Back</Text>
                    </WWButton>
                </View>
            </WWScreenView>
        )
    }

    return (
        <WWScreenView scrollable={true} style={styles.screenView}>
            <View style={styles.container}>
                <InitializationHeader
                    device={device}
                    isInitializing={initState.isInitializing}
                    initProgress={initState.progress}
                    initStep={initState.step}
                    initErrors={initState.errors}
                    theme={theme}
                />

                <ProjectSelectionSection
                    selectedProject={selectedProject}
                    handleProjectChange={handleProjectChange}
                    isInitializing={initState.isInitializing}
                    projects={projects}
                    theme={theme}
                    onShowHelp={showHelp}
                />

                <DiagnosticsSection
                    batteryLevel={batteryLevel}
                    handleBatteryCheck={handleBatteryCheck}
                    sdCardStatus={sdCardStatus}
                    handleSdCardCheck={handleSdCardCheck}
                    capturedImageUri={capturedImageUri}
                    handleCameraTest={handleCameraTest}
                    isCapturingImage={isCapturingImage}
                    cameraTestPassed={cameraTestPassed}
                    isInitializing={initState.isInitializing}
                    bleDeviceConnected={!!bleDevice?.connected}
                    theme={theme}
                    onShowHelp={showHelp}
                    captureProgress={captureProgress}
                    captureStage={captureStage}
                />

                <FirmwareSection
                    latestBleFirmware={latestBleFirmware}
                    deviceFirmwareVersion={deviceFirmwareVersion}
                    bleFirmwareUpdateAvailable={bleFirmwareUpdateAvailable}
                    firmwareUpdateProgress={firmwareUpdateProgress}
                    isUpdatingFirmware={isUpdatingFirmware}
                    isCheckingFirmware={isCheckingFirmware}
                    isVerifyingUpdate={isVerifyingUpdate}
                    handleFirmwareCheck={handleFirmwareCheck}
                    handleBleFirmwareUpdate={handleBleFirmwareUpdate}
                    firmwareUpdateStatus={firmwareUpdateStatus}
                    isInitializing={initState.isInitializing}
                    bleDeviceConnected={!!bleDevice?.connected}
                    batteryLevel={batteryLevel}
                    theme={theme}
                    onShowHelp={showHelp}
                />

                <HardwareBetaSection theme={theme} onShowHelp={showHelp} />

                <FinishProgressDialog
                    visible={isFinishing}
                    progress={finishProgress}
                    step={finishStep}
                    logs={finishLogs}
                    isComplete={finishProgress === 1.0}
                    onDismiss={handleFinishComplete}
                />

                {/* Finish Preparation Button */}
                <View style={[styles.footer, isFinishing && styles.dimmed]}>
                    <WWButton
                        mode="contained"
                        onPress={handleFinish}
                        style={styles.finishButton}
                        disabled={!selectedProject || initState.isInitializing || isFinishing}
                        loading={isFinishing}
                    >
                        <Text>{isFinishing ? 'Finishing...' : 'Finish Preparation & Testing'}</Text>
                    </WWButton>
                    <WWButton mode="text" onPress={() => navigation.goBack()} disabled={isFinishing}>
                        <Text>Cancel</Text>
                    </WWButton>
                </View>
            </View>

            <HelpDialog
                visible={helpVisible}
                title={helpTitle}
                content={helpContent}
                onDismiss={handleDismissHelp}
            />
        </WWScreenView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        gap: 16,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
    },
    footer: {
        marginTop: 16,
        gap: 12,
        marginBottom: 32,
    },
    finishButton: {
        marginTop: 8,
    },
    errorText: {
        textAlign: 'center',
        marginTop: 8,
        paddingHorizontal: 32,
    },
    goBackButton: {
        marginTop: 24,
    },
    screenView: {
        paddingTop: 0,
    },
    dimmed: {
        opacity: 0.5,
    },
})
