import BleManager from "react-native-ble-manager"
import { Platform } from "react-native"
import { Buffer } from "buffer"
import dayjs from "dayjs"
import { log } from "../utils/logger"
import { } from "./emitters"
import { Services, WriteFunction } from "./types"
import { ExtendedPeripheral } from "../redux/slices/devicesSlice"
import {
	BLE_CHARACTERISTIC_READ_UUID,
	BLE_CHARACTERISTIC_WRITE_UUID,
	BLE_SERVICE_UUID,
	BLE_DFU_SERVICE_UUID,
} from "../utils/constants"
import { invokeWithTimeout } from "../utils/helpers"

export const writeToDevice: WriteFunction = async (peripheral, data) => {
	if (!peripheral.connected) return

	if (data) {
		if (data === "") return

		try {
			// Strip ALL newlines/CRs to prevent command injection
			const sanitizedData = data.replace(/[\r\n]+/g, "")
			// Revert: Firmware rejects newline (treats as extra char causing mismatch)
			const byteArray = [...Buffer.from(sanitizedData)]
			
            // Check for sensitive data (PII/Secrets) to redact from logs
            const isSensitive = /\b(setgps|appkey|appeui|deveui|setutc)\b/i.test(sanitizedData)
            const logHex = isSensitive ? "[REDACTED]" : Buffer.from(byteArray).toString("hex")
            const logData = isSensitive ? "[REDACTED]" : sanitizedData

			// log('DEBUG: byteArray content:', byteArray)
			log(`TX Hex: ${logHex}`)

			// iOS: write-WITH-response, same rationale as the file-transfer path
			// (#213): CoreBluetooth silently discards .withoutResponse writes when
			// its queue is full - once iOS relaxes the connection interval (~30s
			// in), commands and session keepalives vanish with no error, the
			// device sees silence, and its idle policy drops the link ("RX:
			// Disconnecting" mid-console-session). ATT write-with-response makes
			// drops impossible by protocol; for CLI-sized packets the throughput
			// cost is irrelevant. Android keeps the without-response fast path.
			const iosWithResponse = Platform.OS === "ios"
			const serviceUuid = peripheral.services?.serviceCharacteristic || BLE_SERVICE_UUID
			const writeUuid = peripheral.services?.writeCharacteristic || BLE_CHARACTERISTIC_WRITE_UUID
			// iOS write-with-response can stall >5 s during connection parameter
			// renegotiation (see writeBinaryToDevice docs) - budget 12 s there,
			// matching the file-transfer pipeline's write timeout.
			const timeoutMs = iosWithResponse ? 12000 : 5000
			await invokeWithTimeout(
				() => iosWithResponse
					? BleManager.write(peripheral.id, serviceUuid, writeUuid, byteArray, 512)
					: BleManager.writeWithoutResponse(peripheral.id, serviceUuid, writeUuid, byteArray, 512),
				iosWithResponse ? "BleManager.write" : "BleManager.writeWithoutResponse",
				timeoutMs
			)

			log(
				`Written ${logData} to the device ${peripheral.name} (${dayjs().format(
					"HH:mm:ss-SSS",
				)})`,
			)
		} catch (e: any) {
			log(
				`Writing ${data} to the device ${peripheral.name} failed with the error: ${e}`,
			)

			const error = e instanceof Error ? e : new Error(String(e))

			// We used to have logic here specifically for disconnection, 
			// but we should always throw the error for the caller to handle.
			throw error
		}
	}
}

/**
 * Write raw binary data to the device.
 *
 * Used exclusively by the file transfer pipeline. Unlike writeToDevice(),
 * this function does NOT string-encode the data — it sends raw bytes.
 *
 * @param withResponse  If true, uses write-with-response (reliable, slower).
 *                      Use for FILE_START and FILE_END. If false, uses
 *                      write-without-response (fast, ACK-confirmed by protocol).
 *                      Use for FILE_DATA.
 * @param timeoutMs     Per-write timeout. iOS CoreBluetooth can stall a
 *                      write-with-response for well over 5 s during connection
 *                      parameter renegotiation — callers on that path must pass
 *                      a budget below the firmware's 15 s session-inactivity
 *                      hold but above the observed stalls (see
 *                      runFileTransferPipeline WRITE_TIMEOUT_MS).
 */
export const writeBinaryToDevice = async (
	peripheral: ExtendedPeripheral,
	data: Uint8Array,
	withResponse: boolean = false,
	timeoutMs: number = 5000,
): Promise<void> => {
	if (!peripheral.connected) {
		throw new Error('Device disconnected')
	}

	const byteArray = Array.from(data)
	const serviceUuid = peripheral.services?.serviceCharacteristic || BLE_SERVICE_UUID
	const charUuid = peripheral.services?.writeCharacteristic || BLE_CHARACTERISTIC_WRITE_UUID

	const writeFn = withResponse
		? () => BleManager.write(peripheral.id, serviceUuid, charUuid, byteArray, byteArray.length)
		: () => BleManager.writeWithoutResponse(peripheral.id, serviceUuid, charUuid, byteArray, byteArray.length)

	const label = withResponse ? 'BleManager.write' : 'BleManager.writeWithoutResponse'

	await invokeWithTimeout(writeFn, label, timeoutMs)
}


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
