import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { classifyHimax, HimaxVariant } from '../../../utils/himaxFirmwareState'
import { log } from '../../../utils/logger'
import { softwarePlan, SoftwareStatuses, SoftwareStep } from '../../../utils/softwareUpdate'
import { firmware83Filename, HimaxFirmwareSource, useFirmwareUpdate } from './useFirmwareUpdate'

/** How long an AI step waits for the camera to reconnect and be read after the Bluetooth update */
const CAMERA_BACK_MS = 90000

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export type SoftwareUpdateState = 'idle' | 'running' | 'complete' | 'failed'

/**
 * Update software (#529): the steps of `softwarePlan` run one after the other
 * on the two update hooks, the Bluetooth one and the AI one, and read as one
 * update with one bar.
 *
 * The plan comes from the hooks' own pre-flight readings, so opening the
 * screen sends the camera nothing more than the update screen does. A retry
 * reads the camera again first: what the last run left decides what is left.
 */
export function useSoftwareUpdate({ device }: { device: ExtendedPeripheral | undefined }) {
    const ble = useFirmwareUpdate({ target: 'ble', device })
    const ai = useFirmwareUpdate({ target: 'himax', device })

    const [state, setState] = useState<SoftwareUpdateState>('idle')
    const [steps, setSteps] = useState<SoftwareStep[]>([])
    const [stepIndex, setStepIndex] = useState(-1)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)

    // Each AI image is newest-first per camera in the catalogue
    const latest = useMemo(() => ({
        RP3: ai.availableDbFirmwares.find(fw => fw.cameraVariant === 'RP3') ?? null,
        HM0360: ai.availableDbFirmwares.find(fw => fw.cameraVariant === 'HM0360') ?? null,
    }), [ai.availableDbFirmwares])

    const isPreflightDone = ble.isPreflightDone && ai.isPreflightDone

    // The two processors as Start Monitoring judges them (useFirmwareStatus)
    const statuses = useMemo((): SoftwareStatuses => {
        const himax = classifyHimax({
            current: ai.previousVersion,
            slots: ai.cameraSlots ?? null,
            record: ai.updateRecord ?? null,
            latest,
        })
        return {
            ble: {
                currentVersion: ble.previousVersion,
                latestVersion: ble.latestFirmware?.version ?? null,
                isOutdated: !!ble.latestFirmware?.version && ble.previousVersion !== ble.latestFirmware.version,
            },
            himax: {
                currentVersion: ai.previousVersion,
                latestVersion: latest.HM0360?.version ?? latest.RP3?.version ?? null,
                isOutdated: himax.state === 'outdated' || himax.state === 'unfinished',
                missingVariant: himax.state === 'missing_variant' ? himax.missingVariant : null,
                unfinished: himax.state === 'unfinished' ? { endVariant: himax.endVariant, done: himax.done, total: himax.total } : null,
                variants: latest,
            },
        }
    }, [ble.previousVersion, ble.latestFirmware, ai.previousVersion, ai.cameraSlots, ai.updateRecord, latest])

    const plan = useMemo(() => (isPreflightDone ? softwarePlan(statuses) : []), [isPreflightDone, statuses])
    // The plan as of the latest render, for a run that starts after a fresh read
    const planNow = useRef(plan)
    // The async run reads the hooks as they are now, not as they were when it began
    const now = useRef({ ble, ai, device, latest })
    // Set once each render has committed, never during it: React may replay or
    // drop a render, and the run must not see one that never reached the screen
    useLayoutEffect(() => {
        planNow.current = plan
        now.current = { ble, ai, device, latest }
    })
    const unmounted = useRef(false)
    useEffect(() => () => { unmounted.current = true }, [])

    const waitFor = async (ready: () => boolean, timeoutMs: number) => {
        const end = Date.now() + timeoutMs
        while (!ready()) {
            if (unmounted.current || Date.now() > end) return false
            await sleep(250)
        }
        return true
    }

    // Both images on the SD card already need no transfer, as on the update screen
    const aiSource = (): HimaxFirmwareSource => {
        const { ai: hook, latest: builds } = now.current
        const onSd = (['RP3', 'HM0360'] as HimaxVariant[]).every(variant => {
            const fw = builds[variant]
            if (!fw) return false
            const name = firmware83Filename(fw.version, fw.buildDate, variant).toUpperCase()
            return hook.sdCardFiles.some(file => file.toUpperCase() === name)
        })
        return onSd ? 'sdcard' : 'download'
    }

    const runSteps = async (toRun: SoftwareStep[]) => {
        for (let i = 0; i < toRun.length; i++) {
            const step = toRun[i]
            setStepIndex(i)
            log(`[Software Update] Step ${i + 1} of ${toRun.length}: ${step}`)
            // The Bluetooth update reconnects at its end, and the AI hook
            // reads the camera again once it is back
            const back = await waitFor(() => !!now.current.device?.connected
                && (step === 'ble' || now.current.ai.isPreflightDone), CAMERA_BACK_MS)
            if (unmounted.current) return
            if (!back) {
                setErrorMsg('The camera did not come back. Wake it, then try again.')
                setState('failed')
                return
            }
            const finished = step === 'ble'
                ? await now.current.ble.startUpdate()
                : await now.current.ai.startUpdate({ himaxSource: aiSource(), stopAfterFirstImage: step === 'ai_first_image' })
            if (unmounted.current) return
            if (!finished) {
                const hook = step === 'ble' ? now.current.ble : now.current.ai
                setErrorMsg(hook.errorMsg)
                setState('failed')
                return
            }
        }
        setState('complete')
    }

    const start = useCallback(async () => {
        setErrorMsg(null)
        if (state !== 'idle') {
            // What the last run left decides what is left (#529: tap again, it picks up)
            now.current.ble.rerunPreflight()
            now.current.ai.rerunPreflight()
            setState('running')
            await sleep(0)
            const read = await waitFor(() => now.current.ble.isPreflightDone && now.current.ai.isPreflightDone, CAMERA_BACK_MS)
            if (unmounted.current) return
            if (!read) {
                setErrorMsg('The camera did not answer. Wake it, then try again.')
                setState('failed')
                return
            }
        }
        // The plan from this render's readings, or the fresh ones after a retry
        const toRun = planNow.current
        setSteps(toRun)
        setState('running')
        if (toRun.length === 0) {
            setState('complete')
            return
        }
        await runSteps(toRun)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state])

    // ── One bar ────────────────────────────────────────────────────
    // Each step an equal share. An AI step's share runs from the image it
    // starts at to the one it stops after, read off the pair progress the
    // first time the run reports it.
    const step = stepIndex >= 0 ? steps[stepIndex] : undefined
    const aiStart = useRef<number | null>(null)
    useEffect(() => { aiStart.current = null }, [stepIndex])
    useEffect(() => {
        if (step && step !== 'ble' && ai.isUpdating && ai.pairProgress && aiStart.current === null) {
            aiStart.current = ai.pairProgress.done / ai.pairProgress.total
        }
    }, [step, ai.isUpdating, ai.pairProgress])

    let fraction = 0
    if (step === 'ble') {
        fraction = ble.progress
    } else if (step && ai.pairProgress) {
        const lo = aiStart.current ?? ai.pairProgress.done / ai.pairProgress.total
        const hi = step === 'ai_first_image' ? lo + 1 / ai.pairProgress.total : 1
        fraction = hi > lo ? (ai.progress - lo) / (hi - lo) : 0
    }
    fraction = Math.min(1, Math.max(0, fraction))
    const progress = state === 'complete' ? 1
        : steps.length > 0 && stepIndex >= 0 ? (stepIndex + fraction) / steps.length : 0

    const current = step === 'ble' ? ble : ai
    const batteryLevel = ble.batteryLevel ?? ai.batteryLevel

    return {
        isPreflightDone,
        plan,
        state,
        progress,
        // What the running update shows today, under the one bar
        target: step === 'ble' ? 'ble' as const : 'himax' as const,
        phase: current.phase,
        pairProgress: step && step !== 'ble' ? ai.pairProgress : null,
        logs: step ? current.progressLogs : [],
        transfer: step && step !== 'ble' ? ai.fileTransferProgress : null,
        errorMsg,
        batteryLevel,
        isBatteryLow: batteryLevel !== null && batteryLevel < 30,
        start,
    }
}
