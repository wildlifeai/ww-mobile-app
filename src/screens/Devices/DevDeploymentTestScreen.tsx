/**
 * DevDeploymentTestScreen
 *
 * Developer-only screen for testing monitoring with full parameter control.
 * Accessible from Engineer Console → Flows → "Dev Deployment Test".
 *
 * All settings are visible on a single scrollable page (no accordion). The
 * capture method and the capture flash are the project's own fields, offered
 * with the same choices as the project edit form (#301), and changes persist
 * to the project. The camera is chosen here and switched at Start.
 *
 * Uses the existing end-monitoring flow (same as production).
 */

import { useEffect, useCallback } from 'react'
import { View, StyleSheet, ScrollView, Switch } from 'react-native'
import {
    Card, Text, Button, SegmentedButtons, Divider,
    TextInput, IconButton
} from 'react-native-paper'
import { useRoute, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'

import { WWScreenView } from '../../components/ui/WWScreenView'
import { WWButton } from '../../components/ui/WWButton'
import { WWSelect } from '../../components/ui/WWSelect'
import { WWText } from '../../components/ui/WWText'
import { WWTextInput } from '../../components/ui/WWTextInput'
import { WWIcon } from '../../components/ui/WWIcon'
import { WWBleDisconnectedBanner } from '../../components/ui/WWBleDisconnectedBanner'
import { DeviceHealthBanner } from '../../components/DeviceHealthBanner'
import { RootStackParamList, AppParams } from '../../navigation/types'
import { DeploymentMonitorView } from '../Deployments/components/DeploymentMonitorView'
import { FinishProgressDialog } from './components/FinishProgressDialog'
import { BatteryLevelCard } from '../Deployments/components/BatteryLevelCard'
import { SdCardStatusCard } from '../Deployments/components/SdCardStatusCard'
import { useDevDeployment, type DeployableCamera } from './hooks/useDevDeployment'
import { CAMERA_VARIANT_LABELS } from '../../hooks/useCameraSwitch'
import { FLASH_MODE_OPTIONS, FLASH_LED_OPTIONS, type ProjectFlashMode, type ProjectFlashLed } from '../../utils/projectFlash'
// The Save BMP switch that used to sit under pictures per trigger, retired
// 21 September 2026; see the commented-out block in the Pictures card.
//   import { TEST_BIT_SAVE_BMP } from '../../hooks/useDeviceSettings'
import { useExtendedTheme } from '../../theme'

/** The AI model dropdown's "None" entry; WWSelect ignores an empty value. */
const NO_MODEL = '__none__'

export const DevDeploymentTestScreen = () => {
    const { colors, spacing } = useExtendedTheme()
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
    const route = useRoute<AppParams<'DevDeploymentTestScreen'>>()
    const { deviceId, bleDeviceId } = route.params

    const {
        bleDevice, device,
        project, availableProjects, handleProjectChange,
        notes, setNotes,
        locationName, setLocationName,
        cameraHeight, setCameraHeight,
        captureMethodOverride, setCaptureMethodOverride,
        timelapseIntervalText, setTimelapseIntervalText, timelapseInterval,
        motionSensitivityOverride, setMotionSensitivityOverride,
        aiModelIdOverride, setAiModelIdOverride,
        lorawanOverride, setLorawanOverride,
        recordGpsOverride, setRecordGpsOverride,
        captureMethodOptions, sensitivityOptions, aiModelOptions,
        flashMode, setFlashMode,
        flashLed, setFlashLed,
        flashWindowStart, setFlashWindowStart,
        flashWindowMinutes, setFlashWindowMinutes,
        ledBrightnessText, setLedBrightnessText, ledBrightness,
        numPicturesText, setNumPicturesText, numPictures,
        //   testModeBits, setTestModeBits,
        cameraChoice, setCameraChoice, activeCamera, cameraBusy, cameraStage,
        batteryLevel, sdCardStatus,
        handleBatteryCheck, handleSdCardCheck,
        isCheckingBattery, isCheckingSdCard,
        healthIssues, isCheckingHealth, recheckHealth, sdCardMissing,
        activeDeployment, handleEndActiveDeployment, isEndingDeployment, dialogMode,
        submitting, deploymentStartTime,
        handleStartDeployment,
        isMonitoring, handleMonitorDisconnect, handleStopMonitoring, isStoppingMonitoring,
        isFinishing, finishProgress, finishStep, finishLogs,
        isStartSuccess, handleFinishDismiss,
    } = useDevDeployment({ deviceId, bleDeviceId, navigation })

    // Title
    useEffect(() => {
        const deviceName = device?.name || bleDevice?.name || 'Device'
        navigation.setOptions({
            title: isMonitoring ? `${deviceName} - Monitoring` : `Dev Deploy: ${deviceName}`
        })
    }, [device?.name, bleDevice?.name, navigation, isMonitoring])

    // Back button override when monitoring
    const headerLeft = useCallback(() => (
        <IconButton icon="arrow-left" onPress={handleMonitorDisconnect} />
    ), [handleMonitorDisconnect])

    useEffect(() => {
        navigation.setOptions({
            headerLeft: isMonitoring ? headerLeft : undefined,
        })
    }, [isMonitoring, navigation, headerLeft])

    // --- Monitoring view ---
    if (isMonitoring) {
        return (
            <>
                <DeploymentMonitorView
                    device={bleDevice as any}
                    captureMethodId={captureMethodOverride}
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

    // --- Sanity check ---
    if (!deviceId) {
        return (
            <WWScreenView>
                <View style={styles.errorContainer}>
                    <Text variant="headlineMedium">Error</Text>
                    <Text variant="bodyLarge">Missing Device ID.</Text>
                    <Button mode="contained" onPress={() => navigation.goBack()}>
                        <Text>Go Back</Text>
                    </Button>
                </View>
            </WWScreenView>
        )
    }

    const isConnected = !!bleDevice?.connected

    // The pipeline reads the method by id: 1 activity, 2 timelapse, 3 mixed.
    const showSensitivity = captureMethodOverride === 1 || captureMethodOverride === 3
    const showTimelapseInterval = captureMethodOverride === 2 || captureMethodOverride === 3

    // What the Camera card says under its control.
    const cameraNote = cameraBusy
        ? (cameraStage || 'Checking cameras…')
        : activeCamera === 'unknown'
            ? 'Reading which camera the device is running…'
            : cameraChoice && cameraChoice !== activeCamera
                ? `Running ${CAMERA_VARIANT_LABELS[activeCamera]}. Start switches to ${CAMERA_VARIANT_LABELS[cameraChoice]} first, about 30 seconds.`
                : `Running ${CAMERA_VARIANT_LABELS[activeCamera]}.`

    return (
        <WWScreenView style={styles.screenView}>
            <ScrollView contentContainerStyle={[styles.content, { gap: spacing }]} keyboardShouldPersistTaps="handled">

                {/* Connection status banner */}
                <WWBleDisconnectedBanner connected={isConnected} dfuInProgress={!!bleDevice?.dfuInProgress} />

                {/* Hardware health from the self-test broadcast. A missing SD
                    card also disables Start below (#303). */}
                <DeviceHealthBanner issues={healthIssues} onRecheck={() => { recheckHealth() }} isChecking={isCheckingHealth} />

                {/* One deployment per device: while the database holds an
                    active one for this device, Start stays off and the way
                    out is to end it, here, with the link kept. */}
                {activeDeployment && (
                    <Card style={[styles.card, { backgroundColor: colors.errorContainer }]}>
                        <Card.Title
                            title="Already deployed"
                            titleStyle={{ color: colors.onErrorContainer }}
                            subtitle={`${activeDeployment.locationName || activeDeployment.name || 'Unknown site'}${activeDeployment.deploymentStart ? `, since ${new Date(activeDeployment.deploymentStart).toLocaleString()}` : ''}`}
                            subtitleStyle={{ color: colors.onErrorContainer }}
                            subtitleNumberOfLines={2}
                        />
                        <Card.Content style={styles.cardContent}>
                            <Text style={{ color: colors.onErrorContainer }}>
                                A device carries one deployment at a time. End this one before starting another.
                            </Text>
                            <Button
                                mode="contained"
                                buttonColor={colors.error}
                                textColor={colors.onError}
                                onPress={handleEndActiveDeployment}
                                loading={isEndingDeployment}
                                disabled={isEndingDeployment || submitting || !isConnected}
                            >
                                {isEndingDeployment ? 'Ending…' : isConnected ? 'End deployment' : 'Connect to end it'}
                            </Button>
                        </Card.Content>
                    </Card>
                )}

                {/* ═══════════════════════════════════════ */}
                {/* 1. PROJECT SETTINGS */}
                {/* ═══════════════════════════════════════ */}
                <Card style={styles.card}>
                    <Card.Title title="Project Settings" />
                    <Card.Content style={styles.cardContent}>
                        <WWSelect
                            label="Project"
                            value={project?.id || ''}
                            options={availableProjects.map(p => ({ label: p.name, value: p.id }))}
                            onChange={handleProjectChange}
                            disabled={submitting}
                        />

                        <View style={styles.spacer} />

                        {/* The project form's capture method fields, with the
                            same reference data, so what is tried here is what
                            the project can be set to. */}
                        <WWSelect
                            label="Capture Method"
                            value={captureMethodOverride?.toString() || ''}
                            options={captureMethodOptions.map(m => ({ label: m.value, value: m.id.toString() }))}
                            onChange={(val) => setCaptureMethodOverride(parseInt(val, 10))}
                            disabled={submitting}
                        />

                        {showSensitivity && (
                            <View style={styles.spacer}>
                                {sensitivityOptions.length > 0 ? (
                                    <WWSelect
                                        label="Motion Sensitivity"
                                        value={motionSensitivityOverride?.toString() || ''}
                                        options={sensitivityOptions.map(s => ({ label: s.value, value: s.id.toString() }))}
                                        onChange={(val) => setMotionSensitivityOverride(parseInt(val, 10))}
                                        disabled={submitting}
                                    />
                                ) : (
                                    <Text variant="bodySmall" style={styles.hint}>Loading sensitivities…</Text>
                                )}
                            </View>
                        )}

                        {showTimelapseInterval && (
                            <View style={styles.spacer}>
                                <TextInput
                                    label="Time-lapse Interval (seconds)"
                                    value={timelapseIntervalText}
                                    onChangeText={(t) => setTimelapseIntervalText(t.replace(/[^0-9]/g, ''))}
                                    onBlur={() => setTimelapseIntervalText(String(timelapseInterval))}
                                    mode="outlined"
                                    keyboardType="numeric"
                                    disabled={submitting}
                                />
                            </View>
                        )}

                        {/* Feature summary */}
                        <Divider style={styles.divider} />
                        <View style={styles.featureRow}>
                            {project?.lorawan_required && (
                                <View style={styles.featureChip}>
                                    <WWIcon source="access-point" size={18} color={colors.onSurfaceVariant} />
                                    <Text variant="labelSmall">LoRaWAN</Text>
                                </View>
                            )}
                            {project?.record_gps_in_images && (
                                <View style={styles.featureChip}>
                                    <WWIcon source="satellite-variant" size={18} color={colors.onSurfaceVariant} />
                                    <Text variant="labelSmall">GPS</Text>
                                </View>
                            )}
                            {project?.model_id && (
                                <View style={styles.featureChip}>
                                    <WWIcon source="brain" size={18} color={colors.onSurfaceVariant} />
                                    <Text variant="labelSmall">AI Model</Text>
                                </View>
                            )}
                        </View>
                    </Card.Content>
                </Card>

                {/* ═══════════════════════════════════════ */}
                {/* 1b. AI & CONNECTIVITY SETTINGS */}
                {/* ═══════════════════════════════════════ */}
                <Card style={styles.card}>
                    <Card.Title title="AI & Connectivity" />
                    <Card.Content style={styles.cardContent}>
                        <WWText variant="labelLarge">AI Model</WWText>
                        {/* "None" is a sentinel, the same as the project form:
                            WWSelect drops an empty value, so an empty string
                            could never be chosen. */}
                        <WWSelect
                            label="Model"
                            value={aiModelIdOverride || NO_MODEL}
                            options={[
                                { label: 'None (no AI)', value: NO_MODEL },
                                ...aiModelOptions.map(m => ({
                                    label: `${m.name} (${m.version})`,
                                    value: m.id,
                                })),
                            ]}
                            onChange={(val) => setAiModelIdOverride(val === NO_MODEL ? null : val)}
                            disabled={submitting}
                        />

                        <Divider style={styles.divider} />

                        <View style={styles.switchRow}>
                            <View style={styles.switchLabel}>
                                <WWIcon source="access-point" size={20} color={colors.onSurfaceVariant} />
                                <WWText variant="bodyMedium" style={styles.switchText}>LoRaWAN Required</WWText>
                            </View>
                            <Switch
                                value={lorawanOverride}
                                onValueChange={setLorawanOverride}
                                disabled={submitting}
                            />
                        </View>

                        <View style={styles.switchRow}>
                            <View style={styles.switchLabel}>
                                <WWIcon source="satellite-variant" size={20} color={colors.onSurfaceVariant} />
                                <WWText variant="bodyMedium" style={styles.switchText}>Record GPS in Images</WWText>
                            </View>
                            <Switch
                                value={recordGpsOverride}
                                onValueChange={setRecordGpsOverride}
                                disabled={submitting}
                            />
                        </View>
                    </Card.Content>
                </Card>

                {/* ═══════════════════════════════════════ */}
                {/* 2. CAMERA */}
                {/* ═══════════════════════════════════════ */}
                {/* One firmware slot per camera. The switch happens at Start,
                    as the first step, so the control only records the choice
                    here (#301). Labelled by the picture, not the sensor, the
                    same as everywhere else. */}
                <Card style={styles.card}>
                    <Card.Title title="Camera" subtitle="Switched at Start when it is not the one running" />
                    <Card.Content style={styles.cardContent}>
                        <SegmentedButtons
                            value={cameraChoice ?? ''}
                            onValueChange={(v) => setCameraChoice(v as DeployableCamera)}
                            buttons={[
                                { value: 'RP3', label: CAMERA_VARIANT_LABELS.RP3, disabled: submitting || cameraBusy },
                                { value: 'HM0360', label: CAMERA_VARIANT_LABELS.HM0360, disabled: submitting || cameraBusy },
                            ]}
                            style={styles.segmented}
                        />
                        <Text variant="bodySmall" style={styles.hint}>{cameraNote}</Text>
                    </Card.Content>
                </Card>

                {/* ═══════════════════════════════════════ */}
                {/* 3. CAPTURE FLASH */}
                {/* ═══════════════════════════════════════ */}
                {/* The project form's Capture Flash card, same choices, same
                    columns (op34, op13, and op35/op36 for the window), plus
                    the brightness (op9) that has no project column. */}
                <Card style={styles.card}>
                    <Card.Title title="Capture Flash" />
                    <Card.Content style={styles.cardContent}>
                        <WWSelect
                            label="Flash Mode"
                            value={flashMode}
                            options={FLASH_MODE_OPTIONS}
                            onChange={(val) => setFlashMode(val as ProjectFlashMode)}
                            disabled={submitting}
                        />

                        {flashMode !== 'off' && (
                            <WWSelect
                                label="Flash LED"
                                value={flashLed}
                                options={FLASH_LED_OPTIONS}
                                onChange={(val) => setFlashLed(val as ProjectFlashLed)}
                                disabled={submitting}
                            />
                        )}

                        {flashMode === 'time_of_day' && (
                            <>
                                <WWTextInput
                                    label="Window starts (UTC, HH:MM)"
                                    value={flashWindowStart}
                                    onChange={setFlashWindowStart}
                                    mode="outlined"
                                    placeholder="e.g., 18:00"
                                    disabled={submitting}
                                />
                                <WWTextInput
                                    label="Window length (minutes)"
                                    value={flashWindowMinutes}
                                    onChange={setFlashWindowMinutes}
                                    mode="outlined"
                                    keyboardType="numeric"
                                    placeholder="e.g., 720"
                                    disabled={submitting}
                                />
                                <Text variant="bodySmall" style={styles.hint}>
                                    The camera runs on UTC, so this window is in UTC too. It may wrap past midnight.
                                </Text>
                            </>
                        )}

                        {/* op9, written to the device only: it has no project
                            column, so a real deployment uses the factory value. */}
                        {flashMode !== 'off' && (
                            <TextInput
                                label="LED Brightness (0-100%)"
                                value={ledBrightnessText}
                                onChangeText={(t) => setLedBrightnessText(t.replace(/[^0-9]/g, ''))}
                                onBlur={() => setLedBrightnessText(String(ledBrightness))}
                                mode="outlined"
                                keyboardType="numeric"
                                disabled={submitting}
                            />
                        )}
                    </Card.Content>
                </Card>

                {/* ═══════════════════════════════════════ */}
                {/* 4. PICTURES PER TRIGGER */}
                {/* ═══════════════════════════════════════ */}
                <Card style={styles.card}>
                    <Card.Title title="Pictures per Trigger" />
                    <Card.Content style={styles.cardContent}>
                        {/* Text as typed, so the field can be emptied and
                            retyped; the number is clamped in the hook and the
                            field is put back to it on blur. */}
                        <TextInput
                            label="Pictures per trigger"
                            value={numPicturesText}
                            onChangeText={(t) => setNumPicturesText(t.replace(/[^0-9]/g, ''))}
                            onBlur={() => setNumPicturesText(String(numPictures))}
                            mode="outlined"
                            keyboardType="numeric"
                            disabled={submitting}
                        />

                        {/* Save BMP (alternating JPG/BMP), TEST_MODE_BITS bit 1.
                            Retired 21 September 2026 (Victor): a quality trial
                            nobody compared any more, at two pictures per trigger.
                            Kept as a comment, with its hook state, until it is
                            certain nothing wants it back.

                        <View style={styles.spacer} />

                        <View style={styles.switchRow}>
                            <View style={styles.switchLabel}>
                                <WWIcon source="image-multiple" size={20} color={colors.onSurfaceVariant} />
                                <WWText variant="bodyMedium" style={styles.switchText}>
                                    Save BMP (alternating JPG/BMP)
                                </WWText>
                            </View>
                            <Switch
                                value={(testModeBits & TEST_BIT_SAVE_BMP) !== 0}
                                onValueChange={(enabled) => {
                                    // eslint-disable-next-line no-bitwise
                                    setTestModeBits((prev: number) => enabled ? (prev | TEST_BIT_SAVE_BMP) : (prev & ~TEST_BIT_SAVE_BMP))
                                    if (enabled && numPictures % 2 !== 0) {
                                        setNumPicturesText(String(numPictures + 1))
                                    }
                                }}
                                disabled={submitting}
                            />
                        </View>
                        */}
                    </Card.Content>
                </Card>

                {/* ═══════════════════════════════════════ */}
                {/* 5. LOCATION */}
                {/* ═══════════════════════════════════════ */}
                <Card style={styles.card}>
                    <Card.Title title="Location" />
                    <Card.Content style={styles.cardContent}>
                        <TextInput
                            label="Site Name"
                            value={locationName}
                            onChangeText={setLocationName}
                            mode="outlined"
                            placeholder="e.g. South Ridge Camera 1"
                        />

                        <View style={styles.spacer} />

                        <TextInput
                            label="Camera Height (cm)"
                            value={cameraHeight}
                            onChangeText={(t) => { if (/^\d*$/.test(t)) setCameraHeight(t) }}
                            mode="outlined"
                            keyboardType="numeric"
                            placeholder="e.g. 50"
                        />
                    </Card.Content>
                </Card>

                {/* ═══════════════════════════════════════ */}
                {/* 6. DEVICE HEALTH */}
                {/* ═══════════════════════════════════════ */}
                <Card style={styles.card}>
                    <Card.Title title="Device Health" />
                    <Card.Content style={styles.cardContent}>
                        {/* No help buttons here: on this screen they opened nothing. */}
                        <BatteryLevelCard
                            batteryLevel={batteryLevel}
                            handleBatteryCheck={handleBatteryCheck}
                            isInitializing={false}
                            bleDeviceConnected={isConnected}
                            isChecking={isCheckingBattery}
                            styles={healthStyles}
                        />
                        <Divider style={styles.divider} />
                        <SdCardStatusCard
                            sdCardStatus={sdCardStatus}
                            handleSdCardCheck={handleSdCardCheck}
                            isInitializing={false}
                            bleDeviceConnected={isConnected}
                            isChecking={isCheckingSdCard}
                            styles={healthStyles}
                        />
                    </Card.Content>
                </Card>

                {/* ═══════════════════════════════════════ */}
                {/* 7. NOTES */}
                {/* ═══════════════════════════════════════ */}
                <Card style={styles.card}>
                    <Card.Title title="Notes" />
                    <Card.Content>
                        <TextInput
                            label="Deployment Notes"
                            value={notes}
                            onChangeText={setNotes}
                            mode="outlined"
                            multiline
                            numberOfLines={3}
                            textAlignVertical="top"
                            style={styles.textArea}
                        />
                    </Card.Content>
                </Card>

                {/* ═══════════════════════════════════════ */}
                {/* FOOTER */}
                {/* ═══════════════════════════════════════ */}
                <View style={styles.footer}>
                    <WWButton
                        mode="contained"
                        onPress={handleStartDeployment}
                        loading={submitting}
                        disabled={!isConnected || submitting || !project || sdCardMissing || !!activeDeployment}
                        style={[styles.startButton, { backgroundColor: isConnected && project && !sdCardMissing && !activeDeployment ? '#4CAF50' : undefined }]}
                    >
                        <Text style={{ color: 'white' }}>
                            {activeDeployment ? 'Already deployed' : sdCardMissing ? 'No SD card' : 'Start Dev Deployment'}
                        </Text>
                    </WWButton>
                </View>

            </ScrollView>

            <FinishProgressDialog
                visible={isFinishing}
                progress={finishProgress}
                step={finishStep}
                logs={finishLogs}
                isComplete={isStartSuccess}
                onDismiss={handleFinishDismiss}
                loadingTitle={dialogMode === 'end' ? 'Ending Deployment' : 'Starting Dev Deployment'}
                successTitle={dialogMode === 'end' ? 'Deployment Ended' : 'Dev Deployment Started'}
                hideOkButton={true}
            />
        </WWScreenView>
    )
}

const styles = StyleSheet.create({
    screenView: {
        paddingTop: 0,
    },
    content: {
        paddingHorizontal: 16,
        paddingBottom: 32,
    },
    card: {
        marginTop: 8,
    },
    cardContent: {
        gap: 8,
    },
    segmented: {
        marginTop: 8,
    },
    spacer: {
        marginTop: 12,
    },
    divider: {
        marginVertical: 12,
    },
    hint: {
        opacity: 0.6,
        marginTop: 4,
    },
    // Three lines of notes. numberOfLines alone sets nothing on the outlined
    // input; the same minimum as the other notes fields.
    textArea: {
        minHeight: 100,
    },
    featureRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
        justifyContent: 'center',
    },
    featureChip: {
        alignItems: 'center',
        gap: 4,
    },
    banner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
    },
    footer: {
        marginTop: 24,
        marginBottom: 32,
    },
    startButton: {
        paddingVertical: 8,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
        gap: 16,
    },
    switchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },
    switchLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    switchText: {
        flex: 1,
    },
})

const healthStyles = StyleSheet.create({
    card: {
        width: '100%',
        boxShadow: "none",
    },
    content: {
        gap: 8,
    },
    statusDisplay: {
        gap: 4,
        marginTop: 8,
    },
    statusHint: {
        opacity: 0.6,
        marginTop: 4,
        fontSize: 12,
    },
    actionButton: {
        marginTop: 8,
    },
})
