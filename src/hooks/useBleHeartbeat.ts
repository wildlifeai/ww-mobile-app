/**
 * BLE Heartbeat Hook
 *
 * Prevents device disconnection due to 60s BLE inactivity timeout.
 *
 * Strategy: every time anything goes over the air, a line or a binary packet
 * received or a raw write sent, restart a 30-second timer. If 30 seconds pass
 * with nothing, send "get heartbeat" to keep the connection alive. The nRF
 * answers it itself, and that reply restarts the timer, creating a
 * self-sustaining heartbeat cycle.
 *
 * Only air traffic counts, because only air traffic restarts the nRF's own
 * timer. The app's local events (queue busy and idle, heartbeat pause) used to
 * restart this one too, so a command that timed out after 30 s pushed the ping
 * 30 s past the last thing the device actually heard (#312).
 *
 * Usage: Mount in a provider or screen where a device is connected.
 *        useBleHeartbeat(connectedDevice)
 */
import { useEffect, useRef } from 'react'
import { ExtendedPeripheral } from '../redux/slices/devicesSlice'
import { bleEventBus, BleEvent } from '../ble/protocol/eventBus'
import { BLE_PROTOCOL_TIMINGS } from '../ble/protocol/protocolConstants'
import { log, logWarn } from '../utils/logger'
import { useBle } from './useBle'

const HEARTBEAT_DELAY_MS = BLE_PROTOCOL_TIMINGS.HEARTBEAT_IDLE_MS
const IDLE_SECONDS = HEARTBEAT_DELAY_MS / 1000

export const useBleHeartbeat = (device: ExtendedPeripheral | null) => {
    const deviceRef = useRef(device)
    const { writeRaw } = useBle()
    const writeRawRef = useRef(writeRaw)

    // Keep refs current to avoid stale closures in the timer callback
    useEffect(() => { deviceRef.current = device }, [device])
    useEffect(() => { writeRawRef.current = writeRaw }, [writeRaw])

    const isPausedRef = useRef(false)

    useEffect(() => {
        // The idle timer lives and dies with this effect: the cleanup below is
        // the only thing that stops it, on disconnect and on unmount alike.
        let timer: ReturnType<typeof setTimeout> | undefined
        if (!device?.connected) {
            return () => clearTimeout(timer)
        }

        log(`[BLE Heartbeat] ✓ Active for ${device.name ?? device.id}`)

        // The write is awaited in its own function so the timer callback stays
        // synchronous: a callback that re-arms the timer after an await could
        // re-arm it after this effect's cleanup has run.
        const sendHeartbeat = async (currentDevice: ExtendedPeripheral) => {
            log(`[BLE Heartbeat] ${IDLE_SECONDS}s idle, sending heartbeat (get heartbeat)...`)
            try {
                // Send fire-and-forget heartbeat raw string
                await writeRawRef.current(currentDevice, 'get heartbeat')
                log('[BLE Heartbeat] Heartbeat sent. Timer will reset on response.')
            } catch (err) {
                logWarn('[BLE Heartbeat] Heartbeat failed:', err)
            }
        }

        const resetTimer = () => {
            clearTimeout(timer)
            timer = setTimeout(() => {
                timer = undefined
                const currentDevice = deviceRef.current
                if (!currentDevice?.connected) return

                if (isPausedRef.current) {
                    // An RSSI read is answered by the phone's own radio and never
                    // reaches the nRF's firmware, so it does not restart the nRF's
                    // 60 s timer. It only keeps this loop running until the pause
                    // lifts; the long-running operation has to keep the link busy.
                    log(`[BLE Heartbeat] ${IDLE_SECONDS}s idle, reading RSSI instead (UART heartbeat is paused)...`)
                    try {
                        import('react-native-ble-manager').then(BleManager => {
                           BleManager.default.readRSSI(currentDevice.id).catch(() => {})
                        })
                    } catch (e) {}

                    // Reset timer purely to keep the loop running
                    resetTimer()
                    return
                }

                sendHeartbeat(currentDevice)
            }, HEARTBEAT_DELAY_MS)
        }

        // Anything on the air = activity → restart the countdown
        const listener = () => resetTimer()
        const pauseListener = (event: BleEvent & { type: 'HEARTBEAT_PAUSE' }) => {
            isPausedRef.current = event.isPaused
            log(`[BLE Heartbeat] UART heartbeat paused state changed to: ${event.isPaused}`)
        }

        bleEventBus.on('rawRx', listener)
        bleEventBus.on('binaryPacket', listener)
        bleEventBus.on('rawTx', listener)
        bleEventBus.on('heartbeatPause', pauseListener)

        // Start the first timer immediately
        resetTimer()

        return () => {
            bleEventBus.removeListener('rawRx', listener)
            bleEventBus.removeListener('binaryPacket', listener)
            bleEventBus.removeListener('rawTx', listener)
            bleEventBus.removeListener('heartbeatPause', pauseListener)
            clearTimeout(timer)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [device?.connected])
}
