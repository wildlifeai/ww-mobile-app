import React, { useCallback } from 'react'
import { StyleSheet } from 'react-native'
import { Card, Text, Button, useTheme } from 'react-native-paper'
import { WWTextInput } from '../../../components/ui/WWTextInput'
import { Control, Controller, FieldErrors } from 'react-hook-form'
import { HelpDialog } from '../../../components/ui/HelpDialog'

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

interface Props {
    control: Control<ProjectFormData>
    errors: FieldErrors<ProjectFormData>
}

export const NewProjectBasicInfoSection: React.FC<Props> = ({ control, errors }) => {
    const theme = useTheme()
    const [helpVisible, setHelpVisible] = React.useState(false)

    const renderHelp = useCallback((props: any) => (
        <Button
            {...props}
            icon="help-circle-outline"
            onPress={() => setHelpVisible(true)}
        >
            <Text>Help</Text>
        </Button>
    ), [])

    return (
        <>
            <Card>
                <Card.Title
                    title="Project Details"
                    right={renderHelp}
                />
                <Card.Content style={styles.cardContent}>
                    <Controller
                        control={control}
                        name="name"
                        rules={{
                            required: "Project name is required",
                            minLength: {
                                value: 3,
                                message: "Project name must be at least 3 characters",
                            },
                            maxLength: {
                                value: 100,
                                message: "Project name must not exceed 100 characters",
                            },
                        }}
                        render={({ field: { value, onChange, onBlur } }) => (
                            <WWTextInput
                                label="Project Name"
                                value={value}
                                onChange={onChange}
                                onBlur={onBlur}
                                mode="outlined"
                                placeholder="Enter project name"
                                error={!!errors.name}
                                testID="project-name-input"
                            />
                        )}
                    />
                    {errors.name && (
                        <Text variant="bodySmall" style={{ color: theme.colors.error }}>
                            {errors.name.message as string}
                        </Text>
                    )}

                    <Controller
                        control={control}
                        name="description"
                        rules={{
                            maxLength: {
                                value: 500,
                                message: "Description must not exceed 500 characters",
                            },
                        }}
                        render={({ field: { value, onChange, onBlur } }) => (
                            <WWTextInput
                                label="Description"
                                value={value}
                                onChange={onChange}
                                onBlur={onBlur}
                                mode="outlined"
                                placeholder="Enter project description"
                                multiline
                                numberOfLines={4}
                                error={!!errors.description}
                                testID="project-description-input"
                                style={styles.textArea}
                            />
                        )}
                    />
                    {errors.description && (
                        <Text variant="bodySmall" style={{ color: theme.colors.error }}>
                            {errors.description.message as string}
                        </Text>
                    )}
                </Card.Content>
            </Card>

            <HelpDialog
                visible={helpVisible}
                title="Project Details"
                content="Project Name: A unique name to identify your project. This is visible to all project members.\n\nDescription: Additional context about the project, such as location, objectives, or species being monitored."
                onDismiss={() => setHelpVisible(false)}
            />
        </>
    )
}

const styles = StyleSheet.create({
    cardContent: {
        gap: 12,
    },
    textArea: {
        minHeight: 100,
    },
})
