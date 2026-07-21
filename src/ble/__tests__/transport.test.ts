import {
	writeToDevice,
	extractServiceAndCharacteristic,
} from "../transport"
import BleManager from "react-native-ble-manager"
import { ExtendedPeripheral } from "../../redux/slices/devicesSlice"
import {
	BLE_SERVICE_UUID,
	BLE_CHARACTERISTIC_WRITE_UUID,
	BLE_CHARACTERISTIC_READ_UUID,
} from "../../utils/constants"
import { Platform } from "react-native"

// Mock dependencies
jest.mock("react-native-ble-manager", () => ({
	write: jest.fn(),
	writeWithoutResponse: jest.fn(),
}))

jest.mock("../../utils/logger", () => ({
	log: jest.fn(),
	logError: jest.fn(),
}))



describe("src/ble/transport", () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	describe("writeToDevice", () => {
		const mockPeripheral = {
			id: "device-123",
			connected: true,
			name: "Test Device",
			services: {
				serviceCharacteristic: "service-uuid",
				writeCharacteristic: "write-uuid",
			},
		} as unknown as ExtendedPeripheral

		it("should return early if device not connected", async () => {
			await writeToDevice({ ...mockPeripheral, connected: false }, "data")
			expect(BleManager.writeWithoutResponse).not.toHaveBeenCalled()
		})

		it("should write data with response on iOS", async () => {
			// CoreBluetooth silently drops .withoutResponse writes when its queue
			// is full, so iOS must use write-with-response (same rationale as the
			// file-transfer path).
			const originalOS = Platform.OS
			Object.defineProperty(Platform, "OS", { value: "ios", configurable: true })
			try {
				await writeToDevice(mockPeripheral, "test-data")
			} finally {
				Object.defineProperty(Platform, "OS", { value: originalOS, configurable: true })
			}

			expect(BleManager.write).toHaveBeenCalledWith(
				"device-123",
				"service-uuid",
				"write-uuid",
				expect.any(Array), // Byte array
				512
			)
			expect(BleManager.writeWithoutResponse).not.toHaveBeenCalled()
		})

		it("should keep the without-response fast path on Android", async () => {
			const originalOS = Platform.OS
			try {
				Object.defineProperty(Platform, "OS", { value: "android", configurable: true })
				await writeToDevice(mockPeripheral, "test-data")
				expect(BleManager.writeWithoutResponse).toHaveBeenCalledWith(
					"device-123",
					"service-uuid",
					"write-uuid",
					expect.any(Array),
					512
				)
				expect(BleManager.write).not.toHaveBeenCalled()
			} finally {
				Object.defineProperty(Platform, "OS", { value: originalOS, configurable: true })
			}
		})

		it("should handle write errors", async () => {
			(BleManager.write as jest.Mock).mockRejectedValue(new Error("Write failed"))
			await expect(writeToDevice(mockPeripheral, "test-data")).rejects.toThrow("Write failed")
		})
	})

	describe("extractServiceAndCharacteristic", () => {
		it("should return default if services are undefined", () => {
			const result = extractServiceAndCharacteristic(undefined)
			expect(result).toEqual({
				writeCharacteristic: BLE_CHARACTERISTIC_WRITE_UUID,
				readCharacteristic: BLE_CHARACTERISTIC_READ_UUID,
				serviceCharacteristic: BLE_SERVICE_UUID,
			})
		})

		it("should extract target service if present", () => {
			const services = {
				services: [{ uuid: BLE_SERVICE_UUID }],
				characteristics: [
					{ service: BLE_SERVICE_UUID, characteristic: "char-write", properties: { WriteWithoutResponse: true } },
					{ service: BLE_SERVICE_UUID, characteristic: "char-read", properties: { Notify: true } },
				],
			}
			const result = extractServiceAndCharacteristic(services as any)
			expect(result).toEqual({
				serviceCharacteristic: BLE_SERVICE_UUID,
				readCharacteristic: "char-read",
				writeCharacteristic: "char-write",
			})
		})
	})
})
