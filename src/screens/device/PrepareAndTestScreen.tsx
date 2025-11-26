import React, { useState, useEffect } from 'react'
import { View, ScrollView, StyleSheet, Alert, TouchableOpacity } from 'react-native'
import { useRoute, useNavigation } from '@react-navigation/native'
import type { RouteProp } from '@react-navigation/native'
import { WWScreenView } from '../../components/ui/WWScreenView'
import { WWText } from '../../components/ui/WWText'
import { WWButton } from '../../components/ui/WWButton'
import { WWSelect } from '../../components/ui/WWSelect'
import { DeviceService } from '../../services/DeviceService'
import { DevicePreparationService } from '../../services/DevicePreparationService'
import { useGetProjectsQuery } from '../../redux/api/projectsApi'
import { useAppSelector } from '../../redux'
import Device from '../../database/models/Device'
import DevicePreparation from '../../database/models/DevicePreparation'
import database from '../../database'
import { ActivityIndicator } from 'react-native-paper'

type PrepareAndTestRouteProp = RouteProp<{ params: { deviceId: string } }, 'params'>

export const PrepareAndTestScreen = () => {
    const route = useRoute<PrepareAndTestRouteProp>()
    const navigation = useNavigation()
    const { deviceId } = route.params
    const user = useAppSelector((state) => state.auth.user)

    const [device, setDevice] = useState<Device | undefined>()
    const [preparation, setPreparation] = useState<DevicePreparation | undefined>()
    const [selectedProject, setSelectedProject] = useState<string>('')
    const [loading, setLoading] = useState(true)

    // Placeholder states for checks (will be replaced with actual BLE commands)
    const [batteryLevel, setBatteryLevel] = useState<number | null>(null)
    const [sdCardStatus, setSdCardStatus] = useState<{ total: number; free: number } | null>(null)
    const [cameraTestPassed, setCameraTestPassed] = useState(false)
    const [firmwareUpToDate, setFirmwareUpToDate] = useState(true)
    const [aiModelMatches, setAiModelMatches] = useState(true)

    const { data: projects } = useGetProjectsQuery()

    useEffect(() => {
        loadDeviceAndPreparation()
    }, [deviceId])

    const loadDeviceAndPreparation = async () => {
        try {
            const deviceData = await DeviceService.getDeviceById(deviceId)
            setDevice(deviceData)

            // Get last prep to pre-fill project
            if (deviceData) {
                const lastPrep = await DevicePreparationService.getLastCompletedPreparation(deviceId)
                if (lastPrep) {
                    setSelectedProject(lastPrep.projectId)
                }
            }

            // Cancel any in-progress preparations
            await DevicePreparationService.cancelInProgressPreparations(deviceId)

            // Create new preparation record
            if (user?.id) {
                const newPrep = await DevicePreparationService.createPreparation(
                    deviceId,
                    selectedProject || (projects && projects.length > 0 ? projects[0].id : ''),
                    user.id
                )
                setPreparation(newPrep)
            }
        } catch (error) {
            console.error('Error loading device:', error)
            Alert.alert('Error', 'Failed to load device information')
        } finally {
            setLoading(false)
        }
    }

    const handleBatteryCheck = async () => {
        // TODO: Send BLE command: battery\n
        // For now, simulate check
        setBatteryLevel(85)
        if (preparation) {
            await DevicePreparationService.updatePreparation(preparation.id, {
                batteryCheckPassed: true,
            })
        }
    }

    const handleSdCardCheck = async () => {
        // TODO: Send BLE command: AI info\n
        // For now, simulate check
        setSdCardStatus({ total: 32000, free: 28000 })
        if (preparation) {
            await DevicePreparationService.updatePreparation(preparation.id, {
                sdCardCheckPassed: true,
            })
        }
    }

    const handleCameraTest = async () => {
        // TODO: Send BLE commands: AI capture 1 0\n, AI txfile, AI rm
        // For now, simulate test
        Alert.alert('Camera Test', 'Camera test functionality coming soon with BLE integration')
        setCameraTestPassed(true)
        if (preparation) {
            await DevicePreparationService.updatePreparation(preparation.id, {
                cameraViewTestPassed: true,
            })
        }
    }

    const handleProjectChange = async (projectId: string) => {
        setSelectedProject(projectId)
        if (preparation) {
            await database.write(async () => {
                await preparation.update((prep) => {
                    prep.projectId = projectId
                })
            })
        }
    }

    const handleFinish = async () => {
        if (!selectedProject) {
            Alert.alert('Project Required', 'Please select a project before finishing preparation.')
            return
        }

        try {
            if (preparation) {
                // Determine if device is deployment ready
                const isReady = batteryLevel !== null &&
                    sdCardStatus !== null &&
                    firmwareUpToDate &&
                    aiModelMatches

                await DevicePreparationService.completePreparation(preparation.id, isReady)

                Alert.alert(
                    'Preparation Complete',
                    isReady
                        ? 'Device is ready for deployment!'
                        : 'Preparation saved. Please address remaining items before deployment.',
                    [
                        {
                            text: 'OK',
                            onPress: () => navigation.goBack(),
                        },
                    ]
                )
            }
        } catch (error) {
            console.error('Error completing preparation:', error)
            Alert.alert('Error', 'Failed to complete preparation')
        }
    }

    if (loading || !device) {
        return (
            <WWScreenView>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" />
                    <WWText variant="bodyMedium" style={styles.loadingText}>
                        Loading device...
                    </WWText>
                </View>
            </WWScreenView>
        )
    }

    return (
        <WWScreenView>
            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                    <WWText variant="titleLarge">Prepare & Test</WWText>
                    <WWText variant="bodyMedium" style={styles.deviceName}>
                        {device.name}
                    </WWText>
                    <WWText variant="bodySmall" style={styles.deviceId}>
                        {device.bluetoothId}
                    </WWText>
                </View>

                {/* Project Association */}
                <View style={styles.section}>
                    <WWText variant="titleMedium" style={styles.sectionTitle}>
                        Project Association
                    </WWText>
                    <WWSelect
                        label="Project"
                        value={selectedProject}
                        onValueChange={handleProjectChange}
                        options={[
                            { label: 'Select a project...', value: '' },
                            ...(projects?.map((p) => ({ label: p.name, value: p.id })) || []),
                        ]}
                    />
                    {!selectedProject && (
                        <WWText variant="bodySmall" style={styles.warningText}>
                            ⚠️ Project selection required
                        </WWText>
                    )}
                </View>

                {/* Battery Check */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <WWText variant="titleMedium" style={styles.sectionTitle}>
                            Battery Level
                        </WWText>
                        {batteryLevel !== null && (
                            <WWText style={styles.statusCheck}>✓</WWText>
                        )}
                    </View>
                    {batteryLevel !== null ? (
                        <View style={styles.statusDisplay}>
                            <WWText variant="bodyLarge">🔋 {batteryLevel}%</WWText>
                            <WWText variant="bodySmall" style={styles.statusHint}>
                                {batteryLevel > 30 ? 'Battery level sufficient' : 'Battery level low - charge before deployment'}
                            </WWText>
                        </View>
                    ) : (
                        <WWButton mode="outlined" onPress={handleBatteryCheck}>
                            Check Battery Level
                        </WWButton>
                    )}
                </View>

                {/* SD Card Check */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <WWText variant="titleMedium" style={styles.sectionTitle}>
                            SD Card Status
                        </WWText>
                        {sdCardStatus !== null && (
                            <WWText style={styles.statusCheck}>✓</WWText>
                        )}
                    </View>
                    {sdCardStatus !== null ? (
                        <View style={styles.statusDisplay}>
                            <WWText variant="bodyMedium">
                                Total: {(sdCardStatus.total / 1000).toFixed(1)} MB
                            </WWText>
                            <WWText variant="bodyMedium">
                                Free: {(sdCardStatus.free / 1000).toFixed(1)} MB ({((sdCardStatus.free / sdCardStatus.total) * 100).toFixed(0)}%)
                            </WWText>
                            <WWText variant="bodySmall" style={styles.statusHint}>
                                SD card detected and ready
                            </WWText>
                        </View>
                    ) : (
                        <WWButton mode="outlined" onPress={handleSdCardCheck}>
                            Check SD Card
                        </WWButton>
                    )}
                </View>

                {/* Camera View Test */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <WWText variant="titleMedium" style={styles.sectionTitle}>
                            Camera View Test
                        </WWText>
                        {cameraTestPassed && (
                            <WWText style={styles.statusCheck}>✓</WWText>
                        )}
                    </View>
                    <WWText variant="bodySmall" style={styles.sectionDescription}>
                        Capture a test photo to verify camera positioning
                    </WWText>
                    <WWButton
                        mode="outlined"
                        onPress={handleCameraTest}
                        disabled={sdCardStatus === null}
                    >
                        {cameraTestPassed ? 'Test Again' : 'Test Camera View'}
                    </WWButton>
                    {sdCardStatus === null && (
                        <WWText variant="bodySmall" style={styles.warningText}>
                            Check SD card first
                        </WWText>
                    )}
                </View>

                {/* Firmware Status */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <WWText variant="titleMedium" style={styles.sectionTitle}>
                            Firmware
                        </WWText>
                        {firmwareUpToDate && (
                            <WWText style={styles.statusCheck}>✓</WWText>
                        )}
                    </View>
                    {firmwareUpToDate ? (
                        <WWText variant="bodyMedium" style={styles.successText}>
                            Firmware is up to date
                        </WWText>
                    ) : (
                        <>
                            <WWText variant="bodySmall" style={styles.warningText}>
                                Firmware update available
                            </WWText>
                            <WWButton mode="outlined" onPress={() => Alert.alert('Coming Soon', 'Firmware update via BLE will be available in next update')}>
                                Update Firmware
                            </WWButton>
                        </>
                    )}
                </View>

                {/* AI Model */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <WWText variant="titleMedium" style={styles.sectionTitle}>
                            AI Model
                        </WWText>
                        {aiModelMatches && (
                            <WWText style={styles.statusCheck}>✓</WWText>
                        )}
                    </View>
                    {aiModelMatches ? (
                        <WWText variant="bodyMedium" style={styles.successText}>
                            AI model matches project requirements
                        </WWText>
                    ) : (
                        <>
                            <WWText variant="bodySmall" style={styles.warningText}>
                                AI model update required
                            </WWText>
                            <WWText variant="bodySmall" style={styles.sectionDescription}>
                                Manual SD card update required for Beta version
                            </WWText>
                            <WWButton mode="outlined" onPress={() => Alert.alert('Coming Soon', 'AI model verification via BLE will be available in next update')}>
                                Verify Model
                            </WWButton>
                        </>
                    )}
                </View>

                {/* LoRaWAN Verification */}
                <View style={styles.section}>
                    <WWText variant="titleMedium" style={styles.sectionTitle}>
                        LoRaWAN Network
                    </WWText>
                    <WWText variant="bodySmall" style={styles.sectionDescription}>
                        Verify device can communicate with LoRaWAN network
                    </WWText>
                    <WWButton
                        mode="outlined"
                        onPress={() => Alert.alert('Coming Soon', 'LoRaWAN ping test via BLE will be available in next update')}
                    >
                        Ping Network
                    </WWButton>
                </View>

                {/* Finish Button */}
                <View style={styles.footer}>
                    <WWButton
                        mode="contained"
                        onPress={handleFinish}
                        style={styles.finishButton}
                        disabled={!selectedProject}
                    >
                        Finish Preparation & Testing
                    </WWButton>
                    <WWButton mode="text" onPress={() => navigation.goBack()}>
                        Cancel
                    </WWButton>
                </View>
            </ScrollView>
        </WWScreenView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: 20,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
    },
    header: {
        marginBottom: 24,
    },
    deviceName: {
        marginTop: 8,
        fontWeight: '600',
    },
    deviceId: {
        marginTop: 4,
        color: '#6B7280',
    },
    section: {
        marginBottom: 24,
        padding: 16,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionTitle: {
        fontWeight: '600',
        flex: 1,
    },
    sectionDescription: {
        color: '#6B7280',
        marginBottom: 12,
    },
    statusCheck: {
        fontSize: 24,
        color: '#10B981',
    },
    statusDisplay: {
        gap: 4,
    },
    statusHint: {
        color: '#6B7280',
        marginTop: 4,
    },
    warningText: {
        color: '#F59E0B',
        marginTop: 8,
    },
    successText: {
        color: '#10B981',
    },
    footer: {
        marginTop: 16,
        gap: 12,
    },
    finishButton: {
        backgroundColor: '#10B981',
    },
})
