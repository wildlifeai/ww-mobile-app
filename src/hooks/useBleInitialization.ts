/* eslint-disable no-bitwise */
import { useCallback, useRef } from 'react'
import { ExtendedPeripheral } from '../redux/slices/devicesSlice'
import { createBleSession } from '../ble/session/createBleSession'
import { commandRegistry } from '../ble/protocol/commandRegistry'
import { extractErrorBits } from '../ble/messageClassifier'
import { selfTestWarnings } from '../utils/deviceSelfTest'

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

      // Brief delay to allow device to stabilize after connection
      await new Promise(resolve => setTimeout(resolve, 300))
      
      let statusMsg = ''
      let hexBits: string | null = null
      let bits = 0
      
      try {
          const session = createBleSession(device)
          
          // The MKL62BA auto-wakes the Himax when it receives any command,
          // so we skip the explicit wake and go straight to selftest.
          statusMsg = await session.execute(commandRegistry.selftest)
          log('[BLE Init] Self-test result:', statusMsg)
          
          hexBits = statusMsg ? extractErrorBits(statusMsg) : null
          if (hexBits) {
              bits = parseInt(hexBits, 16)
              // Bits 8-15 are AI processor errors. The BLE processor pre-sets
              // ALL of them (0xFF00) at boot and only clears them once the AI
              // processor sends its own selftest result.  Because this selftest
              // runs BEFORE we wake the AI processor, any AI-range bits that
              // are still set are stale initialization values — not real errors.
              // Mask them out so only BLE-processor bits (0-7) are evaluated.
              const bleOnlyBits = bits & 0x00FF
              if (bleOnlyBits !== bits) {
                  const maskedBits = bits & 0xFF00
                  logWarn(`[BLE Init] Masking stale AI processor bits 0x${maskedBits.toString(16).toUpperCase().padStart(4, '0')} (AI not yet awake). Keeping BLE bits: 0x${bleOnlyBits.toString(16).toUpperCase().padStart(4, '0')}`)
                  bits = bleOnlyBits
                  hexBits = bleOnlyBits === 0 ? null : bleOnlyBits.toString(16).toUpperCase().padStart(4, '0')
              }
          }
      } catch (e) {
          const errorMsg = e instanceof Error ? e.message : String(e)
          logWarn('[BLE Init] Self-test command failed:', errorMsg)
          // Add a warning to the errors object so the UI can be notified
          if (!errors.deviceHealth) errors.deviceHealth = []
          errors.deviceHealth.push('Hardware self-test failed to run.')
      }

      // Check for hardware warnings. The bit names live in utils/deviceSelfTest.ts,
      // the one copy of the firmware's selfTest.h table.
      if (hexBits && bits !== 0) {
              logWarn(`[BLE Init] Non-zero error bits detected: ${hexBits} (${bits})`)
              errors.deviceHealth = selfTestWarnings(bits)
      } else if (!hexBits && bits === 0) {
          // If bits were cleared or 0
           log('[BLE Init] Hardware check passed (error bits = 0x0000 or ignored init state)')
      }

      try {
        const session = createBleSession(device)
        // 2. Set UTC Time
        options?.onProgress?.('Synchronizing time...', 0.5)
        log('[BLE Init] Setting UTC time...')
        await session.execute(() => commandRegistry.setutc())
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
  }, [])

  return { initialize }
}
