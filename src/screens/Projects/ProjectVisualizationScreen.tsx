/**
 * ProjectVisualizationScreen
 * 
 * Read-only view of project settings for non-admin members.
 * Shows description, capture method, sampling design, sensitivity,
 * timelapse interval, AI model, boolean flags, and website.
 * 
 * Does NOT include devices or members sections.
 */

import { useMemo, useEffect } from 'react'
import { View, StyleSheet } from 'react-native'
import { Card, Text, useTheme, ActivityIndicator, Divider } from 'react-native-paper'
import { useRoute, useNavigation } from '@react-navigation/native'

import { WWScreenView } from '../../components/ui/WWScreenView'
import { WWButton } from '../../components/ui/WWButton'
import { WWIcon } from '../../components/ui/WWIcon'
import { AppParams } from '../../navigation/types'
import { useProjectDetails } from './hooks/useProjectDetails'

export const ProjectVisualizationScreen = () => {
    const theme = useTheme()
    const route = useRoute<AppParams<'ProjectVisualizationScreen'>>()
    const navigation = useNavigation()
    const { projectId } = route.params

    const {
        project,
        isLoading,
        error,
        refetch,
        samplingDesignOptions,
        captureMethodOptions,
        sensitivityOptions,
        aiModelOptions,
        isMotionDetection,
        isTimeLapse,
        getLabel,
    } = useProjectDetails(projectId)

    const dynamicStyles = useMemo(() => ({
        label: { color: theme.colors.onSurfaceVariant },
        value: { color: theme.colors.onSurface, fontWeight: '600' as const },
        noValue: { color: theme.colors.onSurfaceVariant, fontStyle: 'italic' as const },
        description: { color: theme.colors.onSurface },
        orgName: { color: theme.colors.onSurfaceVariant },
        websiteValue: { color: theme.colors.primary },
        errorHeader: { color: theme.colors.error },
        loadingLabel: { color: theme.colors.onSurfaceVariant },
    }), [theme])

    // Set title dynamically
    useEffect(() => {
        if (project?.name) {
            navigation.setOptions({ title: project.name })
        }
    }, [project?.name, navigation])

    // Loading
    if (isLoading) {
        return (
            <WWScreenView scrollable={false}>
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" />
                    <Text variant="bodyMedium" style={[styles.loadingText, dynamicStyles.loadingLabel]}>
                        Loading project…
                    </Text>
                </View>
            </WWScreenView>
        )
    }

    // Error
    if (error || !project) {
        return (
            <WWScreenView scrollable={false}>
                <View style={styles.centerContainer}>
                    <Text variant="headlineSmall" style={[styles.errorTitle, dynamicStyles.errorHeader]}>
                        Failed to load project
                    </Text>
                    <WWButton mode="contained" onPress={() => refetch()} style={styles.retryButton}>
                        <Text>Retry</Text>
                    </WWButton>
                </View>
            </WWScreenView>
        )
    }

    return (
        <WWScreenView>
            <View style={styles.content}>
                <Card mode="outlined" style={styles.card}>
                    <Card.Content>
                        {/* Organisation */}
                        {project.organisation?.name && (
                            <Text variant="bodyMedium" style={[styles.orgName, dynamicStyles.orgName]}>
                                {project.organisation.name}
                            </Text>
                        )}

                        {/* Description */}
                        {project.description ? (
                            <Text variant="bodyMedium" style={[styles.description, dynamicStyles.description]}>
                                {project.description}
                            </Text>
                        ) : (
                            <Text variant="bodyMedium" style={[styles.description, dynamicStyles.noValue]}>
                                No description
                            </Text>
                        )}

                        <Divider style={styles.divider} />

                        {/* Settings */}
                        {project.sampling_design_id && (
                            <View style={styles.settingRow}>
                                <Text variant="bodyMedium" style={dynamicStyles.label}>Sampling Design</Text>
                                <Text variant="bodyMedium" style={dynamicStyles.value}>
                                    {getLabel(samplingDesignOptions, project.sampling_design_id) as React.ReactNode}
                                </Text>
                            </View>
                        )}

                        {project.capture_method_id && (
                            <View style={styles.settingRow}>
                                <Text variant="bodyMedium" style={dynamicStyles.label}>Capture Method</Text>
                                <Text variant="bodyMedium" style={dynamicStyles.value}>
                                    {getLabel(captureMethodOptions, project.capture_method_id) as React.ReactNode}
                                </Text>
                            </View>
                        )}

                        {project.activity_detection_sensitivity_id && isMotionDetection && (
                            <View style={styles.settingRow}>
                                <Text variant="bodyMedium" style={dynamicStyles.label}>Motion Sensitivity</Text>
                                <Text variant="bodyMedium" style={dynamicStyles.value}>
                                    {getLabel(sensitivityOptions, project.activity_detection_sensitivity_id) as React.ReactNode}
                                </Text>
                            </View>
                        )}

                        {project.timelapse_interval_seconds && isTimeLapse && (
                            <View style={styles.settingRow}>
                                <Text variant="bodyMedium" style={dynamicStyles.label}>Time-lapse Interval</Text>
                                <Text variant="bodyMedium" style={dynamicStyles.value}>
                                    {project.timelapse_interval_seconds}s
                                </Text>
                            </View>
                        )}

                        <View style={styles.settingRow}>
                            <Text variant="bodyMedium" style={dynamicStyles.label}>AI Model</Text>
                            <Text variant="bodyMedium" style={project.model_id ? dynamicStyles.value : dynamicStyles.noValue}>
                                {project.model_id
                                    ? (getLabel(aiModelOptions, project.model_id) as React.ReactNode)
                                    : 'None'}
                            </Text>
                        </View>

                        {project.website && (
                            <View style={styles.settingRow}>
                                <Text variant="bodyMedium" style={dynamicStyles.label}>Website</Text>
                                <Text variant="bodyMedium" style={dynamicStyles.websiteValue}>
                                    {project.website}
                                </Text>
                            </View>
                        )}

                        {/* Boolean flags */}
                        {(project.is_baited || project.is_monitoring_marked_individuals || project.record_gps_in_images || project.lorawan_required) && (
                            <>
                                <Divider style={styles.divider} />
                                {project.is_baited && (
                                    <View style={styles.flagRow}>
                                        <WWIcon source="checkbox-marked" size={20} color={theme.colors.primary} />
                                        <Text variant="bodyMedium" style={dynamicStyles.value}>Using Bait</Text>
                                    </View>
                                )}
                                {project.is_monitoring_marked_individuals && (
                                    <View style={styles.flagRow}>
                                        <WWIcon source="checkbox-marked" size={20} color={theme.colors.primary} />
                                        <Text variant="bodyMedium" style={dynamicStyles.value}>Monitoring Marked Individuals</Text>
                                    </View>
                                )}
                                {project.record_gps_in_images && (
                                    <View style={styles.flagRow}>
                                        <WWIcon source="checkbox-marked" size={20} color={theme.colors.primary} />
                                        <Text variant="bodyMedium" style={dynamicStyles.value}>Record GPS in Images</Text>
                                    </View>
                                )}
                                {project.lorawan_required && (
                                    <View style={styles.flagRow}>
                                        <WWIcon source="checkbox-marked" size={20} color={theme.colors.primary} />
                                        <Text variant="bodyMedium" style={dynamicStyles.value}>LoRaWAN Required</Text>
                                    </View>
                                )}
                            </>
                        )}
                    </Card.Content>
                </Card>
            </View>
        </WWScreenView>
    )
}

const styles = StyleSheet.create({
    content: {
        padding: 16,
        paddingBottom: 32,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    loadingText: {
        marginTop: 16,
    },
    errorTitle: {
        marginBottom: 8,
        textAlign: 'center',
    },
    retryButton: {
        marginTop: 8,
    },
    card: {
        marginBottom: 16,
    },
    orgName: {
        marginBottom: 8,
    },
    description: {
        marginBottom: 16,
    },
    divider: {
        marginVertical: 16,
    },
    settingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
        minHeight: 24,
        marginBottom: 12,
    },
    flagRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        minHeight: 24,
        marginBottom: 8,
    },
})
