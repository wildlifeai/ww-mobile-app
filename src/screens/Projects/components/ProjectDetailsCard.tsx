import React from 'react'
import { View, StyleSheet } from 'react-native'
import { Card, Text, IconButton, useTheme, Divider, TouchableRipple } from 'react-native-paper'
import { WWIcon } from '../../../components/ui/WWIcon'
import { ProjectWithDetails } from '../../../types/project'
import { useAppNavigation } from '../../../hooks/useAppNavigation'

interface SelectOption {
    label: string
    value: string
}

interface Props {
    project: ProjectWithDetails
    isProjectAdmin: boolean
    samplingDesignOptions: SelectOption[]
    captureMethodOptions: SelectOption[]
    sensitivityOptions: SelectOption[]
    aiModelOptions: SelectOption[]
    isMotionDetection: boolean
    isTimeLapse: boolean
    getLabel: (options: SelectOption[], value?: string | number | null) => string | number | null | undefined
}

export const ProjectDetailsCard: React.FC<Props> = ({
    project,
    isProjectAdmin,
    samplingDesignOptions,
    captureMethodOptions,
    sensitivityOptions,
    aiModelOptions,
    isMotionDetection,
    isTimeLapse,
    getLabel
}) => {
    const theme = useTheme()
    const navigation = useAppNavigation()

    const dynamicStyles = {
        sectionTitle: { color: theme.colors.onSurface },
        orgName: { color: theme.colors.onSurfaceVariant, marginBottom: 8 },
        description: { color: theme.colors.onSurfaceVariant },
        noDescription: { color: theme.colors.onSurfaceDisabled },
        settingLabel: { color: theme.colors.onSurfaceVariant },
        settingValue: { color: theme.colors.onSurface },
        websiteValue: { color: theme.colors.primary },
    }

    const handleHeaderPress = () => {
        if (isProjectAdmin) {
            navigation.navigate('EditProjectScreen', { projectId: project.id })
        } else {
            navigation.navigate('ProjectVisualizationScreen', { projectId: project.id })
        }
    }

    return (
        <Card mode="outlined" style={styles.card}>
            <Card.Content>
                <TouchableRipple onPress={handleHeaderPress} borderless style={styles.headerTouchable}>
                    <View style={styles.headerRow}>
                        <View style={styles.flex1}>
                            <Text
                                variant="titleMedium"
                                style={[styles.sectionTitle, dynamicStyles.sectionTitle]}
                            >
                                Project Details
                            </Text>
                            {project.organisation?.name && (
                                <Text
                                    variant="bodyMedium"
                                    style={dynamicStyles.orgName}
                                >
                                    {project.organisation.name}
                                </Text>
                            )}
                        </View>

                        <View style={styles.actionButtons}>
                            {isProjectAdmin ? (
                                <IconButton
                                    icon="cog"
                                    size={24}
                                    onPress={handleHeaderPress}
                                    testID="edit-button"
                                />
                            ) : (
                                <IconButton
                                    icon="chevron-right"
                                    size={24}
                                    onPress={handleHeaderPress}
                                    testID="view-details-button"
                                />
                            )}
                        </View>
                    </View>
                </TouchableRipple>

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

                    <View style={styles.settingRow}>
                        <Text
                            variant="bodyMedium"
                            style={dynamicStyles.settingLabel}
                        >
                            AI Model:
                        </Text>
                        <Text
                            variant="bodyMedium"
                            style={project.model_id ? dynamicStyles.settingValue : dynamicStyles.noDescription}
                        >
                            {project.model_id
                                ? (getLabel(aiModelOptions, project.model_id) as React.ReactNode)
                                : 'None'}
                        </Text>
                    </View>

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
            </Card.Content>
        </Card>
    )
}

const styles = StyleSheet.create({
    card: {
        marginBottom: 16,
    },
    headerTouchable: {
        borderRadius: 8,
        marginBottom: 8,
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
