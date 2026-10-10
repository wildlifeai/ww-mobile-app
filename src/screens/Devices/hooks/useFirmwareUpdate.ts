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
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import { runFileTransferPipeline } from '../../../ble/protocol/fileTransfer'
import { FileTransferProgress } from '../../../ble/protocol/fileTransfer/fileTransferTypes'
import { verifyConfigDefaults } from '../../../ble/workflows/configVerification'
import { ExtendedPeripheral, setDfuStatus } from '../../../redux/slices/devicesSlice'
import { useAppDispatch } from '../../../redux'
import { useBle } from '../../../hooks/useBle'
import { himaxUpdateRecord } from '../../../services/himaxUpdateRecord'
import { CameraVariant, parseVariant } from '../../../utils/cameraVariant'
import {
    classifyHimax, HimaxUpdateRecord, HimaxVariant, isRunningFromSelectedSlot, planPair, SlotsReply,
} from '../../../utils/himaxFirmwareState'
import { log, logError, logWarn } from '../../../utils/logger'
import { convertBleToSemanticVersion } from '../../../utils/versionUtils'

// ────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────

export type FirmwareTarget = 'ble' | 'himax'

// Tag for expo-keep-awake so this hook's activation cannot clobber the
// file-transfer pipeline's own per-transfer tags
const KEEP_AWAKE_TAG = 'firmware-update'

// The restart after `AI reset` and `AI dpd`: its Sleep, then the boot's Wake.
// `AI dpd` brings the sleep forward; firmware without it sleeps on op8.
const RESTART_SLEEP_WAIT_MS = 20000
const RESTART_WAKE_WAIT_MS = 15000

// The update stops rather than write to a camera still on its previous image (#374)
const NOT_RESTARTED = 'The camera did not restart into its new image. Nothing more was written.'

/** What `AI ver` and `AI slots` said; null for a reply that did not come */
interface CameraReading {
    version: string | null
    slots: SlotsReply | null
}

const otherCamera = (variant: HimaxVariant): HimaxVariant => (variant === 'RP3' ? 'HM0360' : 'RP3')

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
    flashing: 'Writing firmware to flash — typically 5-10 min...',
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

/** The image one pass of a Himax update sends: its 8.3 name on the SD card, and its cloud path when it is a release */
interface PassImage {
    filename: string
    locationPath: string | null
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
    // Elapsed seconds since the Himax flash command went out. The device is
    // silent over BLE for the whole erase+write+verify (its progress prints go
    // to the local UART console only — see firmware xip_manager.c), so a
    // ticking clock is the honest "still working" signal during that window.
    const flashStartRef = useRef<number | null>(null)
    const [flashElapsedSec, setFlashElapsedSec] = useState(0)
    const [fileTransferProgress, setFileTransferProgress] = useState<FileTransferProgress | null>(null)
    // The image the running pass sends, for the screen's download and transfer
    // cards. A pair update sends each camera's image in turn, so the build
    // picked under Advanced is not it (#436)
    const [passImage, setPassImage] = useState<PassImage | null>(null)
    const [isUpdating, setIsUpdating] = useState(false)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [progressLogs, setProgressLogs] = useState<string[]>([])

    const [downloadState, setDownloadState] = useState<DownloadState>('idle')
    const [downloadProgress, setDownloadProgress] = useState<DownloadProgressData | null>(null)
    
    const abortControllerRef = useRef<AbortController | null>(null)

