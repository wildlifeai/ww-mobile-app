import { useEffect } from 'react'
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native'
import { Button, ActivityIndicator } from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRoute, useNavigation, useIsFocused } from '@react-navigation/native'

import { useExtendedTheme } from '../../theme'
import { useAppSelector } from '../../redux'
import { WWText } from '../../components/ui/WWText'
import { useFirmwareStatus, FirmwareComponentStatus } from './hooks/useFirmwareStatus'
import { friendlyVersion, missingFirmware } from '../../utils/firmwareWords'

interface FirmwareComponentCardProps {
    title: string
    status: FirmwareComponentStatus
    colors: any
    spacing: number
    isChecking: boolean
    isConnected: boolean
    /** Opened from the Engineer Console: Update stays offered when up to date */
    engineer: boolean
    onUpdate: () => void
}

/**
 * "Up to date: 30 Sep build", or "23 Sep build, update available" (#344), or,
 * with one camera's build in the catalogue, "23 Sep build. The colour camera's
 * new firmware is not available yet" rather than either (#437)
 */
const statusLine = (status: FirmwareComponentStatus): string => {
    const current = status.currentVersion && status.currentVersion !== 'Unknown'
        ? friendlyVersion(status.currentVersion)
        : null
    if (!status.currentVersion) return 'Checking…'
    if (status.isOutdated) return current ? `${current}, update available` : 'Update available'
    if (status.missingVariant) {
        return current ? `${current}. ${missingFirmware(status.missingVariant)}` : missingFirmware(status.missingVariant)
    }
    return current ? `Up to date: ${current}` : 'Version unknown'
}

const FirmwareComponentCard = ({ title, status, colors, spacing, isChecking, isConnected, engineer, onUpdate }: FirmwareComponentCardProps) => (
    <View style={[styles.card, { backgroundColor: colors.surfaceVariant, marginBottom: spacing }]}>
        <WWText variant="titleMedium" style={{ color: colors.onSurfaceVariant }}>
            {title}
        </WWText>
        <WWText variant="bodyMedium" style={{ color: status.isOutdated ? colors.error : colors.onSurfaceVariant }}>
            {statusLine(status)}
        </WWText>
        {(status.isOutdated || engineer) && (
            <Button
                mode="contained"
                style={styles.marginTop12}
                onPress={onUpdate}
                disabled={!isConnected || isChecking}
            >
                <WWText>Update</WWText>
            </Button>
        )}
    </View>
)

export const FirmwareStatusScreen = () => {
    const route = useRoute<any>()
    const navigation = useNavigation<any>()
    const { colors, spacing } = useExtendedTheme()

    const deviceId = route.params?.deviceId
    // Opened from the Engineer Console: the update screens it opens are its view (#344)
    const engineer: boolean = route.params?.engineer ?? false
    const device = useAppSelector(state => state.devices[deviceId || ''])
    const isFocused = useIsFocused()

    const {
        isChecking,
        lastChecked,
        statuses,
        checkStatus,
        errorMsg,
    } = useFirmwareStatus({ device })

    // Automatically check firmware status when this screen is focused and device is connected
    useEffect(() => {
        if (isFocused && device?.connected) {
            checkStatus()
        }
    }, [isFocused, device?.connected, checkStatus])

    return (
        <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
            <ScrollView 
                contentContainerStyle={[styles.content, { padding: spacing }]}
                refreshControl={
                    <RefreshControl refreshing={isChecking} onRefresh={checkStatus} tintColor={colors.primary} />
                }
            >
                {errorMsg && (
                    <View style={[styles.errorBanner, { marginBottom: spacing }]}>
                        <WWText style={styles.errorText}>⚠️ {errorMsg}</WWText>
                    </View>
                )}

                {!lastChecked && isChecking ? (
                    <ActivityIndicator animating size="large" color={colors.primary} style={styles.loadingSpinner} />
                ) : (
                    <>
                        <FirmwareComponentCard
                            title="Bluetooth"
                            status={statuses.ble}
                            colors={colors}
                            spacing={spacing}
                            isChecking={isChecking}
                            isConnected={!!device?.connected}
                            engineer={engineer}
                            onUpdate={() => navigation.navigate('FirmwareUpdateScreen', { deviceId, target: 'ble', engineer })}
                        />
                        
                        <FirmwareComponentCard
                            title="AI processor"
                            status={statuses.himax}
                            colors={colors}
                            spacing={spacing}
                            isChecking={isChecking}
                            isConnected={!!device?.connected}
                            engineer={engineer}
                            onUpdate={() => navigation.navigate('FirmwareUpdateScreen', { deviceId, target: 'himax', engineer })}
                        />

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
    errorBanner: {
        backgroundColor: '#BF360C',
        padding: 12,
        borderRadius: 8,
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
})
