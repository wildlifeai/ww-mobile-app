import { useState, useCallback, useEffect, useRef } from 'react'
import { Platform, PermissionsAndroid } from 'react-native'
import BleManager, { Peripheral } from 'react-native-ble-manager'

import { createBleSession } from '../../../ble/session/createBleSession'
import { commandRegistry } from '../../../ble/protocol/commandRegistry'
import { bleEventBus } from '../../../ble/protocol/eventBus'
import { DfuService } from '../../../services/DfuService'
import FirmwareService, { DownloadState, DownloadProgressData } from '../../../services/FirmwareService'
import ReferenceDataService from '../../../services/ReferenceDataService'
import Firmware from '../../../database/models/Firmware'
import { runFileTransferPipeline } from '../../../ble/protocol/fileTransfer'
import { FileTransferProgress } from '../../../ble/protocol/fileTransfer/fileTransferTypes'
import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { useBle } from '../../../hooks/useBle'
import { log, logError, logWarn } from '../../../utils/logger'
import { convertBleToSemanticVersion } from '../../../utils/versionUtils'

// ────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────

export type FirmwareTarget = 'ble' | 'himax'

export type UpdatePhase =
    | 'idle'
    | 'preflight'      // Querying battery + version
    | 'downloading'    // BLE only: downloading .zip from Supabase
    | 'entering_dfu'   // BLE only: sending `dfu` command
    | 'scanning'       // BLE only: scanning for DfuTarg bootloader
    | 'transferring'   // Himax only: transferring firmware via BLE file transfer
    | 'sending'        // Himax only: sending aifirmware command
    | 'waking'         // Himax only: AI processor waking
    | 'flashing'       // DFU in progress / Himax writing
    | 'rebooting'      // Device resetting
    | 'reconnecting'   // Scanning + reconnecting to original device
    | 'verifying'      // Querying new version
    | 'complete'
    | 'failed'

const PHASE_PROGRESS: Record<UpdatePhase, number> = {
    idle: 0,
    preflight: 0.02,
    downloading: 0.08,
    entering_dfu: 0.12,
    scanning: 0.18,
    transferring: 0.50,
    sending: 0.52,
    waking: 0.55,
    flashing: 0.60,
    rebooting: 0.82,
    reconnecting: 0.90,
    verifying: 0.95,
    complete: 1.0,
    failed: 0,
}

const BLE_PHASE_LABELS: Record<UpdatePhase, string> = {
    idle: 'Ready to update.',
    preflight: 'Running pre-flight checks...',
    downloading: 'Downloading firmware package...',
    entering_dfu: 'Entering DFU mode...',
    scanning: 'Scanning for bootloader...',
    transferring: '',
    sending: '',
    waking: '',
    flashing: 'Flashing firmware...',
    rebooting: 'Rebooting device...',
    reconnecting: 'Reconnecting to device...',
    verifying: 'Verifying new firmware version...',
    complete: 'Update complete!',
    failed: 'Update failed.',
}

const HIMAX_PHASE_LABELS: Record<UpdatePhase, string> = {
    idle: 'Ready to update.',
    preflight: 'Running pre-flight checks...',
    downloading: 'Downloading firmware package...',
    entering_dfu: '',
    scanning: '',
    transferring: 'Transferring firmware to SD card...',
    sending: 'Sending firmware update command...',
    waking: 'AI processor waking up...',
    flashing: 'Writing firmware to flash...',
    rebooting: 'Rebooting AI processor (takes 6-10s)...',
    reconnecting: 'Reconnecting to device...',
    verifying: 'Verifying new firmware version...',
    complete: 'Update complete!',
    failed: 'Update failed.',
}

// ────────────────────────────────────────────────────────────────────
// Helpers (file-scoped, not hooks)
// ────────────────────────────────────────────────────────────────────

/** Scan for the Nordic DFU bootloader (advertises as "WW500_DFU" or "DfuTarg") */
function scanForBootloader(timeoutMs = 10000): Promise<string | null> {
    return new Promise((resolve) => {
        let timeoutHandle: NodeJS.Timeout

        const listener = BleManager.addListener(
            'BleManagerDiscoverPeripheral',
            (peripheral: Peripheral) => {
                if (peripheral.name === 'WW500_DFU' || peripheral.name === 'DfuTarg') {
                    log('[FW Update] Found bootloader:', peripheral.id)
                    BleManager.stopScan().catch(() => {})
                    clearTimeout(timeoutHandle)
                    listener.remove()
                    resolve(peripheral.id)
                }
            }
        )

        BleManager.scan([], timeoutMs / 1000)
            .then(() => log('[FW Update] Scanning for bootloader...'))
            .catch((err) => {
                logError('[FW Update] Bootloader scan failed:', err)
                clearTimeout(timeoutHandle)
                listener.remove()
                resolve(null)
            })

        timeoutHandle = setTimeout(() => {
            log('[FW Update] Bootloader scan timeout')
            BleManager.stopScan().catch(() => {})
            listener.remove()
            resolve(null)
        }, timeoutMs)
    })
}

