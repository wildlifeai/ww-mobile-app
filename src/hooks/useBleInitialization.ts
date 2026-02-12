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
      // We check once. If we get the "All Errors" (0xFF--) state but Wake succeeded,
      // we assume the system is just initializing and hasn't reported stats yet.
      
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
          logWarn('[BLE Init] Self-test command failed:', e)
      }

      // Check for hardware warnings
      if (hexBits && bits !== 0) {
              logWarn(`[BLE Init] Non-zero error bits detected: ${hexBits} (${bits})`)
              const warnings: string[] = []

              // Define known bit masks from selfTest.h
              if (bits & (1 << 0)) warnings.push("Low Battery detected (Bit 0)")
              if (bits & (1 << 1)) warnings.push("AI Processor not responding (Bit 1)")
              if (bits & (1 << 2)) warnings.push("LoRaWAN Error (Bit 2)")
              if (bits & (1 << 3)) warnings.push("Watchdog Reset occurred (Bit 3)")
              if (bits & (1 << 4)) warnings.push("Brownout Reset occurred (Bit 4)")

              // Bits 8-15 are AI processor errors
              if (bits & (1 << 8)) warnings.push("Main Camera Error (Bit 8)")
              if (bits & (1 << 9)) warnings.push("Motion Detector Camera Error (Bit 9)")
              if (bits & (1 << 10)) warnings.push("LED Flash Circuit Failure (Bit 10)")
              if (bits & (1 << 11)) warnings.push("Device has no SD card detected (Bit 11)")
              if (bits & (1 << 12)) warnings.push("PDM Microphone Failure (Bit 12)")
              if (bits & (1 << 13)) warnings.push("Neural Network Error (Bit 13)")

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
        log('[BLE Init] UTC time synchronized')
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
