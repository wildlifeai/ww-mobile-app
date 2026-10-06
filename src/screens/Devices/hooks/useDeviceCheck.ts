import { useCallback, useEffect, useRef, useState } from 'react'

import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { createBleSession } from '../../../ble/session/createBleSession'
import { useCameraSwitch } from '../../../hooks/useCameraSwitch'
import {
    CHECK_STEPS, CheckPhoto, CheckStepId, CheckStepState, overallVerdict, runDeviceCheck,
} from '../../../ble/workflows/deviceCheck'
import { LensVerdict } from '../../../utils/deviceCheck/lensSweep'
import { CheckReference, loadReference, saveReference } from '../../../utils/deviceCheck/reference'
import { logError, logWarn } from '../../../utils/logger'

type Steps = Record<CheckStepId, CheckStepState>

const pendingSteps = (): Steps =>
    Object.fromEntries(CHECK_STEPS.map(s => [s.id, { status: 'pending', summary: '' }])) as Steps

/**
 * Screen state for the Device Check. The check itself is `runDeviceCheck`;
 * this hook gives it a session, the camera switch, and a way to ask the
 * operator, and keeps what it reports for the screen.
 *
 * Leaving the screen stops the check at its next step and answers any open
 * question with No. The check still puts the device back on its way out.
 */
export const useDeviceCheck = ({ device }: { device: ExtendedPeripheral | undefined }) => {
    const [steps, setSteps] = useState<Steps>(pendingSteps)
    const [running, setRunning] = useState(false)
    const [finished, setFinished] = useState(false)
    const [instruction, setInstruction] = useState<string | null>(null)
    const [question, setQuestion] = useState<string | null>(null)
    const [photos, setPhotos] = useState<Partial<Record<CheckPhoto, string>>>({})
    const [lens, setLens] = useState<{ verdict: LensVerdict; movesFreely: boolean } | null>(null)
    const [reference, setReference] = useState<CheckReference | null>(null)
    const [cameraStage, setCameraStage] = useState('')

    const mountedRef = useRef(true)
    const cancelledRef = useRef(false)
    const answerRef = useRef<((yes: boolean) => void) | null>(null)

    useEffect(() => {
        mountedRef.current = true
        return () => {
            mountedRef.current = false
            cancelledRef.current = true
            answerRef.current?.(false)
        }
    }, [])

    useEffect(() => {
        loadReference()
            .then(r => { if (mountedRef.current) setReference(r) })
            .catch(e => logWarn('[DeviceCheck] could not read the lens reference:', e))
    }, [])

    const cameraSwitch = useCameraSwitch({
        device,
        onStage: (stage) => { if (mountedRef.current) setCameraStage(stage) },
    })
    // The check runs for minutes; it calls the latest switch, not the one it started with.
    const switchRef = useRef(cameraSwitch.switchTo)
    switchRef.current = cameraSwitch.switchTo

    const ifMounted = <A extends unknown[]>(fn: (...args: A) => void) =>
        (...args: A) => { if (mountedRef.current) fn(...args) }

    const start = useCallback(async () => {
        if (!device?.connected || running) return
        cancelledRef.current = false
        setSteps(pendingSteps())
        setPhotos({})
        setLens(null)
        setFinished(false)
        setRunning(true)
        try {
            await runDeviceCheck({
                session: createBleSession(device),
                deviceId: device.id,
                referencePeak: reference?.lensPeak ?? null,
                switchCamera: (target) => switchRef.current(target),
                ask: (text) => new Promise<boolean>(resolve => {
                    if (cancelledRef.current) return resolve(false)
                    answerRef.current = (yes) => {
                        answerRef.current = null
                        if (mountedRef.current) setQuestion(null)
                        resolve(yes)
                    }
                    if (mountedRef.current) setQuestion(text)
                }),
                instruct: ifMounted(setInstruction),
                onStep: ifMounted((id: CheckStepId, state: CheckStepState) => setSteps(prev => ({ ...prev, [id]: state }))),
                onPhoto: ifMounted((photo: CheckPhoto, uri: string) => setPhotos(prev => ({ ...prev, [photo]: uri }))),
                onLens: ifMounted((verdict: LensVerdict, movesFreely: boolean) => setLens({ verdict, movesFreely })),
                cancelled: () => cancelledRef.current,
            })
        } catch (e) {
            logError('[DeviceCheck] the check stopped:', e)
        } finally {
            if (mountedRef.current) {
                setRunning(false)
                setFinished(true)
                setInstruction(null)
                setQuestion(null)
                setCameraStage('')
            }
        }
    }, [device, running, reference])

    const answer = useCallback((yes: boolean) => answerRef.current?.(yes), [])

    const stop = useCallback(() => {
        cancelledRef.current = true
        answerRef.current?.(false)
    }, [])

    /** Record this unit's sharpest lens position as the one later units are held to. */
    const saveAsReference = useCallback(async () => {
        const peak = lens?.verdict.peakUp
        if (peak === undefined) return
        const next: CheckReference = {
            lensPeak: peak,
            recordedAt: new Date().toISOString(),
            deviceName: device?.name ?? device?.id ?? 'unknown',
        }
        await saveReference(next)
        if (mountedRef.current) setReference(next)
    }, [lens, device])

    return {
        steps,
        running,
        finished,
        verdict: finished ? overallVerdict(steps) : null,
        instruction,
        question,
        answer,
        photos,
        lens,
        reference,
        saveAsReference,
        cameraStage,
        start,
        stop,
    }
}
