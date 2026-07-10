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
import { verifyConfigDefaults } from '../../../ble/workflows/configVerification'
import { ExtendedPeripheral, setDfuStatus } from '../../../redux/slices/devicesSlice'
import { useAppDispatch } from '../../../redux'
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

const MONTH_CHAR: Record<number, string> = {
    1: '1', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
    10: 'A', 11: 'B', 12: 'C'
};

const HOUR_CHAR: Record<number, string> = {
    0: '0', 1: '1', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
    10: 'A', 11: 'B', 12: 'C', 13: 'D', 14: 'E', 15: 'F', 16: 'G', 17: 'H', 18: 'I', 19: 'J',
    20: 'K', 21: 'L', 22: 'M', 23: 'N'
};

const MONTH_MAP: Record<string, number> = {
    Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
    Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12
};

/** First filename character per camera variant: R........IMG / H........IMG */
const VARIANT_LETTER: Record<string, string> = { RP3: 'R', HM0360: 'H' };

export function firmware83Filename(version?: string | null, buildDate?: string | null, variant?: string | null): string {
    const letter = variant ? VARIANT_LETTER[variant] : undefined;
    if (!version) return letter ? `${letter}_OUT.IMG` : 'OUTPUT.IMG';
    try {
        // Match HH:MM:SS Mon DD YYYY
        // Note: version string looks like: "WW500_C02 10:59:43 May 20 2026"
        const match = version.match(/(\d{2}):(\d{2}):\d{2}\s+([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})/);
        if (match) {
            const hour = parseInt(match[1], 10);
            const minute = parseInt(match[2], 10);
            const monthAbbr = match[3];
            const day = parseInt(match[4], 10);
            const year = parseInt(match[5], 10);

            const monthNum = MONTH_MAP[monthAbbr];
            if (monthNum !== undefined) {
                const yy = (year % 100).toString().padStart(2, '0');
                const m = MONTH_CHAR[monthNum];
                const dd = day.toString().padStart(2, '0');
                const h = HOUR_CHAR[hour];
                const mm = minute.toString().padStart(2, '0');
                if (m && h) {
                    // With a variant, the letter replaces the first year digit so the
                    // two images of a dual-image MANIFEST have distinct names
                    // (must match firmware_83_filename in ww-website manifest.py)
                    return letter ? `${letter}${year % 10}${m}${dd}${h}${mm}.IMG` : `${yy}${m}${dd}${h}${mm}.IMG`;
                }
            }
        }

        // Fallback: try parsing buildDate (e.g., "May 20 2026")
        if (buildDate) {
            const matchDate = buildDate.trim().match(/^([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})$/);
            if (matchDate) {
                const monthAbbr = matchDate[1];
                const day = parseInt(matchDate[2], 10);
                const year = parseInt(matchDate[3], 10);

                const monthNum = MONTH_MAP[monthAbbr];
                if (monthNum !== undefined) {
                    const yy = (year % 100).toString().padStart(2, '0');
                    const m = MONTH_CHAR[monthNum];
                    const dd = day.toString().padStart(2, '0');
                    if (m) {
                        return letter ? `${letter}${year % 10}${m}${dd}000.IMG` : `${yy}${m}${dd}000.IMG`;
                    }
                }
            }
        }
    } catch (e) {
        logWarn('[FW Update] Failed to parse 8.3 filename:', e);
    }
    return letter ? `${letter}_OUT.IMG` : 'OUTPUT.IMG';
}

function parseSdCardFiles(lines: string[]): string[] {
    return lines
        .map(line => line.trim())
        .filter(line => line && !/End of directory/i.test(line) && !/\bdirs?,\s+\bfiles?/i.test(line))
        .map(line => {
            const parts = line.split(/\s+/);
            return parts[parts.length - 1]?.toUpperCase();
        })
        .filter(name => name && name.endsWith('.IMG'));
}

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
    selectedFirmware?: Firmware | string
}

interface UseFirmwareUpdateOptions {
    target: FirmwareTarget
    device: ExtendedPeripheral | undefined
}

