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
    useEffect(() => {
        isMounted.current = true
        return () => { isMounted.current = false }
    }, [])

    const checkStatus = useCallback(async () => {
        if (!device?.connected) return

        setIsChecking(true)
        setErrorMsg(null)

        try {
            // 1. Fetch Latest Cloud Versions
            const latestBle = await ReferenceDataService.getLatestFirmware('ble')
            const latestHimax = await ReferenceDataService.getLatestFirmware('himax')

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
                // Wake up AI then ask version
                const rawHimaxVer = await session.execute(() => commandRegistry.aiver()) as string
                // Himax sometimes returns things like "AI ver: 1.0.0" or "Firmware version: V1.2.0"
                // Extracting just the version string cleanly.
                const match = rawHimaxVer.match(/(?:V|v)?(\d+\.\d+\.\d+)/)
                currentHimaxVersion = match ? `v${match[1]}` : rawHimaxVer
            } catch (e) {
                logWarn('[FirmwareStatus] Failed to read Himax version:', e)
            }

            if (!isMounted.current) return

            // 3. Compute Outdated Flags
            const bleOutdated = !!latestBle?.version && currentBleVersion !== latestBle.version
            const himaxOutdated = !!latestHimax?.version && currentHimaxVersion !== latestHimax.version

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
                },
            })

            setLastChecked(new Date())

        } catch (error) {
            if (!isMounted.current) return
            const msg = error instanceof Error ? error.message : String(error)
            logError('[FirmwareStatus] Check failed:', error)
            setErrorMsg(msg)
        } finally {
            if (isMounted.current) {
                setIsChecking(false)
            }
        }
    }, [device?.id, device?.connected]) // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-check on mount or connection
    useEffect(() => {
        if (device?.connected) {
            if (initialBleVersion && initialHimaxVersion) {
                // Perform a silent, cloud-only version metadata check
                const checkSilent = async () => {
                    setIsChecking(true)
                    setErrorMsg(null)
                    try {
                        const latestBle = await ReferenceDataService.getLatestFirmware('ble')
                        const latestHimax = await ReferenceDataService.getLatestFirmware('himax')

                        const currentBleVersion = convertBleToSemanticVersion(initialBleVersion)
                        const rawHimaxVer = initialHimaxVersion
                        const match = rawHimaxVer.match(/(?:V|v)?(\d+\.\d+\.\d+)/)
                        const currentHimaxVersion = match ? `v${match[1]}` : rawHimaxVer

                        const bleOutdated = !!latestBle?.version && currentBleVersion !== latestBle.version
                        const himaxOutdated = !!latestHimax?.version && currentHimaxVersion !== latestHimax.version

                        if (!isMounted.current) return

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
