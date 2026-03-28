import React from 'react'
import { View, StyleSheet } from 'react-native'
import { Card, Text, IconButton, useTheme, Divider } from 'react-native-paper'
import { Control, Controller } from 'react-hook-form'
import { Field } from '../../../components/form/Field'
import { WWSelect } from '../../../components/ui/WWSelect'
import { WWTextInput } from '../../../components/ui/WWTextInput'
import { WWCheckbox } from '../../../components/ui/WWCheckbox'
import { WWIcon } from '../../../components/ui/WWIcon'
import { ProjectWithDetails } from '../../../types/project'
import { NewProjectSettingsSection } from './NewProjectSettingsSection'

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
    project: ProjectWithDetails
    isEditMode: boolean
    isProjectAdmin: boolean
    control: Control<ProjectFormData>
    errors: any
    onEdit: () => void
    samplingDesignOptions: SelectOption[]
    captureMethodOptions: SelectOption[]
    sensitivityOptions: SelectOption[]
    aiModelOptions: SelectOption[]
    isMotionDetection: boolean
    isTimeLapse: boolean
    isLoadingModels: boolean
    modelsError: any
    hasAiModels: boolean
    getLabel: (options: SelectOption[], value?: string | number | null) => string | number | null | undefined
}

export const ProjectDetailsCard: React.FC<Props> = ({
    project,
    isEditMode,
    isProjectAdmin,
    control,
    errors,
    onEdit,
    samplingDesignOptions,
    captureMethodOptions,
    sensitivityOptions,
    aiModelOptions,
    isMotionDetection,
    isTimeLapse,
    isLoadingModels,
    modelsError,
    hasAiModels,
    getLabel
}) => {
    const theme = useTheme()

    const dynamicStyles = {
        sectionTitle: { color: theme.colors.onSurface },
        orgName: { color: theme.colors.onSurfaceVariant, marginBottom: 8 },
        description: { color: theme.colors.onSurfaceVariant },
        noDescription: { color: theme.colors.onSurfaceDisabled },
        settingLabel: { color: theme.colors.onSurfaceVariant },
        settingValue: { color: theme.colors.onSurface },
        websiteValue: { color: theme.colors.primary },
    }

    return (
        <Card mode="outlined" style={styles.card}>
            <Card.Content>
                <View style={styles.headerRow}>
                    <View style={styles.flex1}>
                        <Text
                            variant="titleMedium"
                            style={[styles.sectionTitle, dynamicStyles.sectionTitle]}
                        >
                            Project Details
                        </Text>
                        {!isEditMode && project.organisation?.name && (
                            <Text
                                variant="bodyMedium"
                                style={dynamicStyles.orgName}
                            >
                                {project.organisation.name}
                            </Text>
                        )}
                    </View>

                    {!isEditMode && isProjectAdmin && (
                        <View style={styles.actionButtons}>
                            <IconButton
                                icon="cog"
                                size={24}
                                onPress={onEdit}
                                testID="edit-button"
                            />
                        </View>
                    )}
                </View>

                {isEditMode ? (
                    <View>
                        <Field
                            control={control}
                            name="name"
                            label="Project Name"
                            required
                            rules={{
                                required: "Project name is required",
                                minLength: { value: 3, message: "At least 3 characters" },
                                maxLength: { value: 100, message: "Max 100 characters" },
                            }}
                        >
                            {(field) => (
                                <WWTextInput
                                    {...field}
                                    mode="outlined"
                                    error={!!errors.name}
                                    testID="project-name-input"
                                />
                            )}
                        </Field>

                        <Field
                            control={control}
                            name="description"
                            label="Description"
                            rules={{
                                maxLength: { value: 500, message: "Max 500 characters" },
                            }}
                        >
                            {(field) => (
                                <WWTextInput
                                    {...field}
                                    mode="outlined"
                                    multiline
                                    numberOfLines={4}
                                    error={!!errors.description}
                                    testID="project-description-input"
                                />
                            )}
                        </Field>

                        <Divider style={styles.divider} />

                        <NewProjectSettingsSection
                            control={control}
                            samplingDesignOptions={samplingDesignOptions}
                            captureMethodOptions={captureMethodOptions}
                            sensitivityOptions={sensitivityOptions}
                            aiModelOptions={aiModelOptions}
                            isMotionDetection={isMotionDetection}
                            isTimeLapse={isTimeLapse}
                            isLoadingModels={isLoadingModels}
                            modelsError={modelsError}
                            hasAiModels={hasAiModels}
                            showArchiveToggle={true}
                        />
                    </View>
                ) : (
                    <View>
                        {project.description ? (
                            <Text
                                variant="bodyMedium"
                                style={[
                                    styles.description,
                                    dynamicStyles.description,
                                ]}
                            >
                                {project.description}
                            </Text>
                        ) : (
                            <Text
                                variant="bodyMedium"
                                style={[
                                    styles.description,
                                    dynamicStyles.noDescription,
                                ]}
                            >
                                No description
                            </Text>
                        )}

                        <Divider style={styles.divider} />

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

                        {project.lorawan_required && (
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
                                    LoRaWAN Required
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
    headerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 8,
        gap: 16,
    },
    flex1: {
        flex: 1,
    },
    sectionTitle: {
        fontWeight: "600",
    },
    actionButtons: {
        flexDirection: "row",
        marginRight: -8, // Offset default IconButton padding
        marginTop: -8,
    },
    description: {
        marginBottom: 16,
    },
    divider: {
        marginVertical: 16,
    },
    settingRow: {
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 8,
        minHeight: 24,
        marginBottom: 8,
    },
})
