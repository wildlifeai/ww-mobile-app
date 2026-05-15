import { useEffect, useRef, useCallback } from 'react'
import { Platform } from 'react-native'
import BleManager from 'react-native-ble-manager'

import { useBleActions } from '../providers/BleEngineProvider'
import { useAppSelector, useAppDispatch } from '../redux'
import { clearDiscoveredDevices } from '../redux/slices/devicesSlice'
import { isOurDevice } from '../utils/helpers'
import { log, logWarn } from '../utils/logger'

/** How long each scan burst lasts (seconds). */
const BURST_DURATION_S = 3

/** Delay between the end of one burst and the start of the next (ms). */
const INTER_BURST_DELAY_MS = 300

/**
 * Module-level set of peripheral IDs that were already removed from the
 * native BLE cache by the disconnect handler (useBleListeners).
 *
 * When flushBleCache runs, it skips these IDs to avoid a redundant
 * removePeripheral call that blocks Android's BLE scanner for 10-60s.
 * Entries are cleared after being consumed (single-use).
 */
const recentlyRemovedIds = new Set<string>()

/** Called by useBleListeners after removePeripheral on disconnect. */
export const markPeripheralRemoved = (id: string) => {
    recentlyRemovedIds.add(id)
}

interface UseScanLoopOptions {
    /** Whether the scan loop should be actively cycling. */
    active: boolean
}

/**
 * Shared scan loop for both DeviceDiscovery and EngineerConsole.
 *
 * Runs continuous 3-second BLE scan bursts with a 300ms inter-burst gap
 * while `active` is true. When `active` becomes false the loop stops
 * (any in-flight burst will complete naturally, but no new burst starts).
 */
export const useScanLoop = ({ active }: UseScanLoopOptions) => {
    const { startScan, stopScan } = useBleActions()
    const isScanning = useAppSelector(s => s.scanning.isScanning)
    const dispatch = useAppDispatch()
    const scanLockRef = useRef(false)

    // ── Scan burst cycling ──
    useEffect(() => {
        if (!active) return
        if (scanLockRef.current) return
        if (isScanning) return // Burst still running, wait for it to finish

        const timer = setTimeout(() => {
            if (active && !scanLockRef.current) {
                scanLockRef.current = true
                log('[ScanLoop] Starting scan burst')
                startScan(BURST_DURATION_S)
                setTimeout(() => { scanLockRef.current = false }, 500)
            }
        }, INTER_BURST_DELAY_MS)

        return () => clearTimeout(timer)
    }, [active, isScanning, startScan])

    /**
     * Flush stale BLE state before starting a new scan session.
     *
     * Clears non-connected devices from Redux. On Android, also removes
     * non-connected peripherals from the native BLE cache — but ONLY
     * peripherals that haven't already been removed by the disconnect
     * handler. Calling removePeripheral twice triggers a redundant GATT
     * cleanup that can block Android's BLE scanner for 10-60 seconds,
     * preventing advertisement delivery.
     */
    const flushBleCache = useCallback(async () => {
        dispatch(clearDiscoveredDevices())

        if (Platform.OS === 'android') {
            try {
                const cached = await BleManager.getDiscoveredPeripherals()
                const toRemove = cached.filter(p => {
                    if (!p.name || !isOurDevice(p.name)) return false
                    // Skip peripherals already removed by the disconnect handler.
                    // Android's getDiscoveredPeripherals can return stale entries
                    // for peripherals whose GATT cleanup is still in progress.
                    if (recentlyRemovedIds.has(p.id)) {
                        recentlyRemovedIds.delete(p.id)
                        log(`[ScanLoop] Skipping ${p.id} — already removed by disconnect handler`)
                        return false
                    }
                    return true
                })
                for (const p of toRemove) {
                    try {
                        await BleManager.removePeripheral(p.id)
                    } catch {
                        // Already removed — safe to ignore
                    }
                }
                if (toRemove.length > 0) {
                    log(`[ScanLoop] Removed ${toRemove.length} cached peripheral(s)`)
                }
            } catch (e) {
                logWarn('[ScanLoop] Failed to flush BLE cache:', e)
            }
        }

        log('[ScanLoop] Flushed stale BLE state')
    }, [dispatch])

    return { isScanning, flushBleCache, stopScan }
}
