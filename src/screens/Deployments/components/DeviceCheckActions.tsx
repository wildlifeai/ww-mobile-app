import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Button, Divider, Text, useTheme } from 'react-native-paper'
import { ActionRow } from '../../../components/ui/ActionRow'
import { ActionDialog } from '../../../components/ui/ActionDialog'
import { UseFirmwareStatusReturn } from '../../Devices/hooks/useFirmwareStatus'
import { batteryLowWarning } from '../../../utils/initWarnings'

/**
 * Start Monitoring's three device checks, in Advanced settings. Each row shows
 * what the connection found; tapping asks the camera again and shows the fresh
 * result in a popup (26 October 2026 redesign).
 */

type ShowHelp = (title: string, content: string) => void

/** At or below this the popup says to replace the batteries: Start Monitoring's own rule, the help says above 30%. */
const BATTERY_LOW_PERCENT = 30
/** At or below this share free the popup says the card is nearly full */
const SD_NEARLY_FULL = 0.1

interface BatteryProps {
    batteryLevel: number | null
    onCheck: () => void
    isChecking?: boolean
    /** Initialising or not connected: the row shows what it has but cannot ask again */
    disabled?: boolean
    onShowHelp: ShowHelp
}

export const BatteryAction = ({ batteryLevel, onCheck, isChecking, disabled, onShowHelp }: BatteryProps) => {
    const theme = useTheme()
    const [open, setOpen] = useState(false)
    const low = batteryLevel !== null && batteryLevel <= BATTERY_LOW_PERCENT
    const handleOpen = () => {
        setOpen(true)
        if (!disabled && !isChecking) onCheck()
    }
    return (
        <>
            <ActionRow
                title="Check Battery Level"
                onPress={handleOpen}
                onHelp={() => onShowHelp('Battery Level', 'Check the device battery level. It must be above 30% for monitoring.')}
                result={batteryLevel !== null ? `${batteryLevel}%` : null}
                busy={isChecking}
            />
            <ActionDialog visible={open} title="Battery Level" onClose={() => setOpen(false)}>
                <Text variant="displaySmall">{isChecking ? '…' : batteryLevel !== null ? `${batteryLevel}%` : 'Not read yet'}</Text>
                {low && !isChecking && (
                    <Text variant="bodyMedium" style={{ color: theme.colors.error }}>{batteryLowWarning()}</Text>
                )}
            </ActionDialog>
        </>
    )
}

interface SdCardProps {
    /** Both in KB, as the camera reports them */
    sdCardStatus: { total: number; free: number } | null
    onCheck: () => void
    isChecking?: boolean
    disabled?: boolean
    onShowHelp: ShowHelp
}

const gb = (kb: number) => Math.round(kb / 1024 / 1024)

export const SdCardAction = ({ sdCardStatus, onCheck, isChecking, disabled, onShowHelp }: SdCardProps) => {
    const theme = useTheme()
    const [open, setOpen] = useState(false)
    const share = sdCardStatus && sdCardStatus.total > 0 ? sdCardStatus.free / sdCardStatus.total : null
    const handleOpen = () => {
        setOpen(true)
        if (!disabled && !isChecking) onCheck()
    }
    return (
        <>
            <ActionRow
                title="Check SD Card"
                onPress={handleOpen}
                onHelp={() => onShowHelp('SD Card', 'Verifies SD card space. Ensure sufficient space is available for recordings.')}
                result={sdCardStatus ? `${gb(sdCardStatus.free)} GB free` : null}
                busy={isChecking}
            />
            <ActionDialog visible={open} title="SD Card" onClose={() => setOpen(false)}>
                <Text variant="titleLarge">
                    {isChecking ? '…' : sdCardStatus && share !== null
                        ? `${Math.round(share * 100)}% free of ${gb(sdCardStatus.total)} GB`
                        : 'Not read yet'}
                </Text>
                {share !== null && share <= SD_NEARLY_FULL && !isChecking && (
                    <Text variant="bodyMedium" style={{ color: theme.colors.error }}>Nearly full: free up space before deploying.</Text>
                )}
            </ActionDialog>
        </>
    )
}

