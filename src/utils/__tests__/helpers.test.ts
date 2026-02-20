import {
	clearAllDeviceIntervals,
	invokeWithTimeout,
	storeDataToStorage,
	getStorageData,
	isOurDevice,
	parseUuidToOps,
} from "../helpers"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { ExtendedPeripheral } from "../../redux/slices/devicesSlice"
import {
	DEVICE_NAMES,
} from "../constants"

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
