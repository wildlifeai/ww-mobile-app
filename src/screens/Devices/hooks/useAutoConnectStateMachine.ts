import { useRef, useCallback } from 'react'
import { log } from '../../../utils/logger'

/**
 * Per-device states for the auto-connect state machine.
 *
 * State transitions:
 *   DISCOVERED → ROUTING_PENDING  (connection initiated)
 *   ROUTING_PENDING → ACCEPTED    (routed to a screen successfully)
 *   ROUTING_PENDING → REJECTED    (dialog dismissed / access denied)
 *   REJECTED → IGNORED_FOR_SESSION (permanent ignore for this focus session)
 *   Any → DISCOVERED              (on screen re-focus / manual reset)
 */
export type AutoConnectDeviceState =
  | 'DISCOVERED'
  | 'ROUTING_PENDING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'IGNORED_FOR_SESSION'

/**
 * State machine for managing auto-connect behaviour per discovered device.
 *
 * Replaces the fragile Set<string> ignore pattern which caused
 * reconnect loops when the 2-second cool-off expired.
 */
export function useAutoConnectStateMachine() {
  const stateMap = useRef<Map<string, AutoConnectDeviceState>>(new Map())

  const getState = useCallback((deviceId: string): AutoConnectDeviceState => {
    return stateMap.current.get(deviceId) ?? 'DISCOVERED'
  }, [])

  const transition = useCallback((deviceId: string, to: AutoConnectDeviceState) => {
    const from = stateMap.current.get(deviceId) ?? 'DISCOVERED'
    if (from === to) return
    log(`[AutoConnect] ${deviceId.substring(0, 8)}: ${from} → ${to}`)
    stateMap.current.set(deviceId, to)
  }, [])

  /**
   * Whether a device is eligible for auto-connect.
   * Only DISCOVERED devices can be auto-connected.
   */
  const canAutoConnect = useCallback((deviceId: string): boolean => {
    const s = stateMap.current.get(deviceId)
    return !s || s === 'DISCOVERED'
  }, [])

  /**
   * Reset all devices back to DISCOVERED state.
   * Called when the scanner screen regains focus.
   */
  const resetAll = useCallback(() => {
    stateMap.current.clear()
  }, [])

  /**
   * Reset a single device back to DISCOVERED state.
   * Called when a device loses signal and reappears.
   */
  const resetDevice = useCallback((deviceId: string) => {
    stateMap.current.delete(deviceId)
  }, [])

  return { getState, transition, canAutoConnect, resetAll, resetDevice }
}
