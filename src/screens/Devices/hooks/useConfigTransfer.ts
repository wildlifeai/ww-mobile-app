import { useState, useCallback, useEffect, useRef } from 'react'

import { createBleSession } from '../../../ble/session/createBleSession'
import { commandRegistry } from '../../../ble/protocol/commandRegistry'
import FirmwareService from '../../../services/FirmwareService'
import ReferenceDataService from '../../../services/ReferenceDataService'
import Firmware from '../../../database/models/Firmware'
import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { runFileTransferPipeline } from '../../../ble/protocol/fileTransfer'
import { log, logError, logWarn } from '../../../utils/logger'

// ────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────

export type ConfigTransferPhase =
    | 'idle'
    | 'preflight'
    | 'downloading'
    | 'waking'
    | 'transferring'
    | 'complete'
    | 'failed'

const PHASE_LABELS: Record<ConfigTransferPhase, string> = {
    idle: 'Ready to transfer.',
    preflight: 'Running pre-flight checks...',
    downloading: 'Downloading config from cloud...',
    waking: 'Waking AI processor...',
    transferring: 'Transferring CONFIG.TXT to device...',
    complete: 'Config transfer complete!',
    failed: 'Transfer failed.',
}

const CONFIG_FILENAME = 'CONFIG.TXT'

// ────────────────────────────────────────────────────────────────────
// Hook
// ────────────────────────────────────────────────────────────────────

interface UseConfigTransferOptions {
    device: ExtendedPeripheral | undefined
}

export interface UseConfigTransferReturn {
    // Pre-flight
    batteryLevel: number | null
    latestConfig: Firmware | null
    isPreflightDone: boolean
    // Transfer state
    progress: number
    statusLabel: string
    phase: ConfigTransferPhase
    isTransferring: boolean
    isComplete: boolean
    isFailed: boolean
    errorMsg: string | null
    progressLogs: string[]
    // Action
    startTransfer: () => void
}

export function useConfigTransfer({ device }: UseConfigTransferOptions): UseConfigTransferReturn {
    const [phase, setPhase] = useState<ConfigTransferPhase>('idle')
    const [progress, setProgress] = useState(0)
    const [batteryLevel, setBatteryLevel] = useState<number | null>(null)
    const [latestConfig, setLatestConfig] = useState<Firmware | null>(null)
    const [isPreflightDone, setIsPreflightDone] = useState(false)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [progressLogs, setProgressLogs] = useState<string[]>([])

    const isMounted = useRef(true)
    useEffect(() => {
        isMounted.current = true
        return () => { isMounted.current = false }
    }, [])

    const addLog = useCallback((msg: string) => {
        log(`[ConfigTransfer] ${msg}`)
        if (isMounted.current) {
            setProgressLogs(prev => [...prev.slice(-19), msg])
        }
    }, [])

    // ── Pre-flight: query battery + latest config ─────────────────
    useEffect(() => {
        if (!device?.connected) return
        let cancelled = false

        const run = async () => {
            const session = createBleSession(device)
            try {
                const batt = await session.execute(() => commandRegistry.battery())
                if (!cancelled) setBatteryLevel(batt)
                log(`[ConfigTransfer] Battery: ${batt}%`)
            } catch (e) {
                logWarn('[ConfigTransfer] Battery query failed:', e)
            }

            try {
                const fw = await ReferenceDataService.getLatestFirmware('config')
                if (!cancelled) setLatestConfig(fw)
                log(`[ConfigTransfer] Latest config: ${fw?.version ?? 'none'}`)
            } catch (e) {
                logWarn('[ConfigTransfer] Config lookup failed:', e)
            }

            if (!cancelled) setIsPreflightDone(true)
        }

        run()
        return () => { cancelled = true }
    }, [device?.id, device?.connected]) // eslint-disable-line react-hooks/exhaustive-deps

    // ── Transfer action ───────────────────────────────────────────
    const startTransfer = useCallback(async () => {
        if (!device?.connected || !latestConfig) return

        setPhase('downloading')
        setProgress(0.05)
        setErrorMsg(null)
        setProgressLogs([])

        try {
            // 1. Download config from Supabase
            addLog(`Downloading config v${latestConfig.version}...`)
            const localUri = await FirmwareService.ensureFirmwareDownloaded(latestConfig)
            if (!isMounted.current || !device.connected) return
            setProgress(0.20)

            // 2. Read as bytes
            addLog('Reading config file...')
            const bytes = await FirmwareService.readFirmwareAsBytes(localUri)
            addLog(`Config file: ${bytes.length} bytes`)
            if (!isMounted.current || !device.connected) return
            setProgress(0.25)

            // 3. Wake AI processor
            setPhase('waking')
            addLog('Waking AI processor...')
            const session = createBleSession(device)
            try {
                await session.execute(() => commandRegistry.aiver())
                addLog('AI processor is awake ✓')
            } catch (e) {
                logWarn('[ConfigTransfer] AI wake failed, attempting transfer anyway:', e)
                addLog('AI wake response unclear — attempting transfer...')
            }
            if (!isMounted.current || !device.connected) return
            setProgress(0.30)

            // 4. Transfer via BLE file transfer pipeline
            setPhase('transferring')
            addLog(`Transferring ${CONFIG_FILENAME} (${bytes.length} bytes)...`)

            const result = await runFileTransferPipeline(device, {
                filename: CONFIG_FILENAME,
                data: bytes,
                onProgress: (p) => {
                    if (isMounted.current) {
                        // Map file transfer progress (0-1) to our range (0.30 - 0.95)
                        setProgress(0.30 + (p.percentage / 100) * 0.65)
                    }
                },
            })

            if (!isMounted.current) return

            if (result.success) {
                setPhase('complete')
                setProgress(1.0)
                addLog(`Transfer complete ✓ (${result.sizeBytes} bytes, ${result.durationMs}ms)`)
            } else {
                throw new Error(result.errorMessage || 'Transfer failed')
            }
        } catch (error) {
            if (!isMounted.current) return
            const msg = error instanceof Error ? error.message : String(error)
            logError('[ConfigTransfer] Transfer failed:', error)
            setPhase('failed')
            setErrorMsg(msg)
            addLog(`Error: ${msg}`)
        }
    }, [device, latestConfig, addLog])

    return {
        batteryLevel,
        latestConfig,
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
