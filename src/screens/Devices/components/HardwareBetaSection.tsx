import React, { useCallback } from 'react'
import { StyleSheet } from 'react-native'
import { Card, Button } from 'react-native-paper'
import { WWText } from '../../../components/ui/WWText'
import { WWButton } from '../../../components/ui/WWButton'
import { WWIcon } from '../../../components/ui/WWIcon'

interface HardwareBetaSectionProps {
    theme: any
    onShowHelp: (title: string, content: string) => void
}

export const HardwareBetaSection: React.FC<HardwareBetaSectionProps> = ({
    // theme,
    onShowHelp
}) => {
    const renderAiIcon = useCallback((props: any) => <WWIcon {...props} source="brain" />, [])
    const renderAiHelp = useCallback((props: any) => (
        <Button 
            {...props} 
            icon="help-circle-outline" 
            onPress={() => onShowHelp('AI Model', 'Verify the installed AI model for object detection. (Beta Feature)')}
        >
            Help
        </Button>
    ), [onShowHelp])

    const renderLoraIcon = useCallback((props: any) => <WWIcon {...props} source="access-point-network" />, [])
    const renderLoraHelp = useCallback((props: any) => (
        <Button 
            {...props} 
            icon="help-circle-outline" 
            onPress={() => onShowHelp('LoRaWAN Network', 'Test LoRaWAN connectivity using a ping command. (Beta Feature)')}
        >
            Help
        </Button>
    ), [onShowHelp])

    return (
        <>
            {/* AI Model */}
            <Card style={styles.card}>
                <Card.Title
                    title="AI Model"
                    left={renderAiIcon}
                    right={renderAiHelp}
                />
                <Card.Content>
                    <WWText variant="bodySmall" style={styles.infoText}>
                        🚧 AI Model verification coming soon
                    </WWText>
                    <WWText variant="bodySmall" style={styles.sectionDescription}>
                        For Beta: Manually update AI model via SD card, then use "Verify Model" button to confirm installation.
                    </WWText>
                    <WWButton mode="outlined" disabled>
                        Verify Model (In Progress)
                    </WWButton>
                </Card.Content>
            </Card>

            {/* LoRaWAN Verification */}
            <Card style={styles.card}>
                <Card.Title
                    title="LoRaWAN Network"
                    left={renderLoraIcon}
                    right={renderLoraHelp}
                />
                <Card.Content>
                    <WWText variant="bodySmall" style={styles.infoText}>
                        🚧 LoRaWAN ping test coming soon
                    </WWText>
                    <WWText variant="bodySmall" style={styles.sectionDescription}>
                        Will use "ping" BLE command to verify network connectivity and display RSSI/SNR signal strength.
                    </WWText>
                    <WWButton mode="outlined" disabled>
                        Ping Network (In Progress)
                    </WWButton>
                </Card.Content>
            </Card>
        </>
    )
}

const styles = StyleSheet.create({
    card: {
        // marginBottom: 16, // Removed to use gap in parent container
    },
    sectionDescription: {
        opacity: 0.6,
        marginBottom: 12,
    },
    infoText: {
        marginBottom: 8,
    },
})
