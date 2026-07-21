import { useCallback, useState } from 'react'

import { createBleSession } from '../ble/session/createBleSession'
import { commandRegistry } from '../ble/protocol/commandRegistry'
import { OP_PARAMETER } from './useDeviceSettings'
import { ExtendedPeripheral } from '../redux/slices/devicesSlice'
import { log, logWarn } from '../utils/logger'
import { sleep } from '../utils/helpers'

export type CaptureResolution = 'standard' | 'hires' | 'unknown'

/** Thrown when hi-res is requested while an AI model is loaded (op14 != 0). */
export class ModelLoadedError extends Error {
    constructor() {
        super('An AI model is loaded on the device - hi-res capture needs the memory the model occupies.')
        this.name = 'ModelLoadedError'
    }
}

interface Options {
    device?: ExtendedPeripheral
    onError?: (err: Error) => void
}

/**
 * Dev/test helper: switch the colour camera between the standard 640x480
 * pipeline and hi-res single-JPEG capture (op32 = 1, encoded 1216x960).
 *
 * The firmware picks the datapath at sensor init, so a switch writes the
 * ops and reboots the AI processor (`AI reset` - the documented activation
 * path in the firmware's hires-capture.md; the BLE link lives on the nRF
 * and survives). Hi-res exists only in the colour (RP2/RP3) firmware -
 * the Night-IR (HM0360) build stubs it out - so callers should gate on the
 * running camera. Hi-res also requires no AI model (op14 = 0): we surface
 * that as ModelLoadedError and let the UI offer an explicit erase.
 */
export const useResolutionSwitch = ({ device, onError }: Options) => {
    const [resolution, setResolution] = useState<CaptureResolution>('unknown')
    const [isBusy, setIsBusy] = useState(false)
    const [stage, setStage] = useState('')

    const refresh = useCallback(async () => {
        if (!device?.connected) return
        try {
            const session = createBleSession(device)
            const raw = await session.execute(() => commandRegistry.getop(OP_PARAMETER.CAM_RESOLUTION)) as string
            const m = String(raw).match(/[=]\s*(\d+)/)
            setResolution(m ? (m[1] === '1' ? 'hires' : 'standard') : 'unknown')
        } catch (e) {
            logWarn('[Resolution] op32 read failed:', e)
            setResolution('unknown')
        }
    }, [device])

    const switchTo = useCallback(async (
        target: Exclude<CaptureResolution, 'unknown'>,
        opts?: { eraseModel?: boolean }
    ) => {
        if (!device?.connected || isBusy) return
        setIsBusy(true)
        try {
            const session = createBleSession(device)

            if (target === 'hires') {
                setStage('Checking for a loaded AI model…')
                const rawModel = await session.execute(() => commandRegistry.getop(OP_PARAMETER.MODEL_PROJECT)) as string
                const modelId = parseInt(String(rawModel).match(/[=]\s*(-?\d+)/)?.[1] ?? '0', 10) || 0
                if (modelId !== 0) {
                    if (!opts?.eraseModel) throw new ModelLoadedError()
                    setStage('Erasing AI model…')
                    await session.execute(() => commandRegistry.erasemodel())
                }
                setStage('Enabling hi-res (op32 = 1)…')
                await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.CAM_RESOLUTION, value: 1 }))
            } else {
                setStage('Restoring standard resolution (op32 = 0)…')
                await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.CAM_RESOLUTION, value: 0 }))
            }

            // Datapath is chosen at sensor init - reboot the AI processor to
            // apply. Boot takes ~6-10 s; the nRF keeps the BLE link alive.
            setStage('Rebooting the camera processor (~10 s)…')
            try {
                await session.execute(() => commandRegistry.aireset())
            } catch (resetErr) {
                // The reset ack can be lost in the reboot - not fatal
                logWarn('[Resolution] aireset ack not received (device rebooting):', resetErr)
            }
            await sleep(11000)

            setStage('Confirming…')
            await refresh()
            log(`[Resolution] switched to ${target}`)
        } catch (e) {
            const err = e instanceof Error ? e : new Error(String(e))
            if (!(err instanceof ModelLoadedError)) {
                logWarn('[Resolution] switch failed:', err)
            }
            onError?.(err)
        } finally {
            setStage('')
            setIsBusy(false)
        }
    }, [device, isBusy, refresh, onError])

    return { resolution, isBusy, stage, refresh, switchTo }
}
