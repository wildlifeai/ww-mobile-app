import { useState, useCallback, useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { Card, Button, Text, useTheme, List } from 'react-native-paper'
import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { createBleSession } from '../../../ble/session/createBleSession'
import { pingLorawan, LorawanPingResult, LORAWAN_PING_WORDS } from '../../../ble/workflows/lorawanPing'
import { WWIcon } from '../../../components/ui/WWIcon'


interface Props {
    device?: ExtendedPeripheral
    onShowHelp: (title: string, content: string) => void
}

export const LoRaWANSection = ({ device, onShowHelp }: Props) => {
    const theme = useTheme()
    const [status, setStatus] = useState<'idle' | 'testing' | LorawanPingResult>('idle')
    const [expanded, setExpanded] = useState(false)

    const handlePing = useCallback(async () => {
        if (!device) return
        setStatus('testing')
        setStatus(await pingLorawan(createBleSession(device)))
    }, [device])

    const words = status === 'idle' || status === 'testing' ? null : LORAWAN_PING_WORDS[status]

    const dynamicStyles = useMemo(() => ({
        statusText: { flex: 1, color: theme.colors.onSurface },
        messageText: { color: theme.colors.outline }
    }), [theme])

    const renderRight = useCallback((props: any) => (
        <Button
            {...props}
            icon="help-circle-outline"
            onPress={() => onShowHelp('LoRaWAN Signal Test', 'Asks the camera to send one test message over LoRaWAN now. It can only send once it has joined a network through a gateway, so the result also tells you whether it has.')}
        >
            <Text>Help</Text>
        </Button>
    ), [onShowHelp])

    const renderRightIcon = useCallback((props: any) => <List.Icon {...props} icon={expanded ? "chevron-up" : "chevron-down"} />, [expanded])

    return (
        <View>
            { }
            <List.Item
                title="LoRaWAN Network Test"
                right={renderRightIcon}
                onPress={() => setExpanded(!expanded)}
                style={styles.accordionHeader}
                left={props => <List.Icon {...props} icon="access-point" />}
            />
            { }
            {expanded && (
                <Card style={styles.card}>
                    <Card.Title
                        title="LoRaWAN Signal Test"
                        right={renderRight}
                    />
                    <Card.Content style={styles.content}>
                        <View style={styles.statusRow}>
                    <Text variant="bodyMedium" style={dynamicStyles.statusText}>
                        Status: {words ? words.status : status === 'testing' ? 'Testing…' : 'Not Tested'}
                    </Text>
                    {status === 'sent' && <WWIcon source="check-circle" color={theme.colors.primary} size={24} />}
                    {status === 'busy' && <WWIcon source="clock-outline" color={theme.colors.outline} size={24} />}
                    {(status === 'not_joined' || status === 'off' || status === 'no_answer') && <WWIcon source="alert-circle" color={theme.colors.error} size={24} />}
                </View>

                {status === 'testing' && <Text variant="bodySmall" style={dynamicStyles.messageText}>Sending a test message…</Text>}
                {words && <Text variant="bodySmall" style={dynamicStyles.messageText}>{words.detail}</Text>}

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
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    accordionHeader: {
        backgroundColor: 'transparent',
        paddingHorizontal: 0,
    },
    card: { marginBottom: 8 },
    content: { gap: 12 },
    statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }
})
