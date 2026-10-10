import { useState, useCallback, useEffect, useRef } from 'react'

import { createBleSession } from '../../../ble/session/createBleSession'
import { commandRegistry } from '../../../ble/protocol/commandRegistry'
import ReferenceDataService from '../../../services/ReferenceDataService'
import Firmware from '../../../database/models/Firmware'
import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { himaxStatus, himaxVersionOf } from '../../../services/himaxStatus'
import { HimaxVariant, SlotsReply } from '../../../utils/himaxFirmwareState'
import { logError, logWarn } from '../../../utils/logger'
import { convertBleToSemanticVersion } from '../../../utils/versionUtils'

// ────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────

export interface FirmwareComponentStatus {
    type: 'ble' | 'himax'
    currentVersion: string | null
    latestVersion: string | null
    latestFirmware: Firmware | null
    isOutdated: boolean
    /** Himax only: latest active firmware per camera variant (dual-image devices) */
    variants?: { RP3: Firmware | null; HM0360: Firmware | null }
    /**
     * Himax only: the camera whose build the catalogue lacks, set when the
     * device is behind the one build there is. Neither outdated nor up to
     * date: the update installs both images, so it waits for this one (#437)
     */
    missingVariant?: 'RP3' | 'HM0360' | null
    /**
     * Himax only: an update this phone ran stopped part way, so the camera may
     * be on the other camera's image (#374). Counts as outdated.
     */
    unfinished?: { endVariant: HimaxVariant; done: number; total: number } | null
}

interface UseFirmwareStatusOptions {
    device: ExtendedPeripheral | undefined
    initialBleVersion?: string | null
    initialHimaxVersion?: string | null
}

export interface UseFirmwareStatusReturn {
    isChecking: boolean
    lastChecked: Date | null
    statuses: Record<'ble' | 'himax', FirmwareComponentStatus>
    checkStatus: () => Promise<void>
    errorMsg: string | null
}

