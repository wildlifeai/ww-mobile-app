import React from 'react'
import { View } from 'react-native'
import { Card, Text } from 'react-native-paper'
import { WWText } from '../../../components/ui/WWText'
import { WWButton } from '../../../components/ui/WWButton'

interface SdCardStatusCardProps {
    sdCardStatus: { total: number; free: number } | null
    handleSdCardCheck: () => void
    isInitializing: boolean
    bleDeviceConnected: boolean
    renderSdCardHelp: (props: any) => React.ReactNode
    styles: any
}

export const SdCardStatusCard: React.FC<SdCardStatusCardProps> = ({
    sdCardStatus,
    handleSdCardCheck,
    isInitializing,
    bleDeviceConnected,
    renderSdCardHelp,
    styles,
}) => {
    return (
        <Card style={styles.card}>
            <Card.Title
                title="SD Card Status"
                right={renderSdCardHelp}
            />
            <Card.Content>
                {sdCardStatus !== null ? (
                    <View>
                        <View style={styles.statusDisplay}>
                            <WWText variant="bodyLarge">
                                <Text>💾 {Math.round((sdCardStatus.free / sdCardStatus.total) * 100)}% available of {Math.round(sdCardStatus.total / 1024 / 1024)}GB</Text>
                            </WWText>
                            <WWText variant="bodySmall" style={styles.statusHint}>
                                <Text>{(sdCardStatus.free / sdCardStatus.total) > 0.1
                                    ? 'SD card has sufficient space'
                                    : 'SD card is nearly full - free up space'}</Text>
                            </WWText>
                        </View>
                        <WWButton mode="outlined" onPress={handleSdCardCheck} style={styles.actionButton} disabled={isInitializing || !bleDeviceConnected}>
                            <Text>Check Again</Text>
                        </WWButton>
                    </View>
                ) : (
                    <WWButton mode="outlined" onPress={handleSdCardCheck} disabled={isInitializing || !bleDeviceConnected}>
                        <Text>Check SD Card</Text>
                    </WWButton>
                )}
            </Card.Content>
        </Card>
    )
}
