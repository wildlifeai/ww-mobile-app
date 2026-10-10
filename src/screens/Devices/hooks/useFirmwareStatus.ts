import { useState, useCallback, useEffect, useRef } from 'react'

import { createBleSession } from '../../../ble/session/createBleSession'
import { commandRegistry } from '../../../ble/protocol/commandRegistry'
import ReferenceDataService from '../../../services/ReferenceDataService'
import Firmware from '../../../database/models/Firmware'
import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
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

/**
 * Dual-image aware outdated check, the same rule as the update screen's
 * `deviceUpToDate`. RP3 and HM0360 builds carry different version strings and
 * the device only runs one of them, so it is up to date when its version
 * matches EITHER variant's latest. Comparing against the single newest
 * 'himax' row flagged "outdated" whenever the newest upload happened to be
 * the other camera's build. An unknown current version is not outdated
 * (unknown is not actionable, so the card should not cry wolf).
 *
 * The update installs both images or neither, so a catalogue holding one
 * camera's build only has nothing to update to: a cloud dev deploy resets the
 * database and the builds come back one camera at a time, and elsewhere one
 * camera's upload can fail or be late. A device behind that build is then not
 * outdated, and `missingVariant` names the camera it waits for (#437).
 */
export const himaxUpdateState = (
    current: string | null,
    latestRp3: Firmware | null,
    latestHm0360: Firmware | null,
    latestGeneric: Firmware | null,
): { isOutdated: boolean; missingVariant: 'RP3' | 'HM0360' | null } => {
    if (!current) return { isOutdated: false, missingVariant: null }
    const cur = current.trim()
    const variantVersions = [latestRp3?.version?.trim(), latestHm0360?.version?.trim()]
        .filter((v): v is string => !!v)
    if (variantVersions.length > 0) {
        if (variantVersions.includes(cur)) return { isOutdated: false, missingVariant: null }
        const missingVariant = !latestRp3 ? 'RP3' : !latestHm0360 ? 'HM0360' : null
        return { isOutdated: !missingVariant, missingVariant }
    }
    return { isOutdated: !!latestGeneric?.version && cur !== latestGeneric.version.trim(), missingVariant: null }
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
                // Himax sometimes returns things like "AI ver: 1.0.0" or "Firmware version: V1.2.0"
                // Extracting just the version string cleanly.
                const match = rawHimaxVer.match(/(?:V|v)?(\d+\.\d+\.\d+)/)
                currentHimaxVersion = match ? `v${match[1]}` : rawHimaxVer
            } catch (e) {
                logWarn('[FirmwareStatus] Failed to read Himax version:', e)
            }

            if (!isMounted.current || timedOut) return

            // 3. Compute Outdated Flags (himax: variant-aware, see himaxUpdateState)
            const bleOutdated = !!latestBle?.version && currentBleVersion !== latestBle.version
            const himaxState = himaxUpdateState(currentHimaxVersion, latestRp3, latestHm0360, latestHimax)

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
                    isOutdated: himaxState.isOutdated,
                    variants: { RP3: latestRp3, HM0360: latestHm0360 },
                    missingVariant: himaxState.missingVariant,
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
                        const rawHimaxVer = initialHimaxVersion
                        const match = rawHimaxVer.match(/(?:V|v)?(\d+\.\d+\.\d+)/)
                        const currentHimaxVersion = match ? `v${match[1]}` : rawHimaxVer

                        const bleOutdated = !!latestBle?.version && currentBleVersion !== latestBle.version
                        const himaxState = himaxUpdateState(currentHimaxVersion, latestRp3, latestHm0360, latestHimax)

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
                                isOutdated: himaxState.isOutdated,
                                variants: { RP3: latestRp3, HM0360: latestHm0360 },
                                missingVariant: himaxState.missingVariant,
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
    }, [device?.connected, checkStatus, initialBleVersion, initialHimaxVersion])

    return {
        isChecking,
        lastChecked,
        statuses,
        checkStatus,
        errorMsg,
    }
}
