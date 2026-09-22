/**
 * useDevDeployment, the developer deployment hook
 *
 * A version of useStartDeployment for the Engineer Console. Key differences:
 * - Switches to the camera the operator chose before anything else (#301)
 * - Lets the capture method and the capture flash be overridden on screen,
 *   with the project's own fields, and persists the overrides to the project
 * - Writes the LED brightness (op9), which has no project column
 * - Skips firmware update warnings
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { Alert } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useAppSelector } from '../../../redux'
import { DeploymentService } from '../../../services/DeploymentService'
import ProjectService from '../../../services/ProjectService'
import ReferenceDataService from '../../../services/ReferenceDataService'
import Device from '../../../database/models/Device'
import Deployment from '../../../database/models/Deployment'
import { DeviceService } from '../../../services/DeviceService'
import { useBleSession } from '../../../hooks/useBleSession'
import { commandRegistry } from '../../../ble/protocol/commandRegistry'
import { useBleActions } from '../../../providers/BleEngineProvider'
import { useDeploymentConfiguration } from '../../../hooks/useDeploymentConfiguration'
import { useBle } from '../../../hooks/useBle'
import { useGPSLocation } from '../../../hooks/useGPSLocation'
import { useDeviceSettings, OP_PARAMETER } from '../../../hooks/useDeviceSettings'
import { useDeploymentProgress } from '../../../hooks/useDeploymentProgress'
import { useMonitoringActions, endDeploymentSequence } from '../../../hooks/useMonitoringActions'
import { useCameraSwitch, CAMERA_VARIANT_LABELS, type CameraVariant } from '../../../hooks/useCameraSwitch'
import { useDeviceSelfTest } from '../../../hooks/useDeviceSelfTest'
import { checkSdCard } from '../../../ble/workflows/checkSdCard'
import { selfTestCache } from '../../../ble/protocol/selfTestCache'
import { SelfTestBit, parseSelfTestBits, isBootPreset, formatSelfTestBits } from '../../../utils/deviceSelfTest'
import {
    resolveProjectFlash, formatUtcMinutes, describeProjectFlash, flashColumnsFromFields,
    type ProjectFlashMode, type ProjectFlashLed,
} from '../../../utils/projectFlash'
import * as pipeline from '../../../ble/workflows/deploymentPipeline'

import { log, logError, logWarn } from '../../../utils/logger'
import { sleep } from '../../../utils/helpers'
import { selectCurrentOrganisation } from '../../../redux/slices/authSlice'
import { ProjectWithDetails } from '../../../types/project'

/** A camera the operator can deploy on: one of the two firmware slots. */
export type DeployableCamera = Exclude<CameraVariant, 'unknown'>

/**
 * op9 when the screen opens. 50 rather than the factory 5, which proved too
 * dim on the bench at realistic distances; the same reasoning as the Capture
 * Picture flow's FlashSelector. The operator can type anything from 0 to 100.
 */
const DEFAULT_LED_BRIGHTNESS = 50

/** op5 when the screen opens. The operator can type anything from 1 up. */
const DEFAULT_NUM_PICTURES = 3

/**
 * The number in a numeric field, or the fallback when the field is empty or
 * holds nonsense. The fields keep their text as typed so an operator can clear
 * one and retype it; a controlled field bound straight to the number put the
 * fallback back the moment the last digit was deleted.
 */
const intFromText = (text: string, fallback: number): number => {
    const n = parseInt(text, 10)
    return Number.isFinite(n) ? n : fallback
}

/**
 * How long a health check button says "Checking…" at the least. The device
 * answers `battery` in under a quarter of a second, too quick to register as
 * feedback, and a re-check that lands on the same figure then looks like a
 * dead button. `AI info` takes about 1.3 s and needs no help.
 */
const MIN_CHECKING_MS = 600

interface UseDevDeploymentParams {
    deviceId?: string
    bleDeviceId?: string
    navigation: any
}

