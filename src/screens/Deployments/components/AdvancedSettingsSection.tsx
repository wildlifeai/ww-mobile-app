import React, { useCallback, useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { List, Text, TextInput } from 'react-native-paper'
import { WWButton } from '../../../components/ui/WWButton'
import { WWSelect } from '../../../components/ui/WWSelect'
import { FieldBox } from '../../../components/ui/FieldBox'
import { UseFirmwareStatusReturn } from '../../Devices/hooks/useFirmwareStatus'
import { BatteryAction, FirmwareAction, SdCardAction } from './DeviceCheckActions'

interface AdvancedSettingsSectionProps {
    cameraHeight: string
    onCameraHeightChange: (text: string) => void
    locationName: string
    onLocationNameChange: (text: string) => void
    availableLocations: { label: string, value: string }[]
    isCustomLocation: boolean
    setIsCustomLocation: (val: boolean) => void
    batteryLevel: number | null
    sdCardStatus: { total: number; free: number } | null
    handleBatteryCheck: () => void
    handleSdCardCheck: () => void
    isCheckingBattery?: boolean
    isCheckingSdCard?: boolean
    // The raw BMP capture format was retired on 21 September 2026; see
    // useStartDeployment, step 7b, for why. Its card went with the
    // 26 October 2026 redesign.
    isInitializing: boolean
    bleDeviceConnected: boolean
    onShowHelp: (title: string, content: string) => void
    firmwareStatus: UseFirmwareStatusReturn
    onUpdateFirmware?: (target: 'ble' | 'himax') => void
}

/**
 * Start Monitoring's Advanced settings: one plain row, collapsed by default.
 * Inside, in this order (26 October 2026): Site Name, Camera Height, then the
 * battery, SD card and firmware checks. Test Motion Detection sits on the page.
 */
export const AdvancedSettingsSection: React.FC<AdvancedSettingsSectionProps> = ({
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
    isCheckingBattery,
    isCheckingSdCard,
    isInitializing,
    bleDeviceConnected,
    onShowHelp,
    firmwareStatus,
    onUpdateFirmware
}) => {
    const [expanded, setExpanded] = useState(false)
    const checksBlocked = isInitializing || !bleDeviceConnected
    const renderChevron = useCallback(
        (props: any) => <List.Icon {...props} icon={expanded ? 'chevron-up' : 'chevron-down'} />,
        [expanded],
    )

    return (
        <View>
            <List.Item
                title="Advanced settings"
                right={renderChevron}
                onPress={() => setExpanded(!expanded)}
                style={styles.accordionHeader}
            />
            {expanded && (
                <View style={styles.content}>
                    <FieldBox title="Site Name" onHelp={() => onShowHelp('Site Name', 'The name of the monitoring site. Pick one used before nearby, or create a new one.')}>
                        {availableLocations.length > 0 && !isCustomLocation ? (
                            <WWSelect
                                value={locationName}
                                options={[...availableLocations, { label: '- Create New Site Location -', value: 'ADD_NEW' }]}
                                onChange={(val) => {
                                    if (val === 'ADD_NEW') {
                                        setIsCustomLocation(true)
                                        onLocationNameChange('')
                                    } else {
                                        onLocationNameChange(val)
                                    }
                                }}
                            />
                        ) : (
                            <TextInput value={locationName} onChangeText={onLocationNameChange} mode="outlined" />
                        )}
                    </FieldBox>
                    {isCustomLocation && availableLocations.length > 0 && (
                        <WWButton
                            mode="text"
                            onPress={() => { setIsCustomLocation(false); onLocationNameChange(availableLocations[0].value) }}
                        >
                            <Text>Select from nearby locations instead</Text>
                        </WWButton>
                    )}

                    <FieldBox title="Camera Height (cm)" onHelp={() => onShowHelp('Camera Height', 'The height of the camera lens from the ground, in centimetres.')}>
                        <TextInput
                            value={cameraHeight}
                            onChangeText={(text) => {
                                if (/^\d*$/.test(text)) onCameraHeightChange(text)
                            }}
                            mode="outlined"
                            keyboardType="numeric"
                        />
                    </FieldBox>

                    <BatteryAction
                        batteryLevel={batteryLevel}
                        onCheck={handleBatteryCheck}
                        isChecking={isCheckingBattery}
                        disabled={checksBlocked}
                        onShowHelp={onShowHelp}
                    />
                    <SdCardAction
                        sdCardStatus={sdCardStatus}
                        onCheck={handleSdCardCheck}
                        isChecking={isCheckingSdCard}
                        disabled={checksBlocked}
                        onShowHelp={onShowHelp}
                    />
                    <FirmwareAction
                        firmwareStatus={firmwareStatus}
                        onUpdateFirmware={onUpdateFirmware}
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
    content: {
        gap: 16,
        paddingBottom: 16,
    },
})
