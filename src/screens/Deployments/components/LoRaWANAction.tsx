import { useCallback, useState } from 'react'
import { Button, Text, useTheme } from 'react-native-paper'
import { ActionRow } from '../../../components/ui/ActionRow'
import { ActionDialog } from '../../../components/ui/ActionDialog'
import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { createBleSession } from '../../../ble/session/createBleSession'
import { testLorawan, LorawanTestResult, lorawanTestWords, lorawanRetryWords } from '../../../ble/workflows/lorawanPing'

interface Props {
    device?: ExtendedPeripheral
    onShowHelp: (title: string, content: string) => void
}

/** LoRaWAN Signal, for projects that require LoRaWAN: opening the popup tests whether the network hears the camera. */
export const LoRaWANAction = ({ device, onShowHelp }: Props) => {
    const theme = useTheme()
    const [open, setOpen] = useState(false)
    const [status, setStatus] = useState<'idle' | 'testing' | LorawanTestResult>('idle')
    // The camera's attempt while it tries again, 1 until it does (#560)
    const [attempt, setAttempt] = useState(1)

    const test = useCallback(async () => {
        if (!device) return
        setStatus('testing')
        setAttempt(1)
        setStatus(await testLorawan(createBleSession(device), device.id, setAttempt))
    }, [device])

    const words = typeof status === 'object'
        ? lorawanTestWords(status)
        : status === 'testing' && attempt > 1 ? lorawanRetryWords(attempt) : null

    const handleOpen = () => {
        setOpen(true)
        if (status !== 'testing') test()
    }

    return (
        <>
            <ActionRow
                title="LoRaWAN Signal"
                onPress={handleOpen}
                onHelp={() => onShowHelp('LoRaWAN Signal', 'Checks that a LoRaWAN gateway hears the camera: the camera joins the network if it needs to, sends a test message and waits for the network to answer, then says how strong the signal is. It needs no phone signal.')}
                result={typeof status === 'object' ? words?.status : undefined}
                busy={status === 'testing'}
            />
            <ActionDialog
                visible={open}
                title="LoRaWAN Signal"
                onClose={() => setOpen(false)}
                actions={
                    <Button onPress={test} disabled={!device || status === 'testing'}>
                        Test Again
                    </Button>
                }
            >
                <Text variant="titleMedium">{words ? words.status : 'Testing the network…'}</Text>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                    {words ? words.detail : 'The camera joins the network if it needs to, then sends a test message and waits for the answer. This can take up to a minute.'}
                </Text>
            </ActionDialog>
        </>
    )
}
