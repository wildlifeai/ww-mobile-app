import React, { useState, useCallback } from 'react'
import { View, StyleSheet } from 'react-native'
import { Text, IconButton, ActivityIndicator, useTheme, List } from 'react-native-paper'
import { Control, Controller } from 'react-hook-form'
import { WWSelect } from '../../../components/ui/WWSelect'
import { WWTextInput } from '../../../components/ui/WWTextInput'
import { WWCheckbox } from '../../../components/ui/WWCheckbox'
import { FieldBox } from '../../../components/ui/FieldBox'
import { HelpDialog } from '../../../components/ui/HelpDialog'
import { logError } from '../../../utils/logger'
import { ProjectSettingsHelpDialogs } from './ProjectSettingsHelpDialogs'
// The capture flash the project deploys, written to the camera as op34 and
// op13 at every deployment (#282). The option lists live with the column
// vocabulary in projectFlash.ts because the Dev Deployment Test screen offers
// the same choices (#301).
import { FLASH_MODE_OPTIONS, FLASH_LED_OPTIONS } from '../../../utils/projectFlash'

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
    flash_mode: string
    flash_led: string
    flash_window_start_minutes_utc: string
    flash_window_minutes: string
}

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
    /** The flash mode currently chosen, so the LED and window fields can follow it */
    flashMode: string
}

/** Each field's "?". Sampling Design and the GPS checkbox keep their longer dialogs. */
const HELP = {
    captureMethod: 'How the camera decides to take a picture. Motion detection takes one when something moves in front of it. Time-lapse takes one on a timer, such as every 30 seconds.',
    sensitivity: 'How little movement it takes to wake the camera. High catches smaller or more distant animals, and also more false triggers such as moving plants.',
    interval: 'How often the camera takes a picture, in seconds. For example, 60 takes one a minute.',
    flashMode: 'When the flash fires. Every deployment writes this to the camera, and the same setting decides whether motion detection gets infrared light at night.\n\n' +
        'Off: no flash, and no infrared for night-time motion frames.\n\n' +
        'Always on: the flash fires on every picture, day and night.\n\n' +
        'Time of day: the flash is armed inside a window you set.\n\n' +
        'Light sensor (in development): the camera decides from its own light reading. That reading is still being worked on, so choose one of the others for a real deployment.',
    flashLed: 'Infrared is invisible to wildlife and is what the hardware was tuned for. White gives colour at night but animals can see it.',
    windowStart: 'When the flash window opens, as HH:MM, for example 18:00. The camera runs on UTC, so the window is in UTC too. It may wrap past midnight.',
    windowLength: 'How long the flash window stays open, in minutes. For example, 720 is 12 hours.',
    model: 'The AI model the camera runs to identify animals in its pictures. None means the camera identifies nothing.',
}