export function useFirmwareUpdate({ target, device }: UseFirmwareUpdateOptions) {
    const { connectDevice, disconnectDevice } = useBle()
    const dispatch = useAppDispatch()

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
    const [sdCardFiles, setSdCardFiles] = useState<string[]>([])
    const [availableDbFirmwares, setAvailableDbFirmwares] = useState<Firmware[]>([])
    const [isPreflightDone, setIsPreflightDone] = useState(false)
    // Which camera variant the device is running right now (from 'slots'), and
    // dual-image pass progress ({total, done}) for the pair-update UI.
    const [runningVariant, setRunningVariant] = useState<'RP3' | 'HM0360' | null>(null)
    const [pairProgress, setPairProgress] = useState<{ total: number; done: number } | null>(null)
    // True while waiting for the device to come back between the two pair
    // passes - drives an honest status label instead of "pre-flight checks".
    const [interPassWait, setInterPassWait] = useState(false)
    const preflightDoneRef = useRef(false)

    const unmountedRef = useRef(false)
    const phaseRef = useRef<UpdatePhase>('idle')
    const deviceIdRef = useRef<string | undefined>(device?.id)

    useEffect(() => {
        return () => { unmountedRef.current = true }
    }, [])

    // Reset preflight ref on disconnect or device ID change
    useEffect(() => {
        if (!device?.connected || device.id !== deviceIdRef.current) {
            preflightDoneRef.current = false
            setIsPreflightDone(false)
            deviceIdRef.current = device?.id
        }
    }, [device?.connected, device?.id])

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
        const isDfuMode = !!device?.name?.includes('DfuTarg')

        // Normal devices must be connected for preflight. DFU devices can skip this requirement.
        if (!device?.connected && !isDfuMode) {
            preflightDoneRef.current = false
            return
        }

        if (isUpdating) return
        if (preflightDoneRef.current) return
        
        preflightDoneRef.current = true
        let cancelled = false

        const run = async () => {
            // Only perform BLE command queries if it's NOT a DFU device
            if (!isDfuMode) {
                const session = device ? createBleSession(device) : null
                if (!session) throw new Error('Device not available')
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

                if (target === 'himax') {
                    try {
                        const files = await session.execute(() => commandRegistry.dir())
                        log(`[FW Update] dir command output:`, files)
                        const parsed = parseSdCardFiles(files)
                        if (!cancelled) setSdCardFiles(parsed)
                    } catch (e) {
                        logWarn('[FW Update] dir command failed:', e)
                        if (!cancelled) setSdCardFiles([])
                    }

                    try {
                        // Which camera image is running now - orients the user and
                        // lets the pair update report what it will finish on.
                        const slots = await session.execute(() => commandRegistry.slots())
                        const running = /RP3/i.test(slots.running) ? 'RP3'
                            : /HM0360/i.test(slots.running) ? 'HM0360' : null
                        if (!cancelled) setRunningVariant(running)
                        log(`[FW Update] Running camera variant: ${running ?? 'unknown'}`)
                    } catch (e) {
                        // Older firmware without 'slots' - non-fatal
                        logWarn('[FW Update] slots query failed (older firmware?):', e)
                    }
                }
            } else {
                log('[FW Update] Device is in DFU mode. Skipping battery/version checks.')
            }

            // Latest available firmware from local DB
            try {
                const latest = await ReferenceDataService.getLatestFirmware(target)
                if (!cancelled) setLatestFirmware(latest)
            } catch (e) {
                logWarn('[FW Update] Could not load latest firmware record:', e)
            }

            if (target === 'himax') {
                try {
                    const activeFws = await ReferenceDataService.getActiveFirmwares('himax')
                    if (!cancelled) setAvailableDbFirmwares(activeFws)
                } catch (e) {
                    logWarn('[FW Update] Could not load active firmware records:', e)
                }
            }

            if (!cancelled) setIsPreflightDone(true)
        }

        run()
        return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [device?.connected, device?.name, isUpdating, target])

    // ── Graceful Disconnect Fallback ───────────────────────────────
    
    useEffect(() => {
        if (isUpdating && device && !device.connected) {
            // Reconnecting and rebooting phases legitimately lose BLE connection
            if (phase === 'reconnecting' || phase === 'rebooting') return
            // Entering DFU, scanning, and flashing phases legitimately lose BLE connection for BLE target
            if (target === 'ble' && (phase === 'entering_dfu' || phase === 'scanning' || phase === 'flashing')) return

            logError('[FW Update] Device unexpectedly disconnected during phase:', phase)
            
            // Abort any ongoing operations
            if (abortControllerRef.current) {
                abortControllerRef.current.abort()
            }

            if (!unmountedRef.current) {
                setErrorMsg('BLE connection lost halfway through the update.')
                advancePhase('failed')
            }
        }
    }, [isUpdating, device?.connected, device, phase, target, advancePhase])

    // ── Himax UART phase listener ──────────────────────────────────

    useEffect(() => {
        if (target !== 'himax' || !isUpdating) return

        const onRx = (event: any) => {
            if (event.type !== 'TEXT_LINE' || event.deviceId !== device?.id) return
            const line: string = event.line

            if (line.includes('Wake') && !line.includes('Wakeup_event')) {
                advancePhase('waking')
            } else if (line.includes('erase_firmware_slot') || line.includes('Erasing firmware slot') || line.includes('erased OK')) {
                // Current firmware: "erase_firmware_slot: slot N ..." / "... erased OK".
                // Legacy strings kept for backward compatibility with older HX6538 builds.
                advancePhase('flashing')
                appendLog(line)
            } else if (line.includes('write_firmware_from_sd') || (line.includes('Writing') && line.includes('bytes to firmware'))) {
                // Current firmware: "write_firmware_from_sd: slot N — application only / full image".
                advancePhase('flashing')
                appendLog(line)
            } else if (line.includes('chunk-verified OK') || line.includes('verify_firmware_slot') || line.includes('verify OK') || line.includes('full verify OK')) {
                // Current firmware: "... chunk-verified OK" and "verify_firmware_slot: slot N verify OK".
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

        const isDfuMode = !!device?.name?.includes('DfuTarg')
        let bootloaderAddr = device.id

        // 2. Enter DFU mode (skip if already in DFU)
        if (!isDfuMode) {
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
        }

        // 3. Request notification permission on Android 13+
        if (Platform.OS === 'android' && Platform.Version >= 33) {
            try {
                await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS)
            } catch (_e) { /* non-fatal */ }
        }

        // 4. Scan for bootloader (skip if already in DFU)
        if (!isDfuMode) {
            advancePhase('scanning')
            appendLog('Searching for bootloader...')
            const scannedAddr = await scanForBootloader(10000)
            if (!scannedAddr) throw new Error('Bootloader not found. Make sure the device is nearby.')
            bootloaderAddr = scannedAddr
        }

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

    /**
     * Flash a single Himax firmware image (one A/B slot) and wait for the
     * device to reset into it. The caller decides which image(s) and in
     * which order - see runHimaxUpdate.
     */
    const flashHimaxImage = useCallback(async (
        source: HimaxFirmwareSource,
        fwToFlash: Firmware | null,
        filenameToFlash: string,
        passLabel: string,
    ) => {
        if (!device?.connected) throw new Error('Device disconnected.')

        const session = createBleSession(device)

        if (source === 'download') {
            if (!fwToFlash) throw new Error('No firmware available for download. Sync reference data first.')

            // 1. Download firmware
            advancePhase('downloading')
            appendLog(`${passLabel}Downloading firmware package...`)
            const localUri = await FirmwareService.ensureFirmwareDownloaded(fwToFlash, {
                signal: abortControllerRef.current?.signal,
                onStateChange: (state) => {
                    if (!unmountedRef.current) setDownloadState(state)
                },
                onProgress: (data) => {
                    if (!unmountedRef.current) setDownloadProgress(data)
                }
            })
            appendLog(`${passLabel}Downloaded: ${fwToFlash.version}`)

            const imgName = filenameToFlash;
            appendLog(`${passLabel}Target firmware filename: ${imgName}`);

            // 2. Transfer firmware to SD card
            advancePhase('transferring')
            appendLog(`${passLabel}Transferring firmware to device SD card...`)
            const configBytes = await FirmwareService.readFirmwareAsBytes(localUri)

            let computedCrc: string | undefined;

            if (configBytes) {
                const transferResult = await runFileTransferPipeline(device, {
                    filename: imgName,
                    data: configBytes,
                    abortSignal: abortControllerRef.current?.signal,
                    onProgress: (p) => {
                        if (!unmountedRef.current) setFileTransferProgress(p)
                    }
                })

                // Convert numeric CRC back to 0xNNNN hex string to match firmware CLI expectations
                if (transferResult && typeof transferResult.crc === 'number') {
                    computedCrc = '0x' + transferResult.crc.toString(16).toUpperCase().padStart(4, '0')
                    appendLog(`${passLabel}Transfer complete. Local CRC: ${computedCrc}`)
                } else {
                    appendLog(`${passLabel}Transfer complete.`)
                }
            } else {
                throw new Error('Failed to read firmware bytes')
            }

            advancePhase('sending')
            appendLog(`${passLabel}Sending firmware flash command...`)

            await session.execute(() => commandRegistry.aifirmware(imgName, computedCrc))
        } else {
            // Source is 'sdcard'
            advancePhase('sending')
            appendLog(`${passLabel}Sending firmware flash command...`)

            const targetCrc = fwToFlash?.crcChecksum || undefined
            if (targetCrc) {
                appendLog(`${passLabel}Using database CRC for flash: ${targetCrc}`)
            }

            await session.execute(() => commandRegistry.aifirmware(filenameToFlash, targetCrc))
        }

        if (unmountedRef.current) return

        appendLog(`${passLabel}Firmware write complete. Waiting for device to sleep...`)

        // Wait for the Himax to finish and send Sleep signal
        await session.waitForSleep(5000)
        if (unmountedRef.current) return

        // Send AI reset to boot the newly-written slot and reload parameters
        advancePhase('rebooting')
        appendLog(`${passLabel}Sending AI reset to boot the new image...`)
        try {
            const resetSession = createBleSession(device)
            await resetSession.execute(() => commandRegistry.aireset())
        } catch (e) {
            logWarn('[FW Update] AI reset command error/timeout (may be expected):', e)
        }

        appendLog(`${passLabel}Waiting for AI processor to reboot...`)
        await new Promise(r => setTimeout(r, 4000))
    }, [device, advancePhase, appendLog])

    /**
     * Poll the AI processor with a light command until it responds, or the
     * timeout elapses. Used between the two pair passes: the AI reset that
     * boots the freshly-written slot drops the BLE session ("Session Reset"
     * from bleTransport.clearAll), so a fixed delay is not enough - the next
     * flash command must wait until the device actually answers again.
     */
    const waitForAiReady = useCallback(async (timeoutMs: number) => {
        const deadline = Date.now() + timeoutMs
        let attempt = 0
        while (Date.now() < deadline) {
            if (unmountedRef.current) return
            attempt++
            try {
                const s = createBleSession(device!)
                await s.execute(() => commandRegistry.aiver())
                log(`[FW Update] AI readiness poll ${attempt}: online`)
                appendLog('AI processor is back online.')
                return
            } catch (e: any) {
                log(`[FW Update] AI readiness poll ${attempt} failed: ${e?.message}`)
                await new Promise(r => setTimeout(r, 2500))
            }
        }
        // Proceed anyway - the flash command itself will fail loudly if the
        // device really is gone, and the retry wrapper gets a second chance.
        appendLog('AI processor slow to respond - attempting next image anyway...')
    }, [device, appendLog])

    /**
     * Update the Himax firmware.
     *
     * The WW500 holds TWO firmware images in A/B flash slots (RP3 colour
     * camera and HM0360 night/IR camera). Each `AI firmware` command writes
     * the INACTIVE slot and switches to it, so a full update is two passes -
     * ordered so the device finishes on the camera variant it started with.
     *
     * Falls back to the single-image flow when variant-labelled records are
     * not available (legacy firmware database) or when an explicit SD-card
     * filename is given.
     */
    const runHimaxUpdate = useCallback(async (source: HimaxFirmwareSource = 'sdcard', selectedFirmware?: Firmware | string) => {
        if (!device?.connected) throw new Error('Device disconnected.')

        const verifyAndComplete = async () => {
            if (unmountedRef.current) return
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
            try {
                // Re-read which camera image the device finished on, so the
                // success banner can say "now running ..." with confidence.
                const slotSession = createBleSession(device)
                const slots = await slotSession.execute(() => commandRegistry.slots())
                const running = /RP3/i.test(slots.running) ? 'RP3'
                    : /HM0360/i.test(slots.running) ? 'HM0360' : null
                if (!unmountedRef.current && running) setRunningVariant(running)
            } catch (e) {
                logWarn('[FW Update] Post-update slots query failed:', e)
            }
            try {
                // Empty-SD handshake: the firmware regenerates CONFIG.TXT from its
                // in-RAM OPs at the next sleep, so verifying the OP vector against
                // FACTORY_DEFAULTS confirms the configuration is sane without
                // reading the file. Non-fatal — the update itself is already
                // verified; mismatches are surfaced for the engineer to judge.
                const cfgSession = createBleSession(device)
                const cfg = await verifyConfigDefaults(cfgSession)
                if (cfg.verified) {
                    appendLog(`Configuration verified (${cfg.checkedCount} parameters at defaults)`)
                } else {
                    const details = Object.entries(cfg.mismatches)
                        .map(([idx, m]) => `op${idx}=${m.actual} (default ${m.expected})`)
                        .join(', ')
                    appendLog(`Configuration differs from defaults: ${details}`)
                }
            } catch (e) {
                logWarn('[FW Update] Post-update config verification failed (non-fatal):', e)
            }
            advancePhase('complete')
        }

        // Explicit SD-card filename: single-pass legacy behaviour (the variant
        // cannot be known from a bare filename)
        if (typeof selectedFirmware === 'string') {
            if (!unmountedRef.current) setPairProgress({ total: 1, done: 0 })
            await flashHimaxImage(source, null, selectedFirmware, '')
            if (!unmountedRef.current) setPairProgress({ total: 1, done: 1 })
            await verifyAndComplete()
            return
        }

        // Resolve the image pair
        const primary: Firmware | null = selectedFirmware ?? latestFirmware
        let pair: Firmware[] = []

        if (primary?.cameraVariant) {
            const otherVariant = primary.cameraVariant === 'RP3' ? 'HM0360' : 'RP3'
            const other = await ReferenceDataService.getLatestHimaxByVariant(otherVariant as 'RP3' | 'HM0360')
            pair = other ? [other, primary] : [primary]
        } else {
            // No variant on the chosen record (or none chosen) - try to build the
            // pair from the latest of each variant, else legacy single image
            const rp3 = await ReferenceDataService.getLatestHimaxByVariant('RP3')
            const hm = await ReferenceDataService.getLatestHimaxByVariant('HM0360')
            if (rp3 && hm) {
                pair = [hm, rp3]
            } else if (primary) {
                pair = [primary]
            } else {
                throw new Error('No firmware available. Sync reference data first.')
            }
        }

        if (pair.length === 1) {
            appendLog('Only one camera variant available - single-image update')
        } else {
            // Each flash switches the device to the newly-written slot, so flash
            // the OTHER variant first and the device's CURRENT variant last -
            // the device then finishes on the (updated) camera it started with.
            try {
                const slotSession = createBleSession(device)
                const slots = await slotSession.execute(() => commandRegistry.slots())
                const running = /RP3/i.test(slots.running) ? 'RP3'
                    : /HM0360/i.test(slots.running) ? 'HM0360' : null
                appendLog(`Device is running the ${running ?? 'unknown'} camera image`)
                if (running && pair[0].cameraVariant === running) {
                    pair = [pair[1], pair[0]]
                }
            } catch (e) {
                // Older firmware without the slots command - order doesn't matter
                // for correctness, only for which camera ends up active
                logWarn('[FW Update] slots query failed (older firmware?) - using default order:', e)
            }
        }

        if (!unmountedRef.current) setPairProgress({ total: pair.length, done: 0 })

        // Errors from a transient link drop (the AI reset between passes tears
        // the BLE session down) - retried once after re-establishing contact.
        const TRANSIENT_ERROR = /Session Reset|DEVICE_DISCONNECTED|time.?out/i

        for (let i = 0; i < pair.length; i++) {
            const fw = pair[i]
            const passLabel = pair.length === 2
                ? `[${i + 1}/2 ${fw.cameraVariant ?? 'unknown'}] `
                : ''
            const filename = firmware83Filename(fw.version, fw.buildDate, fw.cameraVariant)

            // Update the completed-pass count BEFORE the boundary wait/phase
            // rewind, so the overall progress bar never runs backwards at the
            // pass boundary (it jumps from ~41% to 51%, not down to ~10%).
            if (!unmountedRef.current) setPairProgress({ total: pair.length, done: i })

            if (i > 0) {
                // The phase machine is forward-only within a pass; rewind it for
                // the second image so downloading/transferring show correctly
                phaseRef.current = 'preflight'
                if (!unmountedRef.current) setPhase('preflight')
                appendLog(`Starting second image (${fw.cameraVariant ?? 'unknown'})...`)
                // The previous pass ended in an AI reset; wait until the device
                // answers again rather than racing the reboot.
                if (!unmountedRef.current) setInterPassWait(true)
                try {
                    await waitForAiReady(25000)
                } finally {
                    if (!unmountedRef.current) setInterPassWait(false)
                }
                if (unmountedRef.current) return
            }

            try {
                await flashHimaxImage(source, fw, filename, passLabel)
            } catch (e: any) {
                if (!TRANSIENT_ERROR.test(String(e?.message ?? e))) throw e
                appendLog(`${passLabel}Link dropped during flash - reconnecting and retrying once...`)
                if (!unmountedRef.current) setInterPassWait(true)
                try {
                    await waitForAiReady(25000)
                } finally {
                    if (!unmountedRef.current) setInterPassWait(false)
                }
                if (unmountedRef.current) return
                phaseRef.current = 'preflight'
                if (!unmountedRef.current) setPhase('preflight')
                await flashHimaxImage(source, fw, filename, passLabel)
            }
            if (unmountedRef.current) return
        }

        if (!unmountedRef.current) setPairProgress({ total: pair.length, done: pair.length })

        await verifyAndComplete()
    }, [device, latestFirmware, advancePhase, appendLog, flashHimaxImage, waitForAiReady])

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
        setPairProgress(null)
        setInterPassWait(false)
        phaseRef.current = 'idle'
        setPhase('idle')
        
        abortControllerRef.current = new AbortController()

        // Mark DFU in progress so the disconnect banner is suppressed
        if (device?.id) dispatch(setDfuStatus({ id: device.id, status: true }))

        try {
            if (target === 'ble') {
                await runBleDfu()
            } else {
                await runHimaxUpdate(options?.himaxSource, options?.selectedFirmware)
            }
        } catch (err: any) {
            if (!unmountedRef.current) {
                logError(`[FW Update] ${target} update failed:`, err)
                setErrorMsg(err.message || String(err))
                advancePhase('failed')
            }
        } finally {
            // Clear DFU flag regardless of success/failure
            if (device?.id) dispatch(setDfuStatus({ id: device.id, status: false }))
            if (!unmountedRef.current) setIsUpdating(false)
        }
    }, [target, runBleDfu, runHimaxUpdate, advancePhase, dispatch, device?.id])

    // ── Derived values ─────────────────────────────────────────────

    const labels = target === 'ble' ? BLE_PHASE_LABELS : HIMAX_PHASE_LABELS
    // Pass-aware status for dual-image updates: an honest boundary message while
    // waiting for the device to restart, and an "Image N of M" prefix otherwise.
    let statusLabel = labels[phase]
    if (target === 'himax' && isUpdating && pairProgress && pairProgress.total > 1) {
        statusLabel = interPassWait
            ? `Image ${pairProgress.done} of ${pairProgress.total} installed — waiting for the camera to restart…`
            : `[Image ${Math.min(pairProgress.done + 1, pairProgress.total)} of ${pairProgress.total}] ${labels[phase]}`
    }

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

    // Dual-image update: scale the per-pass progress into an overall bar so it
    // never runs backwards at the pass boundary (pass 1 = 0-50%, pass 2 = 50-100%).
    if (target === 'himax' && pairProgress && pairProgress.total > 1) {
        progress = Math.min(1, (pairProgress.done + Math.min(progress, 1)) / pairProgress.total)
        if (phase === 'complete') progress = 1
    }

    const cancelUpdate = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
        }
    }, [])

    const isBatteryLow = batteryLevel !== null && batteryLevel < 30
    // A reading this low almost always means the battery rail is not powered at
    // all - i.e. the device is running from USB / a bench supply with no (or
    // flat-flat) batteries. Surfaced so the UI can say "external power?" instead
    // of presenting a scary-but-meaningless percentage.
    const isLikelyExternalPower = batteryLevel !== null && batteryLevel <= 5
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
        isLikelyExternalPower,
        previousVersion: displayPreviousVersion,
        newVersion: displayNewVersion,
        latestFirmware,
        isPreflightDone,
        sdCardFiles,
        availableDbFirmwares,
        runningVariant,
        pairProgress,

        // Actions
        startUpdate,
        cancelUpdate,
    }
}
