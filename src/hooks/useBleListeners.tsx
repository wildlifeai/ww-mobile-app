import { useRef } from "react"
import { useCallback } from "react"
import { useEffect } from "react"

import { NativeEventEmitter, NativeModules, Platform } from "react-native"

import { Buffer } from "buffer"
import BleManager, { Peripheral } from "react-native-ble-manager"

import { guard, log } from "./../utils/logger"
import { useAppDispatch, useAppSelector } from "./../redux"
import {
	DEFAULT_PERIPHERAL,
	ExtendedPeripheral,
	deviceDisconnect,
	deviceSignalChanged,
	deviceUpdate,
} from "./../redux/slices/devicesSlice"
import { logAdded } from "./../redux/slices/logsSlice"
import { useInterval } from "../hooks/useInterval"
import { scanStop } from "../redux/slices/scanningSlice"
import { parseLogs } from "../ble/parser"
import {
	DeviceConfiguration,
	deviceConfigChanged,
} from "../redux/slices/configurationSlice"
import isEmpty from "lodash.isempty"
import { useBleActions } from "../providers/BleEngineProvider"
import { isOurDevice } from "../utils/helpers"
import { ImageReassembler } from "../utils/ImageReassembler"

// Lazy-load the emitter to avoid accessing NativeModules during import
let _bleManagerEmitter: NativeEventEmitter | null = null
export const getBleManagerEmitter = () => {
	if (!_bleManagerEmitter) {
		_bleManagerEmitter = new NativeEventEmitter(NativeModules.BleManager)
	}
	return _bleManagerEmitter
}

import { readlineParserEmitter } from "../ble/emitters"
import { bleCommandManager } from "../ble/commandManager"
export { readlineParserEmitter }

export type UpdateValueEventType = {
	characteristic: string
	peripheral: string
	service: string
	value: any
	isLocal?: boolean
}

