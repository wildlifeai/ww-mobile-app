import { useState, useCallback, useEffect, useRef } from 'react'
import { Platform, PermissionsAndroid } from 'react-native'
import BleManager, { Peripheral } from 'react-native-ble-manager'

import { createBleSession } from '../../../ble/session/createBleSession'
import { commandRegistry } from '../../../ble/protocol/commandRegistry'
import { bleEventBus } from '../../../ble/protocol/eventBus'
import { DfuService } from '../../../services/DfuService'
import FirmwareService from '../../../services/FirmwareService'
import ReferenceDataService from '../../../services/ReferenceDataService'
import Firmware from '../../../database/models/Firmware'
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
    sending: 0.05,
    waking: 0.10,
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
    downloading: '',
    entering_dfu: '',
    scanning: '',
    sending: 'Sending firmware update command...',
    waking: 'Waking AI processor & running selftest...',
    flashing: 'Writing firmware to flash...',
    rebooting: 'Rebooting device...',
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

interface UseFirmwareUpdateOptions {
    target: FirmwareTarget
    device: ExtendedPeripheral | undefined
}

export function useFirmwareUpdate({ target, device }: UseFirmwareUpdateOptions) {
    const { connectDevice, disconnectDevice } = useBle()

    // State
    const [phase, setPhase] = useState<UpdatePhase>('idle')
    const [dfuProgress, setDfuProgress] = useState(0) // 0-100 for BLE DFU
    const [isUpdating, setIsUpdating] = useState(false)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [progressLogs, setProgressLogs] = useState<string[]>([])

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
            'idle', 'preflight', 'downloading', 'entering_dfu', 'scanning',
            'sending', 'waking', 'flashing', 'rebooting', 'reconnecting',
            'verifying', 'complete',
        ]
        const currentIdx = ordering.indexOf(phaseRef.current)
        const newIdx = ordering.indexOf(newPhase)
        if (newPhase === 'failed' || newIdx > currentIdx) {
            phaseRef.current = newPhase
            if (!unmountedRef.current) setPhase(newPhase)
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
    }, [])

    // ── Himax UART phase listener ──────────────────────────────────

    useEffect(() => {
        if (target !== 'himax' || !isUpdating) return

        const onRx = (event: any) => {
            if (event.type !== 'RAW_RX' || event.deviceId !== device?.id) return
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
                advancePhase('complete')
                appendLog(line)
            } else if (/Firmware update FAILED/i.test(line)) {
                appendLog(line)
            }
        }

        bleEventBus.on('rawRx', onRx)
        return () => { bleEventBus.removeListener('rawRx', onRx) }
    }, [target, isUpdating, device?.id, advancePhase, appendLog])

    // ── Wait for "Sleep" line (Himax only) ─────────────────────────

    const waitForSleep = useCallback((): Promise<void> => {
        return new Promise((resolve) => {
            let resolved = false
            const done = () => {
                if (resolved) return
                resolved = true
                bleEventBus.removeListener('rawRx', onRx)
                clearTimeout(fallback)
                resolve()
            }
            const onRx = (event: any) => {
                if (event.type === 'RAW_RX' && event.deviceId === device?.id && event.line.startsWith('Sleep')) {
                    log('[FW Update] Device sent Sleep — ready for reset')
                    done()
                }
            }
            bleEventBus.on('rawRx', onRx)
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
        const localUri = await FirmwareService.ensureFirmwareDownloaded(latestFirmware)
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
        appendLog('Flashing firmware...')
        await DfuService.startDFU(bootloaderAddr, localUri, (progress) => {
            if (!unmountedRef.current) setDfuProgress(progress)
            if (progress > 95) appendLog('Finalizing...')
        })

        setDfuProgress(100)

        // 6. Reboot and reconnect
        advancePhase('rebooting')
        appendLog('Device rebooting...')
        await new Promise(r => setTimeout(r, 6000))

        advancePhase('reconnecting')
        appendLog('Reconnecting...')
        const foundId = await scanForOriginalDevice(device.id, 20000)
        if (!foundId) throw new Error('Device not found after DFU reboot.')

        appendLog('Connecting...')
        await connectDevice(device, 20000)
        await new Promise(r => setTimeout(r, 2000))

        // 7. Verify
        advancePhase('verifying')
        appendLog('Checking new version...')
        try {
            const session = createBleSession(device)
            const ver = await session.execute(() => commandRegistry.version())
            if (!unmountedRef.current) setNewVersion(ver)
            appendLog(`New version: ${ver}`)
        } catch (e) {
            logWarn('[FW Update] Post-DFU version query failed:', e)
        }

        advancePhase('complete')
    }, [device, latestFirmware, disconnectDevice, connectDevice, advancePhase, appendLog])

    // ── Himax flow ─────────────────────────────────────────────────

    const runHimaxUpdate = useCallback(async () => {
        if (!device?.connected) throw new Error('Device disconnected.')

        advancePhase('sending')
        appendLog('Sending firmware flash command...')

        const session = createBleSession(device)
        await session.execute(() => commandRegistry.aifirmware('output.img'))

        if (unmountedRef.current) return

        advancePhase('complete')
        appendLog('Firmware write complete. Waiting for device...')

        // Wait for Sleep signal
        await waitForSleep()
        if (unmountedRef.current) return

        // Reset
        advancePhase('rebooting')
        appendLog('Sending reset command...')
        try {
            const resetSession = createBleSession(device)
            await resetSession.execute(() => commandRegistry.reset())
        } catch (_e) {
            // Usually throws because BLE drops on reset. Expected.
        }

        // Wait for device to come back
        await new Promise(r => setTimeout(r, 3000))
        if (unmountedRef.current) return

        // Try to query new version if still connected
        advancePhase('verifying')
        appendLog('Checking new version...')
        try {
            if (device.connected) {
                const verSession = createBleSession(device)
                const ver = await verSession.execute(() => commandRegistry.aiver())
                if (!unmountedRef.current) setNewVersion(ver)
                appendLog(`New version: ${ver}`)
            }
        } catch (e) {
            logWarn('[FW Update] Post-update version query failed:', e)
        }

        advancePhase('complete')
    }, [device, advancePhase, appendLog, waitForSleep])

    // ── Public start ───────────────────────────────────────────────

    const startUpdate = useCallback(async () => {
        setIsUpdating(true)
        setErrorMsg(null)
        setNewVersion(null)
        setProgressLogs([])
        setDfuProgress(0)
        phaseRef.current = 'idle'

        try {
            if (target === 'ble') {
                await runBleDfu()
            } else {
                await runHimaxUpdate()
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

    // For BLE DFU, interpolate real progress during flashing phase
    let progress: number
    if (target === 'ble' && phase === 'flashing') {
        // Interpolate between scanning(0.18) and rebooting(0.82)
        progress = 0.18 + (dfuProgress / 100) * (0.82 - 0.18)
    } else {
        progress = PHASE_PROGRESS[phase]
    }

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

        // Pre-flight
        batteryLevel,
        isBatteryLow,
        previousVersion: displayPreviousVersion,
        newVersion: displayNewVersion,
        latestFirmware,
        isPreflightDone,

        // Actions
        startUpdate,
    }
}
