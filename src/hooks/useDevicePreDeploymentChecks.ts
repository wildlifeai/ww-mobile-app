import { useCallback } from 'react'
import { ExtendedPeripheral } from '../redux/slices/devicesSlice'
import { useBleInitialization } from './useBleInitialization'
import { createBleSession } from '../ble/session/createBleSession'
import { commandRegistry } from '../ble/protocol/commandRegistry'
import ReferenceDataService from '../services/ReferenceDataService'
import { log, logWarn } from '../utils/logger'
import { convertBleToSemanticVersion } from '../utils/versionUtils'
import { InitPayload } from '../navigation/types'
import { executeResetToDefaults } from '../ble/workflows/resetToDefaults'
import { extractErrorBits } from '../ble/messageClassifier'

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
            aiProcessorFailed: false,
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

        // 1. Battery Check (BLE-only, no AI processor needed)
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

        // 2. AI Processor Wake-Up Gate
        // Try to wake the AI processor via aiinfo up to 3 times.
        // If it never responds, mark aiProcessorFailed and skip all AI commands.
        const AI_WAKE_MAX_RETRIES = 3
        const AI_WAKE_RETRY_DELAY_MS = 2000
        let aiAwake = false

        onProgress('Waking AI processor...')
        for (let attempt = 1; attempt <= AI_WAKE_MAX_RETRIES; attempt++) {
            try {
                log(`[Pre-Deployment] AI wake attempt ${attempt}/${AI_WAKE_MAX_RETRIES}...`)
                const sdStatus = await session.execute(commandRegistry.aiinfo)
                // If we get a response (even an error response), the AI is awake
                if (sdStatus && !sdStatus.error) {
                    aiAwake = true
                    // Store SD card data from the successful aiinfo response
                    if (sdStatus.total !== undefined && sdStatus.total > 0) {
                        payload.sdCardStatus = sdStatus as any
                        const percentFull = ((sdStatus.total - (sdStatus.free || 0)) / sdStatus.total) * 100
                        if (percentFull > 90) {
                            newErrors.deviceHealth.push(`SD Card is almost full (${percentFull.toFixed(1)}% used)`)
                        }
                    } else {
                        newErrors.deviceHealth.push('No SD Card detected or total space is 0')
                    }
                } else if (sdStatus?.error) {
                    // AI responded but with an error — it IS awake
                    aiAwake = true
                    if (sdStatus.error.includes('NACK')) {
                        newErrors.deviceHealth.push('No SD Card detected or SD Card check failed')
                    } else {
                        newErrors.deviceHealth.push(`AI Processor check failed: ${sdStatus.error}`)
                    }
                }
                break // Got a response, stop retrying
            } catch (e) {
                logWarn(`[Pre-Deployment] AI wake attempt ${attempt} failed:`, e)
                if (attempt < AI_WAKE_MAX_RETRIES) {
                    onProgress(`AI processor not responding, retrying (${attempt}/${AI_WAKE_MAX_RETRIES})...`)
                    await new Promise(resolve => setTimeout(resolve, AI_WAKE_RETRY_DELAY_MS))
                }
            }
        }

        if (!aiAwake) {
            logWarn('[Pre-Deployment] AI processor failed to wake after all retries')
            payload.aiProcessorFailed = true
            newErrors.deviceHealth.push('AI processor did not respond — device cannot start monitoring')
            onProgress('AI processor not responding')
        } else {
            // Run post-wake health check (selftest) to evaluate fresh AI processor error bits (like 0x0300 camera errors)
            try {
                onProgress('Checking AI processor health...')
                const statusMsg = await session.execute(commandRegistry.selftest)
                log('[Pre-Deployment] Post-wake self-test result:', statusMsg)
                const hexBits = statusMsg ? extractErrorBits(statusMsg) : null
                if (hexBits) {
                    const bits = parseInt(hexBits, 16)
                    if (!isNaN(bits) && bits !== 0) {
                        logWarn(`[Pre-Deployment] Non-zero error bits detected after AI wake: ${hexBits} (${bits})`)
                        
                        const SelfTestErrorBits = {
                            LOW_BATTERY: 1 << 0,
                            AI_PROCESSOR_NO_RESPONSE: 1 << 1,
                            LORAWAN_ERROR: 1 << 2,
                            WATCHDOG_RESET: 1 << 3,
                            BROWNOUT_RESET: 1 << 4,
                            MAIN_CAMERA_ERROR: 1 << 8,
                            MOTION_DETECTOR_ERROR: 1 << 9,
                            LED_FLASH_FAILURE: 1 << 10,
                            NO_SD_CARD: 1 << 11,
                            PDM_MIC_FAILURE: 1 << 12,
                            NEURAL_NETWORK_ERROR: 1 << 13,
                        }

                        const addWarning = (warning: string) => {
                            if (!newErrors.deviceHealth.includes(warning)) {
                                newErrors.deviceHealth.push(warning)
                            }
                        }

                        if (bits & SelfTestErrorBits.LOW_BATTERY) addWarning("Low Battery detected (Bit 0)")
                        if (bits & SelfTestErrorBits.AI_PROCESSOR_NO_RESPONSE) addWarning("AI Processor not responding (Bit 1)")
                        if (bits & SelfTestErrorBits.LORAWAN_ERROR) addWarning("LoRaWAN Error (Bit 2)")
                        if (bits & SelfTestErrorBits.WATCHDOG_RESET) addWarning("Watchdog Reset occurred (Bit 3)")
                        if (bits & SelfTestErrorBits.BROWNOUT_RESET) addWarning("Brownout Reset occurred (Bit 4)")
                        if (bits & SelfTestErrorBits.MAIN_CAMERA_ERROR) addWarning("Main Camera Error (Bit 8)")
                        if (bits & SelfTestErrorBits.MOTION_DETECTOR_ERROR) addWarning("Motion Detector Camera Error (Bit 9)")
                        if (bits & SelfTestErrorBits.LED_FLASH_FAILURE) addWarning("LED Flash Circuit Failure (Bit 10)")
                        if (bits & SelfTestErrorBits.NO_SD_CARD) addWarning("Device has no SD card detected (Bit 11)")
                        if (bits & SelfTestErrorBits.PDM_MIC_FAILURE) addWarning("PDM Microphone Failure (Bit 12)")
                        if (bits & SelfTestErrorBits.NEURAL_NETWORK_ERROR) addWarning("Neural Network Error (Bit 13)")

                        const knownMask = 0x3F1F
                        if ((bits & ~knownMask) !== 0) {
                            addWarning(`Unknown hardware issue (Code: ${hexBits})`)
                        }

                        // Block starting deployment if there's a critical hardware error on the AI/Camera module
                        const criticalAiErrorMask = SelfTestErrorBits.MAIN_CAMERA_ERROR | 
                                                   SelfTestErrorBits.MOTION_DETECTOR_ERROR | 
                                                   SelfTestErrorBits.NEURAL_NETWORK_ERROR
                        
                        if ((bits & criticalAiErrorMask) !== 0) {
                            payload.aiProcessorFailed = true
                        }
                    }
                }
            } catch (e) {
                logWarn('[Pre-Deployment] Post-wake health check failed:', e)
            }

            // 2b. Reset operational parameters to factory defaults (pre-flight check/align)
            try {
                onProgress('Aligning device parameters...')
                await executeResetToDefaults(session, {
                    skipIdentityReset: true,
                    onProgress: (step) => {
                        log(`[Pre-Deployment:Reset] ${step}`)
                    }
                })
            } catch (resetErr) {
                logWarn('[Pre-Deployment] OP reset failed during checks:', resetErr)
                newErrors.deviceHealth.push('Failed to align device operational parameters')
            }
        }

        // 3. Firmware Check (BLE firmware — no AI processor needed)
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

        // 4. Himax (AI Processor) Firmware Check — SKIP if AI processor is dead
        if (aiAwake) {
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
        } else {
            log('[Pre-Deployment] Skipping AI firmware check — AI processor not responding')
        }

        payload.initErrors = newErrors
        return payload

    }, [runBleStandardInit])

    return { runChecks }
}
