import React, { useState } from 'react'
import { View, StyleSheet, ScrollView } from 'react-native'
import { Text, IconButton, Portal, Dialog, Button, Divider, ActivityIndicator, useTheme, List } from 'react-native-paper'
import { Control, Controller } from 'react-hook-form'
import { Field } from '../../../components/form/Field'
import { WWSelect } from '../../../components/ui/WWSelect'
import { WWTextInput } from '../../../components/ui/WWTextInput'
import { WWCheckbox } from '../../../components/ui/WWCheckbox'
import { logError } from '../../../utils/logger'

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
    hasAiModels
}) => {
    const theme = useTheme()
    const [samplingHelpVisible, setSamplingHelpVisible] = useState(false)
    const [captureHelpVisible, setCaptureHelpVisible] = useState(false)
    const [gpsHelpVisible, setGpsHelpVisible] = useState(false)

    return (
        <View style={styles.section}>
            <Text
                variant="titleMedium"
                style={styles.sectionTitle}
            >
                Project Settings
            </Text>

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
                left={props => <List.Icon {...props} icon="cog-outline" />}
                style={styles.accordionContainer}
            >
                <Field control={control} name="website" label="Website (Optional)">
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

                <Field control={control} name="model_id" label="Default AI Model (Optional)">
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

                <View style={[styles.fieldRow, styles.alignCenter]}>
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
                        style={styles.helpIcon}
                        iconColor={theme.colors.primary}
                    />
                </View>
            </List.Accordion>

            {/* Help Dialogs */}
            <Portal>
                <Dialog
                    visible={samplingHelpVisible}
                    onDismiss={() => setSamplingHelpVisible(false)}
                    style={styles.dialog}
                >
                    <Dialog.Title><Text>Sampling Designs</Text></Dialog.Title>
                    <Dialog.ScrollArea>
                        <ScrollView contentContainerStyle={styles.dialogScrollContent}>
                            <Text style={styles.helpItem}>
                                <Text style={styles.bold}>Simple random:</Text> <Text>random
                                distribution of sampling locations</Text>
                            </Text>
                            <Divider style={styles.divider} />

                            <Text style={styles.helpItem}>
                                <Text style={styles.bold}>Systematic random:</Text> <Text>random
                                distribution of sampling locations, but arranged in a regular
                                pattern</Text>
                            </Text>
                            <Divider style={styles.divider} />

                            <Text style={styles.helpItem}>
                                <Text style={styles.bold}>Clustered random:</Text> <Text>random
                                distribution of sampling locations, but clustered in arrays</Text>
                            </Text>
                            <Divider style={styles.divider} />

                            <Text style={styles.helpItem}>
                                <Text style={styles.bold}>Experimental:</Text> <Text>non-random
                                distribution aimed to study an effect, including the
                                before-after control-impact (BACI) design</Text>
                            </Text>
                            <Divider style={styles.divider} />

                            <Text style={styles.helpItem}>
                                <Text style={styles.bold}>Targeted:</Text> <Text>non-random
                                distribution optimized for capturing specific target species
                                (often using various bait types)</Text>
                            </Text>
                            <Divider style={styles.divider} />

                            <Text style={styles.helpItem}>
                                <Text style={styles.bold}>Opportunistic:</Text> <Text>opportunistic
                                camera trapping (usually with a small number of cameras).</Text>
                            </Text>
                        </ScrollView>
                    </Dialog.ScrollArea>
                    <Dialog.Actions>
                        <Button onPress={() => setSamplingHelpVisible(false)}>
                            <Text>Close</Text>
                        </Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>

            <Portal>
                <Dialog
                    visible={captureHelpVisible}
                    onDismiss={() => setCaptureHelpVisible(false)}
                    style={styles.dialog}
                >
                    <Dialog.Title><Text>Capture Methods</Text></Dialog.Title>
                    <Dialog.ScrollArea>
                        <ScrollView contentContainerStyle={styles.dialogScrollContent}>
                            <Text style={styles.helpItem}>
                                <Text style={styles.bold}>activityDetection:</Text> <Text>The camera
                                uses the motion-detection sensor to record photos</Text>
                            </Text>
                            <Divider style={styles.divider} />

                            <Text style={styles.helpItem}>
                                <Text style={styles.bold}>timeLapse:</Text> <Text>Set a timer (e.g.
                                every 30 seconds) for the camera to take photos.</Text>
                            </Text>
                        </ScrollView>
                    </Dialog.ScrollArea>
                    <Dialog.Actions>
                        <Button onPress={() => setCaptureHelpVisible(false)}>
                            <Text>Close</Text>
                        </Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>
            <Portal>
                <Dialog
                    visible={gpsHelpVisible}
                    onDismiss={() => setGpsHelpVisible(false)}
                    style={styles.dialog}
                >
                    <Dialog.Title><Text>GPS Image Tracking</Text></Dialog.Title>
                    <Dialog.ScrollArea>
                        <ScrollView contentContainerStyle={styles.dialogScrollContent}>
                            <Text style={styles.helpItem}>
                                Geolocation is by default only tracked in the Wildlife Watcher database so that only users with access to the project and deployments can access the information.
                            </Text>
                            <Divider style={styles.divider} />
                            <Text style={styles.helpItem}>
                                <Text style={styles.bold}>Warning:</Text> Writing the GPS locations directly in the images' EXIF properties can expose sensitive information (e.g., a georeferenced picture of a threatened species floating online). Enable this only if absolutely necessary for your workflow.
                            </Text>
                        </ScrollView>
                    </Dialog.ScrollArea>
                    <Dialog.Actions>
                        <Button onPress={() => setGpsHelpVisible(false)}>
                            <Text>Close</Text>
                        </Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>
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
    helpItem: {
        marginBottom: 8,
        lineHeight: 20,
    },
    bold: {
        fontWeight: "bold",
    },
    divider: {
        marginVertical: 8,
    },
    dialog: {
        maxHeight: "80%",
    },
    dialogScrollContent: {
        paddingVertical: 16,
    },
    alignCenter: {
        alignItems: "center"
    },
    accordionContainer: {
        backgroundColor: "transparent",
        paddingHorizontal: 0,
        marginLeft: -16, // To align title with other fields
    }
})
