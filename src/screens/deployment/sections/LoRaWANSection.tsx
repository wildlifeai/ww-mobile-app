import React, { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Card, Button, Text, ActivityIndicator, useTheme } from 'react-native-paper'
import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { useBleCommands } from '../../../hooks/useBleCommands'
import { WWIcon } from '../../../components/ui/WWIcon'

interface Props {
    device?: ExtendedPeripheral
}

export const LoRaWANSection = ({ device }: Props) => {
    const theme = useTheme()
    const { pingNetwork } = useBleCommands()
    const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle')
    const [message, setMessage] = useState('')

    const handlePing = async () => {
        if (!device) return
        setStatus('testing')
        setMessage('Sending ping...')
        try {
            await pingNetwork(device)
            // In a real scenario, we might wait for an event/log confirms success.
            // For now, assume if write succeeds, the test command was sent.
            // We can check logs in a more advanced version.
            setStatus('success')
            setMessage('Ping command sent successfully. Verify reception on server.')
        } catch (error) {
            console.error('Ping failed:', error)
            setStatus('failed')
            setMessage('Failed to send ping command.')
        }
    }

    return (
        <Card style={styles.card}>
            <Card.Title title="LoRaWAN Signal Test" left={(props) => <WWIcon {...props} source="wifi" />} />
            <Card.Content style={styles.content}>
                <View style={styles.statusRow}>
                    <Text variant="bodyMedium" style={{ flex: 1 }}>
                        Status: {status === 'idle' ? 'Not Tested' :
                            status === 'testing' ? 'Testing...' :
                                status === 'success' ? 'Command Sent' : 'Failed'}
                    </Text>
                    {status === 'success' && <WWIcon source="check-circle" color={theme.colors.primary} size={24} />}
                    {status === 'failed' && <WWIcon source="alert-circle" color={theme.colors.error} size={24} />}
                </View>

                {message ? <Text variant="bodySmall" style={{ color: theme.colors.outline }}>{message}</Text> : null}

                <Button
                    mode="outlined"
                    onPress={handlePing}
                    loading={status === 'testing'}
                    disabled={!device || status === 'testing'}
                    icon="refresh"
                >
                    Test Connectivity
                </Button>
            </Card.Content>
        </Card>
    )
}

const styles = StyleSheet.create({
    card: { marginBottom: 16 },
    content: { gap: 12 },
    statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }
})
