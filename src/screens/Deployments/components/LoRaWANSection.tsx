import { useState, useCallback, useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { Card, Button, Text, useTheme } from 'react-native-paper'
import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { useBleCommands } from '../../../hooks/useBleCommands'
import { WWIcon } from '../../../components/ui/WWIcon'
import { logError } from '../../../utils/logger'


interface Props {
    device?: ExtendedPeripheral
    onShowHelp: (title: string, content: string) => void
}

export const LoRaWANSection = ({ device, onShowHelp }: Props) => {
    const theme = useTheme()
    const { pingNetwork } = useBleCommands()
    const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle')
    const [message, setMessage] = useState('')

    const handlePing = useCallback(async () => {
        if (!device) return
        setStatus('testing')
        setMessage('Sending ping...')
        try {
            await pingNetwork(device)
            setStatus('success')
            setMessage('Ping command sent successfully. Verify reception on server.')
        } catch (error) {
            logError('Ping failed:', error)
            setStatus('failed')
            setMessage('Failed to send ping command.')
        }
    }, [device, pingNetwork])

    const dynamicStyles = useMemo(() => ({
        statusText: { flex: 1, color: theme.colors.onSurface },
        messageText: { color: theme.colors.outline }
    }), [theme])

    const renderLeft = useCallback((props: any) => <WWIcon {...props} source="wifi" />, [])
    const renderRight = useCallback((props: any) => (
        <Button
            {...props}
            icon="help-circle-outline"
            onPress={() => onShowHelp('LoRaWAN Signal Test', 'Sends a ping through the LoRaWAN network to verify the device can transmit data to the gateway.')}
        >
            <Text>Help</Text>
        </Button>
    ), [onShowHelp])

    return (
        <Card style={styles.card}>
            <Card.Title
                title="LoRaWAN Signal Test"
                left={renderLeft}
                right={renderRight}
            />
            <Card.Content style={styles.content}>
                <View style={styles.statusRow}>
                    <Text variant="bodyMedium" style={dynamicStyles.statusText}>
                        Status: {status === 'idle' ? 'Not Tested' :
                            status === 'testing' ? 'Testing...' :
                                status === 'success' ? 'Command Sent' : 'Failed'}
                    </Text>
                    {status === 'success' && <WWIcon source="check-circle" color={theme.colors.primary} size={24} />}
                    {status === 'failed' && <WWIcon source="alert-circle" color={theme.colors.error} size={24} />}
                </View>

                {message ? <Text variant="bodySmall" style={dynamicStyles.messageText}>{message}</Text> : null}

                <Button
                    mode="outlined"
                    onPress={handlePing}
                    loading={status === 'testing'}
                    disabled={!device || status === 'testing'}
                    icon="refresh"
                >
                    <Text>Test Connectivity</Text>
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