export const useDevDeployment = ({
    deviceId,
    bleDeviceId,
    navigation,
}: UseDevDeploymentParams) => {
    // Selectors
    const devices = useAppSelector(state => state.devices)
    const bleDevice = devices[bleDeviceId || '']
    const user = useAppSelector(state => state.authentication.user)
    const currentOrganisation = useAppSelector(selectCurrentOrganisation)

    // BLE Hooks
    const { disconnectDevice } = useBle()
    const { quiesceDevice } = useDeviceSettings()
    const bleSession = useBleSession(bleDevice)
    const { configure: startConfigure } = useDeploymentConfiguration()
    useBleActions()

    // GPS
    const { location: gpsLocation } = useGPSLocation()

    // Device health
    const [batteryLevel, setBatteryLevel] = useState<number | null>(null)
    const [sdCardStatus, setSdCardStatus] = useState<{ total: number; free: number } | null>(null)

    // Hardware health from the self-test the device broadcasts after every
    // wake, so it costs nothing to show. A missing SD card blocks Start
    // (#303): every image and setting a deployment writes goes to the card.
    const selfTest = useDeviceSelfTest({ device: bleDevice })
    // eslint-disable-next-line no-bitwise
    const sdCardMissing = selfTest.bits !== null && (selfTest.bits & (1 << SelfTestBit.AI_NO_SD_CARD)) !== 0

    // Form state
    const [notes, setNotes] = useState('')
    const [locationName, setLocationName] = useState('')
    const [cameraHeight, setCameraHeight] = useState('')

    // Capture flash: the project's four columns, offered with the project
    // form's own choices (#301) and persisted with the rest of the overrides.
    const [flashMode, setFlashMode] = useState<ProjectFlashMode>('off')
    const [flashLed, setFlashLed] = useState<ProjectFlashLed>('ir')
    const [flashWindowStart, setFlashWindowStart] = useState('')     // HH:MM UTC
    const [flashWindowMinutes, setFlashWindowMinutes] = useState('')
    // op9, the one flash setting with no project column. Dev only, written
    // to the device after configure and never saved to the project.
    const [ledBrightnessText, setLedBrightnessText] = useState(String(DEFAULT_LED_BRIGHTNESS))
    const ledBrightness = Math.min(100, Math.max(0, intFromText(ledBrightnessText, DEFAULT_LED_BRIGHTNESS)))

    // Pictures per trigger (op5). Three when the screen opens, Victor's choice
    // on the bench on 22 September 2026: one frame per trigger too often catches
    // the animal mid-departure, and three costs little. Start Monitoring still
    // writes one, so the two flows differ here on purpose.
    //
    // The raw BMP option that sat beside it, TEST_MODE_BITS bit 1 with an even
    // picture count so the alternating file types made JPG/BMP pairs, was
    // retired on 21 September 2026 (Victor): a quality trial nobody compared
    // any more, at double the captures. Commented out here and in the screen
    // until it is certain nothing wants it back; the reset leaves op18 at 0.
    const [numPicturesText, setNumPicturesText] = useState(String(DEFAULT_NUM_PICTURES))
    const numPictures = Math.max(1, intFromText(numPicturesText, DEFAULT_NUM_PICTURES))
    //   const [testModeBits, setTestModeBits] = useState(2)

    // The camera to deploy on (#301). null until the device says which one it
    // is running; that one from then on, or whatever the operator picks.
    const [cameraChoice, setCameraChoice] = useState<DeployableCamera | null>(null)

    // Project state
    const [project, setProject] = useState<ProjectWithDetails | null>(null)
    const [availableProjects, setAvailableProjects] = useState<ProjectWithDetails[]>([])
    const [captureMethodOverride, setCaptureMethodOverride] = useState<number | null>(null)
    // As typed. Empty, or anything that is not a positive number, is no
    // override, and the project's own interval applies.
    const [timelapseIntervalText, setTimelapseIntervalText] = useState('')
    const typedTimelapseInterval = intFromText(timelapseIntervalText, 0)
    const timelapseIntervalOverride = typedTimelapseInterval > 0 ? typedTimelapseInterval : null

    // New overridable project fields
    const [motionSensitivityOverride, setMotionSensitivityOverride] = useState<number | null>(null)
    const [aiModelIdOverride, setAiModelIdOverride] = useState<string | null>(null)
    const [lorawanOverride, setLorawanOverride] = useState(false)
    const [recordGpsOverride, setRecordGpsOverride] = useState(false)

    // Reference data
    const [captureMethodOptions, setCaptureMethodOptions] = useState<Array<{ id: number; value: string; description: string }>>([])
    const [sensitivityOptions, setSensitivityOptions] = useState<Array<{ id: number; value: string; description: string }>>([])
    const [aiModelOptions, setAiModelOptions] = useState<Array<{ id: string; name: string; version: string }>>([])

    // Submission
    const [submitting, setSubmitting] = useState(false)
    const [device, setDevice] = useState<Device | undefined>()

    const isNavigatingAway = useRef(false)
    const isStartDeploymentInProgress = useRef(false)
    const deploymentIdRef = useRef<string | null>(null)

    // Shared progress dialog
    const progress = useDeploymentProgress()

    // Shared monitoring actions
    const monitoring = useMonitoringActions({
        bleDevice,
        disconnectDevice,
        quiesceDevice,
        userId: user?.id,
        navigation,
        deploymentIdRef,
        isNavigatingAway,
        progress,
    })

    // The camera switch. Its stage messages go to the progress dialog, but
    // only while a start is running: the read on connect that seeds the
    // control has no dialog to write to. The ref keeps `onStage` stable so
    // the hook's callbacks do not change identity on every render.
    const stageRef = useRef<(stage: string) => void>(() => {})
    stageRef.current = (stage: string) => {
        if (!isStartDeploymentInProgress.current) return
        progress.setFinishStep(stage)
        progress.addLog(stage)
    }
    const onCameraStage = useCallback((stage: string) => stageRef.current(stage), [])
    const cameraErrorRef = useRef<Error | null>(null)
    const onCameraError = useCallback((err: Error) => { cameraErrorRef.current = err }, [])
    const camera = useCameraSwitch({ device: bleDevice, onError: onCameraError, onStage: onCameraStage })

    // Effective values (override > project)
    const effectiveCaptureMethod = captureMethodOverride ?? project?.capture_method_id ?? 1
    const effectiveTimelapseInterval = timelapseIntervalOverride ?? project?.timelapse_interval_seconds ?? 300

    // --- Load device from DB ---
    useEffect(() => {
        if (!deviceId) return
        DeviceService.getDeviceByBluetoothId(deviceId).then(d => {
            if (d) setDevice(d)
        }).catch(e => logWarn('[DevDeploy] Device lookup failed:', e))
    }, [deviceId])

    // A device carries one deployment at a time. The scanner routes a deployed
    // device to its summary instead of Start Monitoring; this screen is reached
    // through the Engineer Console, which does no such thing, so it asks the
    // database itself and blocks Start until that deployment is finished
    // (Victor, 22 September 2026). Re-read on every focus, so coming back from
    // the summary after ending it clears the block, and after this screen's
    // own Stop Monitoring.
    const [activeDeployment, setActiveDeployment] = useState<Deployment | null>(null)
    const refreshActiveDeployment = useCallback(async (): Promise<Deployment | null> => {
        if (!device?.id) return null
        try {
            const found = await DeploymentService.getActiveDeploymentForDeviceId(device.id)
            setActiveDeployment(found ?? null)
            return found ?? null
        } catch (e) {
            logWarn('[DevDeploy] Active deployment lookup failed:', e)
            return null
        }
    }, [device?.id])
    useFocusEffect(useCallback(() => { refreshActiveDeployment() }, [refreshActiveDeployment]))
    useEffect(() => {
        if (!monitoring.isMonitoring) refreshActiveDeployment()
    }, [monitoring.isMonitoring, refreshActiveDeployment])

    // The progress dialog serves both the start and the end below; this says
    // which titles it wears.
    const [dialogMode, setDialogMode] = useState<'start' | 'end'>('start')

    // End the deployment the device already carries, the way Stop Monitoring
    // does, minus the disconnect and the trip to Home: the operator is here to
    // start another one, so the link and the screen stay.
    const [isEndingDeployment, setIsEndingDeployment] = useState(false)
    const handleEndActiveDeployment = useCallback(async () => {
        const running = activeDeployment ?? await refreshActiveDeployment()
        if (!running) return
        if (!bleDevice?.connected) {
            Alert.alert('Device Disconnected', 'Connect to the device first, so the deployment can be cleared from it as well as from the record.')
            return
        }
        setIsEndingDeployment(true)
        setDialogMode('end')
        progress.reset('Ending deployment...')
        progress.addLog(`Ending the deployment at ${running.locationName || running.name || 'unknown site'}...`)
        try {
            await endDeploymentSequence({
                bleDevice,
                deploymentId: running.id,
                userId: user?.id ?? null,
                notes: 'Ended from the Dev Deployment Test',
                quiesceDevice,
                progress,
                disconnect: false,
            })
            progress.setFinishStep('Complete')
            progress.setFinishProgress(1.0)
            progress.setIsSuccess(true)
            progress.addLog('Deployment ended')
            await refreshActiveDeployment()
            setTimeout(() => progress.setIsFinishing(false), 1200)
        } catch (error) {
            logError('[DevDeploy] End deployment failed:', error)
            progress.setIsFinishing(false)
            Alert.alert('Error', 'Failed to end the deployment: ' + (error as Error).message)
        } finally {
            setIsEndingDeployment(false)
        }
    }, [activeDeployment, refreshActiveDeployment, bleDevice, user?.id, quiesceDevice, progress])

    // Everything the screen lets the operator override, seeded from a project.
    const seedFromProject = useCallback((p: ProjectWithDetails) => {
        setCaptureMethodOverride(p.capture_method_id ?? null)
        setTimelapseIntervalText(p.timelapse_interval_seconds ? String(p.timelapse_interval_seconds) : '')
        setMotionSensitivityOverride(p.activity_detection_sensitivity_id ?? null)
        setAiModelIdOverride(p.model_id ?? null)
        setLorawanOverride(p.lorawan_required ?? false)
        setRecordGpsOverride(p.record_gps_in_images ?? false)
        const flash = resolveProjectFlash(p)
        setFlashMode(flash.mode)
        setFlashLed(flash.led)
        setFlashWindowStart(typeof p.flash_window_start_minutes_utc === 'number' ? formatUtcMinutes(p.flash_window_start_minutes_utc) : '')
        setFlashWindowMinutes(p.flash_window_minutes ? String(p.flash_window_minutes) : '')
    }, [])

    // --- Load projects ---
    useEffect(() => {
        const loadProjects = async () => {
            if (!user?.id || !currentOrganisation?.id) return
            try {
                const projects = await ProjectService.getProjectsForUserInOrganisation(
                    user.id, currentOrganisation.id
                )
                setAvailableProjects(projects)
                if (projects.length > 0 && !project) {
                    setProject(projects[0])
                    seedFromProject(projects[0])
                }
            } catch (e) {
                logError('[DevDeploy] Failed to load projects:', e)
            }
        }
        loadProjects()
    }, [user?.id, currentOrganisation?.id]) // eslint-disable-line react-hooks/exhaustive-deps

    // --- Load reference data (capture methods, sensitivities, AI models) ---
    useEffect(() => {
        const loadRefData = async () => {
            try {
                const [methods, sens, models] = await Promise.all([
                    ReferenceDataService.getCaptureMethods(),
                    ReferenceDataService.getActivitySensitivity(),
                    ReferenceDataService.getAiModels(),
                ])
                setCaptureMethodOptions(methods)
                setSensitivityOptions(sens)
                setAiModelOptions(models)
            } catch (e) {
                logWarn('[DevDeploy] Failed to load reference data:', e)
            }
        }
        loadRefData()
    }, [])

    // --- Battery check ---
    // The registry already parses the percentage out of `Battery = 3150mV 4%`,
    // so the reply is the number. (Until 22 September 2026 this re-matched
    // `%` against that number, found nothing, and the card never updated.)
    // Each check shows on its button while it is on the wire: a re-check that
    // comes back with the same figure otherwise looks like a dead button.
    const [isCheckingBattery, setIsCheckingBattery] = useState(false)
    const [isCheckingSdCard, setIsCheckingSdCard] = useState(false)

    const handleBatteryCheck = useCallback(async () => {
        if (!bleDevice?.connected || !bleSession) return
        const started = Date.now()
        setIsCheckingBattery(true)
        try {
            const level = await bleSession.execute(commandRegistry.battery)
            if (typeof level === 'number' && Number.isFinite(level)) setBatteryLevel(level)
        } catch (e) {
            logWarn('[DevDeploy] Battery check failed:', e)
        } finally {
            await sleep(Math.max(0, MIN_CHECKING_MS - (Date.now() - started)))
            setIsCheckingBattery(false)
        }
    }, [bleDevice, bleSession])

    // --- SD card check ---
    // The same workflow Start Monitoring uses; `AI info` comes back parsed.
    const handleSdCardCheck = useCallback(async () => {
        if (!bleDevice?.connected || !bleSession) return
        const started = Date.now()
        setIsCheckingSdCard(true)
        try {
            const sd = await checkSdCard(bleSession)
            setSdCardStatus({ total: sd.totalSpaceMb, free: sd.freeSpaceMb })
        } catch (e) {
            // No card, or the Himax asleep. The health banner and the Start
            // button already say which (#303), so only the figures go.
            logWarn('[DevDeploy] SD card check failed:', e)
            setSdCardStatus(null)
        } finally {
            await sleep(Math.max(0, MIN_CHECKING_MS - (Date.now() - started)))
            setIsCheckingSdCard(false)
        }
    }, [bleDevice, bleSession])

    // Auto-check on connect. The camera read is `slots`, a read like the
    // other two; nothing is written to the device until Start.
    useEffect(() => {
        if (bleDevice?.connected) {
            handleBatteryCheck()
            handleSdCardCheck()
            camera.refresh()
        }
    }, [bleDevice?.connected]) // eslint-disable-line react-hooks/exhaustive-deps

    // Seed the camera control with the one running, once it is known. An
    // operator who never touches the control deploys on the camera the
    // device already has, with no switch.
    useEffect(() => {
        if (cameraChoice === null && (camera.activeCamera === 'RP3' || camera.activeCamera === 'HM0360')) {
            setCameraChoice(camera.activeCamera)
        }
    }, [camera.activeCamera, cameraChoice])

    // The self-test from the boot a switch caused, or a fresh `selftest` when
    // the broadcast was missed. Null when the device gave nothing usable.
    const readSelfTestBits = useCallback(async (sinceTs: number): Promise<number | null> => {
        if (!bleDevice || !bleSession) return null
        const held = await selfTestCache.waitForFresh(bleDevice.id, sinceTs, 3000)
        if (held) return held.bits
        const raw = await bleSession.execute<string>(commandRegistry.selftest)
        const parsed = parseSelfTestBits(raw)
        return parsed !== null && !isBootPreset(parsed) ? parsed : null
    }, [bleDevice, bleSession])

    // --- Project change handler ---
    const handleProjectChange = useCallback(async (projectId: string) => {
        const selected = availableProjects.find(p => p.id === projectId)
        if (selected) {
            setProject(selected)
            seedFromProject(selected)
        }
    }, [availableProjects, seedFromProject])

    // --- Persist project settings to DB ---
    const persistProjectSettings = useCallback(async () => {
        if (!project) return
        const updates: any = {}
        if (captureMethodOverride !== null && captureMethodOverride !== project.capture_method_id) {
            updates.capture_method_id = captureMethodOverride
        }
        if (timelapseIntervalOverride !== null && timelapseIntervalOverride !== project.timelapse_interval_seconds) {
            updates.timelapse_interval_seconds = timelapseIntervalOverride
        }
        if (motionSensitivityOverride !== null && motionSensitivityOverride !== project.activity_detection_sensitivity_id) {
            updates.activity_detection_sensitivity_id = motionSensitivityOverride
        }
        if (aiModelIdOverride !== project.model_id) {
            updates.model_id = aiModelIdOverride
        }
        if (lorawanOverride !== project.lorawan_required) {
            updates.lorawan_required = lorawanOverride
        }
        if (recordGpsOverride !== project.record_gps_in_images) {
            updates.record_gps_in_images = recordGpsOverride
        }
        // The flash, diffed against the project as the deployment would read
        // it, so a row that predates the columns is compared to its fallback
        // rather than to null.
        const stored = resolveProjectFlash(project)
        const flash = flashColumnsFromFields(flashMode, flashLed, flashWindowStart, flashWindowMinutes)
        if (flash.flash_mode !== stored.mode) updates.flash_mode = flash.flash_mode
        if (flash.flash_led !== stored.led) updates.flash_led = flash.flash_led
        if ((flash.flash_window_start_minutes_utc ?? null) !== (project.flash_window_start_minutes_utc ?? null)) {
            updates.flash_window_start_minutes_utc = flash.flash_window_start_minutes_utc
        }
        if ((flash.flash_window_minutes ?? null) !== (project.flash_window_minutes ?? null)) {
            updates.flash_window_minutes = flash.flash_window_minutes
        }
        if (Object.keys(updates).length > 0) {
            try {
                await ProjectService.updateProject(project.id, updates)
                log('[DevDeploy] Project settings persisted to DB:', updates)
            } catch (e) {
                logWarn('[DevDeploy] Failed to persist project settings:', e)
            }
        }
    }, [
        project, captureMethodOverride, timelapseIntervalOverride, motionSensitivityOverride,
        aiModelIdOverride, lorawanOverride, recordGpsOverride,
        flashMode, flashLed, flashWindowStart, flashWindowMinutes,
    ])

    // --- Start deployment ---
    const handleStartDeployment = useCallback(async () => {
        if (!bleDevice?.connected) {
            Alert.alert('Device Disconnected', 'Please ensure the device is connected.')
            return
        }
        if (!project || !user) {
            Alert.alert('Error', 'Missing project or user information.')
            return
        }
        if (!bleSession) {
            Alert.alert('Error', 'BLE session not available.')
            return
        }
        if (sdCardMissing) {
            Alert.alert('No SD Card', 'The device reports no SD card. Every image and setting a deployment writes goes to the card, so it cannot start without one. Insert a FAT32 card, then re-check.')
            return
        }
        // Asked again at the moment of the press, not read from the state the
        // screen was drawn with: another phone may have deployed it since.
        const running = await refreshActiveDeployment()
        if (running) {
            Alert.alert('Already Deployed', `This device is already deployed at ${running.locationName || running.name || 'another site'}. Finish that deployment before starting another.`)
            return
        }

        setDialogMode('start')
        progress.reset('Starting dev deployment...')
        setSubmitting(true)
        isStartDeploymentInProgress.current = true

        const cb = {
            addLog: progress.addLog,
            setStep: progress.setFinishStep,
            setProgress: progress.setFinishProgress,
        }

        try {
            // 0. Camera. First, before anything reads the device: a switch
            // boots the other firmware image, and everything after this has
            // to be asked of the image that will run the deployment. When the
            // chosen camera is already running this is one `slots` read. A
            // switch that does not come back running the chosen camera aborts
            // the start, the way a refused reset does (#268): deploying on the
            // wrong camera silently would be worse than not deploying.
            if (cameraChoice) {
                progress.setFinishStep('Checking the camera...')
                progress.setFinishProgress(0.01)
                cameraErrorRef.current = null
                const before = camera.activeCamera
                const switchStarted = Date.now()
                const ok = await camera.switchTo(cameraChoice)
                if (!ok) {
                    // The ref was filled by `onCameraError` inside `switchTo`;
                    // the cast is because TypeScript still sees the null
                    // written just above.
                    const cameraError = cameraErrorRef.current as Error | null
                    throw new Error(
                        cameraError?.message
                            ?? `The device did not come back running the ${CAMERA_VARIANT_LABELS[cameraChoice]} camera. Check 'AI slots' in the console, then try again.`
                    )
                }

                // The image booted; now the sensor. `slots` reports the slot's
                // label, not whether its camera answered: on 22 September 2026
                // WILD-SIFK booted the RP3 image, printed "Main camera not
                // present at 0x1a", disabled its camera system and still said
                // "running RP3", for four minutes and seven boots after the
                // switch (the IMX708 is fitted; it came good later, cause
                // unknown). The boot's self-test carries bit 8, a warm wake
                // after it reports clean, and a deployment on that image records
                // nothing, so it stops here and the device goes back to the
                // camera it had.
                const chosen = CAMERA_VARIANT_LABELS[cameraChoice]
                const bits = await readSelfTestBits(switchStarted)
                // eslint-disable-next-line no-bitwise
                if (bits !== null && (bits & (1 << SelfTestBit.AI_NO_MAIN_CAMERA)) !== 0) {
                    progress.addLog(`No ${chosen} camera found (self-test ${formatSelfTestBits(bits)})`)
                    let restored = ''
                    if ((before === 'RP3' || before === 'HM0360') && before !== cameraChoice) {
                        const previous = CAMERA_VARIANT_LABELS[before]
                        progress.setFinishStep(`Switching back to ${previous}...`)
                        restored = (await camera.switchTo(before))
                            ? ` Switched back to ${previous}.`
                            : ` Switching back to ${previous} failed as well; check 'AI slots' in the console.`
                    }
                    throw new Error(`The ${chosen} firmware started but its camera did not answer, so a deployment on it would record nothing. Check the sensor cable, or wait a few minutes and try again.${restored}`)
                }
                progress.addLog(`Camera: ${chosen}`)
            }

            progress.addLog('Retrieving current parameters...')
            progress.setFinishStep('Reading parameters...')
            progress.setFinishProgress(0.02)
            const currentOps = await bleSession.execute(commandRegistry.getops)
            log(`[DevDeploy] Pre-flight OPs: ${currentOps.join(' ')}`)

            // 1-2. Shared pipeline steps
            // AI model sync must run BEFORE time sync, see useStartDeployment
            // for the rationale. The model is the one chosen on screen, not
            // the project's stored one: the override is what this deployment
            // is for, and it is persisted to the project two steps below.
            await pipeline.syncAiModel(bleDevice, bleSession, aiModelIdOverride, cb, true, currentOps)
            await pipeline.syncTime(bleSession, cb)

            // 4. Persist project settings (dev-specific)
            progress.addLog('Saving project settings...')
            progress.setFinishStep('Saving settings...')
            progress.setFinishProgress(0.25)
            await persistProjectSettings()
            progress.addLog('Project settings saved')

            // 4b. Reset OPs to factory defaults before applying dev config (shared pipeline).
            // The only reset this deployment gets (connecting is read-only, #268).
            let opsAfterReset: string[] = currentOps
            try {
                // Configure against the post-reset table, not the snapshot the
                // reset was diffed from, see useStartDeployment (#282).
                opsAfterReset = (await pipeline.resetOps(bleSession, cb, currentOps)) ?? currentOps
            } catch (resetError) {
                logWarn('[DevDeploy] OP reset failed, aborting:', resetError)
                progress.addLog('OP reset failed, aborting deployment')
                throw new Error('The device could not be reset to defaults. Reconnect and try again.')
            }

            // 5. Create deployment record
            progress.addLog('Creating deployment record...')
            progress.setFinishStep('Creating record...')
            progress.setFinishProgress(0.3)

            const newDeployment = await DeploymentService.createDeployment({
                name: locationName || 'Dev Deployment Test',
                projectId: project.id,
                deviceId: device?.id || '',
                setupBy: user.id,
                locationName: locationName || 'Dev Deployment Test',
                cameraHeight: cameraHeight ? parseFloat(cameraHeight) : undefined,
                latitude: gpsLocation?.latitude,
                longitude: gpsLocation?.longitude,
                altitude: gpsLocation?.altitude,
                accuracy: gpsLocation?.accuracy === null ? undefined : gpsLocation?.accuracy,
                captureMethodId: effectiveCaptureMethod,
                aiModelId: aiModelIdOverride || undefined,
                deviceEui: device?.deviceEui,
                batteryLevelAtStart: batteryLevel ?? undefined,
                sdCardTotalKbAtStart: sdCardStatus?.total,
                sdCardAvailableKbAtStart: sdCardStatus?.free,
                startComments: notes,
                cameraImagePaths: [],
            })
            deploymentIdRef.current = newDeployment.id
            setDeploymentStartTime(newDeployment.deploymentStart || new Date())
            progress.addLog(`Deployment created: ${newDeployment.id.substring(0, 8)}...`)

            // 6. Configure device OPs (shared pipeline). The flash goes in as
            // the project's columns, exactly as Start Monitoring sends them,
            // so a mode and LED tried here are the ones a real deployment of
            // the project would write.
            const flash = flashColumnsFromFields(flashMode, flashLed, flashWindowStart, flashWindowMinutes)
            await pipeline.configureDevice(bleDevice, startConfigure, {
                deploymentId: newDeployment.id,
                captureMethodId: effectiveCaptureMethod,
                timelapseInterval: effectiveTimelapseInterval,
                recordGpsInImages: recordGpsOverride,
                gpsLocation,
                flash,
            }, cb, opsAfterReset)

            // 7. Flash brightness, dev only (the LED and the mode went in above).
            // Only when there is a flash to be bright: with the mode off the
            // firmware never selects an LED, so op9 would be a value nothing
            // reads.
            const session = bleSession
            if (flash.flash_mode !== 'off') {
                progress.addLog('Setting flash brightness...')
                progress.setFinishStep('Flash brightness...')
                progress.setFinishProgress(0.7)
                await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.LED_BRIGHTNESS, value: ledBrightness }))
                progress.addLog(`Flash: ${describeProjectFlash(flash)} @ ${ledBrightness}%`)
            }

            // 7b. Pictures per trigger. op5 is in RESET_PRESERVED_OPS, so the
            // reset leaves whatever the card held and this write is the only
            // thing that sets it. op18 is not preserved and is 0 by now; the
            // BMP write that used to sit here is commented out with its state.
            progress.addLog('Setting pictures per trigger...')
            progress.setFinishStep('Pictures per trigger...')
            progress.setFinishProgress(0.75)
            //   await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.TEST_MODE_BITS, value: testModeBits }))
            await session.execute(() => commandRegistry.setop({ index: OP_PARAMETER.NUM_PICTURES, value: numPictures }))
            progress.addLog(`Pictures per trigger: ${numPictures}`)

            // 8. Done
            progress.setFinishStep('Complete')
            progress.setFinishProgress(1.0)
            progress.setIsSuccess(true)
            progress.addLog('Dev deployment started successfully')

            setTimeout(() => {
                progress.setIsFinishing(false)
                monitoring.setIsMonitoring(true)
                isStartDeploymentInProgress.current = false
                setSubmitting(false)
            }, 1500)

        } catch (error) {
            logError('Dev deployment failed:', error)
            progress.setIsFinishing(false)
            setSubmitting(false)
            Alert.alert('Error', 'Failed to start dev deployment: ' + (error as any).message)
            isStartDeploymentInProgress.current = false
        }
    }, [
        bleDevice, bleSession, project, user, device,
        startConfigure, progress, persistProjectSettings,
        batteryLevel, gpsLocation, locationName, cameraHeight, notes,
        sdCardStatus, sdCardMissing,
        flashMode, flashLed, flashWindowStart, flashWindowMinutes, ledBrightness,
        numPictures, cameraChoice, camera, readSelfTestBits, refreshActiveDeployment,
        aiModelIdOverride, recordGpsOverride,
        effectiveCaptureMethod, effectiveTimelapseInterval,
        monitoring
    ])

    // Keep track of start time when deployment is created
    const [deploymentStartTime, setDeploymentStartTime] = useState<Date | null>(null)

    const handleFinishDismiss = useCallback(() => {
        progress.setIsFinishing(false)
        if (progress.isSuccess) {
            monitoring.setIsMonitoring(true)
        }
    }, [progress, monitoring])

    return {
        // Device
        bleDevice,
        device,
        // Project
        project,
        availableProjects,
        handleProjectChange,
        // Form
        notes, setNotes,
        locationName, setLocationName,
        cameraHeight, setCameraHeight,
        // Capture method overrides
        captureMethodOverride: effectiveCaptureMethod,
        setCaptureMethodOverride,
        timelapseIntervalText, setTimelapseIntervalText,
        timelapseInterval: effectiveTimelapseInterval,
        // New project field overrides
        motionSensitivityOverride, setMotionSensitivityOverride,
        aiModelIdOverride, setAiModelIdOverride,
        lorawanOverride, setLorawanOverride,
        recordGpsOverride, setRecordGpsOverride,
        // Reference data
        captureMethodOptions, sensitivityOptions, aiModelOptions,
        // Capture flash (the project's columns) and the dev-only brightness
        flashMode, setFlashMode,
        flashLed, setFlashLed,
        flashWindowStart, setFlashWindowStart,
        flashWindowMinutes, setFlashWindowMinutes,
        ledBrightnessText, setLedBrightnessText, ledBrightness,
        // Pictures per trigger
        numPicturesText, setNumPicturesText, numPictures,
        //   testModeBits, setTestModeBits,
        // Camera
        cameraChoice, setCameraChoice,
        activeCamera: camera.activeCamera,
        cameraBusy: camera.isBusy,
        cameraStage: camera.stage,
        // Device health
        batteryLevel, sdCardStatus,
        handleBatteryCheck, handleSdCardCheck,
        isCheckingBattery, isCheckingSdCard,
        healthIssues: selfTest.issues,
        isCheckingHealth: selfTest.isChecking,
        recheckHealth: selfTest.refresh,
        sdCardMissing,
        // The deployment this device is already on, if any; Start is blocked while it exists
        activeDeployment, handleEndActiveDeployment, isEndingDeployment,
        dialogMode,
        // Deployment
        submitting,
        deploymentStartTime,
        handleStartDeployment,
        // Monitoring (from shared hook)
        isMonitoring: monitoring.isMonitoring,
        handleMonitorDisconnect: monitoring.handleMonitorDisconnect,
        handleStopMonitoring: monitoring.handleStopMonitoring,
        isStoppingMonitoring: monitoring.isStoppingMonitoring,
        // Progress (from shared hook)
        isFinishing: progress.isFinishing,
        finishProgress: progress.finishProgress,
        finishStep: progress.finishStep,
        finishLogs: progress.finishLogs,
        isStartSuccess: progress.isSuccess,
        handleFinishDismiss,
    }
}
