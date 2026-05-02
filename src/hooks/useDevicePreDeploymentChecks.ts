import { useCallback } from 'react'
import { ExtendedPeripheral } from '../redux/slices/devicesSlice'
import { useBleInitialization } from './useBleInitialization'
import { createBleSession } from '../ble/session/createBleSession'
import { commandRegistry } from '../ble/protocol/commandRegistry'
import ReferenceDataService from '../services/ReferenceDataService'
import { log, logWarn } from '../utils/logger'
import { convertBleToSemanticVersion } from '../utils/versionUtils'
import { InitPayload } from '../navigation/types'

export const useDevicePreDeploymentChecks = () => {
    const { initialize: runBleStandardInit } = useBleInitialization()

    const runChecks = useCallback(async (
        device: ExtendedPeripheral,
        onProgress: (step: string) => void
    ): Promise<InitPayload> => {
        const payload: InitPayload = {
            batteryLevel: null,
            sdCardStatus: null,
            deviceFirmwareVersion: null,
            himaxFirmwareVersion: null,
            bleFirmwareUpdateAvailable: false,
            initErrors: {}
        }

        onProgress('Initializing...')
        log('[Pre-Deployment] Running standard BLE initialization...')
        
        const initResult = await runBleStandardInit(device, {
            onProgress: (step) => onProgress(step)
        })

        const newErrors: { setUtc?: string; deviceHealth: string[] } = {
            setUtc: initResult.errors?.setUtc,
            deviceHealth: initResult.errors?.deviceHealth || []
        }

        const session = createBleSession(device)

        // 1. Battery Check
        try {
            onProgress('Checking battery...')
            const level = await session.execute(commandRegistry.battery)
            payload.batteryLevel = level
            if (level < 20) {
                newErrors.deviceHealth.push(`Battery is low (${level}%)`)
            }
        } catch (e) {
            logWarn('[Pre-Deployment] Battery check failed:', e)
        }

        // 2. SD Card Check
        try {
            onProgress('Checking SD card...')
            const sdStatus = await session.execute(commandRegistry.aiinfo)
            if (sdStatus.error) {
                 newErrors.deviceHealth.push('AI Processor check failed or SD card missing')
            } else if (sdStatus.total !== undefined && sdStatus.total > 0) {
                payload.sdCardStatus = sdStatus as any
                const percentFull = ((sdStatus.total - (sdStatus.free || 0)) / sdStatus.total) * 100
                if (percentFull > 90) {
                    newErrors.deviceHealth.push(`SD Card is almost full (${percentFull.toFixed(1)}% used)`)
                }
            } else {
                 newErrors.deviceHealth.push('No SD Card detected or total space is 0')
            }
        } catch (e) {
            logWarn('[Pre-Deployment] SD Card check failed:', e)
        }

        // 3. Firmware Check
        try {
            onProgress('Checking firmware...')
            const version = await session.execute(commandRegistry.version)
            payload.deviceFirmwareVersion = version
            const latest = await ReferenceDataService.getLatestFirmware('ble')
            const normalizedVersion = convertBleToSemanticVersion(version)
            if (latest && normalizedVersion !== latest.version) {
                payload.bleFirmwareUpdateAvailable = true
                newErrors.deviceHealth.push(`Newer firmware available: ${latest.version}`)
            }
        } catch (e) {
            logWarn('[Pre-Deployment] Firmware check failed:', e)
        }

        // 4. Himax (AI Processor) Firmware Check
        try {
            onProgress('Checking AI firmware...')
            const aiVersion = await session.execute(commandRegistry.aiver)
            payload.himaxFirmwareVersion = aiVersion
            log(`[Pre-Deployment] Himax firmware: ${aiVersion}`)
            const latestHimax = await ReferenceDataService.getLatestFirmware('himax')
            if (latestHimax && aiVersion && !aiVersion.includes(latestHimax.version)) {
                newErrors.deviceHealth.push(`Newer AI firmware available: ${latestHimax.version}`)
            }
        } catch (e) {
            logWarn('[Pre-Deployment] Himax firmware check failed:', e)
        }

        payload.initErrors = newErrors
        return payload

    }, [runBleStandardInit])

    return { runChecks }
}
