import { useCallback } from 'react'
import { ExtendedPeripheral } from '../redux/slices/devicesSlice'
import { useBleCommands } from './useBleCommands'
import { useBleInitialization } from './useBleInitialization'
import ReferenceDataService from '../services/ReferenceDataService'
import { extractErrorBits } from '../ble/messageClassifier'
import { COMMANDS, CommandNames } from '../ble/types'
import { log, logWarn } from '../utils/logger'
import { InitPayload } from '../navigation/types'

export const useDevicePreDeploymentChecks = () => {
    const { getBatteryLevel, checkSdCard, getDeviceVer, runSelfTest } = useBleCommands()
    const { initialize: runBleStandardInit } = useBleInitialization()

    const runChecks = useCallback(async (
        device: ExtendedPeripheral,
        onProgress: (step: string) => void
    ): Promise<InitPayload> => {
        const payload: InitPayload = {
            batteryLevel: null,
            sdCardStatus: null,
            deviceFirmwareVersion: null,
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

        // 1. Battery Check
        try {
            onProgress('Checking battery...')
            const batteryResponse = await getBatteryLevel(device)
            const batteryMatch = batteryResponse.match(COMMANDS[CommandNames.battery].readRegex!)
            if (batteryMatch) {
                const level = parseInt(batteryMatch[1], 10)
                payload.batteryLevel = level
                if (level < 20) {
                    newErrors.deviceHealth.push(`Battery is low (${level}%)`)
                }
            }
        } catch (e) {
            logWarn('[Pre-Deployment] Battery check failed:', e)
        }

        // 2. SD Card Check
        try {
            onProgress('Checking SD card...')
            const sdStatus = await checkSdCard(device)
            if (sdStatus && sdStatus.total > 0) {
                payload.sdCardStatus = sdStatus
                const percentFull = ((sdStatus.total - sdStatus.free) / sdStatus.total) * 100
                if (percentFull > 90) {
                    newErrors.deviceHealth.push(`SD Card is almost full (${percentFull.toFixed(1)}% used)`)
                }
            } else {
                const statusMsg = await runSelfTest(device)
                const hexBits = extractErrorBits(statusMsg)
                // eslint-disable-next-line no-bitwise
                if (hexBits && (parseInt(hexBits, 16) & 0x0800)) {
                    newErrors.deviceHealth.push('No SD Card detected')
                }
            }
        } catch (e) {
            logWarn('[Pre-Deployment] SD Card check failed:', e)
        }

        // 3. Firmware Check
        try {
            onProgress('Checking firmware...')
            const firmwareResponse = await getDeviceVer(device)
            const fwMatch = firmwareResponse.match(COMMANDS[CommandNames.ver].readRegex!)
            if (fwMatch) {
                const version = fwMatch[1]
                payload.deviceFirmwareVersion = version
                const latest = await ReferenceDataService.getLatestFirmware('ble')
                if (latest && version !== latest.version) {
                    payload.bleFirmwareUpdateAvailable = true
                    newErrors.deviceHealth.push(`Newer firmware available: ${latest.version}`)
                }
            }
        } catch (e) {
            logWarn('[Pre-Deployment] Firmware check failed:', e)
        }

        payload.initErrors = newErrors
        return payload

    }, [runBleStandardInit, getBatteryLevel, checkSdCard, runSelfTest, getDeviceVer])

    return { runChecks }
}
