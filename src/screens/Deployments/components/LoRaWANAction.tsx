import { useCallback, useState } from 'react'
import { Button, Text, useTheme } from 'react-native-paper'
import { ActionRow } from '../../../components/ui/ActionRow'
import { ActionDialog } from '../../../components/ui/ActionDialog'
import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { createBleSession } from '../../../ble/session/createBleSession'
import { pingLorawan, LorawanPingResult, LORAWAN_PING_WORDS } from '../../../ble/workflows/lorawanPing'

interface Props {
    device?: ExtendedPeripheral
    onShowHelp: (title: string, content: string) => void
}

/** LoRaWAN Signal, for projects that require LoRaWAN: opening the popup asks the camera to send one test message. */
export const LoRaWANAction = ({ device, onShowHelp }: Props) => {
    const theme = useTheme()
    const [open, setOpen] = useState(false)
    const [status, setStatus] = useState<'idle' | 'testing' | LorawanPingResult>('idle')

    const ping = useCallback(async () => {
        if (!device) return
        setStatus('testing')
        setStatus(await pingLorawan(createBleSession(device)))
    }, [device])

    const words = status === 'idle' || status === 'testing' ? null : LORAWAN_PING_WORDS[status]

    const handleOpen = () => {
        setOpen(true)
        if (status !== 'testing') ping()
    }

    return (
        <>
            <ActionRow
                title="LoRaWAN Signal"
                onPress={handleOpen}
                onHelp={() => onShowHelp('LoRaWAN Signal', 'Asks the camera to send one test message over LoRaWAN now. It can only send once it has joined a network through a gateway, so the result also tells you whether it has.')}
                result={words?.status}
                busy={status === 'testing'}
            />
            <ActionDialog
                visible={open}
                title="LoRaWAN Signal"
                onClose={() => setOpen(false)}
                actions={
                    <Button onPress={ping} disabled={!device || status === 'testing'}>
                        Test Again
                    </Button>
                }
            >
                <Text variant="titleMedium">{words ? words.status : 'Sending a test message…'}</Text>
                {words && <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>{words.detail}</Text>}
            </ActionDialog>
        </>
    )
}
