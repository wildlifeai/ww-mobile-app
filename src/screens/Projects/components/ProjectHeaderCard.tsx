import React from 'react'
import { View, StyleSheet } from 'react-native'
import { Card, Text, IconButton, useTheme } from 'react-native-paper'
import { Control } from 'react-hook-form'
import { Field } from '../../../components/form/Field'
import { WWTextInput } from '../../../components/ui/WWTextInput'
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
}

interface Props {
    project: ProjectWithDetails
    isEditMode: boolean
    isProjectAdmin: boolean
    control: Control<ProjectFormData>
    errors: any
    onEdit: () => void
    onDelete: () => void
}

export const ProjectHeaderCard: React.FC<Props> = ({
    project,
    isEditMode,
    isProjectAdmin,
    control,
    errors,
    onEdit,
    onDelete,
}) => {
    const theme = useTheme()

    const dynamicStyles = {
        projectTitle: { color: theme.colors.onSurface },
        orgName: { color: theme.colors.onSurfaceVariant, marginTop: 4 },
        description: { color: theme.colors.onSurfaceVariant },
        noDescription: { color: theme.colors.onSurfaceDisabled },
    }

    return (
        <Card mode="outlined" style={styles.card}>
            <Card.Content>
                <View style={styles.headerRow}>
                    {isEditMode ? (
                        <View style={styles.flex1}>
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
                        </View>
                    ) : (
                        <View style={styles.flex1}>
                            <Text
                                variant="headlineMedium"
                                style={dynamicStyles.projectTitle}
                            >
                                {project.name}
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
                    )}

                    {!isEditMode && isProjectAdmin && (
                        <View style={styles.actionButtons}>
                            <IconButton
                                icon="pencil"
                                size={24}
                                onPress={onEdit}
                                testID="edit-button"
                            />
                            <IconButton
                                icon="delete"
                                size={24}
                                iconColor={theme.colors.error}
                                onPress={onDelete}
                                testID="delete-button"
                            />
                        </View>
                    )}
                </View>

                {/* Description */}
                {isEditMode ? (
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
                ) : project.description ? (
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
        marginBottom: 16,
        gap: 16,
    },
    flex1: {
        flex: 1,
    },
    actionButtons: {
        flexDirection: "row",
        marginRight: -8, // Offset default IconButton padding
        marginTop: -8,
    },
    description: {
        marginTop: 8,
    },
})
