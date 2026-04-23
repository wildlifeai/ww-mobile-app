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
    type: 'ble' | 'himax' | 'config'
    currentVersion: string | null
    latestVersion: string | null
    latestFirmware: Firmware | null
    isOutdated: boolean
}

interface UseFirmwareStatusOptions {
    device: ExtendedPeripheral | undefined
}

export interface UseFirmwareStatusReturn {
    isChecking: boolean
    lastChecked: Date | null
    statuses: Record<'ble' | 'himax' | 'config', FirmwareComponentStatus>
    checkStatus: () => Promise<void>
    errorMsg: string | null
}

export function useFirmwareStatus({ device }: UseFirmwareStatusOptions): UseFirmwareStatusReturn {
    const [isChecking, setIsChecking] = useState(false)
    const [lastChecked, setLastChecked] = useState<Date | null>(null)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)

    const [statuses, setStatuses] = useState<Record<'ble' | 'himax' | 'config', FirmwareComponentStatus>>({
        ble: { type: 'ble', currentVersion: null, latestVersion: null, latestFirmware: null, isOutdated: false },
        himax: { type: 'himax', currentVersion: null, latestVersion: null, latestFirmware: null, isOutdated: false },
        config: { type: 'config', currentVersion: null, latestVersion: null, latestFirmware: null, isOutdated: false },
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
            const latestConfig = await ReferenceDataService.getLatestFirmware('config')

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

            // Note: For Config, there is no `AI cfgver` command. The device cannot report its current 
            // CONFIG.TXT version. We treat it as "Unknown" locally, and it will be updated unconditionally
            // upon deployment start.

            if (!isMounted.current) return

            // 3. Compute Outdated Flags
            const bleOutdated = !!latestBle?.version && currentBleVersion !== latestBle.version
            const himaxOutdated = !!latestHimax?.version && currentHimaxVersion !== latestHimax.version
            // Config is always treated as potentially outdated unless the cloud has no latest version
            const configOutdated = !!latestConfig?.version

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
                config: {
                    type: 'config',
                    currentVersion: 'Unknown (Push-only)',
                    latestVersion: latestConfig?.version || 'Unknown',
                    latestFirmware: latestConfig,
                    isOutdated: configOutdated,
                }
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
    }, [device])

    // Auto-check on mount or connection
    useEffect(() => {
        if (device?.connected) {
            checkStatus()
        }
    }, [device?.connected, checkStatus])

    return {
        isChecking,
        lastChecked,
        statuses,
        checkStatus,
        errorMsg,
    }
}
