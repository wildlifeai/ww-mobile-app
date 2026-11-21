import { useCallback } from 'react'
import { ExtendedPeripheral } from '../redux/slices/devicesSlice'
import { useBleInitialization } from './useBleInitialization'
import { createBleSession } from '../ble/session/createBleSession'
import { commandRegistry } from '../ble/protocol/commandRegistry'
import { selfTestCache } from '../ble/protocol/selfTestCache'
import ReferenceDataService from '../services/ReferenceDataService'
import { log, logWarn } from '../utils/logger'
import { convertBleToSemanticVersion } from '../utils/versionUtils'
import { InitPayload } from '../navigation/types'
import { CRITICAL_AI_MASK, formatSelfTestBits, isProvisional, parseSelfTestBits, PROVISIONAL_BIT, SD_CARD_NOT_CHECKED_WARNING, selfTestWarnings } from '../utils/deviceSelfTest'
import { batteryLowWarning, sdCardAlmostFullWarning } from '../utils/initWarnings'

/**
 * Pre-deployment checks: what the Scanner runs between "connected" and the Start
 * Monitoring screen.
 *
 * Reads only. Connecting never writes to the device (see 06-BLE-CONNECTIONS.md);
 * the factory reset that guarantees a clean slate runs in the Start Monitoring
 * pipeline, once the user has decided to deploy (#268).
 *
 * The self-test bits after the wake are not requested: the Himax broadcasts
 * `Error bits = 0x....` on every wake, and on the bench it arrives 60 ms after
 * `Wake`, well before the `AI info` reply that wakes it has finished. The
 * shared selfTestCache holds it; `selftest` is only sent if no broadcast came.
 */
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
                newErrors.deviceHealth.push(batteryLowWarning(level))
            }
        } catch (e) {
            logWarn('[Pre-Deployment] Battery check failed:', e)
        }

        // 2. AI Processor Wake-Up Gate
        // Try to wake the AI processor via aiinfo up to 3 times.
        // If it never responds, mark aiProcessorFailed and skip all AI commands.
        // While it wakes, catch the self-test broadcast it sends unasked.
        const AI_WAKE_MAX_RETRIES = 3
        const AI_WAKE_RETRY_DELAY_MS = 2000
        let aiAwake = false
        // Anything the cache holds from before this moment predates our wake.
        const wakeStartedAt = Date.now()

        onProgress('Waking AI processor...')
        {
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
                                newErrors.deviceHealth.push(sdCardAlmostFullWarning(percentFull))
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
        }

        if (!aiAwake) {
            logWarn('[Pre-Deployment] AI processor failed to wake after all retries')
            payload.aiProcessorFailed = true
            newErrors.deviceHealth.push('AI processor did not respond — device cannot start monitoring')
            onProgress('AI processor not responding')
        } else {
            // Post-wake health: the broadcast carries the real camera, SD and NN bits
            // (bits 8-15), which the pre-wake selftest in useBleInitialization masks.
            // The cache has usually heard it by now; give it a moment, then ask.
            // The wait is for the final reading, past a provisional one (bit
            // 15): it comes about 0.2 s after "Wake" with a card and 0.7 s
            // without (Seeed issue #290), and this starts after `AI info` has
            // answered, so 1500 ms covers both.
            let bits: number | null = null
            const heard = await selfTestCache.waitForFresh(device.id, wakeStartedAt, 1500)
            if (heard) {
                bits = heard.bits
                log('[Pre-Deployment] Post-wake self-test from broadcast:', formatSelfTestBits(bits))
            } else {
                try {
                    onProgress('Checking AI processor health...')
                    const statusMsg = await session.execute(commandRegistry.selftest)
                    log('[Pre-Deployment] Post-wake self-test result (requested, no broadcast seen):', statusMsg)
                    bits = parseSelfTestBits(statusMsg)
                } catch (e) {
                    logWarn('[Pre-Deployment] Post-wake health check failed:', e)
                }
            }

            // Only a provisional reading (bit 15): the camera answered before it
            // mounted its card, and the final reading never came, as with an
            // older BLE processor. Its other bits are real, but its bit 11 is
            // not a pass. `AI info` above has read the card itself when it
            // reported a size; otherwise say the card was not checked. A
            // warning, not a block, since that firmware never sends the final.
            if (bits !== null && isProvisional(bits)) {
                logWarn(`[Pre-Deployment] Only a provisional self-test arrived (${formatSelfTestBits(bits)}), so bit 11 is unknown`)
                if (!(payload.sdCardStatus?.total) && !newErrors.deviceHealth.includes(SD_CARD_NOT_CHECKED_WARNING)) {
                    newErrors.deviceHealth.push(SD_CARD_NOT_CHECKED_WARNING)
                }
            }

            if (bits !== null && (bits & ~PROVISIONAL_BIT) !== 0) {
                logWarn(`[Pre-Deployment] Non-zero error bits detected after AI wake: ${formatSelfTestBits(bits)} (${bits})`)
                for (const warning of selfTestWarnings(bits)) {
                    if (!newErrors.deviceHealth.includes(warning)) {
                        newErrors.deviceHealth.push(warning)
                    }
                }
                // Block starting deployment if there's a critical hardware error on the AI/Camera module
                if ((bits & CRITICAL_AI_MASK) !== 0) {
                    payload.aiProcessorFailed = true
                }
            }
        }

        // 3. Firmware Check (BLE firmware — no AI processor needed)
        try {
            onProgress('Checking firmware...')
            const version = await session.execute(commandRegistry.version)
            payload.deviceFirmwareVersion = version
            const latest = await ReferenceDataService.getLatestFirmware('ble')
            const normalizedVersion = convertBleToSemanticVersion(version)
            // No warning line: Start Monitoring's banner says Update software once (#529)
            if (latest && normalizedVersion !== latest.version) {
                payload.bleFirmwareUpdateAvailable = true
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
                // Read for Start Monitoring's firmware check, which judges it
                // and says Update software once (#529): no warning line here
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
