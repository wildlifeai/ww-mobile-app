import React, { useState, useCallback } from 'react'
import { View, StyleSheet } from 'react-native'
import { Text, IconButton, ActivityIndicator, useTheme, List, Card, Button } from 'react-native-paper'
import { Control, Controller } from 'react-hook-form'
import { WWSelect } from '../../../components/ui/WWSelect'
import { WWTextInput } from '../../../components/ui/WWTextInput'
import { WWCheckbox } from '../../../components/ui/WWCheckbox'
import { logError } from '../../../utils/logger'
import { ProjectSettingsHelpDialogs } from './ProjectSettingsHelpDialogs'
import { FLASH_MODE_LABELS, FLASH_LED_LABELS_BY_COLUMN } from '../../../utils/projectFlash'

interface ProjectFormData {
    name: string
    description: string
    sampling_design_id: string
    website: string
    is_baited: boolean
    is_monitoring_marked_individuals: boolean
    capture_method_id: string
    activity_detection_sensitivity_id: string
    timelapse_interval_seconds: string
    model_id: string
    record_gps_in_images: boolean
    lorawan_required: boolean
    is_archived?: boolean
    flash_mode: string
    flash_led: string
    flash_window_start_minutes_utc: string
    flash_window_minutes: string
}

/**
 * The capture flash the project deploys, written to the camera as op34 and
 * op13 at every deployment (#282).
 *
 * "Light sensor" is offered but not recommended while the firmware's AE light
 * check is still being worked on (5 September 2026): it is the one mode whose
 * behaviour depends on that check. Nothing in the app defaults to it.
 */
const FLASH_MODE_OPTIONS: SelectOption[] = [
    { label: FLASH_MODE_LABELS.off, value: 'off' },
    { label: FLASH_MODE_LABELS.always_on, value: 'always_on' },
    { label: FLASH_MODE_LABELS.time_of_day, value: 'time_of_day' },
    { label: `${FLASH_MODE_LABELS.light_sensor} (in development)`, value: 'light_sensor' },
]

const FLASH_LED_OPTIONS: SelectOption[] = [
    { label: `${FLASH_LED_LABELS_BY_COLUMN.ir} (invisible to wildlife)`, value: 'ir' },
    { label: FLASH_LED_LABELS_BY_COLUMN.white, value: 'white' },
]

interface SelectOption {
    label: string
    value: string
}

interface Props {
    control: Control<ProjectFormData>
    samplingDesignOptions: SelectOption[]
    captureMethodOptions: SelectOption[]
    sensitivityOptions: SelectOption[]
    aiModelOptions: SelectOption[]
    isMotionDetection: boolean
    isTimeLapse: boolean
    isLoadingModels: boolean
    modelsError: any
    showArchiveToggle?: boolean
    /** The flash mode currently chosen, so the LED and window fields can follow it */
    flashMode: string
}

