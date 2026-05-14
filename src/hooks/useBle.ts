import React, { useCallback, useEffect, useRef, useState } from "react"

import { Platform } from "react-native"

import BleManager from "react-native-ble-manager"
import { Peripheral } from "react-native-ble-manager"

import { BLE_SERVICE_UUID } from "../utils/constants"
import {
	invokeWithTimeout,
	isOurDevice
} from "../utils/helpers"
import { guard, log, logError, logWarn } from '../utils/logger'
import { useAppDispatch, useAppSelector } from "../redux"
import {
	ExtendedPeripheral,
	deviceDisconnect,
	deviceLoading,
	deviceUpdate,
} from "../redux/slices/devicesSlice"
import { clearLogs } from "../redux/slices/logsSlice"
import { scanError, scanStart } from "../redux/slices/scanningSlice"
import { clearAllDeviceIntervals } from "../utils/helpers"
import { extractServiceAndCharacteristic, writeToDevice } from "../ble/transport"
import {
	CommandConstructOptions,
	CommandNames,
	Services,
} from "../ble/types"
import { bleEventBus } from "../ble/protocol/eventBus"
import { markPeripheralRemoved } from "./useScanLoop"

export type WriteData = [CommandNames, CommandConstructOptions]

export type ReturnType = {
	isBleConnecting: boolean | undefined
	startScan: (length?: number) => void
	stopScan: () => Promise<void>
	connectDevice: (
		peripheral: ExtendedPeripheral,
		timeout?: number,
	) => Promise<ExtendedPeripheral>
	disconnectDevice: (peripheral: ExtendedPeripheral) => void
	writeRaw: (
		peripheral: ExtendedPeripheral,
		data: string,
	) => Promise<void>
	pingsPause: (toggle: boolean) => void
	pingsPaused: React.MutableRefObject<boolean>
}


