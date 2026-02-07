import { renderHook, act } from "@testing-library/react-native"
import { useBle } from "../useBle"
import BleManager from "react-native-ble-manager"
import { useAppDispatch, useAppSelector } from "../../redux"
import { scanStart } from "../../redux/slices/scanningSlice"
import { deviceDisconnect, deviceUpdate, deviceLoading } from "../../redux/slices/devicesSlice"
import { bleCommandManager } from "../../ble/commandManager"
import { invokeWithTimeout } from "../../utils/helpers"

// Mock dependencies
jest.mock("react-native-ble-manager", () => ({
	scan: jest.fn(),
	stopScan: jest.fn(),
	connect: jest.fn(),
	disconnect: jest.fn(),
	retrieveServices: jest.fn(),
	startNotification: jest.fn(),
	readRSSI: jest.fn(),
	requestMTU: jest.fn(),
	checkState: jest.fn(),
	getConnectedPeripherals: jest.fn().mockResolvedValue([]),
}))

jest.mock("react-native", () => ({
	Platform: { OS: "android" },
}))

jest.mock("../../redux", () => ({
	useAppDispatch: jest.fn(),
	useAppSelector: jest.fn(),
}))

jest.mock("../../ble/commandManager", () => ({
	bleCommandManager: {
		sendCommand: jest.fn(),
		clear: jest.fn(),
	},
}))

jest.mock("../../utils/helpers", () => ({
	invokeWithTimeout: jest.fn(),
	writeToDevice: jest.fn(),
	clearAllDeviceIntervals: jest.fn(),
	isOurDevice: jest.fn().mockReturnValue(true),
	extractServiceAndCharacteristic: jest.fn().mockReturnValue({
		serviceCharacteristic: "service-uuid",
		readCharacteristic: "read-uuid",
		writeCharacteristic: "write-uuid",
	}),
	sleep: jest.fn(),
}))

jest.mock("../../utils/logger", () => ({
	log: jest.fn(),
	logError: jest.fn(),
	logWarn: jest.fn(),
	guard: jest.fn((fn) => fn()),
}))

describe("useBle", () => {
	const mockDispatch = jest.fn()

	beforeEach(() => {
		jest.clearAllMocks()
		;(useAppDispatch as jest.Mock).mockReturnValue(mockDispatch)
		
		// Default selector values
		;(useAppSelector as jest.Mock).mockImplementation((selector) => {
			const state = {
				bleLibrary: { initialized: true },
				scanning: { isScanning: false },
				devices: {},
			}
			return selector(state)
		})
	})

	it("should initialize hooks and return methods", () => {
		const { result } = renderHook(() => useBle())
		
		expect(result.current.startScan).toBeDefined()
		expect(result.current.connectDevice).toBeDefined()
		expect(result.current.disconnectDevice).toBeDefined()
		expect(result.current.write).toBeDefined()
	})

	describe("startScan", () => {
		it("should call BleManager.scan when not scanning", async () => {
			const { result } = renderHook(() => useBle())

			await act(async () => {
				await result.current.startScan(10)
			})

			expect(BleManager.scan).toHaveBeenCalledWith([], 10)
			expect(mockDispatch).toHaveBeenCalledWith(scanStart())
		})

		it("should NOT call BleManager.scan if already scanning", async () => {
			;(useAppSelector as jest.Mock).mockImplementation((selector) => {
				const state = {
					bleLibrary: { initialized: true },
					scanning: { isScanning: true }, // Already scanning
					devices: {},
				}
				return selector(state)
			})

			const { result } = renderHook(() => useBle())

			await act(async () => {
				await result.current.startScan()
			})

			expect(BleManager.scan).not.toHaveBeenCalled()
		})
	})

	describe("connectDevice", () => {
		const mockPeripheral: any = { id: "d1", name: "Test Device", connected: false, loading: false }

		it("should connect, retrieve services, start notifications", async () => {
			const { result } = renderHook(() => useBle())

			;(invokeWithTimeout as jest.Mock).mockImplementation(async (fn) => fn())
			;(BleManager.retrieveServices as jest.Mock).mockResolvedValue({} as any)

			await act(async () => {
				await result.current.connectDevice(mockPeripheral)
			})

			expect(mockDispatch).toHaveBeenCalledWith(deviceLoading({ id: "d1", loading: true }))
			expect(invokeWithTimeout).toHaveBeenCalledWith(expect.any(Function), "BleManager.connect", undefined)
			expect(BleManager.retrieveServices).toHaveBeenCalled()
			expect(BleManager.startNotification).toHaveBeenCalled()
			expect(mockDispatch).toHaveBeenCalledWith(deviceUpdate(expect.objectContaining({ id: "d1", connected: true })))
		})
	})

	describe("disconnectDevice", () => {
		const mockPeripheral: any = { id: "d1" }

		it("should disconnect and dispatch action", async () => {
			const { result } = renderHook(() => useBle())

			await act(async () => {
				await result.current.disconnectDevice(mockPeripheral)
			})

			expect(BleManager.disconnect).toHaveBeenCalledWith("d1")
			expect(mockDispatch).toHaveBeenCalledWith(deviceDisconnect({ id: "d1" }))
			expect(bleCommandManager.clear).toHaveBeenCalled()
		})
	})

	describe("write", () => {
		const mockPeripheral: any = { id: "d1" }

		beforeEach(() => {
			// Mock devices state to have the peripheral
			;(useAppSelector as jest.Mock).mockImplementation((selector) => {
				const state = {
					bleLibrary: { initialized: true },
					scanning: { isScanning: false },
					devices: { "d1": mockPeripheral },
				}
				return selector(state)
			})
		})

		it("should send command via manager", async () => {
			const { result } = renderHook(() => useBle())
			;(bleCommandManager.sendCommand as jest.Mock).mockResolvedValue("OK")

			await act(async () => {
				await result.current.write(mockPeripheral, ["ver"])
			})

			expect(bleCommandManager.sendCommand).toHaveBeenCalledWith(
				mockPeripheral, 
				"ver", 
				expect.any(Function), 
				expect.objectContaining({})
			)
		})
	})
})
