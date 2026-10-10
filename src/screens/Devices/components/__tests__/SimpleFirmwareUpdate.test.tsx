import { fireEvent, render, screen } from "@testing-library/react-native"
import { SimpleFirmwareUpdate, SimpleFirmwareUpdateProps } from "../SimpleFirmwareUpdate"

// The view only needs its words, its button and its checkbox
jest.mock("react-native-paper", () => {
	const React = require("react")
	const RN = require("react-native")
	return {
		Text: ({ children, onPress }: any) => React.createElement(RN.Text, { onPress }, children),
		Button: ({ children, onPress, disabled }: any) =>
			React.createElement(RN.Text, { onPress: disabled ? undefined : onPress, accessibilityState: { disabled: !!disabled } }, children),
		Checkbox: { Android: ({ onPress, status }: any) => React.createElement(RN.Text, { onPress }, `checkbox ${status}`) },
		ProgressBar: ({ progress }: any) => React.createElement(RN.Text, null, `bar ${progress}`),
	}
})
// The theme module builds the navigation themes when it loads; the view needs two colours
jest.mock("../../../../theme", () => ({
	useExtendedTheme: () => ({ colors: { error: "red", primary: "green" }, spacing: 16 }),
}))

const base: SimpleFirmwareUpdateProps = {
	target: "himax",
	currentVersion: "WW500_C02 04:18:11 Sep 23 2026",
	latestVersion: "WW500_C02 20:26:50 Sep 30 2026",
	upToDate: false,
	isPreflightDone: true,
	canStart: true,
	batteryLevel: 80,
	isBatteryLow: false,
	externalPowerConfirmed: false,
	onExternalPowerChange: jest.fn(),
	isUpdating: false,
	isComplete: false,
	isFailed: false,
	phase: "idle",
	progress: 0,
	pairProgress: null,
	errorMsg: null,
	newVersion: null,
	logs: [],
	onStart: jest.fn(),
	onDone: jest.fn(),
}

const view = (props: Partial<SimpleFirmwareUpdateProps> = {}) => render(<SimpleFirmwareUpdate {...base} {...props} />)
const disabled = (label: string) => screen.getByText(label).props.accessibilityState.disabled

/**
 * #344: before an update the operator reads one line and presses one button;
 * while it runs, one status line and one bar; at the end, one line. No build
 * picker, file names, CRCs or step log.
 */
describe("SimpleFirmwareUpdate", () => {
	it("says from which build to which, with one Update button", () => {
		const onStart = jest.fn()
		view({ onStart })

		expect(screen.getByText("Update from the 23 Sep build to the 30 Sep build.")).toBeTruthy()
		fireEvent.press(screen.getByText("Update"))
		expect(onStart).toHaveBeenCalled()
		expect(screen.queryByText(/MANIFEST|\.IMG|CRC|Pre-flight/)).toBeNull()
	})

	it("offers no update when the camera is up to date", () => {
		view({ upToDate: true })

		expect(screen.getByText("Up to date: 30 Sep build.")).toBeTruthy()
		expect(screen.queryByText("Update")).toBeNull()
	})

	it("blocks a low battery until the operator says it is on USB power", () => {
		const onExternalPowerChange = jest.fn()
		view({ isBatteryLow: true, batteryLevel: 8, onExternalPowerChange })

		expect(screen.getByText("Battery at 8%. Charge the camera before updating.")).toBeTruthy()
		expect(disabled("Update")).toBe(true)
		fireEvent.press(screen.getByText("It's on USB power, update anyway"))
		expect(onExternalPowerChange).toHaveBeenCalledWith(true)
	})

	it("lets the update start once USB power is confirmed", () => {
		view({ isBatteryLow: true, batteryLevel: 8, externalPowerConfirmed: true })

		expect(disabled("Update")).toBe(false)
	})

	it("says the firmware is not on the phone when there is nothing to install", () => {
		view({ canStart: false })

		expect(screen.getByText(/not on this phone yet/)).toBeTruthy()
		expect(disabled("Update")).toBe(true)
	})

	it("shows one status line and one bar while it runs, with its last steps under them", () => {
		view({
			isUpdating: true, phase: "transferring", progress: 0.3, pairProgress: { total: 2, done: 0 },
			logs: ["[1/2 RP3] Target firmware filename: R6A01007.IMG", "[1/2 RP3] Transferring firmware to device SD card..."],
		})

		expect(screen.getByText("Sending image 1 of 2 to the camera")).toBeTruthy()
		expect(screen.getByText("bar 0.3")).toBeTruthy()
		expect(screen.getByText("[1/2 RP3] Transferring firmware to device SD card...")).toBeTruthy()
		expect(screen.queryByText("Update")).toBeNull()
	})

	it("shows how much of an image is across, how fast and how long is left, under the log", () => {
		view({
			isUpdating: true, phase: "transferring", progress: 0.3, pairProgress: { total: 2, done: 0 },
			logs: ["[1/2 HM0360] Transferring firmware to device SD card..."],
			transfer: { percentage: 44.5, bytesSent: 217088, totalBytes: 487424, elapsedMs: 27000, estimatedRemainingMs: 38000 },
		})

		expect(screen.getByText("212 of 476 KB, 7.9 KB/s, about 38 s left")).toBeTruthy()
		expect(screen.getByText("bar 0.445")).toBeTruthy()
	})

	it("keeps the steps on screen after a failure", () => {
		view({ isFailed: true, errorMsg: "Device disconnected.", logs: ["[2/2 HM0360] Sending firmware flash command..."] })

		expect(screen.getByText("Device disconnected.")).toBeTruthy()
		expect(screen.getByText("[2/2 HM0360] Sending firmware flash command...")).toBeTruthy()
	})

	it("says how far a two-image update got when it fails, and offers Try again", () => {
		const onStart = jest.fn()
		view({ isFailed: true, pairProgress: { total: 2, done: 1 }, onStart })

		expect(screen.getByText("1 of 2 images installed. Try again to finish.")).toBeTruthy()
		fireEvent.press(screen.getByText("Try again"))
		expect(onStart).toHaveBeenCalled()
	})

	// #374: an update cut short between its images reads as one to finish, never as up to date
	it("says where an unfinished update stopped and offers Finish update instead of Update", () => {
		const onStart = jest.fn()
		const line = "The last update stopped after image 1 of 2. Finishing installs the night-IR image, the 30 Sep build, and puts the camera back on the night-IR camera."
		view({ unfinished: line, onStart })

		expect(screen.getByText(line)).toBeTruthy()
		expect(screen.queryByText(/^Update from|Up to date/)).toBeNull()
		expect(screen.queryByText("Update")).toBeNull()
		fireEvent.press(screen.getByText("Finish update"))
		expect(onStart).toHaveBeenCalled()
	})

	it("ends on one result line and Done", () => {
		const onDone = jest.fn()
		view({ isComplete: true, newVersion: "WW500_C02 20:26:50 Sep 30 2026", onDone })

		expect(screen.getByText("Updated to the 30 Sep build.")).toBeTruthy()
		fireEvent.press(screen.getByText("Done"))
		expect(onDone).toHaveBeenCalled()
	})
})
