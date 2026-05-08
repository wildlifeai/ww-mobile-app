/**
 * deploymentPipeline — Pure async functions for shared BLE deployment steps.
 *
 * These are NOT hooks. They are stateless pipeline stages used by both
 * useStartDeployment and useDevDeployment during their start-deployment flows.
 */

import { BleSession } from '../session/createBleSession'
import { commandRegistry } from '../protocol/commandRegistry'
import { runFileTransferPipeline } from '../protocol/fileTransfer'
import ReferenceDataService from '../../services/ReferenceDataService'
import FirmwareService from '../../services/FirmwareService'
import AiModelService from '../../services/AiModelService'
import { ExtendedPeripheral } from '../../redux/slices/devicesSlice'
import { log, logWarn } from '../../utils/logger'

interface ProgressCallbacks {
    addLog: (msg: string) => void
    setStep: (step: string) => void
    setProgress: (progress: number) => void
}

/**
 * Step 1: Sync device UTC clock to phone time.
 */
export async function syncTime(
    session: BleSession,
    { addLog, setStep, setProgress }: ProgressCallbacks
): Promise<void> {
    addLog('Performing final time check...')
    setStep('Checking time...')
    setProgress(0.1)
    await session.execute(commandRegistry.setutc)
    addLog('Time check complete')
}

/**
 * Step 2: Push CONFIG.TXT to device SD card.
 */
export async function pushConfig(
    device: ExtendedPeripheral,
    session: BleSession,
    { addLog, setStep, setProgress }: ProgressCallbacks
): Promise<void> {
    addLog('Updating configuration...')
    setStep('Config push...')
    setProgress(0.12)

    try {
        const latestConfig = await ReferenceDataService.getLatestFirmware('config')
        if (latestConfig?.locationPath) {
            const configBytes = await FirmwareService.readFirmwareAsBytes(latestConfig.locationPath)
            if (configBytes) {
                await runFileTransferPipeline(device, {
                    filename: 'CONFIG.TXT',
                    data: configBytes,
                    onProgress: (p) => setProgress(0.12 + (p.percentage / 100) * 0.03)
                })
                addLog('Configuration pushed successfully')
            }
        }
    } catch (e) {
        logWarn('Failed to push config:', e)
        addLog('Configuration push failed, continuing...')
    }
}

/**
 * Step 3: Ensure the correct AI model is loaded on the device.
 *
 * Compares the device's currently loaded model (from ops[14]/ops[15]) against
 * the project's target model. Transfers + loads if mismatched.
 *
 * @param eraseStaleModels  If true and no model is assigned, erase any model
 *                          currently on the device. Used by production deployments
 *                          but not dev deployments.
 */
