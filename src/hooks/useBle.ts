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
import { guard, log, logError } from "../utils/logger"
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
import { deviceLogChange } from "../redux/slices/logsSlice"
import { scanError, scanStart } from "../redux/slices/scanningSlice"
import { useInterval } from "../hooks/useInterval"
import { clearAllDeviceIntervals, writeToDevice } from "../utils/helpers"
import {
	CommandConstructOptions,
	CommandControlTypes,
	CommandNames,
	COMMANDS,
	Services,
} from "../ble/types"
import { constructCommandString } from "../ble/parser"

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
	) => Promise<void>
	enginePause: (toggle: boolean) => void
	pingsPause: (toggle: boolean) => void
	enginePaused: React.MutableRefObject<boolean>
	pingsPaused: React.MutableRefObject<boolean>
}

type FunctionEngine = {
	fun: Function
	canBeIgnored?: boolean
	pausesTheEngine?: boolean
}

/**
 * These commands can have a bigger pause implemented after they're executed.
 */
const PAUSE = 500

/**
 * This special command will be ignored by the engine if
 * BLE is writing any information at that moment.
 */
const PING_REQUEST: string[] = []

export const useBle = (): ReturnType => {
	const { initialized } = useAppSelector((state) => state.bleLibrary)

	const [isBleConnecting, setIsBleConnecting] = useState(false)

	const devices = useAppSelector((state) => state.devices)
	const scanning = useAppSelector((state) => state.scanning)

	const dispatch = useAppDispatch()

	const bleWriteFunctionsToCall = useRef<FunctionEngine[]>([])
	const isBleWriting = useRef(false)
	const enginePauseRef = useRef(false)
	const pingsPauseRef = useRef(false)

	const clearPings = () => {
		bleWriteFunctionsToCall.current = bleWriteFunctionsToCall.current.filter(
			({ canBeIgnored }) => !canBeIgnored,
		)
	}

	/**
	 * Heart of the BLE - device bridge. It makes sure functions are
	 * called with a delay, it's actually possible to be faster then
	 * the device buffer.
	 */
	useInterval(async () => {
		if (enginePauseRef.current) {
			clearPings()
			return
		}

		if (isBleWriting.current) {
			return
		}

		isBleWriting.current = true
		if (bleWriteFunctionsToCall.current.length > 0) {
			while (bleWriteFunctionsToCall.current.length > 0) {
				const next = bleWriteFunctionsToCall.current.shift()
				if (next) {
					const { fun, canBeIgnored } = next

					if (pingsPauseRef.current && canBeIgnored) {
						// log(`Pinging paused`)
					} else {
						await fun()

						await sleep(PAUSE)
					}
				}
			}
		}
		isBleWriting.current = false
	}, 500)

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
			bleWriteFunctionsToCall.current = []
			await guard(() => BleManager.disconnect(peripheral.id))
			dispatch(deviceDisconnect({ id: peripheral.id }))
		},
		[dispatch, initialized],
	)

	const write = useCallback(
		async (peripheral: ExtendedPeripheral, data: (WriteData | string)[]) => {
			if (!initialized) return

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

			/**
			 * Simply maps the data in preparation for the BLE functions
			 * engine.
			 */
			interface MappedData extends Omit<FunctionEngine, "fun"> {
				str: string | undefined
			}

			const mappedData: MappedData[] = data.map((strOrCommand) => {
				if (typeof strOrCommand === "string")
					return {
						str: strOrCommand,
						canBeIgnored: PING_REQUEST.includes(strOrCommand),
					}
				const [commandName, options] = strOrCommand

				return {
					str: constructCommandString(commandName, options),
					canBeIgnored: PING_REQUEST.includes(commandName),
				}
			})

			mappedData.forEach(({ str, ...rest }) => {
				bleWriteFunctionsToCall.current.push({
					fun: () =>
						writeToDevice(peripheral, str)
							.then((e?: Error) => {
								if (e) {
									log(
										`Disconnecting device ${peripheral.id
										} due to an error (${JSON.stringify(e)})`,
									)
									disconnectDevice(peripheral)
								}
							})
							.catch(() => {
								log(
									`Disconnecting device ${peripheral.id} due to an error while calling writeToDevice`,
								)
								disconnectDevice(peripheral)
							}),
					...rest,
				})
			})
		},
		[devices, disconnectDevice, dispatch, initialized],
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
					dispatch(deviceLogChange({ id: newPeripheral.id, log: "" }))
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
							console.warn("MTU negotiation failed, proceeding with default speed:", mtuError)
						}
					}

					const services = await invokeWithTimeout(
						() => BleManager.retrieveServices(newPeripheral.id),
						"BleManager.retrieveServices",
						timeout,
					)
					log("Discovered services: " + JSON.stringify(services))

					newPeripheral.services = extractServiceAndCharacteristic(services)

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

					// Logs cleared at start, so we don't clear here anymore

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
		[initialized, scanning.isScanning, dispatch, write, disconnectDevice],
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
					log(`Skipping cleanup for already connected device: ${peripheral.id}`)
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
