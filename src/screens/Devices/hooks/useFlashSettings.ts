import { useCallback, useEffect, useState } from 'react'

import { useAppSelector } from '../../../redux'
import { createBleSession } from '../../../ble/session/createBleSession'
import { commandRegistry } from '../../../ble/protocol/commandRegistry'
import { flashHold } from '../../../ble/session/flashHold'
import { OP_PARAMETER } from '../../../hooks/useDeviceSettings'
import { FlashSettings, flashSettingsWrites, readFlashSettings } from '../../../utils/flashSettings'
import { log, logError } from '../../../utils/logger'

/** How long the test flash lights the white LED */
const TEST_FLASH_MS = 500

export type FlashSettingsStatus = 'loading' | 'ready' | 'unsupported' | 'saving' | 'saved' | 'error'

/**
 * The Flash settings flow: reads op9, op13, op22 and op34 to op36 off the
 * device once, and writes back only the ones the operator changed.
 *
 * Nothing is written on entry. The device applies these at its next wake
 * (`setupLEDFlash()` runs at wake), so the screen says Saved, not Applied.
 */
export const useFlashSettings = (deviceId: string | undefined) => {
    const device = useAppSelector(state => state.devices[deviceId || ''])
    const connected = device?.connected === true

    const [onDevice, setOnDevice] = useState<FlashSettings | null>(null)
    const [status, setStatus] = useState<FlashSettingsStatus>('loading')
    const [error, setError] = useState<string | null>(null)

    const load = useCallback(async (force = false) => {
        if (!device?.connected) return
        try {
            const ops = await createBleSession(device).getOps({ force })
            const settings = readFlashSettings(ops)
            setOnDevice(settings)
            setStatus(settings ? 'ready' : 'unsupported')
        } catch (e) {
            logError('[FlashSettings] could not read the op table:', e)
            setError(e instanceof Error ? e.message : String(e))
            setStatus('error')
        }
        // The session is a snapshot of the device, as in the other flows: a new
        // object arrives on every redux update.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [device?.id, device?.connected])

    useEffect(() => {
        load()
    }, [load])

    const save = useCallback(async (next: FlashSettings) => {
        if (!device?.connected || !onDevice) return
        const writes = flashSettingsWrites(onDevice, next)
        if (writes.length === 0) return
        setStatus('saving')
        setError(null)
        try {
            const session = createBleSession(device)
            for (const write of writes) {
                await session.execute(() => commandRegistry.setop(write))
            }
            // A Capture Picture visit cut short may still owe op34 a restore;
            // the operator's choice is the value to keep now.
            if (writes.some(write => write.index === OP_PARAMETER.FLASH_MODE)) {
                await flashHold.forget(device.id)
            }
            log(`[FlashSettings] wrote ${writes.map(w => `op${w.index}=${w.value}`).join(', ')}`)
            const settings = readFlashSettings(await session.getOps({ force: true }))
            setOnDevice(settings)
            setStatus('saved')
        } catch (e) {
            logError('[FlashSettings] save failed:', e)
            setError(e instanceof Error ? e.message : String(e))
            setStatus('error')
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [device?.id, device?.connected, onDevice])

    /**
     * Light the white LED at `brightness` percent for half a second, with
     * `AI flash`. It proves the LED, its driver and the command path, not the
     * capture flash: op13 and op34 play no part. The firmware sends no reply,
     * so a timeout still means it was sent.
     */
    const [testing, setTesting] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')
    const testWhiteLed = useCallback(async (brightness: number) => {
        if (!device?.connected) return
        setTesting('sending')
        try {
            await createBleSession(device).execute(() => commandRegistry.aiflash(brightness, TEST_FLASH_MS))
            setTesting('sent')
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e)
            if (message === 'TIMEOUT') {
                setTesting('sent')
            } else {
                logError('[FlashSettings] test flash failed:', e)
                setTesting('failed')
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [device?.id, device?.connected])

    return { connected, onDevice, status, error, save, reload: () => load(true), testing, testWhiteLed }
}
