import { useState, useEffect, useCallback, useRef } from 'react'
import { Alert } from 'react-native'
import { useAppSelector } from '../../../redux'
import { Q } from '@nozbe/watermelondb'
import database from '../../../database'
import { useFocusEffect } from '@react-navigation/native'
import { DeploymentService } from '../../../services/DeploymentService'
import { DeploymentPhotoService } from '../../../services/DeploymentPhotoService'
import ProjectService from '../../../services/ProjectService'
import ReferenceDataService from '../../../services/ReferenceDataService'
import Device from '../../../database/models/Device'
import Deployment from '../../../database/models/Deployment'
import { DeviceService } from '../../../services/DeviceService'
import FirmwareService from '../../../services/FirmwareService'
import { useBleSession } from '../../../hooks/useBleSession'
import { commandRegistry } from '../../../ble/protocol/commandRegistry'
import { checkSdCard } from '../../../ble/workflows/checkSdCard'
import { extractErrorBits } from '../../../ble/messageClassifier'
import { useBleActions } from '../../../providers/BleEngineProvider'
import { useDeploymentConfiguration } from '../../../hooks/useDeploymentConfiguration'
import { useBle } from '../../../hooks/useBle'
import { useGPSLocation } from '../../../hooks/useGPSLocation'
import { useDeviceSettings, OP_PARAMETER, TEST_BIT_SAVE_BMP } from '../../../hooks/useDeviceSettings'
import { useDeploymentProgress } from '../../../hooks/useDeploymentProgress'
import { useMonitoringActions } from '../../../hooks/useMonitoringActions'
import * as pipeline from '../../../ble/workflows/deploymentPipeline'

import { log, logError, logWarn } from '../../../utils/logger'
import { selectCurrentOrganisation } from '../../../redux/slices/authSlice'
import { ProjectWithDetails } from '../../../types/project'
import { InitPayload } from '../../../navigation/types'
import { calculateDistance } from '../../../utils/gpsUtils'

interface UseStartDeploymentParams {
    deviceId?: string
    bleDeviceId?: string
    projectId?: string
    navigation: any
    initPayload?: InitPayload
}

