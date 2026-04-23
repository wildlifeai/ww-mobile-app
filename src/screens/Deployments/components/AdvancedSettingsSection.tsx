import React, { useCallback, useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { List, Card, Button, Text, TextInput } from 'react-native-paper'
import { WWButton } from '../../../components/ui/WWButton'
import { WWSelect } from '../../../components/ui/WWSelect'

import { CameraViewSection } from './CameraViewSection'
import { DeploymentMotionDetectionSection } from './DeploymentMotionDetectionSection'
import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { BatteryLevelCard } from './BatteryLevelCard'
import { SdCardStatusCard } from './SdCardStatusCard'
import { FirmwareStatusCard } from './FirmwareStatusCard'
import { UseFirmwareStatusReturn } from '../../Devices/hooks/useFirmwareStatus'


interface AdvancedSettingsSectionProps {
    device?: ExtendedPeripheral
    project?: any
    onImageCaptured: (path: string) => void
    cameraHeight: string
    onCameraHeightChange: (text: string) => void
    locationName: string
    onLocationNameChange: (text: string) => void
    availableLocations: {label: string, value: string}[]
    isCustomLocation: boolean
    setIsCustomLocation: (val: boolean) => void
    batteryLevel: number | null
    sdCardStatus: { total: number; free: number } | null
    handleBatteryCheck: () => void
    handleSdCardCheck: () => void
    isInitializing: boolean
    bleDeviceConnected: boolean
    theme: any
    onShowHelp: (title: string, content: string) => void
    firmwareStatus: UseFirmwareStatusReturn
}

export const AdvancedSettingsSection: React.FC<AdvancedSettingsSectionProps> = ({
    device,
    project,
    onImageCaptured,
    cameraHeight,
    onCameraHeightChange,
    locationName,
    onLocationNameChange,
    availableLocations,
    isCustomLocation,
    setIsCustomLocation,
    batteryLevel,
    sdCardStatus,
    handleBatteryCheck,
    handleSdCardCheck,
    isInitializing,
    bleDeviceConnected,
    theme,
    onShowHelp,
    firmwareStatus
}) => {
    const [expanded, setExpanded] = useState(false)

    // Battery Render Helpers

    const renderBatteryHelp = useCallback((props: any) => (
        <Button 
            {...props} 
            icon="help-circle-outline" 
            onPress={() => onShowHelp('Battery Level', 'Check the device battery level. It must be above 30% for monitoring.')}
        >
            <Text>Help</Text>
        </Button>
    ), [onShowHelp])

    // SD Card Render Helpers

    const renderSdCardHelp = useCallback((props: any) => (
        <Button 
            {...props} 
            icon="help-circle-outline" 
            onPress={() => onShowHelp('SD Card Status', 'Verifies SD card space. Ensure sufficient space is available for recordings.')}
        >
            <Text>Help</Text>
        </Button>
    ), [onShowHelp])

    // Location Render Helpers

    const renderLocationHelp = useCallback((props: any) => (
        <Button 
            {...props} 
            icon="help-circle-outline" 
            onPress={() => onShowHelp('Location & Camera Settings', 'Site Name: Name of the monitoring site.\n\nCamera Height: The height of the camera lens from the ground in centimeters.')}
        >
            <Text>Help</Text>
        </Button>
    ), [onShowHelp])


    const renderRightIcon = useCallback((props: any) => <List.Icon {...props} icon={expanded ? "chevron-up" : "chevron-down"} />, [expanded])

    return (
        <View>
            <List.Item
                title="Advanced Settings"
                right={renderRightIcon}
                onPress={() => setExpanded(!expanded)}
                style={styles.accordionHeader}
            />
            {expanded && (
                <View style={styles.accordionContent}>
                    
                    {/* Location & Camera Settings Card */}
                    <Card style={styles.card}>
                        <Card.Title title="Location & Camera Settings" right={renderLocationHelp} />
                    <Card.Content style={styles.content}>
                        {availableLocations.length > 0 && !isCustomLocation ? (
                            <View style={styles.inputContainer}>
                                <WWSelect
                                    label="Site Name"
                                    value={locationName}
                                    options={[...availableLocations, {label: '- Create New Site Location -', value: 'ADD_NEW'}]}
                                    onChange={(val) => {
                                        if (val === 'ADD_NEW') {
                                            setIsCustomLocation(true)
                                            onLocationNameChange('')
                                        } else {
                                            onLocationNameChange(val)
                                        }
                                    }}
                                />
                            </View>
                        ) : (
                            <View style={styles.inputContainer}>
                                <TextInput
                                    label="Site Name"
                                    value={locationName}
                                    onChangeText={onLocationNameChange}
                                    mode="outlined"
                                />
                                {availableLocations.length > 0 && (
                                    <WWButton mode="text" onPress={() => { setIsCustomLocation(false); if(availableLocations.length > 0) onLocationNameChange(availableLocations[0].value) }} style={styles.switchButton}>
                                        <Text>Select from nearby locations instead</Text>
                                    </WWButton>
                                )}
                            </View>
                        )}

                        <View style={styles.inputContainer}>
                            <TextInput
                                label="Camera Height (cm)"
                                placeholder="e.g. 50"
                                value={cameraHeight}
                                onChangeText={(text) => {
                                    if (/^\d*$/.test(text)) {
                                        onCameraHeightChange(text)
                                    }
                                }}
                                mode="outlined"
                                keyboardType="numeric"
                            />
                        </View>
                    </Card.Content>
                </Card>

                {/* Camera View & MD Rendered inside Advanced Settings */}
                <CameraViewSection
                    device={device}
                    onImageCaptured={onImageCaptured}
                    onShowHelp={onShowHelp}
                />

                <DeploymentMotionDetectionSection
                    device={device}
                    project={project}
                    onShowHelp={onShowHelp}
                />

                {/* Battery Check Card */}
                <BatteryLevelCard
                    batteryLevel={batteryLevel}
                    handleBatteryCheck={handleBatteryCheck}
                    isInitializing={isInitializing}
                    bleDeviceConnected={bleDeviceConnected}
                    renderBatteryHelp={renderBatteryHelp}
                    styles={styles}
                />

                {/* SD Card Check Card */}
                <SdCardStatusCard
                    sdCardStatus={sdCardStatus}
                    handleSdCardCheck={handleSdCardCheck}
                    isInitializing={isInitializing}
                    bleDeviceConnected={bleDeviceConnected}
                    renderSdCardHelp={renderSdCardHelp}
                    styles={styles}
                />

                {/* Firmware Status Card */}
                <FirmwareStatusCard
                    firmwareStatus={firmwareStatus}
                    theme={theme}
                    onShowHelp={onShowHelp}
                />

                </View>
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    accordionHeader: {
        backgroundColor: 'transparent',
        paddingHorizontal: 0,
    },
    accordionContent: {
        gap: 16,
        paddingBottom: 16,
        paddingHorizontal: 0,
    },
    card: {
        width: '100%',
    },
    content: {
        gap: 16,
    },
    inputContainer: {
        marginBottom: 8,
    },
    switchButton: {
        marginTop: 4,
        alignSelf: 'flex-start'
    },
    statusDisplay: {
        gap: 4,
        marginTop: 8,
    },
    statusHint: {
        opacity: 0.6,
        marginTop: 4,
        fontSize: 12,
    },
    actionButton: {
        marginTop: 8,
    },
    firmwareVersionText: {
        marginBottom: 8,
    },
    warningText: {
        marginTop: 8,
    },
    successText: {
        marginBottom: 12,
    },
    updatingContainer: {
        marginTop: 8,
    }
})
