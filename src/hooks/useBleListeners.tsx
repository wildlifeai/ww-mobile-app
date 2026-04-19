import { useRef, useCallback, useEffect } from "react"
import { NativeEventEmitter, NativeModules, Platform } from "react-native"
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
import { scanStop } from "../redux/slices/scanningSlice"
import { useBleActions } from "../providers/BleEngineProvider"
import { isOurDevice } from "../utils/helpers"
import { ImageReassembler } from "../utils/ImageReassembler"
import { imageReassemblerEmitter, readlineParserEmitter } from "../ble/emitters"
import { rxRouter } from "../ble/protocol/rxRouter"
import { bleEventBus, BleEvent } from "../ble/protocol/eventBus"

// Lazy-load the emitter to avoid accessing NativeModules during import
let _bleManagerEmitter: NativeEventEmitter | null = null
export const getBleManagerEmitter = () => {
	if (!_bleManagerEmitter) {
		_bleManagerEmitter = new NativeEventEmitter(NativeModules.BleManager)
	}
	return _bleManagerEmitter
}

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
	const { pingsPause } = useBleActions()

	const dispatch = useAppDispatch()
	
    // Create a persistent instance of ImageReassembler for this session
    const reassemblerRef = useRef<ImageReassembler | null>(null)

    useEffect(() => {
        // Instantiate with the global emitter
        reassemblerRef.current = new ImageReassembler(imageReassemblerEmitter)
        return () => {
            reassemblerRef.current?.destroy()
        }
    }, [])
    
	/*
		Ref is needed so that listeners are able to get access to the
		updated state.
	*/
	const devicesRef = useRef(devices)

	useEffect(() => {
		devicesRef.current = devices
	}, [devices])
	/** End */

	/*
		Helper function to check for newlines and emit a custom event
		that contains the full line. This is to avoid partial messages
		being processed by the rest of the app.
	*/
	const readlineParser = useCallback(
		(data: UpdateValueEventType) => {
			const { value, peripheral } = data

			// Feed the new Shadow Mode router simultaneously
			rxRouter.handleIncomingBytes(peripheral, value as number[])

			// Check for binary packets (Image Transfer)
			// Protocol: 0x06 is Image Binary. Sometimes prefixed with 0x80 (Notification/Status).
			if (value[0] === 0x06 || (value[0] === 0x80 && value[1] === 0x06)) {
				const dataArray = value as number[]
				const imagePacket = dataArray[0] === 0x06 ? dataArray : dataArray.slice(1)
				
				// Direct processing to avoid JS thread latency from extra event hops
				reassemblerRef.current?.processPacket(imagePacket)
				return
			}

		},
		[],
	)
    // Subscribe to bleEventBus for telemetry rendering in UI
    useEffect(() => {
        const handleRawRx = (event: BleEvent & { type: 'RAW_RX' }) => {
            log(`[useBleListeners] RAW_RX received for ${event.deviceId}: ${event.line}`)
            
            // Look for transfer startup string (e.g. "12169 bytes in 592009C0.JPG")
            const imageStartMatch = event.line.match(/^\s*(\d+)\s+bytes\s+in\s+([A-Za-z0-9_.-]+)/i)
            if (imageStartMatch) {
                const size = parseInt(imageStartMatch[1], 10)
                const filename = imageStartMatch[2]
                log(`[useBleListeners] Detected image transfer start: ${filename} (${size} bytes)`)
                reassemblerRef.current?.initialize(size)
            }

            dispatch(
                logAdded({
                    id: event.deviceId,
                    log: {
                        timestamp: event.ts,
                        content: `< RX: ${event.line}${event.line.endsWith('\n') ? '' : '\n'}`,
                        type: "rx",
                    },
                })
            )
        };

        const handleRawTx = (event: BleEvent & { type: 'RAW_TX' }) => {
            log(`[useBleListeners] RAW_TX received for ${event.deviceId}: ${event.command}`)
            dispatch(
                logAdded({
                    id: event.deviceId,
                    log: {
                        timestamp: event.ts,
                        content: `> TX: ${event.command}\n`,
                        type: "tx",
                    },
                })
            )
        };

        bleEventBus.on('rawRx', handleRawRx)
        bleEventBus.on('rawTx', handleRawTx)

        return () => {
            bleEventBus.removeListener('rawRx', handleRawRx)
            bleEventBus.removeListener('rawTx', handleRawTx)
        }
    }, [dispatch]);

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

			// CRITICAL: Clear any pending buffers to prevent stuck state on reconnect
			rxRouter.clearBuffer(data.peripheral)

			/** Clear the device out on Android systems */
			Platform.OS === "android" &&
				guard(() => BleManager.removePeripheral(data.peripheral))

			dispatch(deviceDisconnect({ id: data.peripheral }))
		},
		[dispatch],
	)

	const scanStoppedEvent = useCallback(async () => {
		pingsPause(false)

		const peripherals: Peripheral[] = (await guard(() =>
			BleManager.getDiscoveredPeripherals(),
		)) as Peripheral[]

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

		return () => {
			discoverDeviceFunc.remove()
			scanStoppedEventFunc.remove()
			deviceDisconnectedEventFunc.remove()
			readlineParserFunc.remove()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])
}
