import React, { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Text, useTheme } from 'react-native-paper'
import { WWTextInput } from '../../../components/ui/WWTextInput'
import { Control, Controller, FieldErrors } from 'react-hook-form'
import { HelpDialog } from '../../../components/ui/HelpDialog'
import { FieldBox } from '../../../components/ui/FieldBox'

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

const HELP = {
    name: 'A unique name for the project. Everyone in the project sees it.',
    description: 'What the project is about: where it runs, why, and which species it watches.',
}

/**
 * The project's name and description, on New Project and Edit Project. Each is
 * a box with its title on the border and its own "?" (26 October 2026 redesign).
 */
export const NewProjectBasicInfoSection: React.FC<Props> = ({ control, errors }) => {
    const theme = useTheme()
    const [help, setHelp] = useState<{ title: string; content: string } | null>(null)

    return (
        <View style={styles.section}>
            <FieldBox title="Project Name" onHelp={() => setHelp({ title: 'Project Name', content: HELP.name })}>
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
                            value={value}
                            onChange={onChange}
                            onBlur={onBlur}
                            mode="outlined"
                            error={!!errors.name}
                            testID="project-name-input"
                        />
                    )}
                />
            </FieldBox>
            {errors.name && (
                <Text variant="bodySmall" style={{ color: theme.colors.error }}>
                    {errors.name.message as string}
                </Text>
            )}

            <FieldBox title="Description" onHelp={() => setHelp({ title: 'Description', content: HELP.description })}>
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
                            value={value}
                            onChange={onChange}
                            onBlur={onBlur}
                            mode="outlined"
                            multiline
                            numberOfLines={4}
                            error={!!errors.description}
                            testID="project-description-input"
                            style={styles.textArea}
                        />
                    )}
                />
            </FieldBox>
            {errors.description && (
                <Text variant="bodySmall" style={{ color: theme.colors.error }}>
                    {errors.description.message as string}
                </Text>
            )}

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
    textArea: {
        minHeight: 100,
    },
})
