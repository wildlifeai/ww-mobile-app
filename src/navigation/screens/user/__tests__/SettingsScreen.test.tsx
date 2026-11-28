import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { Settings } from "../SettingsScreen"
import { mobileDataDownloadsAllowed, setMobileDataDownloadsAllowed } from "../../../../services/OfflinePrefetchService"

jest.mock("../../../../services/OfflinePrefetchService", () => ({
	mobileDataDownloadsAllowed: jest.fn(),
	setMobileDataDownloadsAllowed: jest.fn(),
}))
jest.mock("../../../../components/RefusedChangesItem", () => ({ RefusedChangesItem: () => null }))
jest.mock("../../../../components/ui/WWScreenView", () => ({ WWScreenView: ({ children }: any) => children }))
jest.mock("../../../../theme", () => ({ useExtendedTheme: () => ({ spacing: 16, colors: { error: "red" } }) }))
// The shared mock leaves out List.Item's right side, where the switch sits
jest.mock("react-native-paper", () => {
	const React = require("react")
	const RN = require("react-native")
	return {
		List: {
			Section: ({ children }: any) => children,
			Subheader: ({ children }: any) => React.createElement(RN.Text, null, children),
			Icon: () => null,
			Item: ({ title, description, right, onPress, testID }: any) =>
				React.createElement(RN.Pressable, { onPress, testID },
					React.createElement(RN.Text, null, title),
					description ? React.createElement(RN.Text, null, description) : null,
					right?.({})),
		},
		Divider: () => null,
		Switch: ({ value, onValueChange }: any) =>
			React.createElement(RN.Text, { testID: "switch", onPress: () => onValueChange(!value) }, value ? "on" : "off"),
	}
})

const allowed = mobileDataDownloadsAllowed as jest.Mock
const store = setMobileDataDownloadsAllowed as jest.Mock

/** Renders, then lets the stored setting arrive. */
async function renderSettings() {
	render(<Settings />)
	await act(async () => {})
}

/**
 * #573: three sync choices, of which only "Automatic sync" did what it said,
 * became one switch for the one thing the setting decides, the background
 * download of firmware and AI models on mobile data.
 */
describe("Settings, downloads on mobile data", () => {
	beforeEach(() => {
		allowed.mockResolvedValue(true)
		store.mockResolvedValue(undefined)
	})

	it("offers one switch, on by default, and none of the old sync choices", async () => {
		await renderSettings()

		expect(screen.getByText("Download camera software on mobile data")).toBeTruthy()
		expect(screen.getByText("on")).toBeTruthy()
		expect(screen.queryByText(/Automatic sync|Sync on Wi-Fi only|Ask before syncing|Data Synchronization/)).toBeNull()
	})

	it("shows off on a phone whose setting reads off, such as an earlier Wi-Fi only", async () => {
		allowed.mockResolvedValue(false)
		await renderSettings()

		expect(screen.getByText("off")).toBeTruthy()
	})

	it("stores the choice from the switch or a tap on the row", async () => {
		await renderSettings()

		fireEvent.press(screen.getByTestId("switch"))
		expect(store).toHaveBeenLastCalledWith(false)
		expect(screen.getByText("off")).toBeTruthy()

		fireEvent.press(screen.getByTestId("mobile-data-downloads"))
		expect(store).toHaveBeenLastCalledWith(true)
		expect(screen.getByText("on")).toBeTruthy()
	})
})