/** Scan for the original device after reboot */
function scanForOriginalDevice(deviceId: string, timeoutMs = 20000): Promise<string | null> {
    return new Promise((resolve) => {
        let timeoutHandle: NodeJS.Timeout

        const listener = BleManager.addListener(
            'BleManagerDiscoverPeripheral',
            (peripheral: Peripheral) => {
                if (peripheral.id === deviceId) {
                    log('[FW Update] Found original device:', peripheral.id)
                    BleManager.stopScan().catch(() => {})
                    clearTimeout(timeoutHandle)
                    listener.remove()
                    resolve(peripheral.id)
                }
            }
        )

        BleManager.scan([], timeoutMs / 1000)
            .then(() => log('[FW Update] Scanning for original device:', deviceId))
            .catch((err) => {
                logError('[FW Update] Device scan failed:', err)
                clearTimeout(timeoutHandle)
                listener.remove()
                resolve(null)
            })

        timeoutHandle = setTimeout(() => {
            log('[FW Update] Device scan timeout')
            BleManager.stopScan().catch(() => {})
            listener.remove()
            resolve(null)
        }, timeoutMs)
    })
}

// ────────────────────────────────────────────────────────────────────
// Hook
// ────────────────────────────────────────────────────────────────────

export type HimaxFirmwareSource = 'sdcard' | 'download'

export interface StartUpdateOptions {
    himaxSource?: HimaxFirmwareSource
}

interface UseFirmwareUpdateOptions {
    target: FirmwareTarget
    device: ExtendedPeripheral | undefined
}

