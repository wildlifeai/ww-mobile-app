import { ExtendedPeripheral } from "../redux/slices/devicesSlice"
import { log, logError } from './logger'
import {
	DEVICE_NAMES,
} from "./constants"
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


export const storeDataToStorage = async <T>(key: string, value: T) => {
	try {
		const jsonValue = JSON.stringify(value)
		await AsyncStorage.setItem(key, jsonValue)
	} catch (e: any) {
		logError(`Could not save to storage. Reason: ${e.message}`)
	}
}

export const getStorageData = async <T>(key: string): Promise<T | null> => {
	try {
		const jsonValue = await AsyncStorage.getItem(key)
		return jsonValue != null ? JSON.parse(jsonValue) : null
	} catch (e: any) {
		logError(`Could not read from storage. Reason: ${e.message}`)
		return null
	}
}

/**
 * The nRF's DFU bootloader, by the name it advertises: the WW500's own
 * (WILD-SIFK, bootloader 00.01.01, bench 27 Nov 2026) or Nordic's default.
 * It answers no camera command, only a Nordic DFU flash.
 */
export const isDfuBootloader = (name?: string | null): boolean =>
	!!name && (name.includes('WW500_DFU') || name.includes('DfuTarg'))

export const isOurDevice = (name: string) => {
	return !!DEVICE_NAMES.find((deviceName) => name.includes(deviceName)) || isDfuBootloader(name)
}

