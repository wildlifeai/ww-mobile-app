import React from 'react'
import { View, StyleSheet } from 'react-native'
import { Text } from 'react-native-paper'
import { WWText } from '../../../components/ui/WWText'
import { WWButton } from '../../../components/ui/WWButton'

interface HardwareBetaSectionProps {
    theme: any
}

export const HardwareBetaSection: React.FC<HardwareBetaSectionProps> = ({
    theme
}) => {
    return (
        <>
            {/* AI Model */}
            <View style={styles.section}>
                <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                    AI Model
                </Text>
                <WWText variant="bodySmall" style={styles.infoText}>
                    🚧 AI Model verification coming soon
                </WWText>
                <WWText variant="bodySmall" style={styles.sectionDescription}>
                    For Beta: Manually update AI model via SD card, then use "Verify Model" button to confirm installation.
                </WWText>
                <WWButton mode="outlined" disabled>
                    Verify Model (In Progress)
                </WWButton>
            </View>

            {/* LoRaWAN Verification */}
            <View style={styles.section}>
                <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                    LoRaWAN Network
                </Text>
                <WWText variant="bodySmall" style={styles.infoText}>
                    🚧 LoRaWAN ping test coming soon
                </WWText>
                <WWText variant="bodySmall" style={styles.sectionDescription}>
                    Will use "ping" BLE command to verify network connectivity and display RSSI/SNR signal strength.
                </WWText>
                <WWButton mode="outlined" disabled>
                    Ping Network (In Progress)
                </WWButton>
            </View>
        </>
    )
}

const styles = StyleSheet.create({
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontWeight: '600',
        marginBottom: 16,
    },
    sectionDescription: {
        opacity: 0.6,
        marginBottom: 12,
    },
    infoText: {
        marginBottom: 8,
    },
})
