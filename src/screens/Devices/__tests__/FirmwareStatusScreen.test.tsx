import { fireEvent, render, screen } from "@testing-library/react-native"
import { FirmwareStatusScreen } from "../FirmwareStatusScreen"

const mockNavigate = jest.fn()
jest.mock("@react-navigation/native", () => ({
	useRoute: () => ({ params: { deviceId: "dev-1" } }),
	useNavigation: () => ({ navigate: mockNavigate }),
	useIsFocused: () => false,
}))

jest.mock("../../../redux", () => ({
	useAppSelector: (select: any) => select({ devices: { "dev-1": { id: "dev-1", name: "WILD-DJZQ", connected: true } } }),
}))

// What a test changes in the AI processor's status, over the #437 default below
const mockHimax: { current: Record<string, unknown> } = { current: {} }
// And in the Bluetooth processor's
const mockBle: { current: Record<string, unknown> } = { current: {} }
jest.mock("../hooks/useFirmwareStatus", () => ({
	useFirmwareStatus: () => ({
		isChecking: false,
		lastChecked: new Date(),
		errorMsg: null,
		checkStatus: jest.fn(),
		statuses: {
			ble: { type: "ble", currentVersion: "0.30.57", latestVersion: "0.30.57", latestFirmware: null, isOutdated: false, ...mockBle.current },
			himax: {
				type: "himax", currentVersion: "WW500_C02 10:09:08 Oct  9 2026", latestVersion: "WW500_C02 10:56:08 Oct  9 2026",
				latestFirmware: null, isOutdated: false, missingVariant: "RP3",
				...mockHimax.current,
			},
		},
	}),
}))
jest.mock("../../../theme", () => ({
	useExtendedTheme: () => ({ colors: { error: "red", primary: "green", surfaceVariant: "#222", onSurfaceVariant: "#ccc" }, spacing: 16 }),
}))
jest.mock("react-native-paper", () => {
	const React = require("react")
	const RN = require("react-native")
	return {
		Text: ({ children }: any) => React.createElement(RN.Text, null, children),
		Button: ({ children, onPress }: any) => React.createElement(RN.Text, { onPress }, children),
		ActivityIndicator: () => null,
	}
})

/**
 * #437: with one camera's build in the catalogue there is nothing to update to.
 * The AI processor used to read "update available", and its Update led to a
 * disabled button. It must not read "Up to date" either, the false answer
 * #374 is about.
 */
describe("FirmwareStatusScreen with one camera's build in the catalogue", () => {
	it("names the camera whose firmware is missing", () => {
		render(<FirmwareStatusScreen />)

		expect(screen.getByText("9 Oct build. The colour camera's new firmware is not available yet")).toBeTruthy()
		expect(screen.queryByText(/Up to date: 9 Oct|update available/)).toBeNull()
		// The Engineer Console keeps Update on each card, to flash a build by hand
		expect(screen.getAllByText("Update")).toHaveLength(2)
	})
})

/**
 * #374: an AI update cut short between its two images read "Up to date: 9 Oct
 * build", with nothing to finish it.
 */
describe("FirmwareStatusScreen with an AI update that stopped part way", () => {
	afterEach(() => {
		mockHimax.current = {}
	})

	it("says the update is not finished and offers to finish it", () => {
		mockHimax.current = { isOutdated: true, missingVariant: null, unfinished: { endVariant: "HM0360", done: 1, total: 2 } }
		render(<FirmwareStatusScreen />)

		expect(screen.getByText("Update not finished: 1 of 2 images installed")).toBeTruthy()
		expect(screen.getByText("Finish update")).toBeTruthy()
		expect(screen.queryByText(/Up to date: 9 Oct/)).toBeNull()
	})
})

/**
 * #527: Seeed PR 284 changed how the two processors signal each other, and a
 * camera with old AI and new Bluetooth takes no file. The Bluetooth card
 * offered its update first, which left exactly that. It now waits while the
 * AI processor has an update waiting, unless that update is half done: then
 * the camera runs new AI, and the Bluetooth update is what image 2 needs.
 */
describe("FirmwareStatusScreen with both processors behind", () => {
	afterEach(() => {
		mockHimax.current = {}
		mockBle.current = {}
		mockNavigate.mockClear()
	})

	it("offers no Bluetooth update while the AI update waits", () => {
		mockHimax.current = { isOutdated: true, missingVariant: null }
		mockBle.current = { latestVersion: "0.30.61", isOutdated: true }
		render(<FirmwareStatusScreen />)

		expect(screen.getByText("Update the AI processor first")).toBeTruthy()
		expect(screen.getAllByText("Update")).toHaveLength(1)
		fireEvent.press(screen.getByText("Update"))
		expect(mockNavigate).toHaveBeenCalledWith("FirmwareUpdateScreen", expect.objectContaining({ target: "himax" }))
	})

	it("offers the Bluetooth update once the AI update is half done", () => {
		mockHimax.current = { isOutdated: true, missingVariant: null, unfinished: { endVariant: "HM0360", done: 1, total: 2 } }
		mockBle.current = { latestVersion: "0.30.61", isOutdated: true }
		render(<FirmwareStatusScreen />)

		expect(screen.queryByText("Update the AI processor first")).toBeNull()
		fireEvent.press(screen.getByText("Update"))
		expect(mockNavigate).toHaveBeenCalledWith("FirmwareUpdateScreen", expect.objectContaining({ target: "ble" }))
		expect(screen.getByText("Finish update")).toBeTruthy()
	})

	it("offers the Bluetooth update on its own when the AI processor is up to date", () => {
		mockHimax.current = { currentVersion: "WW500_C02 10:56:08 Oct  9 2026", missingVariant: null }
		mockBle.current = { latestVersion: "0.30.61", isOutdated: true }
		render(<FirmwareStatusScreen />)

		expect(screen.queryByText("Update the AI processor first")).toBeNull()
		// The Bluetooth card comes first
		fireEvent.press(screen.getAllByText("Update")[0])
		expect(mockNavigate).toHaveBeenCalledWith("FirmwareUpdateScreen", expect.objectContaining({ target: "ble" }))
	})
})
