import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native'
import { Button, ActivityIndicator, Divider } from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRoute, useNavigation } from '@react-navigation/native'

import { useExtendedTheme } from '../../theme'
import { useAppSelector } from '../../redux'
import { WWText } from '../../components/ui/WWText'
import { useFirmwareStatus, FirmwareComponentStatus } from './hooks/useFirmwareStatus'

export const FirmwareStatusScreen = () => {
    const route = useRoute<any>()
    const navigation = useNavigation<any>()
    const { colors, spacing } = useExtendedTheme()

    const deviceId = route.params?.deviceId
    const device = useAppSelector(state => state.devices[deviceId || ''])

    const {
        isChecking,
        lastChecked,
        statuses,
        checkStatus,
        errorMsg,
    } = useFirmwareStatus({ device })

    const renderComponentCard = (title: string, status: FirmwareComponentStatus, updateAction: () => void) => {
        return (
            <View style={[styles.card, { backgroundColor: colors.surfaceVariant, marginBottom: spacing }]}>
                <View style={styles.cardHeader}>
                    <WWText variant="titleMedium" style={{ color: colors.onSurfaceVariant }}>
                        {title}
                    </WWText>
                    {status.isOutdated ? (
                        <WWText variant="labelMedium" style={[styles.statusText, { color: colors.error }]}>
                            OUTDATED
                        </WWText>
                    ) : (
                        <WWText variant="labelMedium" style={[styles.statusText, styles.statusOk]}>
                            UP TO DATE
                        </WWText>
                    )}
                </View>

                <Divider style={styles.divider} />

                <View style={styles.versionRow}>
                    <WWText variant="bodyMedium" style={[styles.flex1, { color: colors.onSurfaceVariant }]}>
                        Device Version:
                    </WWText>
                    <WWText variant="bodyMedium" style={[styles.boldText, { color: status.isOutdated ? colors.error : colors.onSurfaceVariant }]}>
                        {status.currentVersion}
                    </WWText>
                </View>

                <View style={styles.versionRow}>
                    <WWText variant="bodyMedium" style={[styles.flex1, { color: colors.onSurfaceVariant }]}>
                        Latest Available:
                    </WWText>
                    <WWText variant="bodyMedium" style={[styles.boldText, { color: colors.primary }]}>
                        {status.latestVersion}
                    </WWText>
                </View>

                <Button
                    mode="contained"
                    style={styles.marginTop12}
                    onPress={updateAction}
                    disabled={!device?.connected || isChecking}
                >
                    Update {title}
                </Button>
            </View>
        )
    }

    return (
        <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
            <ScrollView 
                contentContainerStyle={[styles.content, { padding: spacing }]}
                refreshControl={
                    <RefreshControl refreshing={isChecking} onRefresh={checkStatus} tintColor={colors.primary} />
                }
            >
                <WWText variant="titleLarge" style={{ marginBottom: spacing }}>
                    Firmware Status
                </WWText>

                <WWText style={{ marginBottom: spacing }}>
                    Compare the currently installed firmware versions on the device against the
                    latest versions available in the cloud.
                </WWText>

                {errorMsg && (
                    <View style={[styles.errorBanner, { marginBottom: spacing }]}>
                        <WWText style={styles.errorText}>⚠️ {errorMsg}</WWText>
                    </View>
                )}

                {!lastChecked && isChecking ? (
                    <ActivityIndicator animating size="large" color={colors.primary} style={styles.loadingSpinner} />
                ) : (
                    <>
                        {renderComponentCard(
                            'BLE Firmware (nRF52)', 
                            statuses.ble, 
                            () => navigation.navigate('FirmwareUpdateScreen', { deviceId, target: 'ble' })
                        )}
                        
                        {renderComponentCard(
                            'AI Processor Firmware (Himax)', 
                            statuses.himax, 
                            () => navigation.navigate('FirmwareUpdateScreen', { deviceId, target: 'himax' })
                        )}

                        {lastChecked && (
                            <WWText variant="bodySmall" style={[styles.lastCheckedText, { marginTop: spacing }]}>
                                Last checked: {lastChecked.toLocaleTimeString()}
                            </WWText>
                        )}
                    </>
                )}

            </ScrollView>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flexGrow: 1,
    },
    card: {
        padding: 16,
        borderRadius: 8,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    versionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 4,
    },
    errorBanner: {
        backgroundColor: '#BF360C',
        padding: 12,
        borderRadius: 8,
    },
    statusText: {
        fontWeight: 'bold',
    },
    statusOk: {
        color: '#4CAF50',
    },
    divider: {
        marginVertical: 8,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    flex1: {
        flex: 1,
    },
    boldText: {
        fontWeight: 'bold',
    },
    marginTop12: {
        marginTop: 12,
    },
    errorText: {
        color: '#FFF3E0',
    },
    loadingSpinner: {
        marginTop: 40,
    },
    lastCheckedText: {
        textAlign: 'center',
        opacity: 0.6,
    },
})
