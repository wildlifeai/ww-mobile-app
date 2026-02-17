import BleManager from "react-native-ble-manager"
import { Buffer } from "buffer"
import dayjs from "dayjs"
import { ExtendedPeripheral } from "../redux/slices/devicesSlice"
import { log } from "../utils/logger"
import { readlineParserEmitter } from "./emitters"
import { Services, WriteFunction } from "./types"
import {
	BLE_CHARACTERISTIC_READ_UUID,
	BLE_CHARACTERISTIC_WRITE_UUID,
	BLE_SERVICE_UUID,
	BLE_DFU_SERVICE_UUID,
} from "../utils/constants"
import { invokeWithTimeout } from "../utils/helpers"

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
			// log('DEBUG: byteArray content:', byteArray)
			log(`TX Hex: ${Buffer.from(byteArray).toString("hex")}`)

			// Push a LF-CR (LF = 10, CR = 13 in decimal) to local listener for UI feedback
			readlineParserEmitter.emit(
				"BleManagerDidUpdateValueForCharacteristicReadlineParser",
				{ peripheral: peripheral.id, value: [...byteArray], isLocal: true }, // Use the same terminated array
			)

			await invokeWithTimeout(
				() => BleManager.writeWithoutResponse(
					peripheral.id,
					peripheral.services?.serviceCharacteristic || BLE_SERVICE_UUID,
					peripheral.services?.writeCharacteristic ||
					BLE_CHARACTERISTIC_WRITE_UUID,
					byteArray,
					512 // Explicitly allow larger packets
				),
				"BleManager.writeWithoutResponse",
				5000 // 5s timeout
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

			const error = e instanceof Error ? e : new Error(String(e))

			const errorMessage = error.message
			const problem = DEVICE_NOT_CONNECTED_ANYMORE.find((errMessage) =>
				errorMessage.includes(errMessage),
			)

			// We used to have logic here specifically for disconnection, 
			// but we should always return the error for the caller to handle.
			return error
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

		// If neither targetService nor dfuService yielded a valid set of characteristics, throw an error.
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
