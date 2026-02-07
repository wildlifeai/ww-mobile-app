import devicesReducer, {
	deviceUpdate,
	deviceDisconnect,
	deviceLoading,
	deviceSignalChanged,
	removeDevice,
	setDfuStatus,
	DEFAULT_PERIPHERAL,
	ExtendedPeripheral,
} from "../devicesSlice"
import { clearAllDeviceIntervals } from "../../../utils/helpers"

// Mock helper
jest.mock("../../../utils/helpers", () => ({
	clearAllDeviceIntervals: jest.fn(),
}))

describe("devicesSlice", () => {
	const initialState = {}

	const mockDevice: ExtendedPeripheral = {
		...DEFAULT_PERIPHERAL("device-123"),
		id: "device-123",
		name: "Test Device",
		rssi: -50,
	}

	beforeEach(() => {
		jest.clearAllMocks()
	})

	it("should handle initial state", () => {
		expect(devicesReducer(undefined, { type: "unknown" })).toEqual(initialState)
	})

	it("should handle deviceUpdate (add new device)", () => {
		const nextState = devicesReducer(initialState, deviceUpdate(mockDevice))
		expect(nextState["device-123"]).toEqual(mockDevice)
	})

	it("should handle deviceUpdate (update existing device)", () => {
		const prevState = { "device-123": mockDevice }
		const update = { ...mockDevice, rssi: -40, connected: true }
		const nextState = devicesReducer(prevState, deviceUpdate(update))

		expect(nextState["device-123"].rssi).toBe(-40)
		expect(nextState["device-123"].connected).toBe(true)
	})

	it("should handle deviceDisconnect", () => {
		const connectedDevice = { ...mockDevice, connected: true }
		const prevState = { "device-123": connectedDevice }
		
		const nextState = devicesReducer(prevState, deviceDisconnect({ id: "device-123" }))

		expect(nextState["device-123"].connected).toBe(false)
		expect(nextState["device-123"].signalLost).toBe(true)
		expect(clearAllDeviceIntervals).toHaveBeenCalled()
	})

	it("should handle deviceLoading", () => {
		const prevState = { "device-123": mockDevice }
		const nextState = devicesReducer(prevState, deviceLoading({ id: "device-123", loading: true }))

		expect(nextState["device-123"].loading).toBe(true)
	})

	it("should handle deviceSignalChanged", () => {
		const prevState = { "device-123": { ...mockDevice, signalLost: false } }
		const signalUpdate = {
			data: [{ peripheral: { id: "device-123" } as any, value: true }]
		}

		const nextState = devicesReducer(prevState, deviceSignalChanged(signalUpdate))
		expect(nextState["device-123"].signalLost).toBe(true)
	})

	it("should handle removeDevice", () => {
		const prevState = { "device-123": mockDevice }
		const nextState = devicesReducer(prevState, removeDevice({ id: "device-123" }))

		expect(nextState["device-123"]).toBeUndefined()
		expect(clearAllDeviceIntervals).toHaveBeenCalled()
	})

	it("should handle setDfuStatus", () => {
		const prevState = { "device-123": mockDevice }
		const nextState = devicesReducer(prevState, setDfuStatus({ id: "device-123", status: true }))

		expect(nextState["device-123"].dfuInProgress).toBe(true)
	})
})
