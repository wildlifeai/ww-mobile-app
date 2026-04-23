import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useNavigation } from '@react-navigation/native'

import { useBleActions } from '../providers/BleEngineProvider'
import { useAppSelector, useAppDispatch } from '../redux'
import { ExtendedPeripheral } from '../redux/slices/devicesSlice'
import { setEngineerConsoleActive } from '../redux/slices/scanningSlice'
import { log, logError } from '../utils/logger'

export type EngineerConnectState = 'idle' | 'scanning' | 'no_devices' | 'connecting' | 'select'

export const useEngineerConnect = () => {
    const navigation = useNavigation<any>()
    const dispatch = useAppDispatch()
    const { startScan, stopScan, connectDevice } = useBleActions()
    const devices = useAppSelector((state) => state.devices)
    const { isScanning } = useAppSelector((state) => state.scanning)

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

    // Start the continuous scan flow
    const beginScan = useCallback(() => {
        hasNavigatedRef.current = false
        isConnectingRef.current = false
        setDialogState('scanning')
        setConnectingDevice(null)
        dispatch(setEngineerConsoleActive(true))
        // Start a short 3-second scan burst. The effect below will restart it if needed.
        startScan(3)
    }, [startScan, dispatch])

    // Scan loop — keep restarting the scan in 3s bursts while in 'scanning' state
    // This matches the fast-discovery strategy from useDeviceDiscovery
    const scanCommandLockRef = useRef(false)
    useEffect(() => {
        if (dialogState === 'scanning' && !isConnectingRef.current && !isScanning && !scanCommandLockRef.current) {
            scanCommandLockRef.current = true
            startScan(3)
            setTimeout(() => {
                scanCommandLockRef.current = false
            }, 500)
        }
    }, [dialogState, isScanning, startScan])

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
                startScan(3)
            }
        } catch (error) {
            logError('[EngineerConnect] Connection error:', error)
            // Go back to scanning
            isConnectingRef.current = false
            setDialogState('scanning')
            setConnectingDevice(null)
            startScan(3)
        }
    }, [connectDevice, navigation, dispatch, startScan])

    // Reset state when dialog is dismissed / user cancels
    const reset = useCallback(() => {
        setDialogState('idle')
        setConnectingDevice(null)
        hasNavigatedRef.current = false
        isConnectingRef.current = false
        dispatch(setEngineerConsoleActive(false))
        if (isScanning) {
            stopScan()
        }
    }, [isScanning, stopScan, dispatch])

    return {
        dialogState,
        discoveredDevices,
        connectingDevice,
        beginScan,
        selectDevice,
        reset,
    }
}
