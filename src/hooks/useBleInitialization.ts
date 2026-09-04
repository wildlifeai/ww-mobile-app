/* eslint-disable no-bitwise */
import { useCallback, useRef } from 'react'
import { ExtendedPeripheral } from '../redux/slices/devicesSlice'
import { createBleSession } from '../ble/session/createBleSession'
import { commandRegistry } from '../ble/protocol/commandRegistry'
import { AI_BITS_MASK, formatSelfTestBits, parseSelfTestBits, selfTestWarnings } from '../utils/deviceSelfTest'

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
      
      // The BLE processor's half of the self-test (bits 0-7). Bits 8-15 are the
      // AI processor's, and the BLE processor presets every one of them at boot
      // until the Himax reports for itself. This runs before anything wakes the
      // Himax, so the AI range is masked here; the post-wake broadcast (kept by
      // ble/protocol/selfTestCache.ts) is where those bits are read.
      let bits: number | null = null

      try {
          const session = createBleSession(device)
          const statusMsg = await session.execute(commandRegistry.selftest)
          log('[BLE Init] Self-test result:', statusMsg)

          const raw = parseSelfTestBits(statusMsg)
          if (raw !== null) {
              bits = raw & ~AI_BITS_MASK
              if (bits !== raw) {
                  logWarn(`[BLE Init] Masking AI processor bits ${formatSelfTestBits(raw & AI_BITS_MASK)} (AI not yet awake). Keeping BLE bits: ${formatSelfTestBits(bits)}`)
              }
          }
      } catch (e) {
          const errorMsg = e instanceof Error ? e.message : String(e)
          logWarn('[BLE Init] Self-test command failed:', errorMsg)
          // Add a warning to the errors object so the UI can be notified
          if (!errors.deviceHealth) errors.deviceHealth = []
          errors.deviceHealth.push('Hardware self-test failed to run.')
      }

      // The bit names live in utils/deviceSelfTest.ts, the one copy of the
      // firmware's selfTest.h table.
      if (bits !== null && bits !== 0) {
          logWarn(`[BLE Init] Non-zero error bits detected: ${formatSelfTestBits(bits)} (${bits})`)
          errors.deviceHealth = selfTestWarnings(bits)
      } else if (bits === 0) {
          log('[BLE Init] Hardware check passed (BLE bits 0x0000; AI bits read after the wake)')
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