export const useBle = (): ReturnType => {
	const { initialized } = useAppSelector((state) => state.bleLibrary)

	const [isBleConnecting, setIsBleConnecting] = useState(false)

	const devices = useAppSelector((state) => state.devices)

	const dispatch = useAppDispatch()

	const pingsPauseRef = useRef(false)


	const pingsPause = useCallback((toggle: boolean) => {
		pingsPauseRef.current = toggle
	}, [])

	const startScan = useCallback(
		async (length: number = 6) => {
			if (!initialized) return

			try {
				// Always stop first — the native BleManagerStopScan event can lag
				// behind, leaving isScanning stale and blocking the next cycle.
				await BleManager.stopScan()
				pingsPause(true)
				// Use specific service UUID to avoid Android throttling wide-open scans
				// Force Android into SCAN_MODE_LOW_LATENCY (2) to minimize advertisement drop rates
				await BleManager.scan([BLE_SERVICE_UUID], length, true, { scanMode: 2, matchMode: 1 })
				// log("Scan started")
				dispatch(scanStart())
			} catch (e: any) {
				logError(e)
				dispatch(scanError(e))
			}
		},
		[initialized, pingsPause, dispatch],
	)

	const stopScan = useCallback(
		async () => {
			if (!initialized) return
			try {
				await BleManager.stopScan()
			} catch (e: any) {
				logWarn('Failed to stop scan:', e)
			}
		},
		[initialized],
	)

	const disconnectDevice = useCallback(
		async (peripheral: Peripheral | ExtendedPeripheral) => {
			if (!initialized) return
			// Clear reconnecting guard to prevent stale state blocking future connects
			isDeviceReconnecting.current[peripheral.id] = false
			setIsBleConnecting(false)
			await guard(() => BleManager.disconnect(peripheral.id))
			dispatch(deviceDisconnect({ id: peripheral.id }))
		},
		[dispatch, initialized],
	)

	const writeRaw = useCallback(async (peripheral: ExtendedPeripheral, data: string) => {
		if (!initialized) return
		
		try {
			await writeToDevice(peripheral, data)
			bleEventBus.emitEvent({
				type: 'RAW_TX',
				command: data.trim(),
				deviceId: peripheral.id,
				ts: Date.now()
			} as any)
		} catch (error) {
			const errMsg = error instanceof Error ? error.message : String(error)
			logError(`[RAW_TX] Error writing to device: ${errMsg}`)
			throw error
		}
	}, [initialized])

	const isDeviceReconnecting = useRef<{ [x: string]: boolean }>({})

	const connectDevice = useCallback(
		async (peripheral: ExtendedPeripheral, timeout?: number) => {
			if (!initialized || peripheral.loading) return peripheral

			// Always stop scan before connecting — safe to call when not scanning
			await BleManager.stopScan()
			/**
			 * If multiple connectDevice functions are called for a certain device,
			 * this makes sure to avoid any idiotic disconnects when some calls
			 * timeout after some calls already succeed.
			 *
			 * Basically, use the timeout.
			 */
			if (isDeviceReconnecting.current[peripheral.id]) {
				// If the device is no longer connected, the previous connect attempt
				// was interrupted (e.g. unexpected disconnect/DPD). Clear the stale
				// guard so we can reconnect.
				if (!peripheral.connected) {
					log(`Clearing stale reconnecting guard for ${peripheral.id}`)
					isDeviceReconnecting.current[peripheral.id] = false
					setIsBleConnecting(false)
				} else {
					return peripheral
				}
			}

			/** Clean up intervals */
			clearAllDeviceIntervals(peripheral)

			isDeviceReconnecting.current[peripheral.id] = true

			setIsBleConnecting(true)

			const newPeripheral = { ...peripheral }

			dispatch(deviceLoading({ id: newPeripheral.id, loading: true }))

			const deviceIdentification = newPeripheral.name

			if (!newPeripheral.connected) {
				try {
					// log(`Device ${deviceIdentification} will try to connect`)

					// Clear logs BEFORE starting connection/notifications to ensure we don't wipe early firmware messages
					dispatch(clearLogs({ id: newPeripheral.id }))

					// Android BLE stack needs time to release a previous GATT connection
					// after removePeripheral. Without this, rapid reconnect races with
					// cleanup causing "Disconnect called before connect callback invoked".
					if (Platform.OS === "android") {
						await new Promise(resolve => setTimeout(resolve, 500))
					}

					await invokeWithTimeout(
						() => BleManager.connect(newPeripheral.id),
						"BleManager.connect",
						timeout,
					)

					const services = await invokeWithTimeout(
						() => BleManager.retrieveServices(newPeripheral.id),
						"BleManager.retrieveServices",
						timeout,
					)
					// log("Discovered services: " + JSON.stringify(services))

					// Cast to correct type
					newPeripheral.services = extractServiceAndCharacteristic(services as unknown as Services)

					const {
						serviceCharacteristic,
						readCharacteristic,
					} = newPeripheral.services

					// CRITICAL: Enable notifications IMMEDIATELY after service discovery
					// This triggers BLE_NUS_EVT_COMM_STARTED firmware event
					// MTU negotiation is moved AFTER this to avoid blocking the GATT queue
					await invokeWithTimeout(
						() =>
							BleManager.startNotification(
								newPeripheral.id,
								serviceCharacteristic,
								readCharacteristic,
							),
						"BleManager.startNotification",
						timeout,
					)

					log(`Notifications started for ${readCharacteristic}`)

					// MTU optimization - do this AFTER notifications to avoid blocking CCCD write
					// This prevents the 8-second delay caused by MTU blocking the GATT queue
					if (Platform.OS === "android") {
						try {
                            // Request high priority (1) for faster transfer
                            await invokeWithTimeout(
                                () => BleManager.requestConnectionPriority(newPeripheral.id, 1),
                                "BleManager.requestConnectionPriority",
                                timeout
                            )
                            log("Connection priority: High")

							await invokeWithTimeout(
								() => BleManager.requestMTU(newPeripheral.id, 512),
								"BleManager.requestMTU",
								timeout,
							)
							log("MTU negotiated to 512 bytes")
						} catch (mtuError) {
							logWarn("MTU/Priority negotiation failed, using default:", mtuError)
						}
					}

					await BleManager.readRSSI(newPeripheral.id)

					log(`Device ${deviceIdentification} connected`)

					newPeripheral.connected = true
					newPeripheral.intervals = {}

					dispatch(deviceUpdate({ ...newPeripheral }))
				} catch (e: any) {
					log(e)
					log("Connecting to device failed, disconnecting device.")
					await disconnectDevice(newPeripheral)
				}
			}

			dispatch(deviceLoading({ id: newPeripheral.id, loading: false }))

			if (isDeviceReconnecting.current[peripheral.id]) {
				setIsBleConnecting(false)
				isDeviceReconnecting.current[peripheral.id] = false
			}

			return newPeripheral
		},
		[initialized, dispatch, disconnectDevice],
	)

	const removeLeftoverDevices = useCallback(() => {
		if (!initialized) return

		BleManager.getConnectedPeripherals([]).then(async (results) => {
			// Otherwise we unpair everything, ups.
			results = results.filter(
				(device) => device.name && isOurDevice(device.name),
			)

			if (results.length === 0) {
				log("No connected devices found when checking cached peripherals")
				return
			}

			// Use for...of (not .map) so each removal completes before the next.
			// removePeripheral blocks Android's BLE scanner — fire-and-forget
			// caused the scanner to be blocked when the user started scanning.
			for (const peripheral of results) {
				// Prevent disconnecting devices that are already handled by the app state
				if (devices[peripheral.id]?.connected) {
					continue
				}

				if (
					Platform.OS === "android" &&
					(await BleManager.isPeripheralConnected(peripheral.id, [
						BLE_SERVICE_UUID,
					]))
				) {
					log(
						`Connected device ${peripheral.id} found when the app was initialized, clearing it from cache`,
					)
					await guard(() => BleManager.removePeripheral(peripheral.id))
					// Mark as removed so flushBleCache skips the redundant
					// removePeripheral call that would block the scanner again.
					markPeripheralRemoved(peripheral.id)
					await disconnectDevice(peripheral)
				}
			}
		})
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [initialized])

	useEffect(() => {
		removeLeftoverDevices()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [initialized])

	return {
		isBleConnecting,
		startScan,
		stopScan,
		connectDevice,
		disconnectDevice,
		writeRaw,
		pingsPause,
		pingsPaused: pingsPauseRef,
	}
}
