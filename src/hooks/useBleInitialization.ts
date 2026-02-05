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
      options?.onProgress?.('Synchronizing time...', 0.5)
      log('[BLE Init] Setting UTC time...')

      try {
        // 1. Set UTC Time
        await setUtc(device)
        log('[BLE Init] UTC time synchronized')
        
        // 2. Check Hardware Status explicitly
        // We use runSelfTest because it returns the specific "Error bits = ..." response
        // whereas getStatus only returns the sensor status string.
        options?.onProgress?.('Checking hardware...', 0.75)
        
        // This will throw if the response regex doesn't match, so we wrap it
        // The regex defined in types.ts for selftest is: /Error\s*bits\s*=\s*(0x[0-9A-Fa-f]+)/
        const statusMsg = await runSelfTest(device)
        log('[BLE Init] Self-test result:', statusMsg)
        
        // Check for hardware warnings
        const hexBits = extractErrorBits(statusMsg)
        if (hexBits) {
          const bits = parseInt(hexBits, 16)
          if (bits !== 0) {
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

            // If we have bits but no mapped warnings, show generic
            if (warnings.length === 0) warnings.push(`Unknown hardware issue (Code: ${hexBits})`)

            errors.deviceHealth = warnings
          } else {
            log('[BLE Init] Hardware check passed (error bits = 0x0000)')
          }
        }
        
        await new Promise(r => setTimeout(r, 500))
      } catch (err) {
        logError('[BLE Init] Initialization failed:', err)
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
