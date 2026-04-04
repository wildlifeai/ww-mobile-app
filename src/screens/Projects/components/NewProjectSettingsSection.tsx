import React, { useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { Text, IconButton, ActivityIndicator, useTheme, List } from 'react-native-paper'
import { Control, Controller } from 'react-hook-form'
import { Field } from '../../../components/form/Field'
import { WWSelect } from '../../../components/ui/WWSelect'
import { WWTextInput } from '../../../components/ui/WWTextInput'
import { WWCheckbox } from '../../../components/ui/WWCheckbox'
import { logError } from '../../../utils/logger'
import { ProjectSettingsHelpDialogs } from './ProjectSettingsHelpDialogs'

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
    hasAiModels: boolean
    showArchiveToggle?: boolean
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
    hasAiModels,
    showArchiveToggle = false
}) => {
    const theme = useTheme()
    const [samplingHelpVisible, setSamplingHelpVisible] = useState(false)
    const [captureHelpVisible, setCaptureHelpVisible] = useState(false)
    const [gpsHelpVisible, setGpsHelpVisible] = useState(false)

    const renderAccordionIcon = React.useCallback(
        (props: any) => <List.Icon {...props} icon="cog-outline" />,
        []
    )

    return (
        <View style={styles.section}>
            <View style={styles.fieldRow}>
                <View style={styles.flex1}>
                    <Field
                        control={control}
                        name="capture_method_id"
                        label="Capture Method"
                    >
                        {(field) => (
                            <WWSelect
                                {...field}
                                options={captureMethodOptions}
                                label="Capture Method"
                            />
                        )}
                    </Field>
                </View>
                <IconButton
                    icon="help-circle-outline"
                    size={24}
                    onPress={() => setCaptureHelpVisible(true)}
                    style={styles.helpIcon}
                    iconColor={theme.colors.primary}
                />
            </View>

            {isMotionDetection && (
                <Field
                    control={control}
                    name="activity_detection_sensitivity_id"
                    label="Motion Sensitivity"
                >
                    {(field) => (
                        <WWSelect
                            {...field}
                            options={sensitivityOptions}
                            label="Motion Sensitivity"
                        />
                    )}
                </Field>
            )}

            {isTimeLapse && (
                <Field
                    control={control}
                    name="timelapse_interval_seconds"
                    label="Time-lapse Interval (seconds)"
                >
                    {(field) => (
                        <WWTextInput
                            {...field}
                            mode="outlined"
                            keyboardType="numeric"
                            placeholder="e.g., 60"
                        />
                    )}
                </Field>
            )}

            <List.Accordion
                title="Advanced Project Settings"
                left={renderAccordionIcon}
                style={styles.accordionContainer}
            >
                <View style={styles.accordionChildrenContainer}>
                
                <View style={styles.fieldRow}>
                    <View style={styles.flex1}>
                        <Field
                            control={control}
                            name="sampling_design_id"
                            label="Sampling Design"
                        >
                            {(field) => (
                                <WWSelect
                                    {...field}
                                    options={samplingDesignOptions}
                                    label="Sampling Design"
                                />
                            )}
                        </Field>
                    </View>
                    <IconButton
                        icon="help-circle-outline"
                        size={24}
                        onPress={() => setSamplingHelpVisible(true)}
                        style={styles.helpIcon}
                        iconColor={theme.colors.primary}
                    />
                </View>

                <Field control={control} name="model_id" label="Default AI Model">
                    {(field) => {
                        if (isLoadingModels) {
                            return (
                                <View testID="ai-model-select-loading">
                                    <ActivityIndicator testID="ai-model-select-loading-placeholder" />
                                    <Text>Loading AI models...</Text>
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
                        if (!hasAiModels) {
                            return (
                                <View testID="ai-model-select-empty">
                                    <Text>No AI models available for this organisation</Text>
                                </View>
                            )
                        }
                        return (
                            <WWSelect
                                {...field}
                                testID="ai-model-select-dropdown"
                                options={aiModelOptions}
                                label="Default AI Model"
                            />
                        )
                    }}
                </Field>

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
                </View>
            </List.Accordion>

            {/* Help Dialogs */}
            <ProjectSettingsHelpDialogs
                samplingHelpVisible={samplingHelpVisible}
                setSamplingHelpVisible={setSamplingHelpVisible}
                captureHelpVisible={captureHelpVisible}
                setCaptureHelpVisible={setCaptureHelpVisible}
                gpsHelpVisible={gpsHelpVisible}
                setGpsHelpVisible={setGpsHelpVisible}
            />
        </View>
    )
}

const styles = StyleSheet.create({
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontWeight: "600",
        marginBottom: 16,
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
    alignCenter: {
        alignItems: "center"
    },
    accordionContainer: {
        backgroundColor: "transparent",
        paddingHorizontal: 0,
    },
    accordionChildrenContainer: {
        marginLeft: 0,
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