export const useStartDeployment = ({
    deviceId,
    bleDeviceId,
    projectId: initialProjectId,
    navigation,
    initPayload
}: UseStartDeploymentParams) => {
    // Selectors
    const devices = useAppSelector(state => state.devices)
    const bleDevice = devices[bleDeviceId || '']
    const user = useAppSelector(state => state.authentication.user)
    const currentOrganisation = useAppSelector(selectCurrentOrganisation)

    // BLE Hooks
    const { disconnectDevice } = useBle()
    const { quiesceDevice } = useDeviceSettings()
    
    // NEW EVENT-FIRST ARCHITECTURE (SHADOW MODE)
    const bleSession = useBleSession(bleDevice)
    // const { initialize } = useBleInitialization()
    const { configure: startConfigure } = useDeploymentConfiguration()
    useBleActions()

    // GPS Location
    const { getLocation, location: gpsLocation } = useGPSLocation()

    // Advanced Settings State
    const [batteryLevel, setBatteryLevel] = useState<number | null>(initPayload?.batteryLevel || null)
    const [sdCardStatus, setSdCardStatus] = useState<{ total: number; free: number } | null>(initPayload?.sdCardStatus || null)

    
    // Refs for DFU
    const isDfuInProgress = useRef(false)
    const isReconnectingAfterDfu = useRef(false)



    const [formState, setFormState] = useState({
        notes: '',
        cameraHeight: '',
        testImagePath: undefined as string | undefined
    })

    // Phone photos of the deployment site (local file:// paths until uploaded)
    const [deploymentPhotoPaths, setDeploymentPhotoPaths] = useState<string[]>([])

    // Capture format (dev/testing quality trial): JPG+BMP by default; the advanced
    // "Record JPEG only" toggle opts out. See bmp-ingestion-analysis.md.
    const [recordJpegOnly, setRecordJpegOnly] = useState(false)

    // Hi-res photos (op32): one 1216x960 JPEG per trigger instead of 640x480.
    // Requires no on-device AI model (the raw frame occupies the NN arena), so
    // the toggle is blocked for projects with a model. Written after resetOps
    // so the factory-reset diff does not clobber it. The firmware picks the
    // datapath at sensor init, so hi-res starts from the first wake after the
    // device next sleeps. See firmware _Documentation/hires-capture.md.
    const [hiResPhotos, setHiResPhotos] = useState(false)

    const [submitting, setSubmitting] = useState(false)
    const [project, setProject] = useState<any>(null)
    const [availableProjects, setAvailableProjects] = useState<ProjectWithDetails[]>([])
    const [captureMethodName, setCaptureMethodName] = useState<string>('')
    const [sensitivityLabel, setSensitivityLabel] = useState<string>('')
    
    // Site Name (Location Name) States
    const [locationName, setLocationName] = useState<string>('')
    const [availableLocations, setAvailableLocations] = useState<{label: string, value: string}[]>([])
    const [isCustomLocation, setIsCustomLocation] = useState<boolean>(true)
    const lastLocationCalculationRef = useRef<{lat: number, lon: number} | null>(null)
    
    // UI State for Initialization Header
    const [device, setDevice] = useState<Device | undefined>()
    const [isInitializing, _setIsInitializing] = useState(false) // Hardcoded false as initialization now happens upstream
    const [initProgress, _setInitProgress] = useState(1.0)
    const [initStep, _setInitStep] = useState('Complete')
    const [initErrors, setInitErrors] = useState<{ selftest?: string; setUtc?: string; deviceHealth?: string[] }>(initPayload?.initErrors || {})
    const aiProcessorFailed = initPayload?.aiProcessorFailed ?? false

    // Shared progress dialog state
    const progress = useDeploymentProgress()
    const deploymentIdRef = useRef<string | null>(null)

    // Connection Guard Refs
    const isNavigatingAway = useRef(false)
    const isStartDeploymentInProgress = useRef(false)

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

    // Standard BLE initialization plus initialization guard
    // const hasRunInitialization = useRef(false)
    const bleDeviceRef = useRef(bleDevice)

    
    // Memoized handlers to prevent infinite loops in child components
    const handleImageCaptured = useCallback((path: string) => {
        setFormState(prev => ({ ...prev, testImagePath: path }))
    }, [])

    const handleAddDeploymentPhoto = useCallback((path: string) => {
        setDeploymentPhotoPaths(prev => [...prev, path])
    }, [])

    const handleRemoveDeploymentPhoto = useCallback((path: string) => {
        setDeploymentPhotoPaths(prev => prev.filter(p => p !== path))
        DeploymentPhotoService.removeLocalPhoto(path)
    }, [])

    const handleNotesChange = useCallback((notes: string) => {
        setFormState(prev => ({ ...prev, notes }))
    }, [])

    const handleCameraHeightChange = useCallback((text: string) => {
        setFormState(prev => ({ ...prev, cameraHeight: text }))
    }, [])

    useEffect(() => {
        bleDeviceRef.current = bleDevice
    }, [bleDevice])  



    const loadProjectAndDevice = useCallback(async () => {
        try {
            log('[DeploymentDetails] Loading project:', initialProjectId);
            
            const [deviceData] = await Promise.all([
                DeviceService.getDeviceById(deviceId as string)
            ])
            
            setDevice(deviceData)

            if (initialProjectId) {
                const proj = await ProjectService.getProjectById(initialProjectId)
                log('[DeploymentDetails] Project loaded:', proj?.name, 'capture_method_id:', proj?.capture_method_id);
                setProject(proj)
                
                if (user?.id && currentOrganisation?.id) {
                    const projs = await ProjectService.getProjectsForUserInOrganisation(user.id, currentOrganisation.id)
                    setAvailableProjects(projs)
                }

                if (proj && proj.capture_method_id) {
                    log('[DeploymentDetails] Resolving capture method name for ID:', proj.capture_method_id);
                    const methods = await ReferenceDataService.getCaptureMethods()
                    const method = methods.find((m: any) => String(m.id) === String(proj.capture_method_id))
                    log('[DeploymentDetails] Method resolved:', method?.value);
                    setCaptureMethodName(method ? method.value : 'Unknown')

                    if (proj.activity_detection_sensitivity_id) {
                        const sensitivities = await ReferenceDataService.getActivitySensitivity()
                        const sensitivity = sensitivities.find((s: any) => String(s.id) === String(proj.activity_detection_sensitivity_id))
                        setSensitivityLabel(sensitivity ? sensitivity.value : 'Unknown')
                    }
                } else {
                    log('[DeploymentDetails] No capture method ID on project');
                    setCaptureMethodName('Not Set')
                }
            } else {
                logWarn('[DeploymentDetails] No projectId provided');
            }
        } catch (error) {
            logError('[DeploymentDetails] Error in loadProjectAndDevice:', error)
        }
    }, [initialProjectId, deviceId, user?.id, currentOrganisation?.id])

    useFocusEffect(
        useCallback(() => {
            if (initialProjectId || deviceId) {
                loadProjectAndDevice()
            }
            getLocation()
        }, [initialProjectId, deviceId, loadProjectAndDevice, getLocation])
    )

    // Location Name logic based on GPS and Project Deployments
    useEffect(() => {
        let isMounted = true
        const updateClosestLocations = async () => {
            if (!project?.id || !gpsLocation) return

            const lat = gpsLocation.latitude
            const lon = gpsLocation.longitude

            // Check if we need to recalculate (moved > 80m)
            if (lastLocationCalculationRef.current) {
                const dist = calculateDistance(
                    lat, lon,
                    lastLocationCalculationRef.current.lat, lastLocationCalculationRef.current.lon
                )
                if (dist < 80) {
                    return // No significant movement
                }
            }

            lastLocationCalculationRef.current = { lat, lon }

            try {
                const deploymentsCollection = database.get<Deployment>('deployments')
                const pastDeployments = await deploymentsCollection.query(
                    Q.where('project_id', project.id),
                    Q.where('latitude', Q.notEq(null)),
                    Q.where('longitude', Q.notEq(null))
                ).fetch()

                if (!isMounted) return

                if (pastDeployments.length === 0) {
                    setAvailableLocations([])
                    setIsCustomLocation(true)
                    return
                }

                // Group by locationName and find distance
                const locationsMap = new Map<string, number>()
                pastDeployments.forEach(d => {
                    if (!d.locationName) return
                    const dist = calculateDistance(lat, lon, d.latitude!, d.longitude!)
                    
                    if (!locationsMap.has(d.locationName) || dist < locationsMap.get(d.locationName)!) {
                        locationsMap.set(d.locationName, dist)
                    }
                })

                if (locationsMap.size === 0) {
                    setAvailableLocations([])
                    setIsCustomLocation(true)
                    return
                }

                // Sort by distance
                const sorted = Array.from(locationsMap.entries())
                    .sort((a, b) => a[1] - b[1])
                    .slice(0, 3) // Top 3

                const ops = sorted.map(([name]) => ({ label: name, value: name }))
                setAvailableLocations(ops)

                // Autofill closest
                if (ops.length > 0) {
                    setLocationName(ops[0].value)
                    setIsCustomLocation(false)
                }
            } catch (err) {
                logError('[Deployment] Failed to calculate closest locations', err)
            }
        }

        updateClosestLocations()

        return () => {
            isMounted = false
        }
    }, [project?.id, gpsLocation])

    const handleProjectChange = useCallback(async (projectId: string) => {
        if (!projectId || projectId === project?.id) return;
        
        const newProject = availableProjects.find(p => p.id === projectId);
        if (!newProject) return;

        log('[DeploymentDetails] Project changed by user:', projectId)
        setProject(newProject);

        if (newProject.model_id) {
            // Hi-res requires the NN off — not available for AI-model projects
            setHiResPhotos(false)
        }

        if (newProject.capture_method_id) {
            const methods = await ReferenceDataService.getCaptureMethods()
            const method = methods.find((m: any) => String(m.id) === String(newProject.capture_method_id))
            setCaptureMethodName(method ? method.value : 'Unknown')

            if (newProject.activity_detection_sensitivity_id) {
                const sensitivities = await ReferenceDataService.getActivitySensitivity()
                const sensitivity = sensitivities.find((s: any) => String(s.id) === String(newProject.activity_detection_sensitivity_id))
                setSensitivityLabel(sensitivity ? sensitivity.value : 'Unknown')
            } else {
                setSensitivityLabel('')
            }
        } else {
            setCaptureMethodName('Not Set')
            setSensitivityLabel('')
        }
    }, [availableProjects, project?.id]);

    // Validate LoRaWAN connectivity if required
    useEffect(() => {
        let isMounted = true;
        const checkLorawan = async () => {
             if (project?.lorawan_required && bleDevice?.connected) {
                  log('[Deployment] Project requires LoRaWAN. Pinging network...')
                  try {
                      await bleSession?.execute(commandRegistry.ping)
                      log('[Deployment] LoRaWAN ping successful.')
                      if (isMounted) {
                          setInitErrors(prev => ({
                              ...prev,
                              deviceHealth: (prev.deviceHealth || []).filter(msg => !msg.includes('LoRaWAN is required'))
                          }))
                      }
                  } catch (err) {
                      logWarn('[Deployment] LoRaWAN ping failed:', err)
                      if (isMounted) {
                          setInitErrors(prev => {
                              const existing = prev.deviceHealth || []
                              const msg = 'LoRaWAN is required but the test message failed.'
                              if (!existing.includes(msg)) return { ...prev, deviceHealth: [...existing, msg] }
                              return prev
                          })
                      }
                  }
             } else if (!project?.lorawan_required) {
                 if (isMounted) {
                      setInitErrors(prev => ({
                          ...prev,
                          deviceHealth: (prev.deviceHealth || []).filter(msg => !msg.includes('LoRaWAN is required'))
                      }))
                 }
             }
        }
        checkLorawan()
        return () => { isMounted = false }
    }, [project?.lorawan_required, bleDevice?.connected, bleDevice]) // eslint-disable-line react-hooks/exhaustive-deps

    // Navigation Interceptor
    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
            if (isNavigatingAway.current) {
                return
            }

            const actionType = e.data.action.type;
            if (actionType === 'GO_BACK' || actionType === 'POP') {
                e.preventDefault()

                log('[Deployment] Intercepting back navigation. Disconnecting and redirecting to Deployments.')
                isNavigatingAway.current = true

                if (bleDevice) {
                    bleSession?.execute(commandRegistry.disconnect).finally(() => disconnectDevice(bleDevice)).catch((err: any) => logWarn('[Deployment] Auto-disconnect failed:', err))
                }

                navigation.navigate('Home', { initialTab: 'deployment' })
            }
        })

        return () => unsubscribe()
    }, [navigation, bleDevice]) // eslint-disable-line react-hooks/exhaustive-deps

    // Robust Connection Lost Alert
    useEffect(() => {
        if (!isInitializing && !submitting && bleDevice && !bleDevice.connected && !isNavigatingAway.current && !isStartDeploymentInProgress.current && !isDfuInProgress.current && !isReconnectingAfterDfu.current) {
            if (monitoring.isMonitoring) {
                logWarn('[Monitor] Connection lost. Auto-navigating to home.')
                Alert.alert('Connection Lost', 'Connection lost — device continues recording.', [{ text: 'OK' }])
                isNavigatingAway.current = true
                navigation.navigate('Home', { initialTab: 'deployment' })
            } else {
                Alert.alert(
                    'Connection Lost',
                    'Device disconnected unexpectedly during deployment setup.',
                    [{
                        text: 'OK', onPress: () => {
                            isNavigatingAway.current = true
                            if (navigation.canGoBack()) {
                                navigation.goBack()
                            }
                        }
                    }]
                )
            }
        }
    }, [bleDevice, submitting, navigation, isInitializing, monitoring.isMonitoring])  

    const handleStartDeployment = useCallback(async () => {
        if (!bleDevice?.connected) {
            Alert.alert('Device Disconnected', 'Please ensure the device is connected before starting the deployment.', [{ text: 'OK' }])
            return
        }
        if (!project || !user) {
            Alert.alert('Error', 'Missing project or user information. Please wait for data to load.')
            return
        }
        if (!bleSession) {
            Alert.alert('Error', 'BLE session not available.')
            return
        }
        if (aiProcessorFailed) {
            const hasCameraError = initErrors.deviceHealth?.some(w => w.includes('Camera Error') || w.includes('Camera system not enabled') || w.includes('Neural Network Error'))
            Alert.alert(
                hasCameraError ? 'Critical AI Processor Error' : 'AI Processor Not Responding',
                hasCameraError 
                    ? 'The AI processor has reported a critical camera or hardware error. Starting monitoring is blocked. Please check the camera module connections or hardware configuration.'
                    : 'The AI processor did not wake up during pre-deployment checks. The device cannot start monitoring. Please try reconnecting or check the hardware.',
                [{ text: 'OK' }]
            )
            return
        }

        progress.reset('Starting deployment...')
        setSubmitting(true)
        isStartDeploymentInProgress.current = true

        const cb = {
            addLog: progress.addLog,
            setStep: progress.setFinishStep,
            setProgress: progress.setFinishProgress,
        }

        try {
            progress.addLog('Retrieving current parameters...')
            progress.setFinishStep('Reading parameters...')
            progress.setFinishProgress(0.02)
            const currentOps = await bleSession.execute(commandRegistry.getops)
            log(`[Deployment] Pre-flight OPs: ${currentOps.join(' ')}`)

            // 1-2. Shared pipeline steps
            // IMPORTANT: AI model sync must run BEFORE time sync.
            // The getops() call above wakes the AI processor from DPD. The firmware has
            // a 1000ms inactivity timer that shuts down the IMAGE task. setutc is handled
            // by the BLE module (not the AI processor), so it does NOT reset this timer.
            // If syncTime runs first, the IMAGE task dies before loadmodel arrives.
            await pipeline.syncAiModel(bleDevice, bleSession, project.model_id, cb, true, currentOps)
            await pipeline.syncTime(bleSession, cb)

            // 4. Gather snapshot data (unique to production deployment)
            progress.addLog('Gathering snapshot data...')
            progress.setFinishStep('Reading metrics...')
            progress.setFinishProgress(0.2)
            
            let lorawanRssi: number | undefined
            let lorawanSnr: number | undefined
            let bleFirmwareId: string | undefined

            if (bleDevice && project?.lorawan_required) {
                try {
                    progress.addLog('Reading LoRaWAN metrics...')
                    const networkResp = await bleSession?.execute(commandRegistry.network)
                    if (networkResp && networkResp.joined) {
                        lorawanRssi = networkResp.rssi
                        lorawanSnr = networkResp.snr
                        progress.addLog(`LoRaWAN metrics: RSSI ${lorawanRssi}, SNR ${lorawanSnr}`)
                    }
                } catch (e) {
                    logWarn('Failed to read LoRaWAN metrics:', e)
                    progress.addLog('Skipped LoRaWAN metrics (not available)')
                }
            }

            if (bleDevice) {
                try {
                    let response = initPayload?.deviceFirmwareVersion
                    if (!response) {
                        response = await bleSession?.execute(commandRegistry.version)
                    }
                    if (response) {
                        const resolvedId = await FirmwareService.getFirmwareIdByVersion('ble', response)
                        if (resolvedId) bleFirmwareId = resolvedId
                    }
                } catch (e) {
                    logWarn('Failed to resolve firmware ID:', e)
                }
            }

            // 5. Create deployment record
            progress.addLog('Creating deployment record...')
            progress.setFinishStep('Creating record...')
            progress.setFinishProgress(0.3)

            const newDeployment = await DeploymentService.createDeployment({
                name: locationName || 'Automated Deployment',
                projectId: project.id,
                deviceId: deviceId || '',
                setupBy: user.id,
                locationName: locationName || 'Automated Deployment',
                cameraHeight: formState.cameraHeight ? parseFloat(formState.cameraHeight) : undefined,
                latitude: gpsLocation?.latitude,
                longitude: gpsLocation?.longitude,
                altitude: gpsLocation?.altitude,
                accuracy: gpsLocation?.accuracy === null ? undefined : gpsLocation?.accuracy,
                captureMethodId: project.capture_method_id,
                aiModelId: project.model_id,
                deviceEui: device?.deviceEui,
                batteryLevelAtStart: batteryLevel ?? undefined,
                sdCardTotalKbAtStart: sdCardStatus?.total,
                sdCardAvailableKbAtStart: sdCardStatus?.free,
                bleFirmwareId: bleFirmwareId,
                lorawanRssiAtStart: lorawanRssi,
                lorawanSnrAtStart: lorawanSnr,
                startComments: formState.notes,
                cameraImagePaths: deploymentPhotoPaths,
            })
            deploymentIdRef.current = newDeployment.id
            setDeploymentStartTime(newDeployment.deploymentStart || new Date())
            progress.addLog(`Deployment created: ${newDeployment.id.substring(0, 8)}...`)

            // Upload site photos in the background; failures are retried on later syncs
            if (deploymentPhotoPaths.length > 0) {
                DeploymentPhotoService.uploadPendingPhotos(newDeployment.id, user.id)
                    .catch((e) => logWarn('[Deployment] Photo upload deferred:', e))
            }

            // 6. Reset OPs to factory defaults before applying deployment config
            try {
                await pipeline.resetOps(bleSession, cb, currentOps)
            } catch (resetError) {
                logWarn('[Deployment] OP reset failed, continuing with configuration:', resetError)
                progress.addLog('OP reset failed — continuing with configuration')
            }

            // 7. Configure device OPs for this specific deployment (shared pipeline)
            try {
                await pipeline.configureDevice(bleDevice, startConfigure, {
                    deploymentId: newDeployment.id,
                    captureMethodId: project.capture_method_id,
                    timelapseInterval: project.timelapse_interval_seconds || 300,
                    recordGpsInImages: project.record_gps_in_images || false,
                    gpsLocation,
                }, cb, currentOps)
            } catch (configError) {
                logError('[Deployment] Configuration failed:', configError)
                progress.addLog('Configuration failed — aborting deployment')
                throw configError
            }

            // 7b. Capture format.
            // Hi-res (op32=1): one 1216x960 JPEG per trigger via the CPU pipeline.
            // Forces JPEG-only single-shot (BMP alternation and multi-shot are
            // untested on the hi-res path, and single-shot also avoids the
            // back-to-back delivery-contention caveat in hires-capture.md).
            // Requires no AI model — guarded in the UI and re-checked here;
            // resetOps/syncAiModel already erased any stale model when the
            // project has none.
            // Otherwise: JPG+BMP by default (quality trial); the advanced
            // "Record JPEG only" toggle disables BMP. TEST_BIT_SAVE_BMP makes the
            // firmware alternate JPG/BMP, so 2 pics/trigger yields one of each.
            // Non-fatal: on failure the firmware keeps its clean-slate defaults
            // (JPEG only, 640x480). See bmp-ingestion-analysis.md.
            const hiRes = hiResPhotos && !project.model_id
            try {
                const testModeBits = (recordJpegOnly || hiRes) ? 0 : TEST_BIT_SAVE_BMP
                const numPictures = (recordJpegOnly || hiRes) ? 1 : 2
                await bleSession?.execute(() => commandRegistry.setop({ index: OP_PARAMETER.TEST_MODE_BITS, value: testModeBits }))
                await bleSession?.execute(() => commandRegistry.setop({ index: OP_PARAMETER.NUM_PICTURES, value: numPictures }))
                if (hiRes) {
                    await bleSession?.execute(() => commandRegistry.setop({ index: OP_PARAMETER.CAM_RESOLUTION, value: 1 }))
                    progress.addLog('Capture format: high-res JPEG (1216×960), 1 pic/trigger — starts from the first wake after the device sleeps')
                } else {
                    progress.addLog(`Capture format: ${recordJpegOnly ? 'JPEG only' : 'JPG + BMP'} (${numPictures} pic${numPictures > 1 ? 's' : ''}/trigger)`)
                }
            } catch (formatError) {
                logWarn('[Deployment] Failed to set capture format (non-fatal):', formatError)
                if (hiRes) {
                    progress.addLog('⚠️ Could not enable high-res — the deployment will record 640×480')
                }
            }

            // 7c. One-shot light check: take a single reference photo (every capture
            // runs the AE light check on-device and persists the decision to op25),
            // then read the verdict back and tell the user which camera mode the
            // deployment starts in and when light is re-checked. Non-fatal: on any
            // failure fall back to the last persisted decision from the pre-flight
            // ops snapshot.
            try {
                progress.addLog('Checking light conditions...')
                progress.setFinishStep('Checking light...')
                progress.setFinishProgress(0.9)

                let flashState: number | null = null
                let checkInterval: number | null = null
                let autoSwitch: number | null = null
                let freshReading = false

                try {
                    // One photo; its AE sample refreshes op25 (and doubles as a
                    // deployment-start reference shot on the SD card).
                    await bleSession?.execute(() => commandRegistry.capture(1, 500))
                    const opsAfter = await bleSession?.execute(commandRegistry.getops)
                    if (opsAfter) {
                        flashState = parseInt(opsAfter[OP_PARAMETER.AE_FLASH_STATE] ?? '', 10)
                        checkInterval = parseInt(opsAfter[OP_PARAMETER.AE_CHECK_INTERVAL] ?? '', 10)
                        autoSwitch = parseInt(opsAfter[OP_PARAMETER.SLOT_SWITCH] ?? '', 10)
                        freshReading = !isNaN(flashState)
                    }
                } catch (captureError) {
                    logWarn('[Deployment] Light-check capture failed, using last known decision:', captureError)
                }

                if (!freshReading) {
                    // Pre-reset snapshot: op25 persists across sleep, so the last
                    // session's decision is still meaningful, just not fresh.
                    flashState = parseInt(currentOps[OP_PARAMETER.AE_FLASH_STATE] ?? '', 10)
                    checkInterval = parseInt(currentOps[OP_PARAMETER.AE_CHECK_INTERVAL] ?? '', 10)
                    autoSwitch = parseInt(currentOps[OP_PARAMETER.SLOT_SWITCH] ?? '', 10)
                }

                if (flashState !== null && !isNaN(flashState)) {
                    const dark = flashState === 1
                    const readingTag = freshReading ? 'Light check' : 'Light check (last known reading)'
                    progress.addLog(dark
                        ? `💡 ${readingTag}: DARK — starting in night mode (IR camera)`
                        : `💡 ${readingTag}: BRIGHT — starting in day mode (colour camera)`)

                    const intervalKnown = checkInterval !== null && !isNaN(checkInterval)
                    if (autoSwitch === 1) {
                        progress.addLog(intervalKnown && checkInterval! > 0
                            ? `Light is re-checked after every photo and every ${checkInterval} min while asleep — the camera switches day/night automatically at the next sleep.`
                            : 'Light is re-checked after every photo — the camera switches day/night automatically at the next sleep.')
                    } else {
                        progress.addLog('Auto day/night switching is OFF — the device stays in this camera mode.')
                    }
                } else {
                    progress.addLog('Light conditions unknown — the device will decide day/night on its first capture.')
                }
            } catch (lightError) {
                logWarn('[Deployment] Light check failed (non-fatal):', lightError)
            }

            // 7d. Model verification: read back op14/15 and say LOUDLY whether
            // the NN is actually armed for this deployment. Guards the whole
            // class of silent-modelless starts (bench 21 Jul: sessions logged
            // 'motion detected' forever because resetOps had erased the model
            // after syncAiModel loaded it).
            try {
                const finalOps = await bleSession?.execute(commandRegistry.getops)
                if (!finalOps) {
                    // A failed read must NOT masquerade as 'NO MODEL LOADED'
                    throw new Error('No operational parameters returned from device')
                }
                const modelId = parseInt(finalOps[OP_PARAMETER.MODEL_PROJECT] ?? '0', 10) || 0
                const modelVer = parseInt(finalOps[OP_PARAMETER.MODEL_VERSION] ?? '0', 10) || 0
                if (project.model_id && modelId !== 0) {
                    progress.addLog(`🧠 AI model active on device (ID ${modelId} v${modelVer})`)
                } else if (project.model_id && modelId === 0) {
                    progress.addLog('⚠️ NO MODEL LOADED — the camera will capture on motion but nothing will be classified. Re-run the deployment or check the model sync log above.')
                } else {
                    progress.addLog('No on-device AI model for this project (motion-capture only)')
                }
            } catch (verifyError) {
                logWarn('[Deployment] Model verification read failed (non-fatal):', verifyError)
            }

            progress.setFinishStep('Complete')
            progress.setFinishProgress(1.0)
            progress.setIsSuccess(true)
            progress.addLog('Deployment started successfully')
            progress.addLog('Transitioning to live monitor...')

            // Auto-transition to monitoring after a brief delay
            setTimeout(() => {
                progress.setIsFinishing(false)
                monitoring.setIsMonitoring(true)
                isStartDeploymentInProgress.current = false
            }, 1500)

        } catch (error) {
            logError('Deployment failed:', error)
            progress.setIsFinishing(false)
            Alert.alert('Error', 'Failed to start deployment: ' + (error as any).message)
            isStartDeploymentInProgress.current = false
        }
    }, [formState.cameraHeight, formState.notes, bleDevice, bleSession, project, user, deviceId, startConfigure, progress, monitoring, batteryLevel, device?.deviceEui, gpsLocation, locationName, sdCardStatus?.free, sdCardStatus?.total, aiProcessorFailed, initPayload?.deviceFirmwareVersion, initErrors.deviceHealth, deploymentPhotoPaths, recordJpegOnly, hiResPhotos])

    const handleFinishDismiss = useCallback(() => {
        progress.setIsFinishing(false)
        if (progress.isSuccess) {
            monitoring.setIsMonitoring(true)
        }
    }, [progress, monitoring])

    const [helpVisible, setHelpVisible] = useState(false)
    const [helpTitle, setHelpTitle] = useState('')
    const [helpContent, setHelpContent] = useState('')

    const showHelp = useCallback((title: string, content: string) => {
        setHelpTitle(title)
        setHelpContent(content)
        setHelpVisible(true)
    }, [])

    const handleDismissHelp = useCallback(() => {
        setHelpVisible(false)
    }, [])

    const handleBatteryCheck = useCallback(async () => {
        if (!bleDevice || !bleDevice.connected) return
        try {
            const batteryLevelValue = await bleSession?.execute(commandRegistry.battery)
            if (batteryLevelValue) {
                setBatteryLevel(batteryLevelValue)
            }
        } catch (error) {
            logError('Battery check failed:', error)
            Alert.alert('Error', 'Failed to check battery level')
        }
    }, [bleDevice, bleSession])  

    const handleSdCardCheck = useCallback(async () => {
        if (!bleDevice || !bleDevice.connected) return
        try {
            // SHADOW MODE: Try new architecture
            if (bleSession) {
                try {
                    const sdStatus = await checkSdCard(bleSession)
                    setSdCardStatus({ total: sdStatus.totalSpaceMb, free: sdStatus.freeSpaceMb })
                    return
                } catch (err: any) {
                    // Try to determine the exact cause by reading selftest status
                    try {
                        const statusStr = await bleSession?.execute<string>(commandRegistry.selftest)
                        const hexBits = statusStr ? extractErrorBits(statusStr) : null
                        // eslint-disable-next-line no-bitwise
                        if (hexBits && (parseInt(hexBits, 16) & 0x0800)) {
                            Alert.alert('No SD Card Detected', 'The device reports no SD card is inserted.', [{ text: 'OK' }])
                            setSdCardStatus(null)
                            return
                        }
                    } catch (selftestErr) {
                        logWarn('Selftest check failed during SD card error handling:', selftestErr)
                    }

                    if (err.message.includes('AI NACK')) {
                         Alert.alert('SD Card Error', 'The SD card check failed (NACK). Please make sure a formatted SD card is inserted.', [{ text: 'OK' }])
                         setSdCardStatus(null)
                         return
                    }
                    throw err; // Re-throw if it was some other error (e.g. timeout)
                }
            }
        } catch (error) {
            logError('SD card check failed:', error)
            Alert.alert('Error', 'Failed to check SD card status')
        }
    }, [bleSession]) // eslint-disable-line react-hooks/exhaustive-deps



    // Keep track of start time when deployment is created
    const [deploymentStartTime, setDeploymentStartTime] = useState<Date | null>(null)

    return {
        formState, submitting, project, availableProjects, captureMethodName, sensitivityLabel,
        device, bleDevice, isInitializing, initProgress, initStep, initErrors, setInitErrors, aiProcessorFailed,
        finishProgress: progress.finishProgress, finishStep: progress.finishStep,
        finishLogs: progress.finishLogs, isFinishing: progress.isFinishing,
        isStartSuccess: progress.isSuccess,
        isMonitoring: monitoring.isMonitoring,
        deploymentStartTime,
        handleMonitorDisconnect: monitoring.handleMonitorDisconnect,
        handleStopMonitoring: monitoring.handleStopMonitoring,
        isStoppingMonitoring: monitoring.isStoppingMonitoring,
        isNavigatingAway, handleImageCaptured, handleNotesChange, handleProjectChange,
        handleCameraHeightChange, handleStartDeployment, handleFinishDismiss,
        // Deployment site photos
        deploymentPhotoPaths, handleAddDeploymentPhoto, handleRemoveDeploymentPhoto,
        helpVisible, helpTitle, helpContent, showHelp, handleDismissHelp,
        // Dropdown & Additional Location State
        locationName, setLocationName, availableLocations, isCustomLocation, setIsCustomLocation,
        // Advanced Settings Exports
        batteryLevel, sdCardStatus,
        handleBatteryCheck, handleSdCardCheck,
        // Capture format (advanced): JPG+BMP default, opt out to JPEG only
        recordJpegOnly, setRecordJpegOnly,
        // Hi-res photos (advanced): op32 = one 1216x960 JPEG per trigger; needs no AI model
        hiResPhotos, setHiResPhotos,
        // DFU control
        isDfuInProgress,
    }
}
