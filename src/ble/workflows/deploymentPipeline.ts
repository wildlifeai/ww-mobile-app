/**
 * deploymentPipeline — Pure async functions for shared BLE deployment steps.
 *
 * These are NOT hooks. They are stateless pipeline stages used by both
 * useStartDeployment and useDevDeployment during their start-deployment flows.
 */

import { BleSession } from '../session/createBleSession'
import { commandRegistry } from '../protocol/commandRegistry'
import { runFileTransferPipeline } from '../protocol/fileTransfer'
import { crc16ccitt } from '../protocol/fileTransfer/crc16ccitt'
import ReferenceDataService from '../../services/ReferenceDataService'
import AiModelService from '../../services/AiModelService'
import { ExtendedPeripheral } from '../../redux/slices/devicesSlice'

import { executeResetToDefaults } from './resetToDefaults'
import { log, logWarn } from '../../utils/logger'
import { describeProjectFlash, ProjectFlashColumns } from '../../utils/projectFlash'

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
    setProgress(0.05)
    await session.execute(commandRegistry.setutc)
    addLog('Time check complete')
}

/**
 * Reset all operational parameters to factory defaults (step 5 of the Start
 * Monitoring pipeline in 05-DEVICE-FLOWS.md, step 4b of the dev deployment).
 *
 * Ensures the device has a clean slate before deployment. Prevents leftover
 * state from MD tests (TEST_MODE_BITS=8), Engineer Console sessions or
 * previous deployments from contaminating the new deployment.
 *
 * Uses diff-based logic: reads current OPs via getop -1, only writes
 * values that differ from FACTORY_DEFAULTS. Each setop receives a
 * confirmation response, so no verification pass is needed.
 *
 * This is the only reset a deployment gets: connecting no longer runs one
 * (#268), so a refused write here is a failed deployment, not a warning.
 * The error propagates; the caller aborts.
 *
 * Returns the op table as it stands after the reset (null if the ops were
 * unreadable). Pass it to `configureDevice` instead of the pre-reset snapshot,
 * or the diff-write there skips the parameters the reset has just changed.
 */


