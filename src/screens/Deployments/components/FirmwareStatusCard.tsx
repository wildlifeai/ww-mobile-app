import React, { useCallback } from 'react'
import { StyleSheet, View } from 'react-native'
import { Card, Button, Divider } from 'react-native-paper'
import { WWText } from '../../../components/ui/WWText'
import { UseFirmwareStatusReturn } from '../../Devices/hooks/useFirmwareStatus'

interface FirmwareStatusCardProps {
    firmwareStatus: UseFirmwareStatusReturn
    theme: any
    onShowHelp: (title: string, content: string) => void
}

interface FirmwareRowProps {
    title: string
    status: any
    theme: any
}

const FirmwareRow: React.FC<FirmwareRowProps> = ({ title, status, theme }) => (
    <View style={styles.row}>
        <View style={styles.rowHeader}>
            <WWText variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>{title}</WWText>
            {status.isOutdated ? (
                <WWText variant="labelSmall" style={{ color: theme.colors.error, fontWeight: 'bold' }}>UPDATE AVAILABLE</WWText>
            ) : (
                <WWText variant="labelSmall" style={{ color: '#4CAF50', fontWeight: 'bold' }}>UP TO DATE</WWText>
            )}
        </View>
        <WWText variant="bodySmall" style={{ opacity: 0.7 }}>
            Current: {status.currentVersion} | Latest: {status.latestVersion}
        </WWText>
    </View>
)

export const FirmwareStatusCard: React.FC<FirmwareStatusCardProps> = ({
    firmwareStatus,
    theme,
    onShowHelp
}) => {
    const { statuses, isChecking, checkStatus } = firmwareStatus

    const renderHelp = useCallback((props: any) => (
        <Button 
            {...props} 
            icon="help-circle-outline" 
            onPress={() => onShowHelp('Firmware Versions', 'Displays the currently installed firmware versions versus the latest available versions in the cloud. You can update firmware from the Engineer Console.')}
        >
            <WWText>Help</WWText>
        </Button>
    ), [onShowHelp])

    return (
        <Card style={styles.card}>
            <Card.Title title="Firmware Versions" right={renderHelp} />
            <Card.Content>
                <FirmwareRow title="BLE Firmware" status={statuses.ble} theme={theme} />
                <Divider style={styles.divider} />
                <FirmwareRow title="AI Processor Firmware" status={statuses.himax} theme={theme} />

                <Button 
                    mode="outlined" 
                    onPress={checkStatus} 
                    loading={isChecking}
                    disabled={isChecking}
                    style={styles.checkButton}
                >
                    <WWText>Refresh Status</WWText>
                </Button>
            </Card.Content>
        </Card>
    )
}

const styles = StyleSheet.create({
    card: {
        width: '100%',
    },
    row: {
        paddingVertical: 8,
    },
    rowHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    divider: {
        marginVertical: 4,
    },
    checkButton: {
        marginTop: 16,
    }
})
