import { useState, useCallback, useEffect, useRef } from 'react'
import database from '../../../database'

import { createBleSession } from '../../../ble/session/createBleSession'
import { commandRegistry } from '../../../ble/protocol/commandRegistry'
import AiModelService from '../../../services/AiModelService'
import ReferenceDataService from '../../../services/ReferenceDataService'
import AiModel from '../../../database/models/AiModel'
import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { runFileTransferPipeline } from '../../../ble/protocol/fileTransfer'
import { log, logError, logWarn } from '../../../utils/logger'

// ────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────

export type AiModelTransferPhase =
    | 'idle'
    | 'preflight'
    | 'downloading'
    | 'waking'
    | 'transferring'
    | 'erasing'
    | 'loading'
    | 'complete'
    | 'failed'

const PHASE_LABELS: Record<AiModelTransferPhase, string> = {
    idle: 'Ready to transfer.',
    preflight: 'Running pre-flight checks...',
    downloading: 'Downloading AI model from cloud...',
    waking: 'Waking AI processor...',
    transferring: 'Transferring model to device SD card...',
    erasing: 'Erasing old model from AI processor...',
    loading: 'Loading new model into AI processor flash...',
    complete: 'AI model transfer complete!',
    failed: 'Transfer failed.',
}

// ────────────────────────────────────────────────────────────────────
// Hook
// ────────────────────────────────────────────────────────────────────

interface UseAiModelTransferOptions {
    device: ExtendedPeripheral | undefined
    initialModelId?: string
}

export interface UseAiModelTransferReturn {
    // State
    batteryLevel: number | null
    availableModels: AiModel[]
    selectedModelId: string | null
    setSelectedModelId: (id: string | null) => void
    isPreflightDone: boolean
    // Transfer state
    progress: number
    statusLabel: string
    phase: AiModelTransferPhase
    isTransferring: boolean
    isComplete: boolean
    isFailed: boolean
    errorMsg: string | null
    progressLogs: string[]
    // Action
    startTransfer: () => void
}

