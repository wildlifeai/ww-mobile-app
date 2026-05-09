import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useNavigation } from '@react-navigation/native'

import { useBleActions } from '../providers/BleEngineProvider'
import { useAppSelector, useAppDispatch } from '../redux'
import { ExtendedPeripheral } from '../redux/slices/devicesSlice'
import { setEngineerConsoleActive } from '../redux/slices/scanningSlice'
import { useScanLoop } from './useScanLoop'
import { log, logError } from '../utils/logger'

export type EngineerConnectState = 'idle' | 'scanning' | 'no_devices' | 'connecting' | 'select'

export const useEngineerConnect = () => {
    const navigation = useNavigation<any>()
    const dispatch = useAppDispatch()
    const { stopScan, connectDevice } = useBleActions()
    const devices = useAppSelector((state) => state.devices)

    const [dialogState, setDialogState] = useState<EngineerConnectState>('idle')
    const [connectingDevice, setConnectingDevice] = useState<ExtendedPeripheral | null>(null)
    const hasNavigatedRef = useRef(false)
    const isConnectingRef = useRef(false)

    // Filter and sort discovered devices (same logic as useDeviceDiscovery)
    const discoveredDevices = useMemo(() => {
        return Object.values(devices)
            .sort((a, b) => {
                if (a.rssi && b.rssi) {
                    if (b.rssi === 127 || a.rssi === 127) return -1
                    return b.rssi - a.rssi
                }
                return -1
            })
            .filter((device) => !device.signalLost)
    }, [devices])

    // ── Shared scan loop ──
    const { flushBleCache } = useScanLoop({
        active: dialogState === 'scanning' && !isConnectingRef.current,
    })

    // Start the continuous scan flow
    const beginScan = useCallback(async () => {
        hasNavigatedRef.current = false
        isConnectingRef.current = false
        setConnectingDevice(null)
        dispatch(setEngineerConsoleActive(true))
        // Flush stale BLE state BEFORE enabling the scan loop.
        // On Android, removePeripheral() inside flushBleCache blocks the
        // BLE scanner for 10-60s. If we set dialogState='scanning' first,
        // the scan loop starts while the cache is still being flushed,
        // causing the first scan burst to find nothing.
        await flushBleCache()
        setDialogState('scanning')
    }, [dispatch, flushBleCache])

    // Auto-connect when device appears during scanning
    useEffect(() => {
        if (dialogState !== 'scanning') return
        if (isConnectingRef.current) return
        if (discoveredDevices.length === 0) return

        // A device appeared! Auto-connect to the first (strongest signal) device
        log(`[EngineerConnect] Device found during scan, auto-connecting: ${discoveredDevices[0].id}`)
        isConnectingRef.current = true
        stopScan().then(() => {
            selectDevice(discoveredDevices[0])
        }).catch(() => {
            selectDevice(discoveredDevices[0])
        })
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dialogState, discoveredDevices])

    // Connect to a selected device and navigate
    const selectDevice = useCallback(async (device: ExtendedPeripheral) => {
        if (hasNavigatedRef.current) return // Prevent re-entry
        setDialogState('connecting')
        setConnectingDevice(device)
        log(`[EngineerConnect] Connecting to ${device.name || device.id}`)

        try {
            const connected = await connectDevice(device)
            if (connected.connected) {
                log(`[EngineerConnect] Connected, navigating to EngineerConsoleScreen`)
                hasNavigatedRef.current = true
                setDialogState('idle')
                setConnectingDevice(null)
                dispatch(setEngineerConsoleActive(false))
                navigation.navigate('EngineerConsoleScreen', { deviceId: device.id })
            } else {
                logError('[EngineerConnect] Connection failed')
                // Go back to scanning
                isConnectingRef.current = false
                setDialogState('scanning')
                setConnectingDevice(null)
            }
        } catch (error) {
            logError('[EngineerConnect] Connection error:', error)
            // Go back to scanning
            isConnectingRef.current = false
            setDialogState('scanning')
            setConnectingDevice(null)
        }
    }, [connectDevice, navigation, dispatch])

    // Reset state when dialog is dismissed / user cancels
    const reset = useCallback(() => {
        setDialogState('idle')
        setConnectingDevice(null)
        hasNavigatedRef.current = false
        isConnectingRef.current = false
        dispatch(setEngineerConsoleActive(false))
        stopScan()
    }, [stopScan, dispatch])

    return {
        dialogState,
        discoveredDevices,
        connectingDevice,
        beginScan,
        selectDevice,
        reset,
    }
}
