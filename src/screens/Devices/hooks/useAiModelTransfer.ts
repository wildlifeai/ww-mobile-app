import { useState, useCallback, useEffect, useRef } from 'react'
import database from '../../../database'

import { createBleSession } from '../../../ble/session/createBleSession'
import { commandRegistry } from '../../../ble/protocol/commandRegistry'
import AiModelService from '../../../services/AiModelService'
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
            addLog(`Downloading model: ${selectedModel.name} v${selectedModel.version}...`)
            const localUri = await AiModelService.ensureModelDownloaded(selectedModel)
            if (!isMounted.current || !device.connected) return
            setProgress(0.15)

            // 2. Read as bytes
            addLog('Reading model file...')
            const bytes = await AiModelService.readModelAsBytes(localUri)
            addLog(`Model file: ${(bytes.length / 1024).toFixed(1)} KB`)
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

            // Determine target filename (e.g., 42V2.TFL)
            // Use firmware IDs from DB if available, fallback chain for legacy data
            const numericId = selectedModel.firmwareModelId
                ?? (parseInt(selectedModel.fileType || '', 10) || undefined)
                ?? (parseInt(selectedModel.serverId, 10) || undefined)
                ?? 1
            const numericVer = selectedModel.versionNumber
                ?? (parseInt(selectedModel.version.replace(/[^0-9]/g, ''), 10) || undefined)
                ?? 1

            // Defensive guard: reject invalid firmware IDs before BLE transfer
            if (numericId <= 0 || numericVer <= 0) {
                throw new Error(
                    `Invalid firmware IDs: modelId=${numericId}, versionId=${numericVer}. `
                    + `Sync may be stale — pull latest data.`
                )
            }

            const targetFilename = `${numericId}V${numericVer}.TFL`

            // 4. Transfer via BLE file transfer pipeline
            setPhase('transferring')
            addLog(`Transferring ${targetFilename} (${bytes.length} bytes)...`)

            const result = await runFileTransferPipeline(device, {
                filename: targetFilename,
                data: bytes,
                onProgress: (p) => {
                    if (isMounted.current) {
                        // Map file transfer progress (0-1) to our range (0.25 - 0.75)
                        setProgress(0.25 + (p.percentage / 100) * 0.50)
                    }
                },
            })

            if (!isMounted.current) return

            if (!result.success) {
                throw new Error(result.errorMessage || 'Transfer failed')
            }
            
            addLog(`Transfer complete ✓ (${result.sizeBytes} bytes)`)
            setProgress(0.75)

            // 5. Erase old model
            setPhase('erasing')
            addLog('Erasing old model from AI flash...')
            await session.execute(() => commandRegistry.erasemodel())
            addLog('Erase complete ✓')
            setProgress(0.85)

            // 5b. Verify file exists on SD card before loading
            try {
                const dirListing = await session.execute(() => commandRegistry.dir())
                if (dirListing && !dirListing.includes(targetFilename)) {
                    addLog(`⚠️ Warning: ${targetFilename} not found in dir listing`)
                    addLog('Proceeding with loadmodel anyway — firmware may route internally')
                } else {
                    addLog(`Verified ${targetFilename} on SD card ✓`)
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
