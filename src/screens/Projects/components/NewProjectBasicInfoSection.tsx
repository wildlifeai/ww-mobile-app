import React from 'react'
import { View, StyleSheet } from 'react-native'

import { Control, FieldErrors } from 'react-hook-form'
import { Field } from '../../../components/form/Field'
import { WWTextInput } from '../../../components/ui/WWTextInput'

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
    return (
        <View style={styles.section}>
            <Field
                control={control}
                name="name"
                label="Project Name"
                required
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
            >
                {(field) => (
                    <WWTextInput
                        {...field}
                        mode="outlined"
                        placeholder="Enter project name"
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
                    maxLength: {
                        value: 500,
                        message: "Description must not exceed 500 characters",
                    },
                }}
            >
                {(field) => (
                    <WWTextInput
                        {...field}
                        mode="outlined"
                        placeholder="Enter project description"
                        multiline
                        numberOfLines={4}
                        error={!!errors.description}
                        testID="project-description-input"
                        style={styles.textArea}
                    />
                )}
            </Field>
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
    textArea: {
        minHeight: 100
    }
})