export async function syncAiModel(
    device: ExtendedPeripheral,
    session: BleSession,
    modelId: string | null | undefined,
    { addLog, setStep, setProgress }: ProgressCallbacks,
    eraseStaleModels: boolean = false,
): Promise<void> {
    addLog('Checking AI model...')
    setStep('AI Model...')
    setProgress(0.15)

    if (modelId) {
        try {
            // Wake up AI
            await session.execute(() => commandRegistry.aiver())

            // Check current model
            const ops = await session.execute(() => commandRegistry.getops())
            if (!ops || ops.length < 16) throw new Error('Insufficient operational parameters from device.')
            const currentId = parseInt(ops[14] ?? '0', 10) || 0
            const currentVer = parseInt(ops[15] ?? '0', 10) || 0

            const targetModel = await AiModelService.getModelById(modelId)

            if (targetModel) {
                const { firmwareModelId: numericId, versionNumber: numericVer } = await ReferenceDataService.getFirmwareIds(targetModel)

                if (currentId !== numericId || currentVer !== numericVer) {
                    addLog(`Model mismatch (Device: ${currentId}v${currentVer}, Target: ${numericId}v${numericVer})`)
                    addLog('Downloading AI model files...')

                    const localFiles = await AiModelService.ensureFilesDownloaded(targetModel)
                    const modelBytes = await AiModelService.readModelAsBytes(localFiles.modelUri)
                    const labelsBytes = localFiles.labelsUri ? await AiModelService.readModelAsBytes(localFiles.labelsUri) : null

                    if (modelBytes) {
                        addLog('Transferring AI model...')
                        const { modelExt: tflExt } = AiModelService.getModelFileExtensions(targetModel)
                        await runFileTransferPipeline(device, {
                            filename: `${numericId}V${numericVer}.${tflExt}`,
                            data: modelBytes,
                            onProgress: (p) => setProgress(0.15 + (p.percentage / 100) * 0.05)
                        })

                        if (labelsBytes) {
                            addLog('Transferring model labels...')
                            const { labelsExt } = AiModelService.getModelFileExtensions(targetModel)
                            await runFileTransferPipeline(device, {
                                filename: `${numericId}V${numericVer}.${labelsExt}`,
                                data: labelsBytes,
                                onProgress: () => {}
                            })
                        }

                        addLog('Erasing old model...')
                        await session.execute(() => commandRegistry.erasemodel())

                        addLog('Loading new model...')
                        await session.execute(() => commandRegistry.loadmodel(numericId, numericVer))

                        addLog('AI model updated successfully')
                    }
                } else {
                    addLog('AI model up to date')
                }
            } else {
                addLog('Assigned AI model not found locally')
            }
        } catch (e) {
            logWarn('Failed to update AI model:', e)
            addLog('AI model update failed, continuing...')
        }
    } else if (eraseStaleModels) {
        // No AI model assigned — check if device has a stale model loaded
        try {
            await session.execute(() => commandRegistry.aiver())
            const ops = await session.execute(() => commandRegistry.getops())
            const currentId = ops && ops.length > 14 ? parseInt(ops[14] ?? '0', 10) || 0 : 0

            if (currentId !== 0) {
                addLog(`Device has stale model (ID: ${currentId}) — erasing...`)
                await session.execute(() => commandRegistry.erasemodel())
                addLog('Stale AI model erased')
            } else {
                addLog('No AI model required — device clear')
            }
        } catch (e) {
            logWarn('Failed to check/erase device model:', e)
            addLog('Could not verify device model state, continuing...')
        }
    } else {
        addLog('No AI model required')
    }
}

/**
 * Step 4: Configure device operational parameters via the deployment configuration hook.
 */
export async function configureDevice(
    device: ExtendedPeripheral,
    startConfigure: (device: ExtendedPeripheral, config: any) => Promise<void>,
    config: {
        deploymentId: string
        captureMethodId: number
        timelapseInterval: number
        recordGpsInImages: boolean
        gpsLocation?: { latitude: number; longitude: number; altitude?: number | null } | null
    },
    { addLog, setStep, setProgress }: ProgressCallbacks,
): Promise<void> {
    addLog('Configuring device settings...')
    setStep('Configuring device...')
    setProgress(0.5)

    let method: 'activity' | 'timelapse' | 'mixed' | 'unknown' = 'unknown'
    if (config.captureMethodId === 1) method = 'activity'
    else if (config.captureMethodId === 2) method = 'timelapse'
    else if (config.captureMethodId === 3) method = 'mixed'

    log('[Deployment] Configuring device via standardized hook...')

    await startConfigure(device, {
        deploymentId: config.deploymentId,
        captureMethod: method,
        motionInterval: 1000,
        timelapseInterval: config.timelapseInterval || 300,
        recordGpsInImages: config.recordGpsInImages || false,
        location: config.gpsLocation && config.gpsLocation.latitude !== undefined && config.gpsLocation.longitude !== undefined ? {
            latitude: config.gpsLocation.latitude,
            longitude: config.gpsLocation.longitude,
            altitude: config.gpsLocation.altitude || 0
        } : undefined
    })

    addLog('Device configuration successful')
    log('[Deployment] Device configuration successful')
}
