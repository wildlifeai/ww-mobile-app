import { fireEvent, render, screen } from "@testing-library/react-native"
import { FirmwareUpdateScreen } from "../FirmwareUpdateScreen"

const mockParams: { current: any } = { current: {} }
const mockSetOptions = jest.fn()
jest.mock("@react-navigation/native", () => ({
	useRoute: () => ({ params: mockParams.current }),
	useNavigation: () => ({ setOptions: mockSetOptions, goBack: jest.fn(), navigate: jest.fn() }),
}))

jest.mock("../../../redux", () => ({
	useAppSelector: (select: any) => select({ devices: { "dev-1": { id: "dev-1", name: "WILD-7VQI", connected: true } } }),
}))

const mockStartUpdate = jest.fn()
const build = (id: string, variant: "RP3" | "HM0360") => ({
	id, version: "WW500_C02 20:26:50 Sep 30 2026", buildDate: "2026-09-30", cameraVariant: variant, name: id,
})
// What a test changes in the hook's answer, over the defaults below
const mockHook: { current: Record<string, unknown> } = { current: {} }
jest.mock("../hooks/useFirmwareUpdate", () => ({
	firmware83Filename: (_v: string, _d: string, variant: string) => `${variant === "RP3" ? "R" : "H"}6930K26.IMG`,
	useFirmwareUpdate: () => ({
		progress: 0, statusLabel: "", isUpdating: false, isComplete: false, isFailed: false, progressLogs: [],
		errorMsg: null, downloadState: null, downloadProgress: null, fileTransferProgress: null, passImage: null, phase: "idle",
		batteryLevel: 80, isBatteryLow: false, isLikelyExternalPower: false,
		previousVersion: "WW500_C02 04:18:11 Sep 23 2026", newVersion: null, latestFirmware: null,
		isPreflightDone: true, sdCardFiles: [],
		availableDbFirmwares: [build("fw-rp3", "RP3"), build("fw-hm", "HM0360")],
		runningVariant: "HM0360", pairProgress: null,
		startUpdate: mockStartUpdate, cancelUpdate: jest.fn(),
		...mockHook.current,
	}),
}))
jest.mock("../../../hooks/useOfflineFiles", () => ({ useFirmwareOnPhone: () => null }))
jest.mock("../../../services/ReferenceDataService", () => ({
	__esModule: true,
	default: { syncFirmware: jest.fn(() => Promise.resolve()) },
}))
jest.mock("../../../theme", () => ({
	useExtendedTheme: () => ({ colors: { error: "red", primary: "green", surfaceVariant: "#222", onSurfaceVariant: "#ccc" }, spacing: 16 }),
}))
jest.mock("../../../components/ui/WWSelect", () => ({ WWSelect: () => null }))
jest.mock("../../../components/FileTransferProgressCard", () => {
	const React = require("react")
	const RN = require("react-native")
	return { FileTransferProgressCard: ({ title, filename }: any) => React.createElement(RN.Text, null, `${title}: ${filename}`) }
})
jest.mock("react-native-paper", () => {
	const React = require("react")
	const RN = require("react-native")
	const text = ({ children, onPress }: any) => React.createElement(RN.Text, { onPress }, children)
	const nothing = () => null
	return {
		Text: text,
		Button: ({ children, onPress, disabled }: any) => React.createElement(RN.Text, { onPress: disabled ? undefined : onPress }, children),
		ActivityIndicator: nothing,
		ProgressBar: nothing,
		IconButton: nothing,
		Checkbox: { Android: nothing },
		RadioButton: Object.assign(nothing, { Group: ({ children }: any) => React.createElement(RN.View, null, children), Android: nothing }),
	}
})

/**
 * #344: the banner and Firmware Status open the simple view; only the Engineer
 * Console's entries open the view with the build picker and the source choice.
 * The banner's path used to land on the picker and "Flash Selected Build".
 */
describe("FirmwareUpdateScreen", () => {
	beforeEach(() => {
		mockStartUpdate.mockClear()
		mockSetOptions.mockClear()
		mockHook.current = {}
	})

	it("gives an operator one version line and one button, updating both images from the cloud", () => {
		mockParams.current = { deviceId: "dev-1", target: "himax" }
		render(<FirmwareUpdateScreen />)

		expect(screen.getByText("Update from the 23 Sep build to the 30 Sep build.")).toBeTruthy()
		expect(screen.queryByText(/Flash Selected Build|Advanced|MANIFEST|Pre-flight/)).toBeNull()
		expect(mockSetOptions).toHaveBeenCalledWith({ title: "AI firmware update" })

		fireEvent.press(screen.getByText("Update"))
		expect(mockStartUpdate).toHaveBeenCalledWith({ himaxSource: "download" })
	})

	it("keeps the build picker and source choice for the Engineer Console", () => {
		mockParams.current = { deviceId: "dev-1", target: "himax", engineer: true }
		render(<FirmwareUpdateScreen />)

		expect(screen.getByText(/Advanced: flash a specific image/)).toBeTruthy()
		expect(screen.queryByText(/^Update from/)).toBeNull()
		expect(mockSetOptions).not.toHaveBeenCalled()
	})

	// #436: the card named the build picked under Advanced, R6930K26.IMG here,
	// while the pair update sent the night image
	it("names the file the update is sending on the transfer card", () => {
		mockParams.current = { deviceId: "dev-1", target: "himax", engineer: true }
		mockHook.current = {
			isUpdating: true, phase: "transferring", pairProgress: { total: 2, done: 0 },
			fileTransferProgress: { percentage: 40, bytesSent: 200000, totalBytes: 500000, elapsedMs: 25000, estimatedRemainingMs: 30000, phase: "transferring" },
			passImage: { filename: "H6930K26.IMG", locationPath: "himax/hm0360.img" },
		}
		render(<FirmwareUpdateScreen />)

		expect(screen.getByText("Transferring to Device: H6930K26.IMG")).toBeTruthy()
		expect(screen.queryByText(/R6930K26/)).toBeNull()
	})

})
