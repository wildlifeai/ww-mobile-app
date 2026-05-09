/**
 * DevDeploymentTestScreen
 *
 * Developer-only screen for testing monitoring with full parameter control.
 * Accessible from Engineer Console → Flows → "Dev Deployment Test".
 *
 * All settings are visible on a single scrollable page (no accordion).
 * Includes flash controls (Off/Visible/IR + brightness) from CameraSettingsTestSection.
 * Project settings changes persist to the database.
 *
 * Uses the existing end-monitoring flow (same as production).
 */

import { useEffect, useCallback } from 'react'
import { View, StyleSheet, ScrollView, Switch } from 'react-native'
import {
    Card, Text, Button, SegmentedButtons, Surface, Divider,
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
import { RootStackParamList, AppParams } from '../../navigation/types'
import { DeploymentMonitorView } from '../Deployments/components/DeploymentMonitorView'
import { FinishProgressDialog } from './components/FinishProgressDialog'
import { BatteryLevelCard } from '../Deployments/components/BatteryLevelCard'
import { SdCardStatusCard } from '../Deployments/components/SdCardStatusCard'
import { useDevDeployment } from './hooks/useDevDeployment'
import { useExtendedTheme } from '../../theme'

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
        timelapseIntervalOverride, setTimelapseIntervalOverride,
        motionSensitivityOverride, setMotionSensitivityOverride,
        aiModelIdOverride, setAiModelIdOverride,
        lorawanOverride, setLorawanOverride,
        recordGpsOverride, setRecordGpsOverride,
        sensitivityOptions, aiModelOptions,
        flashParams, setFlashParams,
        batteryLevel, sdCardStatus,
        handleBatteryCheck, handleSdCardCheck,
        submitting,
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

    // --- Battery/SD help renderers ---
    const renderBatteryHelp = useCallback((props: any) => (
        <Button {...props} icon="help-circle-outline" onPress={() => {}}>
            <Text>Check</Text>
        </Button>
    ), [])

    const renderSdCardHelp = useCallback((props: any) => (
        <Button {...props} icon="help-circle-outline" onPress={() => {}}>
            <Text>Check</Text>
        </Button>
    ), [])

    // --- Monitoring view ---
    if (isMonitoring) {
        return (
            <>
                <DeploymentMonitorView
                    device={bleDevice as any}
                    captureMethodId={captureMethodOverride}
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

    return (
        <WWScreenView style={styles.screenView}>
            <ScrollView contentContainerStyle={[styles.content, { gap: spacing }]} keyboardShouldPersistTaps="handled">

                {/* Connection status banner */}
                {!isConnected && (
                    <Surface style={[styles.banner, { backgroundColor: '#FFF3E0' }]} elevation={0}>
                        <WWIcon source="bluetooth-off" size={20} color="#E65100" />
                        <Text variant="bodyMedium" style={{ color: '#E65100', flex: 1, marginLeft: 8 }}>
                            Device not connected. Connect from the Engineer Console first.
                        </Text>
                    </Surface>
                )}

                {/* ═══════════════════════════════════════ */}
                {/* 1. PROJECT SETTINGS */}
                {/* ═══════════════════════════════════════ */}
                <Card style={styles.card}>
                    <Card.Title title="Project Settings" subtitle="Changes persist to project DB" />
                    <Card.Content style={styles.cardContent}>
                        <WWSelect
                            label="Project"
                            value={project?.id || ''}
                            options={availableProjects.map(p => ({ label: p.name, value: p.id }))}
                            onChange={handleProjectChange}
                            disabled={submitting}
                        />

                        <View style={styles.spacer} />

                        <WWText variant="labelLarge">Capture Method</WWText>
                        <SegmentedButtons
                            value={captureMethodOverride?.toString() || '1'}
                            onValueChange={(val) => setCaptureMethodOverride(parseInt(val, 10))}
                            buttons={[
                                { value: '1', label: 'Activity' },
                                { value: '2', label: 'Timelapse' },
                                { value: '3', label: 'Mixed' },
                            ]}
                            style={styles.segmented}
                        />

                        {(captureMethodOverride === 2 || captureMethodOverride === 3) && (
                            <View style={styles.spacer}>
                                <TextInput
                                    label="Timelapse Interval (seconds)"
                                    value={timelapseIntervalOverride?.toString() || '300'}
                                    onChangeText={(t) => {
                                        const v = parseInt(t.replace(/[^0-9]/g, ''), 10)
                                        setTimelapseIntervalOverride(isNaN(v) ? 0 : v)
                                    }}
                                    mode="outlined"
                                    keyboardType="numeric"
                                />
                            </View>
                        )}

                        {(captureMethodOverride === 1 || captureMethodOverride === 3) && (
                            <View style={styles.spacer}>
                                <WWText variant="labelLarge">Motion Sensitivity</WWText>
                                {sensitivityOptions.length > 0 ? (
                                    <SegmentedButtons
                                        value={motionSensitivityOverride?.toString() || ''}
                                        onValueChange={(val) => setMotionSensitivityOverride(parseInt(val, 10))}
                                        buttons={sensitivityOptions.map(s => ({
                                            value: s.id.toString(),
                                            label: s.value,
                                        }))}
                                        style={styles.segmented}
                                    />
                                ) : (
                                    <Text variant="bodySmall" style={{ opacity: 0.6 }}>Loading sensitivities…</Text>
                                )}
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
                    <Card.Title title="AI & Connectivity" subtitle="Model selection and network options" />
                    <Card.Content style={styles.cardContent}>
                        <WWText variant="labelLarge">AI Model</WWText>
                        <WWSelect
                            label="Model"
                            value={aiModelIdOverride || ''}
                            options={[
                                { label: 'None (no AI)', value: '' },
                                ...aiModelOptions.map(m => ({
                                    label: `${m.name} (${m.version})`,
                                    value: m.id,
                                })),
                            ]}
                            onChange={(val) => setAiModelIdOverride(val || null)}
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
                {/* 2. FLASH SETTINGS */}
                {/* ═══════════════════════════════════════ */}
                <Card style={styles.card}>
                    <Card.Title title="Flash Settings" subtitle="Op 13 (LED type) + Op 9 (brightness)" />
                    <Card.Content style={styles.cardContent}>
                        <WWText variant="labelLarge">Flash LED Type</WWText>
                        <SegmentedButtons
                            value={flashParams.flashLed.toString()}
                            onValueChange={(val) => setFlashParams(prev => ({ ...prev, flashLed: parseInt(val, 10) }))}
                            buttons={[
                                { value: '0', label: 'Off' },
                                { value: '1', label: 'White' },
                                { value: '2', label: 'IR' },
                            ]}
                            style={styles.segmented}
                        />

                        <View style={styles.spacer} />

                        <WWTextInput
                            label="LED Brightness (0-100%)"
                            value={flashParams.ledBrightness.toString()}
                            keyboardType="numeric"
                            disabled={submitting}
                            onChange={(t: string) => {
                                let v = parseInt(t.replace(/[^0-9]/g, ''), 10)
                                if (isNaN(v)) v = 0
                                if (v > 100) v = 100
                                setFlashParams(prev => ({ ...prev, ledBrightness: v }))
                            }}
                        />
                    </Card.Content>
                </Card>

                {/* ═══════════════════════════════════════ */}
                {/* 3. LOCATION & CAMERA */}
                {/* ═══════════════════════════════════════ */}
                <Card style={styles.card}>
                    <Card.Title title="Location & Camera" />
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
                {/* 4. DEVICE HEALTH */}
                {/* ═══════════════════════════════════════ */}
                <Card style={styles.card}>
                    <Card.Title title="Device Health" />
                    <Card.Content style={styles.cardContent}>
                        <BatteryLevelCard
                            batteryLevel={batteryLevel}
                            handleBatteryCheck={handleBatteryCheck}
                            isInitializing={false}
                            bleDeviceConnected={isConnected}
                            renderBatteryHelp={renderBatteryHelp}
                            styles={healthStyles}
                        />
                        <Divider style={styles.divider} />
                        <SdCardStatusCard
                            sdCardStatus={sdCardStatus}
                            handleSdCardCheck={handleSdCardCheck}
                            isInitializing={false}
                            bleDeviceConnected={isConnected}
                            renderSdCardHelp={renderSdCardHelp}
                            styles={healthStyles}
                        />
                    </Card.Content>
                </Card>

                {/* ═══════════════════════════════════════ */}
                {/* 5. NOTES */}
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
                        disabled={!isConnected || submitting || !project}
                        style={[styles.startButton, { backgroundColor: isConnected && project ? '#4CAF50' : undefined }]}
                    >
                        <Text style={{ color: 'white' }}>Start Dev Deployment</Text>
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
                loadingTitle="Starting Dev Deployment"
                successTitle="Dev Deployment Started"
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
        elevation: 0,
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
