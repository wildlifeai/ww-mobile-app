import dayjs from "dayjs"
import { ExtendedPeripheral } from "../redux/slices/devicesSlice"
import { log } from "./logger"
import {
	BLE_CHARACTERISTIC_READ_UUID,
	BLE_CHARACTERISTIC_WRITE_UUID,
	BLE_SERVICE_UUID,
	DEVICE_NAMES,
	BLE_DFU_SERVICE_UUID,
} from "./constants"
import BleManager from "react-native-ble-manager"
import { Buffer } from "buffer"
import { readlineParserEmitter } from "../ble/emitters"
import { Services } from "../ble/types"
import AsyncStorage from "@react-native-async-storage/async-storage"

export const clearAllDeviceIntervals = (
	device: ExtendedPeripheral | undefined | null,
) => {
	if (!device) return

	for (const key in device.intervals) {
		const timer = device.intervals[key]

		if (typeof timer === "number") {
			log(`Interval ${key} cleared (ID = ${timer})`)
			clearInterval(timer)
		}
	}
}

export const invokeWithTimeout = async (
	func: Function,
	name: string = "Anonymous",
	timeout: number = 13000,
) => {
	return new Promise(async (resolve, reject) => {
		const id = setTimeout(
			() => reject(Error(`${name} function timed out`)),
			timeout,
		)
		try {
			const result = await func()
			clearTimeout(id)
			resolve(result)
		} catch (error: any) {
			clearTimeout(id)
			reject(Error(error))
		}
	})
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export type WriteFunction = (
	peripheral: ExtendedPeripheral,
	data: string | undefined,
) => Promise<Error | undefined>

const DEVICE_NOT_CONNECTED_ANYMORE = [
	"Device disconnected",
	"Device is not connected",
	"Write failed",
	"Could not find service",
]

export const writeToDevice: WriteFunction = async (peripheral, data) => {
	if (!peripheral.connected) return

	if (data) {
		if (data === "") return

		try {
			// Strip trailing newlines/CRs as they break firmware command matching
			const sanitizedData = data.replace(/[\r\n]+$/, "")
			// Revert: Firmware rejects newline (treats as extra char causing mismatch)
			const byteArray = [...Buffer.from(sanitizedData)]
			console.log('DEBUG: byteArray content:', byteArray)
			log(`TX Hex: ${Buffer.from(byteArray).toString("hex")}`)

			// Push a LF-CR (LF = 10, CR = 13 in decimal) to local listener for UI feedback
			readlineParserEmitter.emit(
				"BleManagerDidUpdateValueForCharacteristicReadlineParser",
				{ peripheral: peripheral.id, value: [...byteArray], isLocal: true }, // Use the same terminated array
			)

			await BleManager.writeWithoutResponse(
				peripheral.id,
				peripheral.services?.serviceCharacteristic || BLE_SERVICE_UUID,
				peripheral.services?.writeCharacteristic ||
				BLE_CHARACTERISTIC_WRITE_UUID,
				byteArray,
				512 // Explicitly allow larger packets
			)

			log(
				`Written ${data} to the device ${peripheral.name} (${dayjs().format(
					"HH:mm:ss-SSS",
				)})`,
			)
		} catch (e: any) {
			log(
				`Writing ${data} to the device ${peripheral.name} failed with the error: ${e}`,
			)

			/**
			 * If anything goes wrong, return the error so that parent functions
			 * may use it. Currently, we disconnect the device if we detect some
			 * specific errors.
			 */
			const problem = DEVICE_NOT_CONNECTED_ANYMORE.find((errMessage) =>
				e.includes(errMessage),
			)
			if (problem) {
				return Error(e)
			}
		}
	}
}

const UUID_LENGTH = 36

export const extractServiceAndCharacteristic = (services?: Services) => {
	log("Extracting services and characteristics.")
	if (!services) {
		log("Service object not found, using default.")
		return {
			writeCharacteristic: BLE_CHARACTERISTIC_WRITE_UUID,
			readCharacteristic: BLE_CHARACTERISTIC_READ_UUID,
			serviceCharacteristic: BLE_SERVICE_UUID,
		}
	}

	try {
		log(`Available services: ${JSON.stringify(services.services.map(s => s.uuid))}`)

		// 1. Try to find our specific UART service first
		const targetService = services.services.find(
			(s) => s.uuid.toLowerCase() === BLE_SERVICE_UUID.toLowerCase()
		)

		if (targetService) {
			const write = services.characteristics.find((c) =>
				c.service.toLowerCase() === targetService.uuid.toLowerCase() &&
				c.properties.WriteWithoutResponse
			)

			const read = services.characteristics.find((c) =>
				c.service.toLowerCase() === targetService.uuid.toLowerCase() &&
				c.properties.Notify
			)

			if (write && read) {
				return {
					serviceCharacteristic: targetService.uuid,
					readCharacteristic: read.characteristic,
					writeCharacteristic: write.characteristic,
				}
			}
		}

		// 2. Try to find DFU service
		const dfuService = services.services.find(
			(s) => s.uuid.toLowerCase().includes(BLE_DFU_SERVICE_UUID.toLowerCase())
		)

		if (dfuService) {
			log("DFU Service found, attempting to connect...")
			// For DFU, we just need any write/notify characteristic to keep the connection alive
			const write = services.characteristics.find((c) =>
				c.service.toLowerCase() === dfuService.uuid.toLowerCase() &&
				(c.properties.Write || c.properties.WriteWithoutResponse)
			)

			const read = services.characteristics.find((c) =>
				c.service.toLowerCase() === dfuService.uuid.toLowerCase() &&
				(c.properties.Notify || c.properties.Indicate)
			)

			if (write && read) {
				return {
					serviceCharacteristic: dfuService.uuid,
					readCharacteristic: read.characteristic,
					writeCharacteristic: write.characteristic,
				}
			}
		}

		// 3. Fallback: Look for any service with 36-char UUID (Legacy logic, but less strict)
		const allServices = services.services.filter(
			(s) => s.uuid.length === UUID_LENGTH,
		)

		// If we found exactly one custom service (that wasn't the target one), try to use it
		if (allServices.length === 1) {
			const service = allServices[0]
			const write = services.characteristics.find((c) =>
				c.service === service.uuid && c.properties.WriteWithoutResponse
			)
			const read = services.characteristics.find((c) =>
				c.service === service.uuid && c.properties.Notify
			)

			if (write && read) {
				return {
					serviceCharacteristic: service.uuid,
					readCharacteristic: read.characteristic,
					writeCharacteristic: write.characteristic,
				}
			}
		}

		throw new Error(
			`Target service ${BLE_SERVICE_UUID} not found and no suitable fallback service detected.`
		)

	} catch (e: any) {
		log(e.message)
		log("Extracting services and characteristics failed, using default.")
		return {
			writeCharacteristic: BLE_CHARACTERISTIC_WRITE_UUID,
			readCharacteristic: BLE_CHARACTERISTIC_READ_UUID,
			serviceCharacteristic: BLE_SERVICE_UUID,
		}
	}
}

export const storeDataToStorage = async <T>(key: string, value: T) => {
	try {
		const jsonValue = JSON.stringify(value)
		await AsyncStorage.setItem(key, jsonValue)
	} catch (e: any) {
		console.error(`Could not save to storage. Reason: ${e.message}`)
	}
}

export const getStorageData = async <T>(key: string): Promise<T | null> => {
	try {
		const jsonValue = await AsyncStorage.getItem(key)
		return jsonValue != null ? JSON.parse(jsonValue) : null
	} catch (e: any) {
		console.error(`Could not read from storage. Reason: ${e.message}`)
		return null
	}
}

export const isOurDevice = (name: string) => {
	return !!DEVICE_NAMES.find((deviceName) => name.includes(deviceName))
}
