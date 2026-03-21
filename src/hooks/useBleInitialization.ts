/* eslint-disable no-bitwise */
import { useCallback, useRef } from 'react'
import { ExtendedPeripheral } from '../redux/slices/devicesSlice'
import { useBleCommands } from './useBleCommands'
import { extractErrorBits } from '../ble/messageClassifier'

import { log, logError, logWarn } from '../utils/logger'


export interface BleInitOptions {
  onProgress?: (step: string, progress: number) => void
  onError?: (error: {setUtc?: string; deviceHealth?: string[]}) => void
}

export interface BleInitResult {
  success: boolean
  errors: {
    setUtc?: string
    deviceHealth?: string[]
  }
}

/**
 * Standard BLE Initialization: "wake -> stabilize -> setutc"
 * 
 * This hook provides a standardized initialization flow that should be used
 * every time the mobile app connects to a device in the following scenarios:
 * - Prepare and Test Device flow
 * - Start Deployment flow
 * - End Deployment flow
 * 
 * The hook does NOT handle connection itself - the device must already be connected.
 */
export const useBleInitialization = () => {
  const { setUtc, runSelfTest } = useBleCommands()
  const isInitializing = useRef(false)

  const initialize = useCallback(async (
    device: ExtendedPeripheral,
    options?: BleInitOptions
  ): Promise<BleInitResult> => {
    // Prevent duplicate initialization
    if (isInitializing.current) {
      logWarn('[BLE Init] Already initializing, skipping duplicate call')
      return { success: false, errors: {} }
    }

    isInitializing.current = true
    const errors: { setUtc?: string; deviceHealth?: string[] } = {}

    try {
      // 1. Check Hardware Status (Selftest)
      options?.onProgress?.('Checking hardware...', 0.1)
      log('[BLE Init] Checking hardware status prior to time sync...')

      // 1. Check Hardware Status (Selftest) - FIRST
      // Add delay to allow device to stabilize after connection (especially if joining LoRaWAN)
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      let statusMsg = ''
      let hexBits: string | null = null
      let bits = 0
      
      try {
          statusMsg = await runSelfTest(device)
          log('[BLE Init] Self-test result:', statusMsg)
          
          hexBits = extractErrorBits(statusMsg)
          if (hexBits) {
              bits = parseInt(hexBits, 16)
              // If high byte is FF (0xFF00, 0xFFFF), it usually means system offline/not ready
              // This can happen if the selftest runs before the system has fully initialized
              const isSystemOffline = (bits & 0xFF00) === 0xFF00
              
              if (isSystemOffline) {
                  logWarn(`[BLE Init] System reports initial state (${hexBits}). Assuming temporary initialization state.`)
                  // We do NOT block here, as waiting for stats requires sleep (~1s) which we want to avoid blocking on.
                  // We clear the bits for the purpose of error reporting to avoid showing "All Hardware Failed" to user
                  bits = 0 
                  hexBits = null
              }
          }
      } catch (e) {
          const errorMsg = e instanceof Error ? e.message : String(e)
          logWarn('[BLE Init] Self-test command failed:', errorMsg)
          // Add a warning to the errors object so the UI can be notified
          if (!errors.deviceHealth) errors.deviceHealth = []
          errors.deviceHealth.push('Hardware self-test failed to run.')
      }

      // Check for hardware warnings
      if (hexBits && bits !== 0) {
              logWarn(`[BLE Init] Non-zero error bits detected: ${hexBits} (${bits})`)
              const warnings: string[] = []

              // Define known bit masks based on selfTest.h
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

              if (bits & SelfTestErrorBits.LOW_BATTERY) warnings.push("Low Battery detected (Bit 0)")
              if (bits & SelfTestErrorBits.AI_PROCESSOR_NO_RESPONSE) warnings.push("AI Processor not responding (Bit 1)")
              if (bits & SelfTestErrorBits.LORAWAN_ERROR) warnings.push("LoRaWAN Error (Bit 2)")
              if (bits & SelfTestErrorBits.WATCHDOG_RESET) warnings.push("Watchdog Reset occurred (Bit 3)")
              if (bits & SelfTestErrorBits.BROWNOUT_RESET) warnings.push("Brownout Reset occurred (Bit 4)")

              // Bits 8-15 are AI processor errors
              if (bits & SelfTestErrorBits.MAIN_CAMERA_ERROR) warnings.push("Main Camera Error (Bit 8)")
              if (bits & SelfTestErrorBits.MOTION_DETECTOR_ERROR) warnings.push("Motion Detector Camera Error (Bit 9)")
              if (bits & SelfTestErrorBits.LED_FLASH_FAILURE) warnings.push("LED Flash Circuit Failure (Bit 10)")
              if (bits & SelfTestErrorBits.NO_SD_CARD) warnings.push("Device has no SD card detected (Bit 11)")
              if (bits & SelfTestErrorBits.PDM_MIC_FAILURE) warnings.push("PDM Microphone Failure (Bit 12)")
              if (bits & SelfTestErrorBits.NEURAL_NETWORK_ERROR) warnings.push("Neural Network Error (Bit 13)")

              // If we have bits but no mapped warnings
              if (warnings.length === 0) warnings.push(`Unknown hardware issue (Code: ${hexBits})`)

              errors.deviceHealth = warnings
      } else if (!hexBits && bits === 0) {
          // If bits were cleared or 0
           log('[BLE Init] Hardware check passed (error bits = 0x0000 or ignored init state)')
      }

      try {
        // 2. Set UTC Time
        options?.onProgress?.('Synchronizing time...', 0.5)
        log('[BLE Init] Setting UTC time...')
        await setUtc(device)
        // setUtc already waits for the firmware response ("UTC is: <time>"),
        // confirming the time was set. No need for a separate getUtc verification.
        log('[BLE Init] UTC time synchronized successfully')
      } catch (err) {
        logError('[BLE Init] Failed to set UTC:', err)
        errors.setUtc = 'Device initialization failed. Check connection or device state.'
      }

      options?.onProgress?.('Initialization complete', 1.0)
      options?.onError?.(errors)

      const success = !errors.setUtc
      isInitializing.current = false
      return { success, errors }

    } catch (err) {
      logError('[BLE Init] Initialization failed:', err)
      isInitializing.current = false
      return { success: false, errors: { setUtc: 'Initialization failed unexpectedly' } }
    }
  }, [setUtc, runSelfTest])

  return { initialize }
}