export const NewProjectSettingsSection: React.FC<Props> = ({
    control,
    samplingDesignOptions,
    captureMethodOptions,
    sensitivityOptions,
    aiModelOptions,
    isMotionDetection,
    isTimeLapse,
    isLoadingModels,
    modelsError,
    showArchiveToggle = false,
    flashMode
}) => {
    const theme = useTheme()
    const [samplingHelpVisible, setSamplingHelpVisible] = useState(false)
    const [captureHelpVisible, setCaptureHelpVisible] = useState(false)
    const [gpsHelpVisible, setGpsHelpVisible] = useState(false)
    const [flashHelpVisible, setFlashHelpVisible] = useState(false)
    const [expanded, setExpanded] = useState(false)

    // Card title render helpers: matching StartDeployment pattern
    const renderCaptureHelp = useCallback((props: any) => (
        <Button
            {...props}
            icon="help-circle-outline"
            onPress={() => setCaptureHelpVisible(true)}
        >
            <Text>Help</Text>
        </Button>
    ), [])

    const renderFlashHelp = useCallback((props: any) => (
        <Button
            {...props}
            icon="help-circle-outline"
            onPress={() => setFlashHelpVisible(true)}
        >
            <Text>Help</Text>
        </Button>
    ), [])

    const renderRightIcon = useCallback(
        (props: any) => <List.Icon {...props} icon={expanded ? "chevron-up" : "chevron-down"} />,
        [expanded]
    )

    return (
        <View style={styles.section}>
            {/* Capture Method Card */}
            <Card>
                <Card.Title
                    title="Capture Method"
                    right={renderCaptureHelp}
                />
                <Card.Content style={styles.cardContent}>
                    <Controller
                        control={control}
                        name="capture_method_id"
                        render={({ field: { value, onChange } }) => (
                            <WWSelect
                                value={value}
                                onChange={onChange}
                                options={captureMethodOptions}
                                label="Capture Method"
                            />
                        )}
                    />

                    {isMotionDetection && (
                        <Controller
                            control={control}
                            name="activity_detection_sensitivity_id"
                            render={({ field: { value, onChange } }) => (
                                <WWSelect
                                    value={value}
                                    onChange={onChange}
                                    options={sensitivityOptions}
                                    label="Motion Sensitivity"
                                />
                            )}
                        />
                    )}

                    {isTimeLapse && (
                        <Controller
                            control={control}
                            name="timelapse_interval_seconds"
                            render={({ field: { value, onChange, onBlur } }) => (
                                <WWTextInput
                                    value={value}
                                    onChange={onChange}
                                    onBlur={onBlur}
                                    mode="outlined"
                                    label="Time-lapse Interval (seconds)"
                                    keyboardType="numeric"
                                    placeholder="e.g., 60"
                                />
                            )}
                        />
                    )}
                </Card.Content>
            </Card>

            {/* Capture Flash Card. The camera writes these at every deployment;
                the mode also decides whether motion frames get IR light at night. */}
            <Card>
                <Card.Title
                    title="Capture Flash"
                    right={renderFlashHelp}
                />
                <Card.Content style={styles.cardContent}>
                    <Controller
                        control={control}
                        name="flash_mode"
                        render={({ field: { value, onChange } }) => (
                            <WWSelect
                                value={value || 'off'}
                                onChange={onChange}
                                options={FLASH_MODE_OPTIONS}
                                label="Flash Mode"
                                testID="flash-mode-select"
                            />
                        )}
                    />

                    {flashMode !== 'off' && (
                        <Controller
                            control={control}
                            name="flash_led"
                            render={({ field: { value, onChange } }) => (
                                <WWSelect
                                    value={value || 'ir'}
                                    onChange={onChange}
                                    options={FLASH_LED_OPTIONS}
                                    label="Flash LED"
                                    testID="flash-led-select"
                                />
                            )}
                        />
                    )}

                    {flashMode === 'time_of_day' && (
                        <>
                            <Controller
                                control={control}
                                name="flash_window_start_minutes_utc"
                                render={({ field: { value, onChange, onBlur } }) => (
                                    <WWTextInput
                                        value={value}
                                        onChange={onChange}
                                        onBlur={onBlur}
                                        mode="outlined"
                                        label="Window starts (UTC, HH:MM)"
                                        placeholder="e.g., 18:00"
                                    />
                                )}
                            />
                            <Controller
                                control={control}
                                name="flash_window_minutes"
                                render={({ field: { value, onChange, onBlur } }) => (
                                    <WWTextInput
                                        value={value}
                                        onChange={onChange}
                                        onBlur={onBlur}
                                        mode="outlined"
                                        label="Window length (minutes)"
                                        keyboardType="numeric"
                                        placeholder="e.g., 720"
                                    />
                                )}
                            />
                            <Text variant="bodySmall" style={styles.hint}>
                                The camera runs on UTC, so this window is in UTC too. It may wrap past midnight.
                            </Text>
                        </>
                    )}
                </Card.Content>
            </Card>

            {/* Advanced Project Settings Accordion */}
            <List.Item
                title="Advanced Project Settings"
                right={renderRightIcon}
                onPress={() => setExpanded(!expanded)}
                style={styles.accordionHeader}
            />
            {expanded && (
                <Card>
                    <Card.Content style={styles.cardContent}>
                        <View style={styles.fieldRow}>
                            <View style={styles.flex1}>
                                <Controller
                                    control={control}
                                    name="sampling_design_id"
                                    render={({ field: { value, onChange } }) => (
                                        <WWSelect
                                            value={value}
                                            onChange={onChange}
                                            options={samplingDesignOptions}
                                            label="Sampling Design"
                                        />
                                    )}
                                />
                            </View>
                            <IconButton
                                icon="help-circle-outline"
                                size={24}
                                onPress={() => setSamplingHelpVisible(true)}
                                style={styles.helpIcon}
                                iconColor={theme.colors.primary}
                            />
                        </View>

                        <Controller
                            control={control}
                            name="model_id"
                            render={({ field: { value, onChange } }) => {
                                if (isLoadingModels) {
                                    return (
                                        <View testID="ai-model-select-loading">
                                            <ActivityIndicator testID="ai-model-select-loading-placeholder" />
                                            <Text>Loading AI models…</Text>
                                        </View>
                                    )
                                }
                                if (modelsError) {
                                    logError("Failed to load AI models:", modelsError)
                                    return (
                                        <View testID="ai-model-select-error">
                                            <Text>Error loading AI models.</Text>
                                        </View>
                                    )
                                }
                                // Prepend "None" option; use sentinel value since WWSelect ignores empty strings
                                const optionsWithNone = [
                                    { label: 'None (no AI identification)', value: '__none__' },
                                    ...aiModelOptions,
                                ]
                                return (
                                    <WWSelect
                                        value={value || '__none__'}
                                        onChange={(v: string) => onChange(v === '__none__' ? '' : v)}
                                        testID="ai-model-select-dropdown"
                                        options={optionsWithNone}
                                        label="Default AI Model"
                                    />
                                )
                            }}
                        />

                        {/* Checkboxes */}
                        <Controller
                            control={control}
                            name="is_baited"
                            render={({ field: { value, onChange } }) => (
                                <WWCheckbox
                                    label="Using Bait"
                                    value={value}
                                    onChange={onChange}
                                    testID="is-baited-checkbox"
                                />
                            )}
                        />

                        <Controller
                            control={control}
                            name="is_monitoring_marked_individuals"
                            render={({ field: { value, onChange } }) => (
                                <WWCheckbox
                                    label="Monitoring Marked Individuals"
                                    value={value}
                                    onChange={onChange}
                                    testID="is-monitoring-marked-checkbox"
                                />
                            )}
                        />

                        <View style={styles.relativeContainer}>
                            <Controller
                                control={control}
                                name="record_gps_in_images"
                                render={({ field: { value, onChange } }) => (
                                    <WWCheckbox
                                        label="Record GPS locations in images"
                                        value={value}
                                        onChange={onChange}
                                        testID="record-gps-checkbox"
                                    />
                                )}
                            />
                            <IconButton
                                icon="help-circle-outline"
                                size={24}
                                onPress={() => setGpsHelpVisible(true)}
                                style={[styles.helpIcon, styles.absoluteHelpIcon]}
                                iconColor={theme.colors.primary}
                            />
                        </View>

                        <Controller
                            control={control}
                            name="lorawan_required"
                            render={({ field: { value, onChange } }) => (
                                <WWCheckbox
                                    label="LoRaWAN Required"
                                    value={value}
                                    onChange={onChange}
                                    testID="lorawan-required-checkbox"
                                />
                            )}
                        />

                        {showArchiveToggle && (
                            <Controller
                                control={control}
                                name="is_archived"
                                render={({ field: { value, onChange } }) => (
                                    <WWCheckbox
                                        label="Archive project"
                                        value={value}
                                        onChange={onChange}
                                        testID="is-archived-checkbox"
                                    />
                                )}
                            />
                        )}
                    </Card.Content>
                </Card>
            )}

            {/* Help Dialogs */}
            <ProjectSettingsHelpDialogs
                samplingHelpVisible={samplingHelpVisible}
                setSamplingHelpVisible={setSamplingHelpVisible}
                captureHelpVisible={captureHelpVisible}
                setCaptureHelpVisible={setCaptureHelpVisible}
                gpsHelpVisible={gpsHelpVisible}
                setGpsHelpVisible={setGpsHelpVisible}
                flashHelpVisible={flashHelpVisible}
                setFlashHelpVisible={setFlashHelpVisible}
            />
        </View>
    )
}

const styles = StyleSheet.create({
    hint: {
        opacity: 0.7,
        marginTop: 4,
    },
    section: {
        gap: 16,
    },
    cardContent: {
        gap: 12,
    },
    fieldRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 8,
    },
    flex1: {
        flex: 1,
    },
    helpIcon: {
        margin: 0,
        marginTop: 8,
    },
    accordionHeader: {
        backgroundColor: "transparent",
        paddingHorizontal: 0,
    },
    relativeContainer: {
        position: 'relative'
    },
    absoluteHelpIcon: {
        position: 'absolute',
        right: 0,
        top: 4,
        zIndex: 1
    }
})