export function useFirmwareUpdate({ target, device }: UseFirmwareUpdateOptions) {
    const { connectDevice, disconnectDevice } = useBle()

    const [phase, setPhase] = useState<UpdatePhase>('idle')
    const [dfuProgress, setDfuProgress] = useState(0) // 0-100 for BLE DFU
    const [fileTransferProgress, setFileTransferProgress] = useState<FileTransferProgress | null>(null)
    const [isUpdating, setIsUpdating] = useState(false)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [progressLogs, setProgressLogs] = useState<string[]>([])

    const [downloadState, setDownloadState] = useState<DownloadState>('idle')
    const [downloadProgress, setDownloadProgress] = useState<DownloadProgressData | null>(null)
    
    const abortControllerRef = useRef<AbortController | null>(null)

    // Pre-flight
    const [batteryLevel, setBatteryLevel] = useState<number | null>(null)
    const [previousVersion, setPreviousVersion] = useState<string | null>(null)
    const [newVersion, setNewVersion] = useState<string | null>(null)
    const [latestFirmware, setLatestFirmware] = useState<Firmware | null>(null)
    const [isPreflightDone, setIsPreflightDone] = useState(false)

    const unmountedRef = useRef(false)
    const phaseRef = useRef<UpdatePhase>('idle')

    useEffect(() => {
        return () => { unmountedRef.current = true }
    }, [])

    // Phase advancement (forward-only, except to failed)
    const advancePhase = useCallback((newPhase: UpdatePhase) => {
        const ordering: UpdatePhase[] = [
            'idle', 'preflight', 'downloading', 'entering_dfu', 'scanning', 'transferring',
            'sending', 'waking', 'flashing', 'rebooting', 'reconnecting',
            'verifying', 'complete',
        ]
        const currentIdx = ordering.indexOf(phaseRef.current)
        const newIdx = ordering.indexOf(newPhase)
        if (newPhase === 'failed' || newIdx > currentIdx) {
            log(`[FW Update] Phase: ${phaseRef.current} → ${newPhase}`)
            phaseRef.current = newPhase
            if (!unmountedRef.current) setPhase(newPhase)
        } else {
            log(`[FW Update] Phase advance BLOCKED: ${phaseRef.current} → ${newPhase} (not forward)`)
        }
    }, [])

    const appendLog = useCallback((msg: string) => {
        if (!unmountedRef.current) {
            setProgressLogs(prev => [...prev, msg].slice(-6))
        }
    }, [])

    // ── Pre-flight: run on mount ───────────────────────────────────

    useEffect(() => {
        if (!device?.connected) return
        let cancelled = false

        const run = async () => {
            const session = createBleSession(device)
            try {
                // Battery
                const batt = await session.execute(() => commandRegistry.battery())
                if (!cancelled) setBatteryLevel(batt)
                log(`[FW Update] Battery: ${batt}%`)
            } catch (e) {
                logWarn('[FW Update] Battery query failed:', e)
            }

            try {
                // Current version
                const ver = target === 'ble'
                    ? await session.execute(() => commandRegistry.version())
                    : await session.execute(() => commandRegistry.aiver())
                if (!cancelled) setPreviousVersion(ver)
                log(`[FW Update] Current ${target} version: ${ver}`)
            } catch (e) {
                logWarn('[FW Update] Version query failed:', e)
            }

            // Latest available firmware from local DB
            try {
                const latest = await ReferenceDataService.getLatestFirmware(target)
                if (!cancelled) setLatestFirmware(latest)
            } catch (e) {
                logWarn('[FW Update] Could not load latest firmware record:', e)
            }

            if (!cancelled) setIsPreflightDone(true)
        }

        run()
        return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [device?.connected, target])

    // ── Himax UART phase listener ──────────────────────────────────

    useEffect(() => {
        if (target !== 'himax' || !isUpdating) return

        const onRx = (event: any) => {
            if (event.type !== 'TEXT_LINE' || event.deviceId !== device?.id) return
            const line: string = event.line

            if (line.includes('Wake') && !line.includes('Wakeup_event')) {
                advancePhase('waking')
            } else if (line.includes('Erasing firmware slot') || line.includes('erased OK')) {
                advancePhase('flashing')
                appendLog(line)
            } else if (line.includes('Writing') && line.includes('bytes to firmware')) {
                advancePhase('flashing')
                appendLog(line)
            } else if (line.includes('chunk-verified OK') || line.includes('full verify OK')) {
                appendLog(line)
            } else if (/Firmware update OK/i.test(line)) {
                // Don't advance to complete yet, runHimaxUpdate handles the sequence
                appendLog(line)
            } else if (/Firmware update FAILED/i.test(line)) {
                appendLog(line)
            }
        }

        bleEventBus.on('textLine', onRx)
        return () => { bleEventBus.removeListener('textLine', onRx) }
    }, [target, isUpdating, device?.id, advancePhase, appendLog])

    // ── Wait for "Sleep" line (Himax only) ─────────────────────────

    const waitForSleep = useCallback((): Promise<void> => {
        return new Promise((resolve) => {
            let resolved = false
            const done = () => {
                if (resolved) return
                resolved = true
                bleEventBus.removeListener('textLine', onRx)
                clearTimeout(fallback)
                resolve()
            }
            const onRx = (event: any) => {
                if (event.type === 'TEXT_LINE' && event.deviceId === device?.id && event.line.startsWith('Sleep')) {
                    log('[FW Update] Device sent Sleep — ready for reset')
                    done()
                }
            }
            bleEventBus.on('textLine', onRx)
            const fallback = setTimeout(() => {
                log('[FW Update] Sleep not received in 5s — proceeding')
                done()
            }, 5000)
        })
    }, [device?.id])

    // ── BLE DFU flow ───────────────────────────────────────────────

    const runBleDfu = useCallback(async () => {
        if (!device) throw new Error('No device')

        // 1. Download firmware
        advancePhase('downloading')
        appendLog('Downloading firmware package...')

        if (!latestFirmware) throw new Error('No firmware available for download. Sync reference data first.')
        
        const localUri = await FirmwareService.ensureFirmwareDownloaded(latestFirmware, {
            signal: abortControllerRef.current?.signal,
            onStateChange: (state) => {
                if (!unmountedRef.current) setDownloadState(state)
            },
            onProgress: (data) => {
                if (!unmountedRef.current) setDownloadProgress(data)
            }
        })
        appendLog(`Downloaded: ${latestFirmware.version}`)

        // 2. Enter DFU mode
        advancePhase('entering_dfu')
        appendLog('Switching to DFU mode...')

        if (device.connected) {
            try {
                const session = createBleSession(device)
                await session.execute(() => commandRegistry.dfu())
                await new Promise(r => setTimeout(r, 500))
                try {
                    const disSession = createBleSession(device)
                    await disSession.execute(() => commandRegistry.disconnect())
                } catch (_e) { /* expected */ } finally {
                    await disconnectDevice(device)
                }
                await new Promise(r => setTimeout(r, 5000))
            } catch (e) {
                logWarn('[FW Update] DFU command error (may be expected):', e)
            }
        }

        // 3. Request notification permission on Android 13+
        if (Platform.OS === 'android' && Platform.Version >= 33) {
            try {
                await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS)
            } catch (_e) { /* non-fatal */ }
        }

        // 4. Scan for bootloader
        advancePhase('scanning')
        appendLog('Searching for bootloader...')
        const bootloaderAddr = await scanForBootloader(10000)
        if (!bootloaderAddr) throw new Error('Bootloader not found. Make sure the device is nearby.')

        appendLog(`Found bootloader: ${bootloaderAddr}`)

        // 5. Flash via Nordic DFU
        advancePhase('flashing')
        appendLog('Flashing firmware via Nordic DFU...')
        let lastMilestone = 0
        await DfuService.startDFU(bootloaderAddr, localUri, (progress: number) => {
            if (!unmountedRef.current) setDfuProgress(progress)
            // Log at 25% milestones for user visibility
            const milestone = Math.floor(progress / 25) * 25
            if (milestone > lastMilestone && milestone <= 100) {
                lastMilestone = milestone
                appendLog(`DFU progress: ${milestone}%`)
            }
        })

        setDfuProgress(100)
        appendLog('DFU transfer complete.')

        // 6. Reboot and reconnect
        advancePhase('rebooting')
        appendLog('Device rebooting with new firmware...')
        await new Promise(r => setTimeout(r, 6000))

        advancePhase('reconnecting')
        appendLog('Scanning for device after reboot...')
        const foundId = await scanForOriginalDevice(device.id, 20000)
        if (!foundId) throw new Error('Device not found after DFU reboot.')

        appendLog('Device found. Reconnecting...')
        await connectDevice({ ...device, connected: false } as ExtendedPeripheral, 20000)
        appendLog('Reconnected successfully.')
        await new Promise(r => setTimeout(r, 2000))

        // 7. Verify
        advancePhase('verifying')
        appendLog('Querying new firmware version...')
        try {
            const session = createBleSession(device)
            const ver = await session.execute(() => commandRegistry.version())
            if (!unmountedRef.current) setNewVersion(ver)
            appendLog(`New version: ${ver}`)
        } catch (e) {
            logWarn('[FW Update] Post-DFU version query failed:', e)
            appendLog('Version query failed — check manually.')
        }

        advancePhase('complete')
    }, [device, latestFirmware, disconnectDevice, connectDevice, advancePhase, appendLog])

    // ── Himax flow ─────────────────────────────────────────────────

    const runHimaxUpdate = useCallback(async (source: HimaxFirmwareSource = 'sdcard') => {
        if (!device?.connected) throw new Error('Device disconnected.')

        if (source === 'download') {
            if (!latestFirmware) throw new Error('No firmware available for download. Sync reference data first.')
            
            // 1. Download firmware
            advancePhase('downloading')
            appendLog('Downloading firmware package...')
            const localUri = await FirmwareService.ensureFirmwareDownloaded(latestFirmware, {
                signal: abortControllerRef.current?.signal,
                onStateChange: (state) => {
                    if (!unmountedRef.current) setDownloadState(state)
                },
                onProgress: (data) => {
                    if (!unmountedRef.current) setDownloadProgress(data)
                }
            })
            appendLog(`Downloaded: ${latestFirmware.version}`)

            // 2. Transfer firmware to SD card
            advancePhase('transferring')
            appendLog('Transferring firmware to device SD card...')
            const configBytes = await FirmwareService.readFirmwareAsBytes(localUri)
            
            if (configBytes) {
                await runFileTransferPipeline(device, {
                    filename: 'OUTPUT.IMG',
                    data: configBytes,
                    abortSignal: abortControllerRef.current?.signal,
                    onProgress: (p) => {
                        if (!unmountedRef.current) setFileTransferProgress(p)
                    }
                })
                appendLog('Transfer complete.')
            } else {
                throw new Error('Failed to read firmware bytes')
            }
        }

        advancePhase('sending')
        appendLog('Sending firmware flash command...')

        const session = createBleSession(device)
        await session.execute(() => commandRegistry.aifirmware('output.img'))

        if (unmountedRef.current) return

        appendLog('Firmware write complete. Waiting for device to sleep...')

        // Wait for the Himax to finish and send Sleep signal
        await waitForSleep()
        if (unmountedRef.current) return

        // The Himax resets itself after a firmware write — no need to reset
        // the nRF or drop the BLE connection. Just wait for it to wake back
        // up with the new firmware. The nRF will forward the Wake signal.
        advancePhase('rebooting')
        appendLog('AI processor rebooting with new firmware...')
        appendLog('This normally takes 6-10 seconds...')

        // Wait for the Himax to complete its reboot cycle (DPD → wake → selftest)
        // BLE stays connected to the nRF throughout.
        await new Promise<void>((resolve) => {
            let resolved = false
            const done = () => {
                if (resolved) return
                resolved = true
                bleEventBus.removeListener('textLine', onRx)
                clearTimeout(fallback)
                resolve()
            }
            const onRx = (event: any) => {
                if (event.type === 'TEXT_LINE' && event.deviceId === device?.id) {
                    const line: string = event.line
                    // The nRF sends "Wake" when the Himax comes back up
                    if (line.includes('Wake') && !line.includes('Wakeup_event')) {
                        log('[FW Update] Himax woke up after firmware write')
                        done()
                    }
                }
            }
            bleEventBus.on('textLine', onRx)
            // Fallback: if we don't see Wake within 15s, proceed anyway
            const fallback = setTimeout(() => {
                log('[FW Update] Wake not received in 15s — proceeding to verify')
                done()
            }, 15000)
        })
        if (unmountedRef.current) return

        // Give the Himax a moment to finish selftest after waking
        await new Promise(r => setTimeout(r, 3000))
        if (unmountedRef.current) return

        // Query new version — BLE is still connected, no reconnect needed
        advancePhase('verifying')
        appendLog('Checking new AI firmware version...')
        try {
            const verSession = createBleSession(device)
            const ver = await verSession.execute(() => commandRegistry.aiver())
            if (!unmountedRef.current) setNewVersion(ver)
            appendLog(`New version: ${ver}`)
        } catch (e) {
            logWarn('[FW Update] Post-update version query failed:', e)
        }

        advancePhase('complete')
    }, [device, latestFirmware, advancePhase, appendLog, waitForSleep])

    // ── Public start ───────────────────────────────────────────────

    const startUpdate = useCallback(async (options?: StartUpdateOptions) => {
        setIsUpdating(true)
        setErrorMsg(null)
        setNewVersion(null)
        setProgressLogs([])
        setDfuProgress(0)
        setFileTransferProgress(null)
        setDownloadProgress(null)
        setDownloadState('idle')
        phaseRef.current = 'idle'
        setPhase('idle')
        
        abortControllerRef.current = new AbortController()

        try {
            if (target === 'ble') {
                await runBleDfu()
            } else {
                await runHimaxUpdate(options?.himaxSource)
            }
        } catch (err: any) {
            if (!unmountedRef.current) {
                logError(`[FW Update] ${target} update failed:`, err)
                setErrorMsg(err.message || String(err))
                advancePhase('failed')
            }
        } finally {
            if (!unmountedRef.current) setIsUpdating(false)
        }
    }, [target, runBleDfu, runHimaxUpdate, advancePhase])

    // ── Derived values ─────────────────────────────────────────────

    const labels = target === 'ble' ? BLE_PHASE_LABELS : HIMAX_PHASE_LABELS
    const statusLabel = labels[phase]

    // For BLE DFU and Himax File Transfer, interpolate real progress during specific phases
    let progress: number
    if (target === 'ble' && phase === 'flashing') {
        // Interpolate between scanning(0.18) and rebooting(0.82)
        progress = 0.18 + (dfuProgress / 100) * (0.82 - 0.18)
    } else if (target === 'himax' && phase === 'transferring') {
        // Interpolate between downloading(0.08) and sending(0.52) so the bar never jumps backwards
        const pct = fileTransferProgress ? fileTransferProgress.percentage / 100 : 0
        progress = PHASE_PROGRESS.downloading + pct * (PHASE_PROGRESS.sending - PHASE_PROGRESS.downloading)
    } else {
        progress = PHASE_PROGRESS[phase]
    }

    const cancelUpdate = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
        }
    }, [])

    const isBatteryLow = batteryLevel !== null && batteryLevel < 30
    const isComplete = phase === 'complete'
    const isFailed = phase === 'failed'

    const displayPreviousVersion = target === 'ble' && previousVersion
        ? convertBleToSemanticVersion(previousVersion)
        : previousVersion
    const displayNewVersion = target === 'ble' && newVersion
        ? convertBleToSemanticVersion(newVersion)
        : newVersion

    return {
        // Phase state
        phase,
        progress,
        statusLabel,
        isUpdating,
        isComplete,
        isFailed,
        progressLogs,
        errorMsg,
        
        // Raw transfer state
        downloadState,
        downloadProgress,
        fileTransferProgress,

        // Pre-flight
        batteryLevel,
        isBatteryLow,
        previousVersion: displayPreviousVersion,
        newVersion: displayNewVersion,
        latestFirmware,
        isPreflightDone,

        // Actions
        startUpdate,
        cancelUpdate,
    }
}
