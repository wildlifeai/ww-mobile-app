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
 * Dual-image aware outdated check — the same rule as the update screen's
 * `deviceUpToDate`. RP3 and HM0360 builds carry different version strings and
 * the device only runs one of them, so it is up to date when its version
 * matches EITHER variant's latest. Comparing against the single newest
 * 'himax' row flagged "outdated" whenever the newest upload happened to be
 * the other camera's build. An unknown current version is not outdated
 * (unknown is not actionable — the card should not cry wolf).
 */
const isHimaxOutdated = (
    current: string | null,
    latestRp3: Firmware | null,
    latestHm0360: Firmware | null,
    latestGeneric: Firmware | null,
): boolean => {
    if (!current) return false
    const cur = current.trim()
    const variantVersions = [latestRp3?.version?.trim(), latestHm0360?.version?.trim()]
        .filter((v): v is string => !!v)
    if (variantVersions.length > 0) return !variantVersions.includes(cur)
    return !!latestGeneric?.version && cur !== latestGeneric.version.trim()
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
                // Wake up AI processor by querying aiinfo first (wakes from Deep Power Down)
                try {
                    await session.execute(() => commandRegistry.aiinfo())
                } catch (wakeError) {
                    logWarn('[FirmwareStatus] Failed to wake AI processor via aiinfo:', wakeError)
                }

                // Query Himax version
                const rawHimaxVer = await session.execute(() => commandRegistry.aiver()) as string
                // Himax sometimes returns things like "AI ver: 1.0.0" or "Firmware version: V1.2.0"
                // Extracting just the version string cleanly.
                const match = rawHimaxVer.match(/(?:V|v)?(\d+\.\d+\.\d+)/)
                currentHimaxVersion = match ? `v${match[1]}` : rawHimaxVer
            } catch (e) {
                logWarn('[FirmwareStatus] Failed to read Himax version:', e)
            }

            if (!isMounted.current || timedOut) return

            // 3. Compute Outdated Flags (himax: variant-aware, see isHimaxOutdated)
            const bleOutdated = !!latestBle?.version && currentBleVersion !== latestBle.version
            const himaxOutdated = isHimaxOutdated(currentHimaxVersion, latestRp3, latestHm0360, latestHimax)

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
                    isOutdated: himaxOutdated,
                    variants: { RP3: latestRp3, HM0360: latestHm0360 },
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
                        const himaxOutdated = isHimaxOutdated(currentHimaxVersion, latestRp3, latestHm0360, latestHimax)

                        if (!isMounted.current) return

                        // The initial versions are a connect-time snapshot — stale
                        // right after a firmware update. Never declare "outdated"
                        // from the snapshot alone: escalate to the active check
                        // (live `version`/`AI ver` queries) and let the device
                        // decide. Up-to-date verdicts stay silent and BLE-quiet.
                        if (bleOutdated || himaxOutdated) {
                            logWarn('[FirmwareStatus] Snapshot looks outdated — verifying against the live device')
                            await checkStatus()
                            return
                        }

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
                                isOutdated: himaxOutdated,
                                variants: { RP3: latestRp3, HM0360: latestHm0360 },
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
