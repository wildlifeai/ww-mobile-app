import dayjs from "dayjs"
import { ExtendedPeripheral } from "../redux/slices/devicesSlice"
import { log } from "./logger"
import {
	BLE_CHARACTERISTIC_READ_UUID,
	BLE_CHARACTERISTIC_WRITE_UUID,
	BLE_SERVICE_UUID,
	DEVICE_NAMES,
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
			const byteArray = [...Buffer.from(data)]

			// Push a LF-CR (LF = 10, CR = 13 in decimal)
			readlineParserEmitter.emit(
				"BleManagerDidUpdateValueForCharacteristicReadlineParser",
				{ peripheral: peripheral.id, value: [...byteArray, 10, 13] },
			)

			await BleManager.writeWithoutResponse(
				peripheral.id,
				peripheral.services?.serviceCharacteristic || BLE_SERVICE_UUID,
				peripheral.services?.writeCharacteristic ||
					BLE_CHARACTERISTIC_WRITE_UUID,
				byteArray,
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
		const allServices = services.services.filter(
			(s) => s.uuid.length === UUID_LENGTH,
		)

		if (allServices.length !== 1) {
			throw new Error("Error: More then one service found.")
		}

		const service = allServices[0]

		const write = services.characteristics.find((c) => {
			if (c.service === service.uuid && c.properties.WriteWithoutResponse) {
				return true
			}
		})

		const read = services.characteristics.find((c) => {
			if (c.service === service.uuid && c.properties.Notify) {
				return true
			}
		})

		if (!write || !read) {
			throw new Error(
				`Error: No combination found for this service: ${service.uuid}`,
			)
		}

		return {
			serviceCharacteristic: service.uuid,
			readCharacteristic: read.characteristic,
			writeCharacteristic: write.characteristic,
		}
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
