import { useRef, useCallback, useMemo } from 'react'
import { log } from '../../../utils/logger'

/**
 * Per-device states for the auto-connect state machine.
 *
 * State transitions:
 *   DISCOVERED → ROUTING_PENDING  (connection initiated)
 *   ROUTING_PENDING → ACCEPTED    (routed to a screen successfully)
 *   ROUTING_PENDING → REJECTED    (dialog dismissed / access denied)
 *   REJECTED → IGNORED_FOR_SESSION (permanent ignore for this focus session)
 *   DISCOVERED → SUSPENDED        (screen blur via suspend())
 *   ROUTING_PENDING → SUSPENDED   (screen blur via suspend())
 *   SUSPENDED → DISCOVERED        (screen focus via resume())
 *   Any → DISCOVERED              (on resetAll() — new scan session only)
 *
 * Important: Use suspend()/resume() for focus changes.
 * Only use resetAll() when starting a fresh scan session.
 * resetAll() clears IGNORED_FOR_SESSION, which can cause reconnect loops
 * if a device was explicitly dismissed in the current session.
 */
export type AutoConnectDeviceState =
  | 'DISCOVERED'
  | 'ROUTING_PENDING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'IGNORED_FOR_SESSION'
  | 'SUSPENDED'

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
   * Called when starting a NEW scan session (user presses "Search").
   * Do NOT call on focus changes — use suspend()/resume() instead.
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

  /**
   * Suspend all eligible devices when screen loses focus.
   * DISCOVERED and ROUTING_PENDING → SUSPENDED.
   * ACCEPTED and IGNORED_FOR_SESSION are preserved — they represent
   * completed lifecycle decisions that must survive navigation.
   */
  const suspend = useCallback(() => {
    for (const [id, state] of stateMap.current) {
      if (state === 'DISCOVERED' || state === 'ROUTING_PENDING') {
        stateMap.current.set(id, 'SUSPENDED')
      }
    }
    log('[AutoConnect] Suspended eligible devices')
  }, [])

  /**
   * Resume all SUSPENDED devices back to DISCOVERED when screen regains focus.
   * They become eligible for auto-connect again without losing
   * IGNORED_FOR_SESSION decisions from the same session.
   */
  const resume = useCallback(() => {
    let resumed = 0
    for (const [id, state] of stateMap.current) {
      if (state === 'SUSPENDED') {
        stateMap.current.set(id, 'DISCOVERED')
        resumed++
      }
    }
    if (resumed > 0) {
      log(`[AutoConnect] Resumed ${resumed} device(s)`)
    }
  }, [])

  return useMemo(() => ({
    getState,
    transition,
    canAutoConnect,
    resetAll,
    resetDevice,
    suspend,
    resume,
  }), [getState, transition, canAutoConnect, resetAll, resetDevice, suspend, resume])
}
