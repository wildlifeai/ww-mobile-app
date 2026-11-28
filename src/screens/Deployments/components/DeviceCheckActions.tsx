import { useState } from 'react'
import { StyleSheet } from 'react-native'
import { Button, Text, useTheme } from 'react-native-paper'
import { ActionRow } from '../../../components/ui/ActionRow'
import { ActionDialog } from '../../../components/ui/ActionDialog'
import { UseFirmwareStatusReturn } from '../../Devices/hooks/useFirmwareStatus'
import { SoftwareState } from '../../../utils/softwareUpdate'
import { batteryLowWarning } from '../../../utils/initWarnings'

/**
 * Start Monitoring's three device checks, in Advanced settings. Each row shows
 * what the connection found; tapping asks the camera again and shows the fresh
 * result in a popup (26 October 2026 redesign).
 */

type ShowHelp = (title: string, content: string) => void

/** At or below this the popup says to replace the batteries: Start Monitoring's own rule, the help says above 30%. */
const BATTERY_LOW_PERCENT = 30
/** What a check's popup says while the camera is not connected (#571) */
export const NOT_CONNECTED_WORDS = 'The camera is not connected. Reconnect to check again.'

/** At or below this share free the popup says the card is nearly full */
const SD_NEARLY_FULL = 0.1

interface BatteryProps {
    batteryLevel: number | null
    onCheck: () => void
    isChecking?: boolean
    /** Initialising or not connected: the row shows what it has but cannot ask again */
    disabled?: boolean
    /** Not connected: the popup says so, and shows the reading as the last one (#571) */
    notConnected?: boolean
    onShowHelp: ShowHelp
}

export const BatteryAction = ({ batteryLevel, onCheck, isChecking, disabled, notConnected, onShowHelp }: BatteryProps) => {
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
                {notConnected && <Text variant="bodyMedium">{NOT_CONNECTED_WORDS}</Text>}
                <Text variant={notConnected ? 'bodyMedium' : 'displaySmall'}>
                    {isChecking ? '…' : batteryLevel !== null ? `${notConnected ? 'Last reading: ' : ''}${batteryLevel}%` : 'Not read yet'}
                </Text>
                {low && !isChecking && !notConnected && (
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
    notConnected?: boolean
    onShowHelp: ShowHelp
}

const gb = (kb: number) => Math.round(kb / 1024 / 1024)

export const SdCardAction = ({ sdCardStatus, onCheck, isChecking, disabled, notConnected, onShowHelp }: SdCardProps) => {
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
                {notConnected && <Text variant="bodyMedium">{NOT_CONNECTED_WORDS}</Text>}
                <Text variant={notConnected ? 'bodyMedium' : 'titleLarge'}>
                    {isChecking ? '…' : sdCardStatus && share !== null
                        ? `${notConnected ? 'Last reading: ' : ''}${Math.round(share * 100)}% free of ${gb(sdCardStatus.total)} GB`
                        : 'Not read yet'}
                </Text>
                {share !== null && share <= SD_NEARLY_FULL && !isChecking && !notConnected && (
                    <Text variant="bodyMedium" style={{ color: theme.colors.error }}>Nearly full: free up space before deploying.</Text>
                )}
            </ActionDialog>
        </>
    )
}

interface SoftwareProps {
    firmwareStatus: UseFirmwareStatusReturn
    /** From `useSoftwareState`: what the firmware check means to the person deploying */
    softwareState: SoftwareState
    onUpdateSoftware?: () => void
    onShowHelp: ShowHelp
}

/** What the row and the popup say for each state */
export const SOFTWARE_WORDS: Record<Exclude<SoftwareState, 'not_checked'>, string> = {
    up_to_date: 'Up to date',
    available: 'Update available',
    unfinished: 'Update not finished',
}

const SOFTWARE_HELP = 'Whether the camera runs the latest software. Update software installs it in a few minutes; keep the phone near the camera.'

/**
 * Check Software (#529): up to date or not, and Update software when not. No
 * processors and no versions; those are the Engineer Console's.
 */
export const SoftwareAction = ({ firmwareStatus, softwareState, onUpdateSoftware, onShowHelp }: SoftwareProps) => {
    const theme = useTheme()
    const [open, setOpen] = useState(false)
    const { isChecking, checkStatus, errorMsg } = firmwareStatus
    const words = softwareState === 'not_checked' ? null : SOFTWARE_WORDS[softwareState]
    const behind = softwareState === 'available' || softwareState === 'unfinished'
    const handleOpen = () => {
        setOpen(true)
        if (!isChecking) checkStatus()
    }
    return (
        <>
            <ActionRow
                title="Check Software"
                onPress={handleOpen}
                onHelp={() => onShowHelp('Software', SOFTWARE_HELP)}
                result={words}
                busy={isChecking}
            />
            <ActionDialog visible={open} title="Software" onClose={() => setOpen(false)}>
                <Text variant="bodyLarge" style={{ color: behind ? theme.colors.error : theme.colors.primary }}>
                    {words ?? (isChecking ? 'Checking…' : 'Not checked')}
                </Text>
                {!words && !isChecking && errorMsg && (
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                        The camera did not answer. Wake it, then check again.
                    </Text>
                )}
                {behind && onUpdateSoftware && (
                    <Button
                        mode="contained"
                        icon="download"
                        style={styles.update}
                        // Closed first: the popup would stay drawn over the update screen
                        onPress={() => {
                            setOpen(false)
                            onUpdateSoftware()
                        }}
                    >
                        Update software
                    </Button>
                )}
            </ActionDialog>
        </>
    )
}

const styles = StyleSheet.create({
    update: {
        alignSelf: 'flex-start',
    },
})
