import {
	clearAllDeviceIntervals,
	invokeWithTimeout,
	writeToDevice,
	extractServiceAndCharacteristic,
	storeDataToStorage,
	getStorageData,
	isOurDevice,
	parseUuidToOps,
} from "../helpers"
import BleManager from "react-native-ble-manager"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { ExtendedPeripheral } from "../../redux/slices/devicesSlice"
import {
	BLE_SERVICE_UUID,
	BLE_CHARACTERISTIC_WRITE_UUID,
	BLE_CHARACTERISTIC_READ_UUID,
	BLE_DFU_SERVICE_UUID,
	DEVICE_NAMES,
} from "../constants"
import { readlineParserEmitter } from "../../ble/emitters"

// Mock dependencies
jest.mock("react-native-ble-manager", () => ({
	writeWithoutResponse: jest.fn(),
}))

jest.mock("@react-native-async-storage/async-storage", () => ({
	setItem: jest.fn(),
	getItem: jest.fn(),
}))

jest.mock("../logger", () => ({
	log: jest.fn(),
	logError: jest.fn(),
}))

jest.mock("../../ble/emitters", () => ({
	readlineParserEmitter: {
		emit: jest.fn(),
	},
}))

describe("src/utils/helpers", () => {
	beforeEach(() => {
		jest.clearAllMocks()
		jest.useFakeTimers()
	})

	afterEach(() => {
		jest.useRealTimers()
	})

	describe("clearAllDeviceIntervals", () => {
		it("should clear all intervals in the device object", () => {
			const clearIntervalSpy = jest.spyOn(global, "clearInterval")
			const device = {
				intervals: {
					testInterval1: 123,
					testInterval2: 456,
				},
			} as unknown as ExtendedPeripheral

			clearAllDeviceIntervals(device)

			expect(clearIntervalSpy).toHaveBeenCalledTimes(2)
			expect(clearIntervalSpy).toHaveBeenCalledWith(123)
			expect(clearIntervalSpy).toHaveBeenCalledWith(456)
		})

		it("should do nothing if device is undefined", () => {
			const clearIntervalSpy = jest.spyOn(global, "clearInterval")
			clearAllDeviceIntervals(undefined)
			expect(clearIntervalSpy).not.toHaveBeenCalled()
		})
	})

	describe("invokeWithTimeout", () => {
		it("should resolve if function completes within timeout", async () => {
			const mockFunc = jest.fn().mockResolvedValue("success")
			const result = await invokeWithTimeout(mockFunc, "testFunc", 1000)
			expect(result).toBe("success")
		})

		it("should reject if function times out", async () => {
			const mockFunc = jest.fn().mockImplementation(() => new Promise(() => {})) // Never resolves
			const promise = invokeWithTimeout(mockFunc, "testFunc", 1000)
			
			jest.advanceTimersByTime(2000)

			await expect(promise).rejects.toThrow("testFunc function timed out")
		})

		it("should reject if function throws error", async () => {
			const mockFunc = jest.fn().mockRejectedValue("failure")
			await expect(invokeWithTimeout(mockFunc, "testFunc", 1000)).rejects.toThrow("failure")
		})
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

		it("should write data to device", async () => {
			await writeToDevice(mockPeripheral, "test-data")

			expect(BleManager.writeWithoutResponse).toHaveBeenCalledWith(
				"device-123",
				"service-uuid",
				"write-uuid",
				expect.any(Array), // Byte array
				512
			)
			// Check if emitter was called
			expect(readlineParserEmitter.emit).toHaveBeenCalled()
		})

		it("should handle write errors", async () => {
			(BleManager.writeWithoutResponse as jest.Mock).mockRejectedValue("Write failed")
			const error = await writeToDevice(mockPeripheral, "test-data")
			expect(error).toBeInstanceOf(Error)
			expect(error?.message).toBe("Write failed")
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
		
		// Add more scenarios for DFU and fallback if needed
	})

	describe("storeDataToStorage / getStorageData", () => {
		it("should store data", async () => {
			await storeDataToStorage("key", { foo: "bar" })
			expect(AsyncStorage.setItem).toHaveBeenCalledWith("key", JSON.stringify({ foo: "bar" }))
		})

		it("should retrieve data", async () => {
			(AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({ foo: "bar" }))
			const result = await getStorageData("key")
			expect(result).toEqual({ foo: "bar" })
		})

		it("should return null if key does not exist", async () => {
			(AsyncStorage.getItem as jest.Mock).mockResolvedValue(null)
			const result = await getStorageData("key")
			expect(result).toBeNull()
		})
	})

	describe("isOurDevice", () => {
		it("should return true for device in list", () => {
			expect(isOurDevice(DEVICE_NAMES[0])).toBe(true)
		})

		it("should return false for unknown device", () => {
			expect(isOurDevice("Unknown Device")).toBe(false)
		})
	})

	describe("parseUuidToOps", () => {
		it("should parse valid UUID to ops array", () => {
			const uuid = "12345678-1234-1234-1234-123456789abc"
			const result = parseUuidToOps(uuid)
			expect(result).toHaveLength(8)
			expect(result[0]).toBe(0x1234)
			expect(result[7]).toBe(0x9abc)
		})

		it("should throw error for invalid length", () => {
			expect(() => parseUuidToOps("too-short")).toThrow()
		})

		it("should throw error for invalid hex", () => {
			expect(() => parseUuidToOps("zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz")).toThrow()
		})
	})
})
