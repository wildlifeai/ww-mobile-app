import React, { useCallback, useEffect, useRef, useState } from "react"

import { Platform } from "react-native"

import BleManager from "react-native-ble-manager"
import { Peripheral } from "react-native-ble-manager"

import { BLE_SERVICE_UUID } from "../utils/constants"
import {
	extractServiceAndCharacteristic,
	invokeWithTimeout,
	isOurDevice,
	sleep,
} from "../utils/helpers"
import { guard, log, logError, logWarn } from '../utils/logger'
import { useAppDispatch, useAppSelector } from "../redux"
import {
	deviceConfigClear,
	deviceConfigInitiated,
} from "../redux/slices/configurationSlice"
import {
	ExtendedPeripheral,
	deviceDisconnect,
	deviceLoading,
	deviceUpdate,
} from "../redux/slices/devicesSlice"
import { clearLogs } from "../redux/slices/logsSlice"
import { scanError, scanStart } from "../redux/slices/scanningSlice"
// import { useInterval } from "../hooks/useInterval"
import { clearAllDeviceIntervals, writeToDevice } from "../utils/helpers"
import {
	BleCommandOptions,
	CommandConstructOptions,
	// CommandControlTypes,
	CommandNames,
	// COMMANDS,
	Services,
} from "../ble/types"
import { constructCommandString } from "../ble/parser"
import { bleCommandManager } from "../ble/commandManager"
import { getCommandByName } from "../ble/types"

export type WriteData = [CommandNames, CommandConstructOptions]

export type ReturnType = {
	isBleConnecting: boolean | undefined
	startScan: (length?: number) => void
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
	enginePause: (toggle: boolean) => void
	pingsPause: (toggle: boolean) => void
	enginePaused: React.MutableRefObject<boolean>
	pingsPaused: React.MutableRefObject<boolean>
}

const PAUSE = 20

export const useBle = (): ReturnType => {
	const { initialized } = useAppSelector((state) => state.bleLibrary)

	const [isBleConnecting, setIsBleConnecting] = useState(false)

	const devices = useAppSelector((state) => state.devices)
	const scanning = useAppSelector((state) => state.scanning)

	const dispatch = useAppDispatch()

	const enginePauseRef = useRef(false)
	const pingsPauseRef = useRef(false)

	/**
	 * Wrapper for writeToDevice to match BleCommandManager signature
	 */
	const writeToDeviceWrapper = useCallback(
		async (p: ExtendedPeripheral, s: string) => {
			const err = await writeToDevice(p, s)
			if (err) throw err
		},
		[],
	)

	// Removed legacy useInterval polling queue. BleCommandManager handles serialization now.

	const enginePause = useCallback((toggle: boolean) => {
		// log(`Engine turning: ${toggle ? "off" : "on"}`)
		enginePauseRef.current = toggle
	}, [])

	const pingsPause = useCallback((toggle: boolean) => {
		// log(`Pinging paused: ${toggle ? "YES" : "NO"}`)
		pingsPauseRef.current = toggle
	}, [])

	const startScan = useCallback(
		async (length: number = 6) => {
			if (!initialized) return

			if (!scanning.isScanning) {
				try {
					pingsPause(true)
					await BleManager.scan([], length)
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

			const currentPeripheral = devices[peripheral.id]

			if (currentPeripheral) {
				dispatch(
					deviceConfigInitiated({
						id: peripheral.id,
						data: data
							.filter((strOrCommand) => typeof strOrCommand !== "string")
							.map(([name]) => {
								return name as CommandNames
							}),
					}),
				)
			}

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
						if (!cmdOptions.expectedPattern && cmdDef?.readRegex) {
							cmdOptions.expectedPattern = cmdDef.readRegex
						}

						const response = await bleCommandManager.sendCommand(
							peripheral,
							commandString,
							writeToDeviceWrapper,
							cmdOptions,
						)
						results.push(response)
						// Add small delay between commands to be nice to firmware
						await sleep(PAUSE)
					} catch (error) {
						logError(`Error writing command ${commandString}: ${error}`)
						results.push(`ERROR: ${error}`)
						// On critical error, we might want to disconnect or stop processing
						// disconnectDevice(peripheral) 
					}
				}
			}

			return results
		},
		[devices, dispatch, initialized, writeToDeviceWrapper],
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
					dispatch(deviceConfigClear({ id: newPeripheral.id }))

					// if (Platform.OS === "android") {
					// 	await BleManager.createBond(newPeripheral.id)
					// }

					await invokeWithTimeout(
						() => BleManager.connect(newPeripheral.id),
						"BleManager.connect",
						timeout,
					)

					if (Platform.OS === "android") {
						// Tolerate MTU failure (Samsung devices/slow connections)
						try {
							await invokeWithTimeout(
								() => BleManager.requestMTU(newPeripheral.id, 512),
								"BleManager.requestMTU",
								timeout,
							)
						} catch (mtuError) {
							logWarn("MTU negotiation failed, proceeding with default speed:", mtuError)
						}
					}

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
					// log(`Skipping cleanup for already connected device: ${peripheral.id}`)
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
		connectDevice,
		disconnectDevice,
		write,
		enginePause,
		enginePaused: enginePauseRef,
		pingsPause,
		pingsPaused: pingsPauseRef,
	}
}
