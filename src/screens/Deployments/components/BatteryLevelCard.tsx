import React from 'react'
import { View } from 'react-native'
import { Card, Text } from 'react-native-paper'
import { WWText } from '../../../components/ui/WWText'
import { WWButton } from '../../../components/ui/WWButton'

interface BatteryLevelCardProps {
    batteryLevel: number | null
    handleBatteryCheck: () => void
    isInitializing: boolean
    bleDeviceConnected: boolean
    /**
     * True while a check is on the wire. The button says so and cannot be
     * tapped again; without it a re-check that returns the same figure looks
     * like a dead button.
     */
    isChecking?: boolean
    /** Optional: the Dev Deployment Test shows this card with no help button. */
    renderBatteryHelp?: (props: any) => React.ReactNode
    styles: any
}

export const BatteryLevelCard: React.FC<BatteryLevelCardProps> = ({
    batteryLevel,
    handleBatteryCheck,
    isInitializing,
    bleDeviceConnected,
    isChecking = false,
    renderBatteryHelp,
    styles,
}) => {
    const busy = isInitializing || !bleDeviceConnected || isChecking
    return (
        <Card style={styles.card}>
            <Card.Title
                title="Battery Level"
                right={renderBatteryHelp}
            />
            <Card.Content>
                {batteryLevel !== null ? (
                    <View>
                        <View style={styles.statusDisplay}>
                            <WWText variant="bodyLarge"><Text>🔋 {batteryLevel}%</Text></WWText>
                            <WWText variant="bodySmall" style={styles.statusHint}>
                                <Text>{batteryLevel > 30 ? 'Battery level sufficient' : 'Battery level low - charge before monitoring'}</Text>
                            </WWText>
                        </View>
                        <WWButton mode="outlined" onPress={handleBatteryCheck} style={styles.actionButton} disabled={busy} loading={isChecking}>
                            <Text>{isChecking ? 'Checking…' : 'Check Again'}</Text>
                        </WWButton>
                    </View>
                ) : (
                    <WWButton mode="outlined" onPress={handleBatteryCheck} disabled={busy} loading={isChecking}>
                        <Text>{isChecking ? 'Checking…' : 'Check Battery Level'}</Text>
                    </WWButton>
                )}
            </Card.Content>
        </Card>
    )
}
