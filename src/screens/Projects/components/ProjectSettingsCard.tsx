import React from 'react'
import { View, StyleSheet } from 'react-native'
import { Card, Text, useTheme } from 'react-native-paper'
import { Control, Controller } from 'react-hook-form'
import { Field } from '../../../components/form/Field'
import { WWSelect } from '../../../components/ui/WWSelect'
import { WWTextInput } from '../../../components/ui/WWTextInput'
import { WWCheckbox } from '../../../components/ui/WWCheckbox'
import { WWIcon } from '../../../components/ui/WWIcon'
import { ProjectWithDetails } from '../../../types/project'

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
}

interface SelectOption {
    label: string
    value: string
}

interface Props {
    project: ProjectWithDetails
    isEditMode: boolean
    isProjectAdmin: boolean
    control: Control<ProjectFormData>
    samplingDesignOptions: SelectOption[]
    captureMethodOptions: SelectOption[]
    sensitivityOptions: SelectOption[]
    aiModelOptions: SelectOption[]
    isMotionDetection: boolean
    isTimeLapse: boolean
    getLabel: (options: SelectOption[], value?: string | number | null) => string | number | null | undefined
}

export const ProjectSettingsCard: React.FC<Props> = ({
    project,
    isEditMode,
    isProjectAdmin,
    control,
    samplingDesignOptions,
    captureMethodOptions,
    sensitivityOptions,
    aiModelOptions,
    isMotionDetection,
    isTimeLapse,
    getLabel
}) => {
    const theme = useTheme()

    const dynamicStyles = {
        sectionTitle: { color: theme.colors.onSurface },
        settingLabel: { color: theme.colors.onSurfaceVariant },
        settingValue: { color: theme.colors.onSurface },
        websiteValue: { color: theme.colors.primary },
    }

    return (
        <Card mode="outlined" style={styles.card}>
            <Card.Content>
                <Text
                    variant="titleMedium"
                    style={[styles.sectionTitle, dynamicStyles.sectionTitle]}
                >
                    Settings
                </Text>

                {isEditMode ? (
                    <View>
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

                        {isProjectAdmin && (
                            <Field
                                control={control}
                                name="model_id"
                                label="Default AI Model"
                            >
                                {(field) => (
                                    <WWSelect
                                        {...field}
                                        options={aiModelOptions}
                                        label="Default AI Model"
                                    />
                                )}
                            </Field>
                        )}

                        <Field control={control} name="website" label="Website">
                            {(field) => (
                                <WWTextInput
                                    {...field}
                                    mode="outlined"
                                    placeholder="https://example.com"
                                    keyboardType="url"
                                    autoCapitalize="none"
                                    testID="website-input"
                                />
                            )}
                        </Field>

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

                        <Controller
                            control={control}
                            name="record_gps_in_images"
                            render={({ field: { value, onChange } }) => (
                                <WWCheckbox
                                    label="Record GPS in Images"
                                    value={value}
                                    onChange={onChange}
                                    testID="record-gps-checkbox"
                                />
                            )}
                        />
                    </View>
                ) : (
                    <View>
                        {project.sampling_design_id && (
                            <View style={styles.settingRow}>
                                <Text
                                    variant="bodyMedium"
                                    style={dynamicStyles.settingLabel}
                                >
                                    Sampling Design:
                                </Text>
                                <Text
                                    variant="bodyMedium"
                                    style={dynamicStyles.settingValue}
                                >
                                    {getLabel(samplingDesignOptions, project.sampling_design_id) as React.ReactNode}
                                </Text>
                            </View>
                        )}

                        {project.capture_method_id && (
                            <View style={styles.settingRow}>
                                <Text
                                    variant="bodyMedium"
                                    style={dynamicStyles.settingLabel}
                                >
                                    Capture Method:
                                </Text>
                                <Text
                                    variant="bodyMedium"
                                    style={dynamicStyles.settingValue}
                                >
                                    {getLabel(captureMethodOptions, project.capture_method_id) as React.ReactNode}
                                </Text>
                            </View>
                        )}

                        {project.activity_detection_sensitivity_id && isMotionDetection && (
                            <View style={styles.settingRow}>
                                <Text
                                    variant="bodyMedium"
                                    style={dynamicStyles.settingLabel}
                                >
                                    Motion Sensitivity:
                                </Text>
                                <Text
                                    variant="bodyMedium"
                                    style={dynamicStyles.settingValue}
                                >
                                    {getLabel(sensitivityOptions, project.activity_detection_sensitivity_id) as React.ReactNode}
                                </Text>
                            </View>
                        )}

                        {project.timelapse_interval_seconds && isTimeLapse && (
                            <View style={styles.settingRow}>
                                <Text
                                    variant="bodyMedium"
                                    style={dynamicStyles.settingLabel}
                                >
                                    Time-lapse Interval:
                                </Text>
                                <Text
                                    variant="bodyMedium"
                                    style={dynamicStyles.settingValue}
                                >
                                    {project.timelapse_interval_seconds}s
                                </Text>
                            </View>
                        )}

                        {project.model_id && (
                            <View style={styles.settingRow}>
                                <Text
                                    variant="bodyMedium"
                                    style={dynamicStyles.settingLabel}
                                >
                                    AI Model:
                                </Text>
                                <Text
                                    variant="bodyMedium"
                                    style={dynamicStyles.settingValue}
                                >
                                    {getLabel(aiModelOptions, project.model_id) as React.ReactNode}
                                </Text>
                            </View>
                        )}

                        {project.website && (
                            <View style={styles.settingRow}>
                                <Text
                                    variant="bodyMedium"
                                    style={dynamicStyles.settingLabel}
                                >
                                    Website:
                                </Text>
                                <Text
                                    variant="bodyMedium"
                                    style={dynamicStyles.websiteValue}
                                >
                                    {project.website}
                                </Text>
                            </View>
                        )}

                        {project.is_baited && (
                            <View style={styles.settingRow}>
                                <WWIcon
                                    source="checkbox-marked"
                                    size={20}
                                    color={theme.colors.primary}
                                />
                                <Text
                                    variant="bodyMedium"
                                    style={dynamicStyles.settingValue}
                                >
                                    Using Bait
                                </Text>
                            </View>
                        )}

                        {project.is_monitoring_marked_individuals && (
                            <View style={styles.settingRow}>
                                <WWIcon
                                    source="checkbox-marked"
                                    size={20}
                                    color={theme.colors.primary}
                                />
                                <Text
                                    variant="bodyMedium"
                                    style={dynamicStyles.settingValue}
                                >
                                    Monitoring Marked Individuals
                                </Text>
                            </View>
                        )}

                        {project.record_gps_in_images && (
                            <View style={styles.settingRow}>
                                <WWIcon
                                    source="checkbox-marked"
                                    size={20}
                                    color={theme.colors.primary}
                                />
                                <Text
                                    variant="bodyMedium"
                                    style={dynamicStyles.settingValue}
                                >
                                    Record GPS in Images
                                </Text>
                            </View>
                        )}
                    </View>
                )}
            </Card.Content>
        </Card>
    )
}

const styles = StyleSheet.create({
    card: {
        marginBottom: 16,
    },
    sectionTitle: {
        fontWeight: "600",
        marginBottom: 16,
    },
    settingRow: {
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 8,
        minHeight: 24,
    },
})
