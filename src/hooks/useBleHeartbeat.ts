/**
 * BLE Heartbeat Hook
 * 
 * Prevents device disconnection due to 60s BLE inactivity timeout.
 * 
 * Strategy: Every time ANY BLE message is received, reset a 58-second timer.
 * If 58 seconds pass with no messages, send "AI selftest" to keep the
 * connection alive. The device's response resets the timer again, creating
 * a self-sustaining heartbeat cycle.
 * 
 * Usage: Mount in a provider or screen where a device is connected.
 *        useBleHeartbeat(connectedDevice)
 */
import { useEffect, useRef } from 'react'
import { ExtendedPeripheral } from '../redux/slices/devicesSlice'
import { bleCommandManager } from '../ble/commandManager'
import { log, logWarn } from '../utils/logger'
import { useBle } from './useBle'

const HEARTBEAT_DELAY_MS = 58_000 // 58s (device disconnects at 60s inactivity)

export const useBleHeartbeat = (device: ExtendedPeripheral | null) => {
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const deviceRef = useRef(device)
    const { write } = useBle()
    const writeRef = useRef(write)

    // Keep refs current to avoid stale closures in the 58s timer callback
    useEffect(() => { deviceRef.current = device }, [device])
    useEffect(() => { writeRef.current = write }, [write])

    useEffect(() => {
        if (!device?.connected) {
            if (timerRef.current) {
                clearTimeout(timerRef.current)
                timerRef.current = null
            }
            return
        }

        log(`[BLE Heartbeat] ✓ Active for ${device.name ?? device.id}`)

        const resetTimer = () => {
            if (timerRef.current) clearTimeout(timerRef.current)
            timerRef.current = setTimeout(async () => {
                timerRef.current = null
                const currentDevice = deviceRef.current
                if (!currentDevice?.connected) return
                log('[BLE Heartbeat] 58s idle — sending heartbeat (get heartbeat)...')
                try {
                    await writeRef.current(currentDevice, ['get heartbeat'])
                    log('[BLE Heartbeat] Heartbeat sent. Timer will reset on response.')
                } catch (err) {
                    logWarn('[BLE Heartbeat] Heartbeat failed:', err)
                }
            }, HEARTBEAT_DELAY_MS)
        }

        // Any BLE message = activity → reset the 58s countdown
        const listener = () => resetTimer()

        bleCommandManager.addMessageListener(listener)

        // Start the first timer immediately
        resetTimer()

        return () => {
            bleCommandManager.removeMessageListener(listener)
            if (timerRef.current) {
                clearTimeout(timerRef.current)
                timerRef.current = null
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [device?.connected])
}
