import { useCallback, useRef } from 'react'
import { ExtendedPeripheral } from '../redux/slices/devicesSlice'
import { useBleCommands } from './useBleCommands'
import { bleCommandManager } from '../ble/commandManager'
import { extractErrorBits } from '../ble/messageClassifier'

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
  const { setUtc } = useBleCommands()
  const isInitializing = useRef(false)

  const initialize = useCallback(async (
    device: ExtendedPeripheral,
    options?: BleInitOptions
  ): Promise<BleInitResult> => {
    // Prevent duplicate initialization
    if (isInitializing.current) {
      console.warn('[BLE Init] Already initializing, skipping duplicate call')
      return { success: false, errors: {} }
    }

    isInitializing.current = true
    const errors: { setUtc?: string; deviceHealth?: string[] } = {}

    try {
      // Single-step initialization: SET UTC
      // This triggers the full sequence: wake -> stabilize -> setutc -> selftest
      // The device responds with:
      // 1. "UTC is:" (Nordic acknowledgment)
      // 2. "Wake" (Himax wakes up)
      // 3. "RTC set to" (Himax confirms time sync)
      // 4. "Error bits = 0xXXXX" (Himax selftest result)
      
      options?.onProgress?.('Synchronizing time...', 0.5)
      console.log('[BLE Init] Setting UTC time...')

      try {
        // RACE CONDITION FIX: Start listening for error bits BEFORE sending setUtc.
        // The error bits arrive very soon after the "RTC set to" response,
        // often before the app has a chance to start the next listener.
        const errorBitsPromise = bleCommandManager.waitForMessage(/Error bits = 0x/, 5000)

        // Call setUtc - Command Manager waits for "RTC set to" automatically
        await setUtc(device)
        console.log('[BLE Init] UTC time synchronized')
        
        // Wait for the error bits that arrive after RTC confirmation
        options?.onProgress?.('Checking hardware...', 0.75)
        
        const errorMsg = await errorBitsPromise
        
        // Check for hardware warnings
        const hexBits = extractErrorBits(errorMsg)
        if (hexBits) {
          const bits = parseInt(hexBits, 16)
          if (bits !== 0) {
            console.warn(`[BLE Init] Non-zero error bits detected: ${hexBits} (${bits})`)
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
            console.log('[BLE Init] Hardware check passed (error bits = 0x0000)')
          }
        }
        
        await new Promise(r => setTimeout(r, 500))
      } catch (err) {
        console.error('[BLE Init] Initialization failed:', err)
        errors.setUtc = 'Device initialization failed. Check connection or device state.'
      }

      options?.onProgress?.('Initialization complete', 1.0)
      options?.onError?.(errors)

      const success = !errors.setUtc
      isInitializing.current = false
      return { success, errors }

    } catch (err) {
      console.error('[BLE Init] Initialization failed:', err)
      isInitializing.current = false
      return { success: false, errors: { setUtc: 'Initialization failed unexpectedly' } }
    }
  }, [setUtc])

  return { initialize }
}