    // Keep the screen awake for the WHOLE update, not just the file transfer
    // (runFileTransferPipeline holds its own per-transfer tag). The Himax
    // flash phase (5-10 min of waiting) and the BLE DFU had no coverage: the
    // screen sleeping backgrounds the app, iOS throttles/park the BLE link,
    // and the session dies mid-update.
    useEffect(() => {
        if (!isUpdating) return
        activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => { /* best effort */ })
        return () => {
            Promise.resolve().then(() => deactivateKeepAwake(KEEP_AWAKE_TAG)).catch(() => { /* best effort */ })
        }
    }, [isUpdating])

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
    // The whole `slots` reply, and this phone's record of an update it left
    // unfinished on the device, for the screen to say what finishing does (#374)
    const [cameraSlots, setCameraSlots] = useState<SlotsReply | null>(null)
    const [updateRecord, setUpdateRecord] = useState<HimaxUpdateRecord | null>(null)
    const [pairProgress, setPairProgress] = useState<{ total: number; done: number } | null>(null)
    // True while waiting for the device to come back between the two pair
    // passes - drives an honest status label instead of "pre-flight checks".
    const [interPassWait, setInterPassWait] = useState(false)
    const preflightDoneRef = useRef(false)

    const unmountedRef = useRef(false)
    const phaseRef = useRef<UpdatePhase>('idle')
    const deviceIdRef = useRef<string | undefined>(device?.id)

    // Cleared on mount as well as set on unmount: an effect that runs again
    // (Fast Refresh, StrictMode) runs its cleanup first, and a flag only ever
    // set to true left the hook believing it was gone. On 1 October 2026 that
    // stopped an update after image 1's flash command with the screen frozen
    // on "Sending", and nothing sent the reset (#344 bench).
    useEffect(() => {
        unmountedRef.current = false
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
            let currentVersion: string | null = null
            let slotsReply: SlotsReply | null = null
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
                    currentVersion = ver
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
                        slotsReply = slots
                        const running = /RP3/i.test(slots.running) ? 'RP3'
                            : /HM0360/i.test(slots.running) ? 'HM0360' : null
                        if (!cancelled) {
                            setRunningVariant(running)
                            setCameraSlots(slots)
                        }
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
                let activeFws: Firmware[] = []
                try {
                    activeFws = await ReferenceDataService.getActiveFirmwares('himax')
                    if (!cancelled) setAvailableDbFirmwares(activeFws)
                } catch (e) {
                    logWarn('[FW Update] Could not load active firmware records:', e)
                }

                // An update this phone left unfinished on the camera. One the
                // camera shows finished, or never reached, is dropped here.
                if (device && !isDfuMode) {
                    let record = await himaxUpdateRecord.load(device.id)
                    if (record && slotsReply) {
                        const latest = {
                            RP3: activeFws.find(fw => fw.cameraVariant === 'RP3') ?? null,
                            HM0360: activeFws.find(fw => fw.cameraVariant === 'HM0360') ?? null,
                        }
                        const { recordStatus } = classifyHimax({ current: currentVersion, slots: slotsReply, record, latest })
                        if (recordStatus === 'finished' || recordStatus === 'stale') {
                            await himaxUpdateRecord.clear(device.id)
                            record = null
                        }
                    }
                    if (!cancelled) setUpdateRecord(record)
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
                // The AI processor emits 'Wake <utc>' EVERY time it wakes -
                // including when woken for the SD-card transfer. advancePhase is
                // forward-only and 'waking' sits after 'transferring', so an early
                // Wake used to leapfrog the phase and block
                // advancePhase('transferring'), hiding transfer progress for the
                // whole upload. Only the wake following the flash command
                // ('sending') is the one this phase describes.
                if (phaseRef.current === 'sending') {
                    advancePhase('waking')
                }
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

    // ── Himax flash elapsed clock ──────────────────────────────────
    // Ticks once a second while the flash command is in flight (waking /
    // flashing), driving the "(m:ss elapsed)" suffix on the status label.
    useEffect(() => {
        if (target !== 'himax' || !isUpdating || (phase !== 'waking' && phase !== 'flashing')) return
        const id = setInterval(() => {
            if (flashStartRef.current !== null && !unmountedRef.current) {
                setFlashElapsedSec(Math.floor((Date.now() - flashStartRef.current) / 1000))
            }
        }, 1000)
        return () => clearInterval(id)
    }, [target, isUpdating, phase])


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
     * `AI ver` and `AI slots`. A `slots` that fails reads as null, as on
     * firmware without the command, unless `strict`, when it throws.
     */
    const readCamera = useCallback(async (strict = false): Promise<CameraReading> => {
        const session = createBleSession(device!)
        let version: string | null = null
        try {
            version = await session.execute(() => commandRegistry.aiver())
        } catch (e) {
            logWarn('[FW Update] AI ver query failed:', e)
        }
        let slots: SlotsReply | null = null
        try {
            slots = await session.execute(() => commandRegistry.slots())
        } catch (e) {
            if (strict) throw e
            logWarn('[FW Update] slots query failed (older firmware?):', e)
        }
        return { version, slots }
    }, [device])

    /**
     * Restart the AI processor into the slot its selector names and wait for
     * it, sending nothing meanwhile, since every command restarts the timer to
     * the sleep the restart waits for. `AI reset` restarts it at its next
     * sleep, a cold boot that labels the slot, and `AI dpd` brings that sleep
     * forward, as the Device Check does. Firmware without `dpd` sleeps on op8.
     */
    const restartCamera = useCallback(async (passLabel: string) => {
        const session = createBleSession(device!)
        try {
            await session.execute(() => commandRegistry.aireset())
        } catch (e) {
            logWarn('[FW Update] AI reset command error/timeout (may be expected):', e)
        }
        try {
            await session.execute(() => commandRegistry.aidpd())
        } catch (e) {
            logWarn('[FW Update] AI dpd failed, waiting for the sleep timer:', e)
        }
        appendLog(`${passLabel}Waiting for AI processor to reboot...`)
        const restarted = (await session.waitForSleep(RESTART_SLEEP_WAIT_MS)) && (await session.waitForWake(RESTART_WAKE_WAIT_MS))
        if (!restarted) logWarn('[FW Update] No restart seen after AI reset and AI dpd')
    }, [device, appendLog])

    /**
     * The check before each `AI firmware` (#374). `firmware` writes the slot
     * opposite the selector and moves the selector to it, so until the camera
     * restarts, a second write lands on the slot it is running from. The
     * camera must run the image in its selected slot and, after an image of
     * this update, that image's camera. If not, it is restarted once, and if
     * still not, the update stops. Resolves 'installed' when the camera
     * already runs `image`, a retried pass whose write landed, so that image
     * is not written over the other camera's slot as well.
     */
    const checkBeforeWrite = useCallback(async (
        image: { variant: CameraVariant; version: string } | null,
        expectRunning: CameraVariant | null,
        passLabel: string,
    ): Promise<'ready' | 'installed'> => {
        const judge = ({ version, slots }: CameraReading): 'ready' | 'installed' | null => {
            if (!slots || !isRunningFromSelectedSlot(slots)) return null
            const running = parseVariant(slots.running)
            if (image && running === image.variant && !!version && version.trim() === image.version.trim()) return 'installed'
            return !expectRunning || running === expectRunning ? 'ready' : null
        }
        const before = judge(await readCamera(true))
        if (before) return before
        appendLog(`${passLabel}The camera is not running its new image yet. Restarting it before anything is written...`)
        await restartCamera(passLabel)
        const after = judge(await readCamera(true))
        if (after) return after
        throw new Error(NOT_RESTARTED)
    }, [readCamera, restartCamera, appendLog])

    /**
     * Flash a single Himax firmware image (one A/B slot) and wait for the
     * device to reset into it. The caller decides which image(s) and in
     * which order - see runHimaxUpdate. `record` saves the update's progress
     * just before the flash command and after its OK.
     */
    const flashHimaxImage = useCallback(async (
        source: HimaxFirmwareSource,
        fwToFlash: Firmware | null,
        filenameToFlash: string,
        passLabel: string,
        record?: { beforeFlash: () => Promise<void>; afterFlash: () => Promise<void> },
    ) => {
        if (!device?.connected) throw new Error('Device disconnected.')

        if (!unmountedRef.current) setPassImage({ filename: filenameToFlash, locationPath: fwToFlash?.locationPath || null })

        const session = createBleSession(device)

        // Download the release image from the cloud and stream it to the SD
        // card, returning the CRC the app computed over the bytes it sent. Used
        // both for an explicit 'download' and as the fallback when the card
        // already holds a file of the right name but the wrong bytes.
        const downloadTransferAndGetCrc = async (): Promise<string | undefined> => {
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
            // Clear the previous pass's progress so the transfer card starts
            // fresh for image 2 of a dual-camera update
            if (!unmountedRef.current) setFileTransferProgress(null)
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
                // Transfer done - drop the progress card (presence == in flight;
                // on failure the pipeline throws and the failed card stays up)
                if (!unmountedRef.current) setFileTransferProgress(null)
            } else {
                throw new Error('Failed to read firmware bytes')
            }

            return computedCrc
        }

        // CRC to hand the device's `AI firmware` command: the one the app
        // computed over a fresh transfer, or the release's recorded CRC when we
        // flash a file that is already on the card.
        let crcForFlash: string | undefined

        if (source === 'download') {
            crcForFlash = await downloadTransferAndGetCrc()
        } else {
            // Source is 'sdcard' — verify the file already on the card before
            // anything touches flash.
            //
            // The card copy is trusted on filename alone: `dir` finds
            // R6905142.IMG and the screen offers it as "on SD card". A file of
            // that name whose bytes are wrong, truncated by an interrupted
            // transfer, or left by an older build, would otherwise be flashed
            // as if it were the real image. The transfer path has a whole-file
            // CRC; this path reads the device's `crc` and compares.
            const targetCrc = fwToFlash?.crcChecksum || undefined
            let onCard: { crc: string; sizeBytes: number } | null = null
            try {
                onCard = await session.execute(() => commandRegistry.crc(filenameToFlash))
                appendLog(`${passLabel}File on card: ${onCard.crc}, ${onCard.sizeBytes.toLocaleString()} bytes`)
            } catch (e: any) {
                // Older firmware has no `crc` command. Not fatal: the device
                // still checks the CRC itself when we pass one below.
                logWarn('[FW Update] could not read the card file CRC:', e)
                appendLog(`${passLabel}Could not read the file's CRC from the card`)
            }

            // A matching name is not matching bytes. Compare what is on the card
            // against the release; a difference is recoverable, not fatal.
            let mismatchReason: string | null = null
            if (targetCrc && onCard) {
                const expected = targetCrc.toUpperCase().startsWith('0X')
                    ? `0X${targetCrc.slice(2).toUpperCase().padStart(4, '0')}`
                    : `0X${targetCrc.toUpperCase().padStart(4, '0')}`
                const actual = onCard.crc.toUpperCase()
                if (actual !== expected) {
                    mismatchReason = `it is ${onCard.crc}, the release is ${targetCrc}`
                } else {
                    const expectedSize = fwToFlash?.fileSizeBytes
                    if (expectedSize && onCard.sizeBytes !== expectedSize) {
                        mismatchReason = `it is ${onCard.sizeBytes.toLocaleString()} bytes, the release is ${expectedSize.toLocaleString()} bytes`
                    }
                }
            }

            if (mismatchReason) {
                // The card holds a file of the right name but the wrong bytes
                // (an interrupted transfer, or an older build's image). Rather
                // than refuse the update, overwrite it with the correct copy
                // from the cloud — but only when we have a release record to
                // download (a bare SD-card filename has nothing to fetch).
                if (fwToFlash) {
                    appendLog(`${passLabel}The file on the SD card does not match the release (${mismatchReason}). Replacing it with the cloud copy.`)
                    // The phase machine is forward-only; rewind so the download
                    // and transfer phases show correctly (as the retry path does).
                    phaseRef.current = 'preflight'
                    if (!unmountedRef.current) setPhase('preflight')
                    crcForFlash = await downloadTransferAndGetCrc()
                } else {
                    const msg = `The file on the SD card does not match the release: ${mismatchReason}. Nothing was written, and there is no cloud copy to send — sync reference data and try again.`
                    appendLog(`${passLabel}${msg}`)
                    throw new Error(msg)
                }
            } else {
                if (targetCrc && onCard) {
                    appendLog(`${passLabel}Card file matches the release (${targetCrc}). Flashing.`)
                } else if (!targetCrc) {
                    // An SD-only file, or a release row with no CRC recorded. The
                    // device cannot verify what it is about to flash, and neither
                    // can we, so say so plainly rather than let it look checked.
                    appendLog(`${passLabel}No CRC to check this file against, so it is being flashed unverified`)
                }
                crcForFlash = targetCrc
            }
        }

        // Flash the image now on the card (freshly transferred, or verified in
        // place). The device's `AI firmware <name> 0xCRC` refuses to touch flash
        // on a CRC mismatch — the last line of defence.
        advancePhase('sending')
        appendLog(`${passLabel}Sending firmware flash command...`)

        // The device reports nothing over BLE while it erases/writes flash
        // (its progress prints go to the local UART console only); the next
        // line we receive is the final "Firmware update OK/FAILED", minutes
        // later. Start the elapsed clock and advance to 'flashing' after a
        // short grace so the UI never sits frozen on "waking up".
        await record?.beforeFlash()
        flashStartRef.current = Date.now()
        setFlashElapsedSec(0)
        const flashPhaseTimer = setTimeout(() => advancePhase('flashing'), 8000)
        try {
            await session.execute(() => commandRegistry.aifirmware(filenameToFlash, crcForFlash))
        } finally {
            clearTimeout(flashPhaseTimer)
            flashStartRef.current = null
        }
        await record?.afterFlash()

        if (unmountedRef.current) return

        appendLog(`${passLabel}Firmware write complete. Waiting for device to sleep...`)

        // Wait for the Himax to finish and send Sleep signal
        await session.waitForSleep(5000)
        if (unmountedRef.current) return

        // `firmware` moves the boot selector and schedules nothing, so the
        // camera would start the new image at its next boot of any kind. The
        // reset makes that now, and a cold boot that labels the slot. A fixed
        // wait and `AI ver` polls used to follow, and the polls, restarting
        // the inactivity timer, could hold the restart off (#374).
        advancePhase('rebooting')
        appendLog(`${passLabel}Sending AI reset to boot the new image...`)
        await restartCamera(passLabel)
    }, [device, advancePhase, appendLog, restartCamera])

    /**
     * Poll the AI processor with a light command until it responds, or the
     * timeout elapses. Used before a pass is retried after a transient error:
     * a dropped session ("Session Reset" from bleTransport.clearAll) needs the
     * device answering again before the next command. Not between passes,
     * where the polls restart the inactivity timer the restart waits for.
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
     * An update this phone left unfinished is finished instead (#374): it
     * ends on the camera that update started on, and writes only what is
     * left, see `planPair`. Its progress is saved before each write, see
     * `services/himaxUpdateRecord.ts`.
     *
     * Falls back to the single-image flow when variant-labelled records are
     * not available (legacy firmware database) or when an explicit SD-card
     * filename is given.
     */
    const runHimaxUpdate = useCallback(async (source: HimaxFirmwareSource = 'sdcard', selectedFirmware?: Firmware | string) => {
        if (!device?.connected) throw new Error('Device disconnected.')

        // `endVariant`, when known, is the camera the update must leave
        // running: it is restarted once more if not, and the update fails if
        // it still is not. Once it is, the saved record is done with.
        const verifyAndComplete = async (endVariant: HimaxVariant | null) => {
            if (unmountedRef.current) return
            advancePhase('verifying')
            appendLog('Checking new AI firmware version...')
            const onEndCamera = ({ slots }: CameraReading) =>
                !!slots && parseVariant(slots.running) === endVariant && isRunningFromSelectedSlot(slots)
            let reading = await readCamera()
            if (endVariant && reading.slots && !onEndCamera(reading)) {
                appendLog(`The camera is not running the ${endVariant} image yet. Restarting it...`)
                await restartCamera('')
                reading = await readCamera()
                if (!onEndCamera(reading)) throw new Error(NOT_RESTARTED)
            }
            if (reading.version) {
                if (!unmountedRef.current) setNewVersion(reading.version)
                appendLog(`New version: ${reading.version}`)
            }
            if (reading.slots) {
                // Which camera image the device finished on, so the success
                // banner can say "now running ..." with confidence.
                const running = parseVariant(reading.slots.running)
                if (!unmountedRef.current && running !== 'unknown') setRunningVariant(running)
                if (endVariant && onEndCamera(reading)) {
                    await himaxUpdateRecord.clear(device.id)
                    log(`[FW Update] Update finished on the ${endVariant} camera; pending update cleared`)
                }
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

        advancePhase('preflight')

        // Explicit SD-card filename: single-pass legacy behaviour (the variant
        // cannot be known from a bare filename)
        if (typeof selectedFirmware === 'string') {
            if (!unmountedRef.current) setPairProgress({ total: 1, done: 0 })
            if ((await readCamera()).slots) await checkBeforeWrite(null, null, '')
            await flashHimaxImage(source, null, selectedFirmware, '')
            if (!unmountedRef.current) setPairProgress({ total: 1, done: 1 })
            await verifyAndComplete(null)
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

        const byVariant = {
            RP3: pair.find(fw => fw.cameraVariant === 'RP3') ?? null,
            HM0360: pair.find(fw => fw.cameraVariant === 'HM0360') ?? null,
        }
        const isPair = pair.length === 2 && !!byVariant.RP3 && !!byVariant.HM0360

        // Older firmware has no `slots`: the order then decides nothing about
        // correctness, only which camera ends up active, and nothing is
        // checked before a write or saved for a finish
        let reading = await readCamera()
        const slotsSupported = !!reading.slots

        // An update this phone left unfinished. One the camera shows finished,
        // or never reached, is dropped; a pending one is finished, below.
        let record = isPair && reading.slots ? await himaxUpdateRecord.load(device.id) : null
        const settleRecord = async () => {
            if (!record || !reading.slots) return null
            const { recordStatus } = classifyHimax({ current: reading.version, slots: reading.slots, record, latest: byVariant })
            if (recordStatus === 'finished' || recordStatus === 'stale') {
                await himaxUpdateRecord.clear(device.id)
                record = null
            }
            return recordStatus
        }
        const finishingTo = (await settleRecord()) === 'pending' ? record?.endVariant ?? null : null

        if (reading.slots && (finishingTo || !isRunningFromSelectedSlot(reading.slots))) {
            // A camera an update left part way may still run its previous
            // image while the selector names the new one. Restart it into the
            // selected slot before working out what is left to write.
            appendLog(finishingTo
                ? 'Finishing the last update. Restarting the camera first...'
                : 'The camera is not running from its selected slot. Restarting it first...')
            await restartCamera('')
            reading = await readCamera()
            if (!reading.slots || !isRunningFromSelectedSlot(reading.slots)) throw new Error(NOT_RESTARTED)
            if (finishingTo && (await settleRecord()) === 'finished') {
                // The restart was all it lacked
                if (!unmountedRef.current) setPairProgress({ total: 2, done: 2 })
                await verifyAndComplete(finishingTo)
                return
            }
        }

        // The camera the update ends on: the one an unfinished update started
        // on, else the one running now. Each flash switches the device to the
        // newly-written slot, so the OTHER camera's image goes first and this
        // one's last, and an image the camera already runs is not written again.
        const running = reading.slots ? parseVariant(reading.slots.running) : 'unknown'
        const endVariant: HimaxVariant | null = isPair
            ? record?.endVariant ?? (running !== 'unknown' ? running : null)
            : null
        let plan = pair
        if (pair.length === 1) {
            appendLog('Only one camera variant available - single-image update')
        } else {
            appendLog(`Device is running the ${running} camera image`)
            if (endVariant) plan = planPair(endVariant, reading.slots, reading.version, byVariant)
        }
        const total = pair.length
        const skipped = total - plan.length

        // What the record saves before each write; none without `slots`, since
        // it could not say which camera to end on
        const recordBase = endVariant && reading.slots ? {
            startedAt: record?.startedAt ?? new Date().toISOString(),
            endVariant,
            startActiveSlot: record ? record.startActiveSlot : reading.slots.activeSlot,
            startVersion: record ? record.startVersion : reading.version,
            images: [byVariant[otherCamera(endVariant)]!, byVariant[endVariant]!].map(fw => ({
                variant: fw.cameraVariant as HimaxVariant,
                version: fw.version,
                filename: firmware83Filename(fw.version, fw.buildDate, fw.cameraVariant),
            })),
        } : null

        if (!unmountedRef.current) setPairProgress({ total, done: skipped })

        // Errors from a transient link drop (the AI reset between passes tears
        // the BLE session down) - retried once after re-establishing contact.
        const TRANSIENT_ERROR = /Session Reset|DEVICE_DISCONNECTED|time.?out/i

        for (let i = 0; i < plan.length; i++) {
            const fw = plan[i]
            // This image's place in the pair: a finish starts at image 2
            const n = skipped + i
            const passLabel = total === 2
                ? `[${n + 1}/2 ${fw.cameraVariant ?? 'unknown'}] `
                : ''
            const filename = firmware83Filename(fw.version, fw.buildDate, fw.cameraVariant)
            const saveRecord = (sent: number, flashed: number) =>
                recordBase ? himaxUpdateRecord.save(device.id, { ...recordBase, sent, flashed }) : Promise.resolve()
            // The camera the write must find running: the image this update
            // wrote before it, or for a finish, the other camera's image the
            // last update left it on
            const expectRunning: CameraVariant | null = i > 0
                ? parseVariant(plan[i - 1].cameraVariant ?? undefined)
                : (skipped > 0 && endVariant ? otherCamera(endVariant) : null)

            // Update the completed-pass count BEFORE the boundary wait/phase
            // rewind, so the overall progress bar never runs backwards at the
            // pass boundary (it jumps from ~41% to 51%, not down to ~10%).
            if (!unmountedRef.current) setPairProgress({ total, done: n })

            if (i > 0) {
                // The phase machine is forward-only within a pass; rewind it for
                // the second image so downloading/transferring show correctly
                phaseRef.current = 'preflight'
                if (!unmountedRef.current) setPhase('preflight')
                appendLog(`Starting second image (${fw.cameraVariant ?? 'unknown'})...`)
            }

            const runPass = async () => {
                if (slotsSupported) {
                    if (!unmountedRef.current) setInterPassWait(n > 0)
                    let check: 'ready' | 'installed'
                    try {
                        check = await checkBeforeWrite(
                            { variant: parseVariant(fw.cameraVariant ?? undefined), version: fw.version }, expectRunning, passLabel)
                    } finally {
                        if (!unmountedRef.current) setInterPassWait(false)
                    }
                    if (check === 'installed') {
                        appendLog(`${passLabel}The camera already runs this image.`)
                        await saveRecord(n + 1, n + 1)
                        return
                    }
                }
                await flashHimaxImage(source, fw, filename, passLabel, {
                    beforeFlash: () => saveRecord(n + 1, n),
                    afterFlash: () => saveRecord(n + 1, n + 1),
                })
            }

            try {
                await runPass()
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
                await runPass()
            }
            if (unmountedRef.current) return
        }

        if (!unmountedRef.current) setPairProgress({ total, done: total })

        await verifyAndComplete(endVariant)
    }, [device, latestFirmware, advancePhase, appendLog, flashHimaxImage, waitForAiReady, readCamera, restartCamera, checkBeforeWrite])

    // ── Public start ───────────────────────────────────────────────

    const startUpdate = useCallback(async (options?: StartUpdateOptions) => {
        setIsUpdating(true)
        setErrorMsg(null)
        setNewVersion(null)
        setProgressLogs([])
        setDfuProgress(0)
        setFileTransferProgress(null)
        setPassImage(null)
        setDownloadProgress(null)
        setDownloadState('idle')
        setPairProgress(null)
        setInterPassWait(false)
        phaseRef.current = 'idle'
        setPhase('idle')
        
        abortControllerRef.current = new AbortController()

        // Mark DFU in progress so the disconnect banner is suppressed
        if (device?.id) dispatch(setDfuStatus({ id: device.id, status: true }))
        // The offline pre-download must not delete the image this update reads
        const releaseCache = FirmwareService.holdCache()

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
            releaseCache()
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
    // While the Himax writes flash the phone hears nothing over BLE — show a
    // ticking elapsed clock so the long quiet window reads as work, not a hang.
    if (target === 'himax' && isUpdating && (phase === 'waking' || phase === 'flashing') && flashElapsedSec > 0) {
        const mm = Math.floor(flashElapsedSec / 60)
        const ss = String(flashElapsedSec % 60).padStart(2, '0')
        statusLabel = `${statusLabel} (${mm}:${ss} elapsed)`
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
        passImage,

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
        cameraSlots,
        updateRecord,
        pairProgress,

        // Actions
        startUpdate,
        cancelUpdate,
    }
}
