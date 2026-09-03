import { useState, useCallback, useEffect, useRef } from 'react'

import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { bleEventBus, BleEvent } from '../../../ble/protocol/eventBus'
import { DeviceSignal } from '../../../ble/protocol/deviceSignals'
import { imageReassemblerEmitter } from '../../../ble/emitters'
import {
    CaptureStepsState, idleState, begin as beginSteps, settingsApplied, deviceWoke,
    deviceLine, transferProgress, imageSaved, failed,
} from '../../../utils/captureSteps'

interface UseCaptureStepsOptions {
    device: ExtendedPeripheral | undefined
}

export interface UseCaptureStepsReturn {
    state: CaptureStepsState
    /** Clock the countdown is drawn against; advances once a second while a transfer runs */
    now: number
    /** A run has started: the app is about to read and write the flash settings */
    begin: () => void
    /** The flash settings are on the device (or were already right); `note` replaces the step's detail */
    markSettingsApplied: (changed: boolean, note?: string) => void
    /** A command or the transfer failed; the step in progress shows the reason */
    markFailed: (message: string) => void
    reset: () => void
}

/**
 * Step-by-step progress of a Capture Picture run, driven by what the device
 * broadcasts (text lines, the Wake signal, the reassembler's packet progress)
 * plus two milestones only the app knows: the run started, the settings are
 * written. See captureSteps.ts for the transitions; this hook only wires them
 * to the event buses and keeps a once-a-second clock for the countdown.
 */
export const useCaptureSteps = ({ device }: UseCaptureStepsOptions): UseCaptureStepsReturn => {
    const [state, setState] = useState<CaptureStepsState>(idleState)
    const [now, setNow] = useState(() => Date.now())
    const deviceIdRef = useRef(device?.id)
    useEffect(() => { deviceIdRef.current = device?.id }, [device?.id])

    useEffect(() => {
        const onLine = (event: BleEvent & { type: 'TEXT_LINE' }) => {
            if (event.deviceId !== deviceIdRef.current) return
            setState(s => deviceLine(s, event.line, Date.now()))
        }
        const onSignal = (event: BleEvent & { type: 'DEVICE_SIGNAL' }) => {
            if (event.deviceId !== deviceIdRef.current || event.signal !== DeviceSignal.WAKE) return
            setState(s => deviceWoke(s))
        }
        const onProgress = (progress: number) => setState(s => transferProgress(s, progress, Date.now()))
        const onComplete = () => setState(s => imageSaved(s, Date.now()))
        const onError = (message: string) => setState(s => failed(s, message))

        bleEventBus.on('textLine', onLine)
        bleEventBus.on('deviceSignal', onSignal)
        imageReassemblerEmitter.on('onImageProgress', onProgress)
        imageReassemblerEmitter.on('onImageComplete', onComplete)
        imageReassemblerEmitter.on('onImageError', onError)
        return () => {
            bleEventBus.removeListener('textLine', onLine)
            bleEventBus.removeListener('deviceSignal', onSignal)
            imageReassemblerEmitter.off('onImageProgress', onProgress)
            imageReassemblerEmitter.off('onImageComplete', onComplete)
            imageReassemblerEmitter.off('onImageError', onError)
        }
    }, [])

    // The countdown has to move between packets, and after the last one if the
    // transfer stalls, so tick once a second while a transfer is in flight.
    const transferring = state.running && state.transfer !== null
    useEffect(() => {
        if (!transferring) return
        const id = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(id)
    }, [transferring])

    const begin = useCallback(() => { setNow(Date.now()); setState(beginSteps()) }, [])
    const markSettingsApplied = useCallback((changed: boolean, note?: string) => setState(s => settingsApplied(s, changed, note)), [])
    const markFailed = useCallback((message: string) => setState(s => failed(s, message)), [])
    const reset = useCallback(() => setState(idleState()), [])

    return { state, now, begin, markSettingsApplied, markFailed, reset }
}