export function useAiModelTransfer({ device, initialModelId }: UseAiModelTransferOptions): UseAiModelTransferReturn {
    const [phase, setPhase] = useState<AiModelTransferPhase>('idle')
    const [progress, setProgress] = useState(0)
    const [batteryLevel, setBatteryLevel] = useState<number | null>(null)
    const [availableModels, setAvailableModels] = useState<AiModel[]>([])
    const [selectedModelId, setSelectedModelId] = useState<string | null>(initialModelId || null)
    const [isPreflightDone, setIsPreflightDone] = useState(false)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [progressLogs, setProgressLogs] = useState<string[]>([])

    const isMounted = useRef(true)
    useEffect(() => {
        isMounted.current = true
        return () => { isMounted.current = false }
    }, [])

    const addLog = useCallback((msg: string) => {
        log(`[AiModelTransfer] ${msg}`)
        if (isMounted.current) {
            setProgressLogs(prev => [...prev.slice(-19), msg])
        }
    }, [])

    // ── Pre-flight: query battery + load available models ─────────
    useEffect(() => {
        let cancelled = false

        const loadModels = async () => {
            try {
                const models = await database.get<AiModel>('ai_models').query().fetch()
                if (!cancelled) {
                    setAvailableModels(models)
                    if (models.length > 0 && !selectedModelId) {
                        setSelectedModelId(models[0].id)
                    }
                }
            } catch (e) {
                logWarn('[AiModelTransfer] Failed to load models:', e)
            }
        }

        const runDeviceChecks = async () => {
            if (!device?.connected) return
            const session = createBleSession(device)
            try {
                const batt = await session.execute(() => commandRegistry.battery())
                if (!cancelled) setBatteryLevel(batt)
                log(`[AiModelTransfer] Battery: ${batt}%`)
            } catch (e) {
                logWarn('[AiModelTransfer] Battery query failed:', e)
            }
        }

        const runAll = async () => {
            await Promise.all([loadModels(), runDeviceChecks()])
            if (!cancelled) setIsPreflightDone(true)
        }

        runAll()
        return () => { cancelled = true }
    }, [device?.connected, device?.id]) // eslint-disable-line react-hooks/exhaustive-deps

    // ── Transfer action ───────────────────────────────────────────
    const startTransfer = useCallback(async () => {
        if (!device?.connected || !selectedModelId) return

        const selectedModel = availableModels.find(m => m.id === selectedModelId)
        if (!selectedModel) {
            setErrorMsg('Selected model not found')
            return
        }

        setPhase('downloading')
        setProgress(0.05)
        setErrorMsg(null)
        setProgressLogs([])

        try {
            // 1. Download model from Supabase
            addLog(`Downloading files for model: ${selectedModel.name} v${selectedModel.version}...`)
            const localFiles = await AiModelService.ensureFilesDownloaded(selectedModel)
            if (!isMounted.current || !device.connected) return
            setProgress(0.15)

            // Determine target firmware IDs from the model family relationship
            addLog('Looking up firmware identity...')
            const { firmwareModelId: numericId, versionNumber: numericVer } = await ReferenceDataService.getFirmwareIds(selectedModel)
            addLog(`Firmware identity: family=${numericId}, version=${numericVer}`)

            // 2. Read as bytes
            addLog('Reading model files...')
            const modelBytes = await AiModelService.readModelAsBytes(localFiles.modelUri)
            const labelsBytes = localFiles.labelsUri ? await AiModelService.readModelAsBytes(localFiles.labelsUri) : null
            addLog(`Model file: ${(modelBytes.length / 1024).toFixed(1)} KB`)
            if (!isMounted.current || !device.connected) return
            setProgress(0.20)

            // 3. Wake AI processor
            setPhase('waking')
            addLog('Waking AI processor...')
            const session = createBleSession(device)
            try {
                await session.execute(() => commandRegistry.aiver())
                addLog('AI processor is awake ✓')
            } catch (e) {
                logWarn('[AiModelTransfer] AI wake failed, attempting transfer anyway:', e)
                addLog('AI wake response unclear — attempting transfer...')
            }
            if (!isMounted.current || !device.connected) return
            setProgress(0.25)

            // 4. Transfer via BLE file transfer pipeline
            setPhase('transferring')
            const { modelExt: tflExt } = AiModelService.getModelFileExtensions(selectedModel)
            const tflFilename = `${numericId}V${numericVer}.${tflExt}`
            addLog(`Transferring ${tflFilename} (${modelBytes.length} bytes)...`)

            const modelResult = await runFileTransferPipeline(device, {
                filename: tflFilename,
                data: modelBytes,
                onProgress: (p) => {
                    if (isMounted.current) {
                        // Map file transfer progress (0-1) to our range (0.25 - 0.60)
                        setProgress(0.25 + (p.percentage / 100) * 0.35)
                    }
                },
            })

            if (!isMounted.current) return

            if (!modelResult.success) {
                throw new Error(modelResult.errorMessage || 'Model transfer failed')
            }
            
            addLog(`Model transfer complete ✓ (${modelResult.sizeBytes} bytes)`)

            // Transfer Labels if available
            if (labelsBytes) {
                const { labelsExt } = AiModelService.getModelFileExtensions(selectedModel)
                const labelsFilename = `${numericId}V${numericVer}.${labelsExt}`
                addLog(`Transferring ${labelsFilename} (${labelsBytes.length} bytes)...`)
                const labelsResult = await runFileTransferPipeline(device, {
                    filename: labelsFilename,
                    data: labelsBytes,
                    onProgress: (p) => {
                        if (isMounted.current) {
                            // Map labels progress (0-1) to our range (0.60 - 0.75)
                            setProgress(0.60 + (p.percentage / 100) * 0.15)
                        }
                    },
                })

                if (!isMounted.current) return
                if (!labelsResult.success) {
                    throw new Error(labelsResult.errorMessage || 'Labels transfer failed')
                }
                addLog(`Labels transfer complete ✓ (${labelsResult.sizeBytes} bytes)`)
            }

            setProgress(0.75)

            // 5. Erase old model
            setPhase('erasing')
            addLog('Erasing old model from AI flash...')
            await session.execute(() => commandRegistry.erasemodel())
            addLog('Erase complete ✓')
            setProgress(0.85)

            // 5b. Verify files exist on SD card before loading
            try {
                const dirListing = await session.execute(() => commandRegistry.dir())
                
                if (dirListing && !dirListing.includes(tflFilename)) {
                    addLog(`⚠️ Warning: ${tflFilename} not found in dir listing`)
                    addLog('Proceeding with loadmodel anyway — firmware may route internally')
                } else {
                    addLog(`Verified ${tflFilename} on SD card ✓`)
                }

                const { labelsExt } = AiModelService.getModelFileExtensions(selectedModel)
                if (labelsBytes && dirListing && !dirListing.includes(`${numericId}V${numericVer}.${labelsExt}`)) {
                    addLog(`⚠️ Warning: ${numericId}V${numericVer}.${labelsExt} not found in dir listing`)
                } else if (labelsBytes) {
                    addLog(`Verified ${numericId}V${numericVer}.${labelsExt} on SD card ✓`)
                }
            } catch (dirErr) {
                addLog('Dir listing unavailable — proceeding with loadmodel')
            }

            // 6. Load new model
            setPhase('loading')
            addLog(`Loading new model: ID ${numericId}, Ver ${numericVer}...`)
            await session.execute(() => commandRegistry.loadmodel(numericId, numericVer))
            addLog('Load complete ✓')

            // 7. Readback verification — confirm OP 14/15 match expected values
            try {
                const readbackId = await session.execute(() => commandRegistry.getop(14))
                const readbackVer = await session.execute(() => commandRegistry.getop(15))
                const parsedId = parseInt(String(readbackId), 10)
                const parsedVer = parseInt(String(readbackVer), 10)

                if (parsedId === numericId && parsedVer === numericVer) {
                    addLog(`OP readback verified: ${parsedId}V${parsedVer} ✓`)
                } else {
                    addLog(`⚠️ OP readback mismatch: expected ${numericId}V${numericVer}, got ${parsedId}V${parsedVer}`)
                }
            } catch (readbackErr) {
                addLog('OP readback unavailable — model may still be loaded correctly')
            }
            
            setPhase('complete')
            setProgress(1.0)

        } catch (error) {
            if (!isMounted.current) return
            const msg = error instanceof Error ? error.message : String(error)
            logError('[AiModelTransfer] Transfer failed:', error)
            setPhase('failed')
            setErrorMsg(msg)
            addLog(`Error: ${msg}`)
        }
    }, [device, selectedModelId, availableModels, addLog])

    return {
        batteryLevel,
        availableModels,
        selectedModelId,
        setSelectedModelId,
        isPreflightDone,
        progress,
        statusLabel: PHASE_LABELS[phase],
        phase,
        isTransferring: phase !== 'idle' && phase !== 'complete' && phase !== 'failed',
        isComplete: phase === 'complete',
        isFailed: phase === 'failed',
        errorMsg,
        progressLogs,
        startTransfer,
    }
}
