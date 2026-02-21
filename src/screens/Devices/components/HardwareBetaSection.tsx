import React, { useCallback } from 'react'
import { StyleSheet } from 'react-native'
import { Card, Button, Text } from 'react-native-paper'
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
            <Text>Help</Text>
        </Button>
    ), [onShowHelp])

    const renderLoraIcon = useCallback((props: any) => <WWIcon {...props} source="access-point-network" />, [])
    const renderLoraHelp = useCallback((props: any) => (
        <Button 
            {...props} 
            icon="help-circle-outline" 
            onPress={() => onShowHelp('LoRaWAN Network', 'Test LoRaWAN connectivity using a ping command. (Beta Feature)')}
        >
            <Text>Help</Text>
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
                        <Text>🚧 AI Model verification coming soon</Text>
                    </WWText>
                    <WWText variant="bodySmall" style={styles.sectionDescription}>
                        <Text>For Beta: Manually update AI model via SD card, then use "Verify Model" button to confirm installation.</Text>
                    </WWText>
                    <WWButton mode="outlined" disabled>
                        <Text>Verify Model (In Progress)</Text>
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
                        <Text>🚧 LoRaWAN ping test coming soon</Text>
                    </WWText>
                    <WWText variant="bodySmall" style={styles.sectionDescription}>
                        <Text>Will use "ping" BLE command to verify network connectivity and display RSSI/SNR signal strength.</Text>
                    </WWText>
                    <WWButton mode="outlined" disabled>
                        <Text>Ping Network (In Progress)</Text>
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