export function useFirmwareStatus({ device, initialBleVersion, initialHimaxVersion }: UseFirmwareStatusOptions): UseFirmwareStatusReturn {
    const [isChecking, setIsChecking] = useState(false)
    const [lastChecked, setLastChecked] = useState<Date | null>(null)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)

    const [statuses, setStatuses] = useState<Record<'ble' | 'himax', FirmwareComponentStatus>>({
        ble: { type: 'ble', currentVersion: initialBleVersion || null, latestVersion: null, latestFirmware: null, isOutdated: false },
        himax: { type: 'himax', currentVersion: initialHimaxVersion || null, latestVersion: null, latestFirmware: null, isOutdated: false },
    })

    const isMounted = useRef(true)
    const hasRunActiveCheck = useRef(false)
    useEffect(() => {
        isMounted.current = true
        return () => { isMounted.current = false }
    }, [])

    const checkStatus = useCallback(async () => {
        if (!device?.connected) {
            // Never a silent no-op: this left the screen on its spinner forever
            // when the device slept/disconnected before the check ran
            setErrorMsg('Device not connected - wake it, reconnect via the scanner, then pull to refresh.')
            return
        }

        setIsChecking(true)
        setErrorMsg(null)
        hasRunActiveCheck.current = true

        // Overall deadline: a hung network fetch or a BLE query whose response
        // was lost previously left the screen on a spinner indefinitely
        let deadlineTimer: ReturnType<typeof setTimeout> | undefined
        let timedOut = false
        const deadline = new Promise<never>((_, reject) => {
            deadlineTimer = setTimeout(() => {
                timedOut = true
                reject(new Error(
                    'Firmware status check timed out - the device may have gone to sleep. Wake it and pull to refresh.'))
            }, 30000)
        })
        // The losing branch of the race keeps running: guard its state writes
        // behind timedOut (a late success must not clobber the declared error)
        // and swallow its late rejection (already reported via the race).
        const work = (async () => {
            // 1. Fetch Latest Cloud Versions
            const latestBle = await ReferenceDataService.getLatestFirmware('ble')
            const latestHimax = await ReferenceDataService.getLatestFirmware('himax')
            // Dual-image devices hold one firmware per camera variant
            const latestRp3 = await ReferenceDataService.getLatestHimaxByVariant('RP3')
            const latestHm0360 = await ReferenceDataService.getLatestHimaxByVariant('HM0360')

            let currentBleVersion: string | null = null
            let currentHimaxVersion: string | null = null
            
            // 2. Query Device Versions via BLE
            const session = createBleSession(device)
            try {
                // Device `version` typically returns something like "V0.2.0"
                const rawBleVer = await session.execute(() => commandRegistry.version())
                currentBleVersion = convertBleToSemanticVersion(rawBleVer as string)
            } catch (e) {
                logWarn('[FirmwareStatus] Failed to read BLE version:', e)
            }

            try {
                // Query Himax version. The nRF wakes the Himax for any `AI` command,
                // so no separate wake is needed; `aiver` already allows for the
                // DPD wake in its timeout.
                const rawHimaxVer = await session.execute(() => commandRegistry.aiver()) as string
                currentHimaxVersion = himaxVersionOf(rawHimaxVer)
            } catch (e) {
                logWarn('[FirmwareStatus] Failed to read Himax version:', e)
            }

            // Which camera is running, to compare with that camera's build,
            // and whether it runs from the slot that boots next (#374)
            let slots: SlotsReply | null = null
            try {
                slots = await session.execute(() => commandRegistry.slots())
            } catch (e) {
                logWarn('[FirmwareStatus] Failed to read the AI slots (older firmware?):', e)
            }

            if (!isMounted.current || timedOut) return

            // 3. Compute Outdated Flags (himax: per camera, and an unfinished update, see himaxStatus)
            const bleOutdated = !!latestBle?.version && currentBleVersion !== latestBle.version
            const himaxState = await himaxStatus(device.id, currentHimaxVersion, slots,
                { RP3: latestRp3, HM0360: latestHm0360, any: latestHimax })

            if (!isMounted.current || timedOut) return

            setStatuses({
                ble: {
                    type: 'ble',
                    currentVersion: currentBleVersion || 'Unknown',
                    latestVersion: latestBle?.version || 'Unknown',
                    latestFirmware: latestBle,
                    isOutdated: bleOutdated,
                },
                himax: {
                    type: 'himax',
                    currentVersion: currentHimaxVersion || 'Unknown',
                    latestVersion: latestHimax?.version || 'Unknown',
                    latestFirmware: latestHimax,
                    variants: { RP3: latestRp3, HM0360: latestHm0360 },
                    ...himaxState,
                },
            })

            setLastChecked(new Date())
        })()
        work.catch(() => {})
        try {
            await Promise.race([deadline, work])

        } catch (error) {
            if (!isMounted.current) return
            const msg = error instanceof Error ? error.message : String(error)
            logError('[FirmwareStatus] Check failed:', error)
            setErrorMsg(msg)
        } finally {
            clearTimeout(deadlineTimer)
            if (isMounted.current) {
                setIsChecking(false)
            }
        }
    }, [device?.id, device?.connected]) // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-check on mount or connection
    useEffect(() => {
        if (device?.connected) {
            if (hasRunActiveCheck.current) {
                // If we've already done an active check, re-check actively on reconnect rather than silently with old cached params
                checkStatus()
                return
            }
            if (initialBleVersion && initialHimaxVersion) {
                // Perform a silent, cloud-only version metadata check
                const checkSilent = async () => {
                    setIsChecking(true)
                    setErrorMsg(null)
                    try {
                        const latestBle = await ReferenceDataService.getLatestFirmware('ble')
                        const latestHimax = await ReferenceDataService.getLatestFirmware('himax')
                        const latestRp3 = await ReferenceDataService.getLatestHimaxByVariant('RP3')
                        const latestHm0360 = await ReferenceDataService.getLatestHimaxByVariant('HM0360')

                        const currentBleVersion = convertBleToSemanticVersion(initialBleVersion)
                        const currentHimaxVersion = himaxVersionOf(initialHimaxVersion)

                        const bleOutdated = !!latestBle?.version && currentBleVersion !== latestBle.version
                        // No `slots` here: this path sends nothing (#268)
                        const himaxState = await himaxStatus(device.id, currentHimaxVersion, null,
                            { RP3: latestRp3, HM0360: latestHm0360, any: latestHimax })

                        if (!isMounted.current) return

                        // The snapshot was read by this connection seconds ago, so
                        // it is the device's answer. Re-querying "to be sure" sent
                        // ver, AI info and AI ver a second time on every connect
                        // and woke the Himax again (#268). The screen re-checks
                        // actively on focus return after a firmware update, which
                        // is the one case where the snapshot is stale.
                        setStatuses({
                            ble: {
                                type: 'ble',
                                currentVersion: currentBleVersion || 'Unknown',
                                latestVersion: latestBle?.version || 'Unknown',
                                latestFirmware: latestBle,
                                isOutdated: bleOutdated,
                            },
                            himax: {
                                type: 'himax',
                                currentVersion: currentHimaxVersion || 'Unknown',
                                latestVersion: latestHimax?.version || 'Unknown',
                                latestFirmware: latestHimax,
                                variants: { RP3: latestRp3, HM0360: latestHm0360 },
                                ...himaxState,
                            },
                        })
                        setLastChecked(new Date())
                    } catch (error) {
                        if (!isMounted.current) return
                        logError('[FirmwareStatus] Silent check failed:', error)
                    } finally {
                        if (isMounted.current) {
                            setIsChecking(false)
                        }
                    }
                }
                checkSilent()
            } else {
                checkStatus()
            }
        }
    }, [device?.connected, device?.id, checkStatus, initialBleVersion, initialHimaxVersion])

    return {
        isChecking,
        lastChecked,
        statuses,
        checkStatus,
        errorMsg,
    }
}