export async function resetOps(
    session: BleSession,
    { addLog, setStep, setProgress }: ProgressCallbacks,
    currentOps?: string[]
): Promise<string[] | null> {
    addLog('Resetting operational parameters...')
    setStep('Resetting device...')
    setProgress(0.06)

    try {
        const opsAfterReset = await executeResetToDefaults(session, {
            currentOps,
            skipIdentityReset: true,
            // syncAiModel owns model state in the deployment pipeline - the
            // reset must not erase the model it just loaded (op14/15 + flash)
            preserveModel: true,
            onProgress: (step) => {
                log(`[ResetOps] ${step}`)
            }
        })
        addLog('Device parameters reset successfully')
        setProgress(0.09)
        return opsAfterReset
    } catch (e) {
        logWarn('[ResetOps] Reset failed:', e)
        addLog('Parameter reset failed — the device may still carry settings from a previous session')
        throw e
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
    currentOps?: string[]
): Promise<void> {
    addLog('Checking AI model...')
    setStep('AI Model...')
    setProgress(0.10)

    if (modelId) {
        try {
            // 1. Resolve the target model from local WatermelonDB
            let targetModel = await AiModelService.getModelById(modelId)

            // If not found, reference data may not have synced yet — try once
            if (!targetModel) {
                addLog('Model not found locally — syncing reference data...')
                await ReferenceDataService.syncReferenceData()
                targetModel = await AiModelService.getModelById(modelId)
            }

            if (!targetModel) {
                addLog('⚠️ Assigned AI model not found after sync — continuing without model')
                return
            }

            // 2. Resolve firmware IDs (family ID for OP14, version for OP15)
            const firmwareIds = await ReferenceDataService.getFirmwareIds(targetModel)
            if (!firmwareIds) {
                addLog('⚠️ Could not resolve firmware IDs for model — continuing without model')
                return
            }
            const { firmwareModelId: numericId, versionNumber: numericVer } = firmwareIds
            const { modelExt: tflExt, labelsExt } = AiModelService.getModelFileExtensions(targetModel)
            // Uppercase: both the app's transfer validator and the firmware's
            // fileRx require uppercase 8.3 names - a lowercase extension
            // ('1V1.tfl') failed validation BEFORE any transfer, so the model
            // never reached the SD card (bench 21 Jul). FAT is case-insensitive,
            // so loadmodel finds the file either way.
            const tflFilename = `${numericId}V${numericVer}.${tflExt}`.toUpperCase()
            const labelsFilename = `${numericId}V${numericVer}.${labelsExt}`.toUpperCase()

            // 3. Check current OPs to see if model is already loaded
            const ops = currentOps || await session.execute(() => commandRegistry.getops())
            if (!ops || ops.length < 16) throw new Error('Insufficient operational parameters from device.')
            const currentId = parseInt(ops[14] ?? '0', 10) || 0
            const currentVer = parseInt(ops[15] ?? '0', 10) || 0

            if (currentId === numericId && currentVer === numericVer) {
                addLog('AI model up to date')
                return
            }

            addLog(`Model mismatch (Device: ${currentId}v${currentVer}, Target: ${numericId}v${numericVer})`)

            // 4. Check SD card for existing files (same pattern as ModelValidationTestScreen)
            addLog('Checking SD card for existing model files...')
            setStep('Checking SD card...')
            setProgress(0.12)

            let hasTfl = false
            let hasLabels = false
            try {
                const files = await session.execute(commandRegistry.dir) as string[]
                hasTfl = files.some(f => f.toUpperCase().includes(tflFilename.toUpperCase()))
                hasLabels = files.some(f => f.toUpperCase().includes(labelsFilename.toUpperCase()))

                if (hasTfl) addLog(`✅ ${tflFilename} found on SD card`)
                else addLog(`📥 ${tflFilename} not on SD card`)
                if (hasLabels) addLog(`✅ ${labelsFilename} found on SD card`)
                else if (targetModel.labelsPath) addLog(`📥 ${labelsFilename} not on SD card`)
            } catch (dirError) {
                logWarn('SD card dir check failed, assuming files missing:', dirError)
                addLog('Could not list SD card — will attempt transfer')
            }

            // 4a. A matching name is not a matching file. Check the contents.
            //
            // Until this existed, a file whose name matched was assumed correct
            // and skipped, and `dir` matching is a substring test at that. The
            // failure is not hypothetical: a card still holding the one-line
            // `unknown` labels file from before ww-website#139 kept those labels
            // through every later deployment, and the documented workaround was
            // to delete the file or reformat the card by hand. The device named
            // both classes wrongly for as long as that file survived.
            //
            // The device computes CRC16-CCITT over a file with `crc`, and the
            // app computes the same over the bytes it would have sent, so the
            // two are directly comparable. A file that differs is treated as
            // missing and retransferred below.
            //
            // Deliberately non-fatal in both directions. Verifying needs the
            // real bytes, so it downloads them, and a phone in the field may
            // have no connectivity: if the download or the `crc` command fails
            // we keep the old name-only behaviour rather than blocking a
            // deployment over a check we could not run.
            if (hasTfl || hasLabels) {
                try {
                    const localFiles = await AiModelService.ensureFilesDownloaded(targetModel)
                    const expected: Array<{ filename: string, uri: string | null, present: boolean, clear: () => void }> = [
                        { filename: tflFilename, uri: localFiles.modelUri, present: hasTfl, clear: () => { hasTfl = false } },
                        { filename: labelsFilename, uri: localFiles.labelsUri, present: hasLabels, clear: () => { hasLabels = false } },
                    ]

                    for (const file of expected) {
                        if (!file.present || !file.uri) continue
                        const bytes = await AiModelService.readModelAsBytes(file.uri)
                        if (!bytes) continue
                        const want = crc16ccitt(bytes)
                        const onCard = await session.execute(() => commandRegistry.crc(file.filename))
                        const wantHex = `0x${want.toString(16).toUpperCase().padStart(4, '0')}`

                        if (onCard.crc.toUpperCase() !== wantHex || onCard.sizeBytes !== bytes.length) {
                            addLog(`♻️ ${file.filename} on the card does not match the model (card ${onCard.crc}, ${onCard.sizeBytes} bytes; expected ${wantHex}, ${bytes.length} bytes) — replacing it`)
                            file.clear()
                        } else {
                            addLog(`✅ ${file.filename} on the card matches (${wantHex})`)
                        }
                    }
                } catch (verifyError) {
                    logWarn('Could not verify the model files already on the card:', verifyError)
                    addLog('Could not check the files on the card; using the ones that are there')
                }
            }

            // 5. Only download and transfer files that are missing
            if (!hasTfl || (!hasLabels && targetModel.labelsPath)) {
                addLog('Downloading missing model files...')
                setStep('Downloading model...')
                setProgress(0.14)

                const localFiles = await AiModelService.ensureFilesDownloaded(targetModel)

                // Transfer TFL if missing
                if (!hasTfl) {
                    addLog(`Transferring ${tflFilename}...`)
                    setStep('Transferring model...')
                    const modelBytes = await AiModelService.readModelAsBytes(localFiles.modelUri)
                    if (!modelBytes) {
                        throw new Error(`Failed to read model bytes from ${localFiles.modelUri}`)
                    }
                    // Live feedback: a model is minutes of BLE transfer, and the
                    // old mapping moved the overall bar 4% total - invisible.
                    // The step line carries percentage + KB (throttled to whole
                    // percents; onProgress fires per packet).
                    let lastPct = -1
                    await runFileTransferPipeline(device, {
                        filename: tflFilename,
                        data: modelBytes,
                        onProgress: (p) => {
                            setProgress(0.14 + (p.percentage / 100) * 0.04)
                            if (p.percentage !== lastPct) {
                                lastPct = p.percentage
                                setStep(`Transferring model… ${p.percentage}% (${Math.round(p.bytesSent / 1024)}/${Math.round(p.totalBytes / 1024)} KB)`)
                            }
                        }
                    })
                    addLog(`✅ ${tflFilename} transferred`)
                }

                // Transfer labels if missing
                if (!hasLabels && localFiles.labelsUri) {
                    addLog(`Transferring ${labelsFilename}...`)
                    const labelsBytes = await AiModelService.readModelAsBytes(localFiles.labelsUri)
                    if (!labelsBytes) {
                        throw new Error(`Failed to read label bytes from ${localFiles.labelsUri}`)
                    }
                    await runFileTransferPipeline(device, {
                        filename: labelsFilename,
                        data: labelsBytes,
                        onProgress: (p) => setStep(`Transferring labels… ${p.percentage}%`)
                    })
                    addLog(`✅ ${labelsFilename} transferred`)
                }
            } else {
                addLog('All model files present on SD card — skipping transfer')
            }

            // 6. Load the target model
            // NOTE: Do NOT call erasemodel before loadmodel — it destroys the
            // flash-cached copy, forcing a slow SD→flash re-copy (~62 × 4KB writes).
            // The firmware's loadmodel command handles replacement on its own.
            // If the model is already in flash, it loads instantly (~23ms).
            addLog('Loading model...')
            setStep('Loading model...')
            setProgress(0.19)
            await session.execute(() => commandRegistry.loadmodel(numericId, numericVer))
            addLog('AI model loaded successfully')

        } catch (e) {
            logWarn('Failed to update AI model:', e)
            addLog('⚠️ AI model update FAILED — the deployment will record but not classify. See device log.')
        }
    } else if (eraseStaleModels) {
        // No AI model assigned — check if device has a stale model loaded
        try {
            const ops = currentOps || await session.execute(() => commandRegistry.getops())
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
 *
 * `currentOps` must be the op table as it stands now, which after step 5's
 * reset means `resetOps`' return value, not the snapshot taken before it.
 */
export async function configureDevice(
    device: ExtendedPeripheral,
    startConfigure: (device: ExtendedPeripheral, config: any, providedOps?: string[]) => Promise<void>,
    config: {
        deploymentId: string
        captureMethodId: number
        timelapseInterval: number
        recordGpsInImages: boolean
        gpsLocation?: { latitude: number; longitude: number; altitude?: number | null } | null
        flash?: ProjectFlashColumns | null
    },
    { addLog, setStep, setProgress }: ProgressCallbacks,
    currentOps?: string[]
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
        } : undefined,
        flash: config.flash ?? undefined
    }, currentOps)

    if (config.flash !== undefined) addLog(`Capture flash: ${describeProjectFlash(config.flash)}`)
    addLog('Device configuration successful')
    log('[Deployment] Device configuration successful')
}
