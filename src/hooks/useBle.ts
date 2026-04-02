import React, { useCallback, useEffect, useRef, useState } from "react"

import { Platform } from "react-native"

import BleManager from "react-native-ble-manager"
import { Peripheral } from "react-native-ble-manager"

import { BLE_SERVICE_UUID } from "../utils/constants"
import {
	invokeWithTimeout,
	isOurDevice,
	sleep,
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
	BleCommandOptions,
	CommandConstructOptions,
	// CommandControlTypes,
	CommandNames,
	// COMMANDS,
	Services,
} from "../ble/types"
import { constructCommandString } from "../ble/types"
import { bleCommandManager } from "../ble/commandManager"
import { getCommandByName } from "../ble/types"

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
	write: (
		peripheral: ExtendedPeripheral,
		data: (string | WriteData)[],
		options?: BleCommandOptions,
	) => Promise<string[]>
	pingsPause: (toggle: boolean) => void
	pingsPaused: React.MutableRefObject<boolean>
}

const PAUSE = 20

export const useBle = (): ReturnType => {
	const { initialized } = useAppSelector((state) => state.bleLibrary)

	const [isBleConnecting, setIsBleConnecting] = useState(false)

	const devices = useAppSelector((state) => state.devices)
	const scanning = useAppSelector((state) => state.scanning)

	const dispatch = useAppDispatch()

	const pingsPauseRef = useRef(false)


	const pingsPause = useCallback((toggle: boolean) => {
		pingsPauseRef.current = toggle
	}, [])

	const startScan = useCallback(
		async (length: number = 6) => {
			if (!initialized) return

			if (!scanning.isScanning) {
				try {
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
			}
		},
		[initialized, scanning.isScanning, pingsPause, dispatch],
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
			bleCommandManager.clear()
			await guard(() => BleManager.disconnect(peripheral.id))
			dispatch(deviceDisconnect({ id: peripheral.id }))
		},
		[dispatch, initialized],
	)

	const write = useCallback(
		async (
			peripheral: ExtendedPeripheral,
			data: (WriteData | string)[],
			options: BleCommandOptions = {},
		): Promise<string[]> => {
			if (!initialized) return []



			const results: string[] = []

			for (const strOrCommand of data) {
				let commandString: string | undefined

				if (typeof strOrCommand === "string") {
					commandString = strOrCommand
				} else {
					const [commandName, constructOptions] = strOrCommand
					commandString = constructCommandString(commandName, constructOptions)
				}

				if (commandString) {
					try {
						// Look up command definition for regex pattern if not already provided
						let lookupName = typeof strOrCommand === "string" ? strOrCommand : strOrCommand[0]
						const cmdDef = getCommandByName(lookupName)
						const cmdOptions = { ...options }
						if (cmdOptions.expectedPattern === undefined && cmdDef?.readRegex) {
							cmdOptions.expectedPattern = cmdDef.readRegex
						}
						// Use command-specific timeout if no override provided in options
						if (cmdOptions.timeout === undefined && cmdDef?.timeout) {
							cmdOptions.timeout = cmdDef.timeout
						}

						const response = await bleCommandManager.sendCommand(
							peripheral,
							{ name: lookupName || 'UNKNOWN', string: commandString },
							writeToDevice,
							cmdOptions,
						)
						results.push(response)
						// Add small delay between commands to be nice to firmware
						await sleep(PAUSE)
					} catch (error) {
						const errMsg = error instanceof Error ? error.message : String(error)
                        const isCleared = errMsg.includes('Command manager cleared')
                        
                        // Treat cleared command manager during explicit disconnects gracefully
                        if (isCleared && (commandString === CommandNames.dis || commandString === 'dis')) {
                            log(`[useBle] Command manager cleared during disconnect command (expected)`)
                        } else {
						    logError(`Error writing command ${commandString}: ${errMsg}`)
                        }
                        
						results.push(`ERROR: ${errMsg}`)
						
						// Stop the sequence if the error is fatal (disconnection or cancelled)
						const isFatal = 
							errMsg.includes('Peripheral not found') || 
							errMsg.includes('not connected') || 
							isCleared ||
							errMsg.includes('disconnected')

						if (isFatal) {
                            if (isCleared && (commandString === CommandNames.dis || commandString === 'dis')) {
                                log(`[useBle] Stopping command sequence normally due to explicit disconnect`)
                            } else {
							    logWarn(`[useBle] Fatal error detected, stopping command sequence: ${errMsg}`)
                            }
							throw error
						}
					}
				}
			}

			return results
		},
		[initialized],
	)

	const isDeviceReconnecting = useRef<{ [x: string]: boolean }>({})

	const connectDevice = useCallback(
		async (peripheral: ExtendedPeripheral, timeout?: number) => {
			if (!initialized || peripheral.loading) return peripheral

			if (scanning.isScanning) {
				await BleManager.stopScan()
			}
			/**
			 * If multiple connectDevice functions are called for a certain device,
			 * this makes sure to avoid any idiotic disconnects when some calls
			 * timeout after some calls already succeed.
			 *
			 * Basically, use the timeout.
			 */
			if (isDeviceReconnecting.current[peripheral.id]) {
				// log(
				// 	`Cancelling the connection request for ${peripheral.id}. connectDevice is already running.`,
				// )
				return peripheral
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
		[initialized, scanning.isScanning, dispatch, disconnectDevice],
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

			results.map(async (peripheral) => {
				// Prevent disconnecting devices that are already handled by the app state
				if (devices[peripheral.id]?.connected) {
					return
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
					await disconnectDevice(peripheral)
				}
			})
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
		write,
		pingsPause,
		pingsPaused: pingsPauseRef,
	}
}