interface FirmwareProps {
    firmwareStatus: UseFirmwareStatusReturn
    onUpdateFirmware?: (target: 'ble' | 'himax') => void
    onShowHelp: ShowHelp
}

type ProcessorStatus = UseFirmwareStatusReturn['statuses']['ble']

/** One processor's state in words. An AI update that stopped part way counts as outdated (#374); one camera's build only is "not ready" (#437). */
export const firmwareWords = (status: ProcessorStatus): string =>
    status.isOutdated
        ? (status.unfinished ? 'Update not finished' : 'Update available')
        : status.missingVariant ? 'Update not ready' : 'Up to date'

/**
 * Check Firmware: up to date or not, and Update when a processor is behind.
 * People deploying do not need versions (26 October 2026), so they sit under
 * Details in the popup.
 */
export const FirmwareAction = ({ firmwareStatus, onUpdateFirmware, onShowHelp }: FirmwareProps) => {
    const theme = useTheme()
    const [open, setOpen] = useState(false)
    const [details, setDetails] = useState(false)
    const { statuses, isChecking, checkStatus, errorMsg } = firmwareStatus
    const behind = statuses.ble.isOutdated || statuses.himax.isOutdated
    // Nothing to say until a check has found the latest builds
    const known = !!statuses.ble.latestVersion || !!statuses.himax.latestVersion
    const rowResult = !known ? null
        : behind ? 'Update available'
            : statuses.ble.missingVariant || statuses.himax.missingVariant ? 'Update not ready' : 'Up to date'
    const processors = [
        { key: 'ble' as const, name: 'Bluetooth', status: statuses.ble },
        { key: 'himax' as const, name: 'AI processor', status: statuses.himax },
    ]
    const handleOpen = () => {
        setOpen(true)
        if (!isChecking) checkStatus()
    }
    return (
        <>
            <ActionRow
                title="Check Firmware"
                onPress={handleOpen}
                onHelp={() => onShowHelp('Firmware', 'Whether the camera runs the latest firmware. When an update is available, Update installs it.')}
                result={rowResult}
                busy={isChecking}
            />
            <ActionDialog
                visible={open}
                title="Firmware"
                onClose={() => setOpen(false)}
                actions={<Button onPress={() => setDetails(d => !d)}>{details ? 'Hide details' : 'Details'}</Button>}
            >
                {processors.map(({ key, name, status }, i) => (
                    <View key={key} style={styles.processor}>
                        {i > 0 && <Divider />}
                        <View style={styles.processorRow}>
                            <Text variant="bodyLarge">{name}</Text>
                            <Text variant="labelLarge" style={{ color: status.isOutdated ? theme.colors.error : theme.colors.primary }}>
                                {/* Until a check returns there is no latest build to compare with */}
                                {status.latestVersion ? firmwareWords(status) : isChecking ? 'Checking…' : 'Not checked'}
                            </Text>
                        </View>
                        {details && (
                            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                Current {status.currentVersion ?? 'unknown'}, latest {status.latestVersion ?? 'unknown'}
                            </Text>
                        )}
                        {status.isOutdated && onUpdateFirmware && (
                            <Button mode="contained" compact icon="download" style={styles.update} onPress={() => onUpdateFirmware(key)}>
                                Update
                            </Button>
                        )}
                    </View>
                ))}
                {errorMsg && !isChecking && (
                    <Text variant="bodySmall" style={{ color: theme.colors.error }}>{errorMsg}</Text>
                )}
            </ActionDialog>
        </>
    )
}

const styles = StyleSheet.create({
    processor: {
        gap: 8,
    },
    processorRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 4,
    },
    update: {
        alignSelf: 'flex-start',
    },
})