/*
	Helper hook of useBleDevices to extract the listener logic out
	and make the code more readable. Simply attaches listeners
	to events triggered by the Ble library and helps update
	the state accordingly.
*/
export const useBleListeners = () => {
	const devices = useAppSelector((state) => state.devices)
	const configuration = useAppSelector((state) => state.configuration)
	const { disconnectDevice, pingsPause } = useBleActions()

	const dispatch = useAppDispatch()
	/*
		Ref is needed so that listeners are able to get access to the
		updated state.
	*/
	const devicesRef = useRef(devices)
	const configRef = useRef(configuration)

	useEffect(() => {
		devicesRef.current = devices
		configRef.current = configuration
	}, [devices, configuration])
	/** End */

	/**
	 * This interval takes care of trimming the device logs before
	 * they're processed by the reducers. It also acts as a sort of
	 * a buffer so that data is always reported in correct order as
	 * it arrives via the BLE library bridge.
	 */
	const allLogs = useRef<{ [x: string]: string }>({})
	const MAX_LOG_LENGTH = 15000

	useInterval(() => {
		for (const device in allLogs.current) {
			const currentLog = allLogs.current[device]
			if (currentLog.length > MAX_LOG_LENGTH) {
				allLogs.current[device] = currentLog.slice(
					currentLog.length - MAX_LOG_LENGTH,
					currentLog.length,
				)
			}
		}
	}, 5000)

	/*
		Helper function to check for newlines and emit a custom event
		that contains the full line. This is to avoid partial messages
		being processed by the rest of the app.
	*/
	const readlineParser = useCallback(
		(data: UpdateValueEventType) => {
			const { value, peripheral } = data

			// Check for binary packets (Image Transfer)
			// Protocol: 0x06 is Image Binary. Sometimes prefixed with 0x80 (Notification/Status).
			if (value[0] === 0x06 || (value[0] === 0x80 && value[1] === 0x06)) {
				readlineParserEmitter.emit(
					"BleManagerDidUpdateValueForCharacteristicReadlineParser",
					{
						...data,
						value,
					},
				)
				return
			}

			// Check for newline character in the received data
			const newlineIndex = Buffer.from(value).indexOf("\n")

			if (newlineIndex !== -1) {
				readlineParserEmitter.emit(
					"BleManagerDidUpdateValueForCharacteristicReadlineParser",
					{
						...data,
						value,
					},
				)
			} else {
				readlineParserEmitter.emit(
					"BleManagerDidUpdateValueForCharacteristicReadlineParser",
					{ peripheral: peripheral, value: [...value, 10, 13] },
				)
			}
		},
		[],
	)

	const deviceValueUpdatedEvent = useCallback(
		(data: UpdateValueEventType) => {
			const { peripheral, value, isLocal } = data

			const dataArray = value as number[]
			const hex = Buffer.from(dataArray).toString("hex")
			log(`${isLocal ? 'TX' : 'RX'} Hex: ${hex}`)

			// Check for binary image packet (0x06) or (0x80 0x06)
			// Firmware might send 0x80 as a status/header byte.
			let imagePacket: number[] | null = null;
			if (dataArray[0] === 0x06) {
				imagePacket = dataArray;
			} else if (dataArray[0] === 0x80 && dataArray[1] === 0x06) {
				imagePacket = dataArray.slice(1);
			}

			if (imagePacket) {
				const reassembler = ImageReassembler.getInstance()
				reassembler.processPacket(imagePacket)
				return
			}

			const text = Buffer.from(value).toString()

			// Feed to Command Manager for response tracking
			bleCommandManager.handleIncomingMessage(text)

			// Check for Image Transfer Start Message
			// Example: "10361 bytes in TL000019.JPG"
			const imageStartMatch = text.match(/(\d+) bytes in (.+)/)
			if (imageStartMatch) {
				const size = parseInt(imageStartMatch[1], 10)
				const filename = imageStartMatch[2]
				log(`Detected image transfer start: ${filename} (${size} bytes)`)
				ImageReassembler.getInstance().initialize(size)
			}

			const currentConfiguration = configRef.current[peripheral] || {}
			const currentLog = allLogs.current[peripheral] || ""

			// Format the new log entry
			// Add newline if there isn't one at the end of previous log
			const needsNewline = currentLog.length > 0 && !currentLog.endsWith('\n')
			const prefix = needsNewline ? '\n' : ''
			const formattedText = `${prefix}${isLocal ? '> TX: ' : '< RX: '}${text}${text.endsWith('\n') ? '' : '\n'}`

			if (allLogs.current[peripheral]) {
				allLogs.current[peripheral] += formattedText
			} else {
				allLogs.current[peripheral] = formattedText
			}
			const finishedLog = currentLog + formattedText

			dispatch(
				logAdded({
					id: peripheral,
					log: {
						timestamp: Date.now(),
						content: formattedText,
						type: isLocal ? "tx" : "rx",
					},
				}),
			)

			const commands = parseLogs(finishedLog, text)
			const newConfig = {} as DeviceConfiguration

			if (commands.length > 0) {
				commands.forEach((commandToProcess) => {
					const { command, error, value: newValue } = commandToProcess
					if (command && newValue) {
						const existingValue =
							currentConfiguration[command.name] &&
							currentConfiguration[command.name]?.value

						newConfig[command.name] = {
							value: newValue === undefined ? existingValue : newValue,
							loading: false,
							loaded: true,
							error,
						}
					}
				})
			}

			if (!isEmpty(newConfig)) {
				dispatch(
					deviceConfigChanged({
						id: peripheral,
						configuration: newConfig,
					}),
				)
			}
		},
		[dispatch],
	)

	const discoveredPeripheralEvent = useCallback(
		(peripheral: ExtendedPeripheral) => {
			if (!peripheral.name || !isOurDevice(peripheral.name)) return

			peripheral = {
				...DEFAULT_PERIPHERAL(peripheral.id),
				device: peripheral,
				name: peripheral.name,
				rssi: peripheral.rssi, // Copy RSSI value for signal strength display
				signalLost: false,
			}

			/**
			 * This dispatch slows down slower devices and makes the scan take longer
			 * then intended. For now, I'm leaving it in since the app looks cooler
			 * if the devices update in real time, plus, you need to have like 30+
			 * devices to actually notice the difference.
			 *
			 * If for some reason we get reports that scanning takes too long,
			 * remove this dispatch and use the getDiscoveredPeripherals below
			 * to get the devices after scan has stopped and simply call dispatch
			 * there in scanStoppedEvent just once, this will make the problem go away.
			 */
			dispatch(deviceUpdate(peripheral))
		},
		[dispatch],
	)

	const deviceDisconnectedEvent = useCallback(
		(data: { peripheral: string }) => {
			log(
				`Peripheral disconnect event triggered. Disconnecting: ${data.peripheral}`,
			)

			/** Clear the device out on Android systems */
			Platform.OS === "android" &&
				guard(() => BleManager.removePeripheral(data.peripheral))

			dispatch(deviceDisconnect({ id: data.peripheral }))
		},
		[dispatch],
	)

	const scanStoppedEvent = useCallback(async () => {
		pingsPause(false)

		const peripherals: Peripheral[] = await guard(() =>
			BleManager.getDiscoveredPeripherals(),
		)

		const filteredPeripherals = peripherals.filter((p) => {

			return p.name && isOurDevice(p.name)
		})

		const notFoundAnymore: Peripheral[] = []

		Object.keys(devicesRef.current).forEach((key) => {
			const peripheral = devicesRef.current[key]
			if (
				!filteredPeripherals.find(
					(filteredPeripheral) => filteredPeripheral.id === peripheral.id,
				)
			) {
				if (peripheral.connected) {
					log(`Disconnecting device ${peripheral.id} after scan stopped.`)
					// disconnectDevice(peripheral) // USER REQUEST: Prevent auto-disconnect
				}
				notFoundAnymore.push(peripheral)
			}
		})

		dispatch(
			deviceSignalChanged({
				data: [
					...filteredPeripherals.map((peripheral) => ({
						peripheral,
						value: false,
					})),
					...notFoundAnymore.map((peripheral) => ({
						peripheral,
						value: true,
					})),
				],
			}),
		)

		dispatch(scanStop())
		// log("Scan stopped.")
	}, [dispatch, pingsPause])

	useEffect(() => {
		const discoverDeviceFunc = getBleManagerEmitter().addListener(
			"BleManagerDiscoverPeripheral",
			discoveredPeripheralEvent,
		)
		const scanStoppedEventFunc = getBleManagerEmitter().addListener(
			"BleManagerStopScan",
			scanStoppedEvent,
		)
		const deviceDisconnectedEventFunc = getBleManagerEmitter().addListener(
			"BleManagerDisconnectPeripheral",
			deviceDisconnectedEvent,
		)
		const readlineParserFunc = getBleManagerEmitter().addListener(
			"BleManagerDidUpdateValueForCharacteristic",
			readlineParser,
		)

		readlineParserEmitter.on(
			"BleManagerDidUpdateValueForCharacteristicReadlineParser",
			deviceValueUpdatedEvent,
		)

		return () => {
			discoverDeviceFunc.remove()
			scanStoppedEventFunc.remove()
			deviceDisconnectedEventFunc.remove()
			readlineParserFunc.remove()

			readlineParserEmitter.removeListener(
				"BleManagerDidUpdateValueForCharacteristicReadlineParser",
				deviceValueUpdatedEvent,
			)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])
}
