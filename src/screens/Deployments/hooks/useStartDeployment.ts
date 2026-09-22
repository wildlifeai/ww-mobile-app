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
import { sleep } from '../../../utils/helpers'
import { selfTestCache } from '../../../ble/protocol/selfTestCache'
import { parseSelfTestBits, SelfTestBit } from '../../../utils/deviceSelfTest'
import { useBleActions } from '../../../providers/BleEngineProvider'
import { useDeploymentConfiguration } from '../../../hooks/useDeploymentConfiguration'
import { useBle } from '../../../hooks/useBle'
import { useGPSLocation } from '../../../hooks/useGPSLocation'
import { useDeviceSettings, OP_PARAMETER } from '../../../hooks/useDeviceSettings'
import { useDeploymentProgress } from '../../../hooks/useDeploymentProgress'
import { useMonitoringActions } from '../../../hooks/useMonitoringActions'
import * as pipeline from '../../../ble/workflows/deploymentPipeline'

import { log, logError, logWarn } from '../../../utils/logger'
import { selectCurrentOrganisation } from '../../../redux/slices/authSlice'
import { ProjectWithDetails } from '../../../types/project'
import { InitPayload } from '../../../navigation/types'
import { calculateDistance } from '../../../utils/gpsUtils'
import { CAMERA_VARIANT_LABELS, CameraVariant, parseVariant } from '../../../utils/cameraVariant'
import { checkFlashAgainstCamera } from '../../../utils/flashCameraMatch'

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

    // Capture format used to be a choice here: JPEG only, or JPEG plus a raw
    // BMP. The BMP was a quality trial (bmp-ingestion-analysis.md), the
    // default until 5 September 2026 and opt-in from the advanced settings
    // after that. Retired on 21 September 2026 (Victor): it doubled the
    // captures and the card usage for pictures nobody compared any more.
    // Commented out rather than deleted, with `TEST_BIT_SAVE_BMP` still in
    // useDeviceSettings, until it is certain nothing wants it back; the
    // matching card is commented out in AdvancedSettingsSection.
    //
    //   const [recordJpegOnly, setRecordJpegOnly] = useState(true)

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
                Alert.alert('Connection Lost', 'Connection lost. The device continues recording.', [{ text: 'OK' }])
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
            const health = initErrors.deviceHealth ?? []
            // A missing card blocks on its own since #303: the deployment has
            // nowhere to write. Named first so the operator is told about the
            // card and not about the camera.
            const hasSdCardError = health.some(w => /no sd card/i.test(w))
            const hasCameraError = health.some(w => w.includes('Camera Error') || w.includes('Camera system not enabled') || w.includes('Neural Network Error'))
            Alert.alert(
                hasSdCardError ? 'No SD Card' : hasCameraError ? 'Critical AI Processor Error' : 'AI Processor Not Responding',
                hasSdCardError
                    ? 'The device reports no SD card. Every image and setting a deployment writes goes to the card, so monitoring cannot start without one. Insert a FAT32 card, then reconnect.'
                    : hasCameraError
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

            // 6. Reset OPs to factory defaults before applying deployment config.
            // The only reset this deployment gets (connecting is read-only, #268):
            // a device that cannot be reset must not be deployed with whatever a
            // previous deployment or an Engineer Console session left on it.
            let opsAfterReset: string[] = currentOps
            try {
                // The reset returns the op table as it now stands. Configuring
                // against the pre-reset snapshot instead would skip every write
                // whose old value happened to match, leaving the device on the
                // factory default the reset had just written (#282).
                opsAfterReset = (await pipeline.resetOps(bleSession, cb, currentOps)) ?? currentOps
            } catch (resetError) {
                logError('[Deployment] OP reset failed, aborting deployment:', resetError)
                progress.addLog('OP reset failed, aborting deployment')
                throw new Error('The device could not be reset to defaults. Reconnect and try again.')
            }

            // 7. Configure device OPs for this specific deployment (shared pipeline)
            try {
                await pipeline.configureDevice(bleDevice, startConfigure, {
                    deploymentId: newDeployment.id,
                    captureMethodId: project.capture_method_id,
                    timelapseInterval: project.timelapse_interval_seconds || 300,
                    recordGpsInImages: project.record_gps_in_images || false,
                    gpsLocation,
                    flash: project,
                }, cb, opsAfterReset)
            } catch (configError) {
                logError('[Deployment] Configuration failed:', configError)
                progress.addLog('Configuration failed, aborting deployment')
                throw configError
            }

            // 7b. Pictures per trigger: one. The reset cannot be relied on for
            // this one, because op5 is in RESET_PRESERVED_OPS, so a device left
            // at 2 by an earlier BMP deployment would stay there. Non-fatal: on
            // failure the firmware keeps whatever the card holds. #317 will make
            // the count a project setting; until then it is 1.
            //
            // The raw BMP used to be written here too, as TEST_MODE_BITS bit 1
            // plus a second picture so the alternating file types yielded one
            // of each. Retired on 21 September 2026, see the note by the state
            // above. op18 is not preserved by the reset, so it is 0 by now and
            // no longer needs writing.
            //
            //   const testModeBits = recordJpegOnly ? 0 : TEST_BIT_SAVE_BMP
            //   const numPictures = recordJpegOnly ? 1 : 2
            //   await bleSession?.execute(() => commandRegistry.setop({ index: OP_PARAMETER.TEST_MODE_BITS, value: testModeBits }))
            //   progress.addLog(`Capture format: ${recordJpegOnly ? 'JPEG only' : 'JPG + BMP'} (${numPictures} pic${numPictures > 1 ? 's' : ''}/trigger)`)
            try {
                await bleSession?.execute(() => commandRegistry.setop({ index: OP_PARAMETER.NUM_PICTURES, value: 1 }))
                progress.addLog('Pictures per trigger: 1')
            } catch (formatError) {
                logWarn('[Deployment] Failed to set pictures per trigger (non-fatal):', formatError)
            }

            // 7c. Light verdict for the deployment log: which camera mode the
            // deployment starts in, and when light is re-checked. Non-fatal
            // throughout; on any failure fall back to the pre-flight snapshot.
            //
            // The op table is read FIRST, because op25 only moves when the
            // firmware runs a light check and `lightSensor_isRequired()` is true
            // only for op34 mode 1 or op26. Since #304 both are off unless the
            // project asked for the AE flash, so the capture this step used to
            // take unconditionally could not refresh anything.
            //
            // It was not free. On the bench on 20 September 2026 that capture
            // cost 21 s: the IMX708 failed to power on (three I2C writes to
            // 0x0100 returned -60), the firmware logged `IMX708 on by app fail`,
            // moved the image task to 'Capturing' anyway, told the app nothing
            // and slept. Only a chance motion wake completed it (#269). Paying
            // that for a value that cannot change is what #304 calls an
            // unnecessary light sensor check.
            //
            // When one is needed it is measured with `AI light`, a throwaway
            // single-frame AE check: about a second, no image file, no flash and
            // no file transfer. Nothing here needs a photograph.
            // The freshest table this step actually read back from the device,
            // carried out to 7d. Deliberately NOT the same variable as `ops`
            // below: that one falls back to the pre-reset snapshot when the
            // device read fails, and a pre-reset table would tell 7d about the
            // model that was on the device *before* this deployment configured
            // it. Only genuine post-configuration reads land here, so 7d can
            // either trust it or read for itself.
            let latestDeviceOps: string[] | null = null

            try {
                progress.addLog('Checking light conditions...')
                progress.setFinishStep('Checking light...')
                progress.setFinishProgress(0.9)

                const opAt = (table: string[] | null | undefined, index: number): number | null => {
                    if (!table || index >= table.length) return null
                    const value = parseInt(table[index] ?? '', 10)
                    return isNaN(value) ? null : value
                }

                let ops: string[] | null = null
                try {
                    ops = (await bleSession?.execute(commandRegistry.getops)) ?? null
                    latestDeviceOps = ops
                } catch (readError) {
                    logWarn('[Deployment] Could not read ops for the light verdict:', readError)
                }

                // Which camera this deployment will actually use. Worth one
                // command now that #304 has stopped the device switching slots
                // on its own: whatever is active here is what the deployment
                // keeps. Non-fatal, and 'unknown' is reported as unknown rather
                // than guessed (#321).
                let camera: CameraVariant = 'unknown'
                try {
                    const slots = await bleSession?.execute(commandRegistry.slots)
                    if (slots) camera = parseVariant(slots.running)
                } catch (slotsError) {
                    logWarn('[Deployment] Could not read the active camera:', slotsError)
                }

                // Would a check here produce a reading, or move nothing at all?
                const lightSensorRuns = opAt(ops, OP_PARAMETER.SLOT_SWITCH) === 1
                    || opAt(ops, OP_PARAMETER.FLASH_MODE) === 1
                let freshReading = false

                if (lightSensorRuns && bleSession && bleDevice) {
                    const outcome = await pipeline.measureLight(bleSession, bleDevice.id)
                    let measured = outcome === 'ok'

                    if (outcome === 'unsupported') {
                        // Firmware without `AI light`. There every capture runs
                        // the check, so a photo is the only way to refresh op25.
                        try {
                            await bleSession.execute(() => commandRegistry.capture(1, 500))
                            measured = true
                        } catch (captureError) {
                            logWarn('[Deployment] Light-check capture failed, using last known decision:', captureError)
                        }
                    }

                    try {
                        const opsAfter = await bleSession.execute(commandRegistry.getops)
                        if (opsAfter) {
                            ops = opsAfter
                            latestDeviceOps = opsAfter
                            // `measured`, not merely "did not fail". A timeout means
                            // the command was acknowledged and the reading never
                            // arrived, so op25 is exactly as stale as it was before;
                            // so is it when the fallback capture throws. Calling
                            // either a fresh reading is the bug this step was
                            // rewritten to stop telling.
                            freshReading = measured && opAt(ops, OP_PARAMETER.AE_FLASH_STATE) !== null
                        }
                    } catch (readError) {
                        logWarn('[Deployment] Could not re-read ops after the light check:', readError)
                    }
                } else if (!lightSensorRuns) {
                    log('[Deployment] No light check would run (op26 and op34 both off); not measuring')
                }

                // Pre-reset snapshot as the last resort: op25 persists across
                // sleep, so the last session's decision is still meaningful.
                if (opAt(ops, OP_PARAMETER.AE_FLASH_STATE) === null) ops = currentOps

                const flashState = opAt(ops, OP_PARAMETER.AE_FLASH_STATE)
                const checkInterval = opAt(ops, OP_PARAMETER.AE_CHECK_INTERVAL)
                const autoSwitch = opAt(ops, OP_PARAMETER.SLOT_SWITCH)

                if (flashState !== null) {
                    const dark = flashState === 1
                    const readingTag = freshReading
                        ? 'Light check'
                        : 'Light check (last recorded, not measured now)'
                    progress.addLog(`💡 ${readingTag}: ${dark ? 'DARK' : 'BRIGHT'}`)

                    const intervalKnown = checkInterval !== null
                    if (autoSwitch === 1) {
                        progress.addLog(dark
                            ? 'Auto day/night switching is ON, so the camera moves to night mode (black & white) at the next sleep.'
                            : 'Auto day/night switching is ON, so the camera moves to day mode (colour) at the next sleep.')
                        progress.addLog(intervalKnown && checkInterval! > 0
                            ? `Light is re-checked after every photo and every ${checkInterval} min while asleep.`
                            : 'Light is re-checked after every photo.')
                    } else {
                        progress.addLog(camera === 'unknown'
                            ? 'Auto day/night switching is OFF: this deployment stays on the camera that is active now, which could not be read. Check it on the device screen.'
                            : `Auto day/night switching is OFF: this deployment stays on the ${CAMERA_VARIANT_LABELS[camera]} camera. Set the camera for the site on the device screen if it is the wrong one.`)
                    }
                } else {
                    progress.addLog(autoSwitch === 1
                        ? 'Light conditions unknown. Auto day/night switching is ON, so the device decides at its first check.'
                        : 'Light conditions unknown. Auto day/night switching is OFF, so this deployment keeps the camera that is active now.')
                }

                // #321: the flash and the camera are chosen in different places
                // and nothing compared them. An IR flash in front of the colour
                // camera is invisible to it (IR-cut filter), so the LED drains
                // the battery and the night frames are black. Reported, never
                // corrected: #304 deliberately stopped the app switching slots
                // by itself, and the operator is the one who knows the site.
                const flashVsCamera = checkFlashAgainstCamera(project, camera)
                if (flashVsCamera.kind === 'mismatch') {
                    const mark = flashVsCamera.severity === 'broken' ? '\u26a0\ufe0f' : '\u2139\ufe0f'
                    progress.addLog(`${mark} ${flashVsCamera.message}`)
                } else if (flashVsCamera.kind === 'unknown') {
                    progress.addLog('Could not read the active camera, so the flash and camera were not checked against each other.')
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
                // Reuse the table 7c already read back. It is taken after the
                // last `setop`, and everything issued since is a read: `slots`,
                // plus `AI light` on the deployments that need it, and when
                // that one runs 7c re-reads the table afterwards anyway. None
                // of them touch op14/op15. Asking the device for the same 37
                // values a second time cost about 300 ms of every deployment,
                // measured on the bench on 21 September 2026. When 7c came back
                // with nothing, read for ourselves rather than guess.
                const finalOps = latestDeviceOps
                    ?? (await bleSession?.execute(commandRegistry.getops))
                if (!finalOps) {
                    // A failed read must NOT masquerade as 'NO MODEL LOADED'
                    throw new Error('No operational parameters returned from device')
                }
                const modelId = parseInt(finalOps[OP_PARAMETER.MODEL_PROJECT] ?? '0', 10) || 0
                const modelVer = parseInt(finalOps[OP_PARAMETER.MODEL_VERSION] ?? '0', 10) || 0
                if (project.model_id && modelId !== 0) {
                    progress.addLog(`🧠 AI model active on device (ID ${modelId} v${modelVer})`)
                } else if (project.model_id && modelId === 0) {
                    progress.addLog('⚠️ NO MODEL LOADED. The camera will capture on motion but nothing will be classified. Re-run the deployment or check the model sync log above.')
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
    }, [formState.cameraHeight, formState.notes, bleDevice, bleSession, project, user, deviceId, startConfigure, progress, monitoring, batteryLevel, device?.deviceEui, gpsLocation, locationName, sdCardStatus?.free, sdCardStatus?.total, aiProcessorFailed, initPayload?.deviceFirmwareVersion, initErrors.deviceHealth, deploymentPhotoPaths])

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

    // Each check shows on its button while it is on the wire, for at least
    // MIN_CHECKING_MS: `battery` answers in under a quarter of a second, and a
    // re-check that lands on the same figure otherwise looks like a dead button.
    const MIN_CHECKING_MS = 600
    const [isCheckingBattery, setIsCheckingBattery] = useState(false)
    const [isCheckingSdCard, setIsCheckingSdCard] = useState(false)

    const handleBatteryCheck = useCallback(async () => {
        if (!bleDevice || !bleDevice.connected) return
        const started = Date.now()
        setIsCheckingBattery(true)
        try {
            const batteryLevelValue = await bleSession?.execute(commandRegistry.battery)
            if (batteryLevelValue) {
                setBatteryLevel(batteryLevelValue)
            }
        } catch (error) {
            logError('Battery check failed:', error)
            Alert.alert('Error', 'Failed to check battery level')
        } finally {
            await sleep(Math.max(0, MIN_CHECKING_MS - (Date.now() - started)))
            setIsCheckingBattery(false)
        }
    }, [bleDevice, bleSession])

    const handleSdCardCheck = useCallback(async () => {
        if (!bleDevice || !bleDevice.connected) return
        const started = Date.now()
        setIsCheckingSdCard(true)
        try {
            // SHADOW MODE: Try new architecture
            if (bleSession) {
                try {
                    const sdStatus = await checkSdCard(bleSession)
                    setSdCardStatus({ total: sdStatus.totalSpaceMb, free: sdStatus.freeSpaceMb })
                    return
                } catch (err: any) {
                    // Try to determine the exact cause from the self-test bits. The
                    // `AI info` that just failed woke the device, and the wake's
                    // broadcast is usually already in the cache; only ask if not.
                    try {
                        let bits: number | null = selfTestCache.getFresh(bleDevice.id, Date.now() - 10_000)?.bits ?? null
                        if (bits === null) {
                            const statusStr = await bleSession?.execute<string>(commandRegistry.selftest)
                            bits = parseSelfTestBits(statusStr)
                        }
                        // eslint-disable-next-line no-bitwise
                        if (bits !== null && (bits & (1 << SelfTestBit.AI_NO_SD_CARD))) {
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
        } finally {
            await sleep(Math.max(0, MIN_CHECKING_MS - (Date.now() - started)))
            setIsCheckingSdCard(false)
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
        isCheckingBattery, isCheckingSdCard,
        // Capture format (advanced), retired 21 September 2026, see the state above
        //   recordJpegOnly, setRecordJpegOnly,
        // DFU control
        isDfuInProgress,
    }
}