/**
 * The project's camera settings, on New Project and Edit Project: capture
 * method, flash, then Advanced Project Settings as one plain row. Each field is
 * a box with its title on the border and its own "?" (26 October 2026 redesign).
 */
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
    flashMode
}) => {
    const theme = useTheme()
    const [samplingHelpVisible, setSamplingHelpVisible] = useState(false)
    const [gpsHelpVisible, setGpsHelpVisible] = useState(false)
    const [help, setHelp] = useState<{ title: string; content: string } | null>(null)
    const [expanded, setExpanded] = useState(false)
    const showHelp = (title: string, content: string) => () => setHelp({ title, content })

    const renderRightIcon = useCallback(
        (props: any) => <List.Icon {...props} icon={expanded ? "chevron-up" : "chevron-down"} />,
        [expanded]
    )

    return (
        <View style={styles.section}>
            <FieldBox title="Capture Method" onHelp={showHelp('Capture Method', HELP.captureMethod)}>
                <Controller
                    control={control}
                    name="capture_method_id"
                    render={({ field: { value, onChange } }) => (
                        <WWSelect value={value} onChange={onChange} options={captureMethodOptions} />
                    )}
                />
            </FieldBox>

            {isMotionDetection && (
                <FieldBox title="Motion Sensitivity" onHelp={showHelp('Motion Sensitivity', HELP.sensitivity)}>
                    <Controller
                        control={control}
                        name="activity_detection_sensitivity_id"
                        render={({ field: { value, onChange } }) => (
                            <WWSelect value={value} onChange={onChange} options={sensitivityOptions} />
                        )}
                    />
                </FieldBox>
            )}

            {isTimeLapse && (
                <FieldBox title="Time-lapse Interval (seconds)" onHelp={showHelp('Time-lapse Interval', HELP.interval)}>
                    <Controller
                        control={control}
                        name="timelapse_interval_seconds"
                        render={({ field: { value, onChange, onBlur } }) => (
                            <WWTextInput
                                value={value}
                                onChange={onChange}
                                onBlur={onBlur}
                                mode="outlined"
                                keyboardType="numeric"
                            />
                        )}
                    />
                </FieldBox>
            )}

            {/* The capture flash. The camera writes it at every deployment; the
                mode also decides whether motion frames get IR light at night. */}
            <FieldBox title="Flash Mode" onHelp={showHelp('Flash Mode', HELP.flashMode)}>
                <Controller
                    control={control}
                    name="flash_mode"
                    render={({ field: { value, onChange } }) => (
                        <WWSelect
                            value={value || 'off'}
                            onChange={onChange}
                            options={FLASH_MODE_OPTIONS}
                            testID="flash-mode-select"
                        />
                    )}
                />
            </FieldBox>

            {flashMode !== 'off' && (
                <FieldBox title="Flash LED" onHelp={showHelp('Flash LED', HELP.flashLed)}>
                    <Controller
                        control={control}
                        name="flash_led"
                        render={({ field: { value, onChange } }) => (
                            <WWSelect
                                value={value || 'ir'}
                                onChange={onChange}
                                options={FLASH_LED_OPTIONS}
                                testID="flash-led-select"
                            />
                        )}
                    />
                </FieldBox>
            )}

            {flashMode === 'time_of_day' && (
                <>
                    <FieldBox title="Window starts (UTC, HH:MM)" onHelp={showHelp('Window starts', HELP.windowStart)}>
                        <Controller
                            control={control}
                            name="flash_window_start_minutes_utc"
                            render={({ field: { value, onChange, onBlur } }) => (
                                <WWTextInput value={value} onChange={onChange} onBlur={onBlur} mode="outlined" />
                            )}
                        />
                    </FieldBox>
                    <FieldBox title="Window length (minutes)" onHelp={showHelp('Window length', HELP.windowLength)}>
                        <Controller
                            control={control}
                            name="flash_window_minutes"
                            render={({ field: { value, onChange, onBlur } }) => (
                                <WWTextInput
                                    value={value}
                                    onChange={onChange}
                                    onBlur={onBlur}
                                    mode="outlined"
                                    keyboardType="numeric"
                                />
                            )}
                        />
                    </FieldBox>
                </>
            )}

            {/* Advanced Project Settings: one plain row, collapsed by default */}
            <List.Item
                title="Advanced Project Settings"
                right={renderRightIcon}
                onPress={() => setExpanded(!expanded)}
                style={styles.accordionHeader}
            />
            {expanded && (
                <View style={styles.section}>
                    <FieldBox title="Sampling Design" onHelp={() => setSamplingHelpVisible(true)}>
                        <Controller
                            control={control}
                            name="sampling_design_id"
                            render={({ field: { value, onChange } }) => (
                                <WWSelect value={value} onChange={onChange} options={samplingDesignOptions} />
                            )}
                        />
                    </FieldBox>

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
                                <FieldBox title="Default AI Model" onHelp={showHelp('Default AI Model', HELP.model)}>
                                    <WWSelect
                                        value={value || '__none__'}
                                        onChange={(v: string) => onChange(v === '__none__' ? '' : v)}
                                        testID="ai-model-select-dropdown"
                                        options={optionsWithNone}
                                    />
                                </FieldBox>
                            )
                        }}
                    />

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

                    {/* The help icon sits beside the checkbox, not over it, so a
                        long label wraps instead of running under the icon (#190) */}
                    <View style={styles.checkboxRow}>
                        <View style={styles.flex1}>
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
                        </View>
                        <IconButton
                            icon="help-circle-outline"
                            size={24}
                            onPress={() => setGpsHelpVisible(true)}
                            style={styles.checkboxHelpIcon}
                            iconColor={theme.colors.primary}
                            accessibilityLabel="About recording GPS locations"
                            testID="record-gps-help"
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
                </View>
            )}

            <ProjectSettingsHelpDialogs
                samplingHelpVisible={samplingHelpVisible}
                setSamplingHelpVisible={setSamplingHelpVisible}
                gpsHelpVisible={gpsHelpVisible}
                setGpsHelpVisible={setGpsHelpVisible}
            />
            <HelpDialog
                visible={!!help}
                title={help?.title ?? ''}
                content={help?.content ?? ''}
                onDismiss={() => setHelp(null)}
            />
        </View>
    )
}

const styles = StyleSheet.create({
    section: {
        gap: 16,
    },
    flex1: {
        flex: 1,
    },
    accordionHeader: {
        backgroundColor: "transparent",
        paddingHorizontal: 0,
    },
    checkboxRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    checkboxHelpIcon: {
        margin: 0,
    },
})
