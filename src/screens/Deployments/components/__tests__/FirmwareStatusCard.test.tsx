import { render, screen } from "@testing-library/react-native"
import { FirmwareStatusCard } from "../FirmwareStatusCard"

// The theme module builds the navigation themes when it loads; WWText needs the spacing
jest.mock("../../../../theme", () => ({ useExtendedTheme: () => ({ spacing: 16 }) }))
jest.mock("react-native-paper", () => {
	const React = require("react")
	const RN = require("react-native")
	const Card = ({ children }: any) => React.createElement(RN.View, null, children)
	Card.Title = ({ title }: any) => React.createElement(RN.Text, null, title)
	Card.Content = ({ children }: any) => React.createElement(RN.View, null, children)
	return {
		Card,
		Button: ({ children, onPress }: any) => React.createElement(RN.Text, { onPress }, children),
		Divider: () => null,
		Text: ({ children }: any) => React.createElement(RN.Text, null, children),
	}
})

const status = (himax: Record<string, unknown>) => ({
	isChecking: false,
	lastChecked: new Date(),
	errorMsg: null,
	checkStatus: jest.fn(),
	statuses: {
		ble: { type: "ble", currentVersion: "0.30.57", latestVersion: "0.30.57", latestFirmware: null, isOutdated: false },
		himax: {
			type: "himax", currentVersion: "WW500_C02 10:09:08 Oct  9 2026", latestVersion: "WW500_C02 10:09:08 Oct  9 2026",
			latestFirmware: null, isOutdated: false, ...himax,
		},
	},
}) as any

const theme = { colors: { error: "red", onSurfaceVariant: "#ccc" } }

/**
 * #374: Start Monitoring's firmware card read UP TO DATE for a camera an AI
 * update had left on the other camera's image.
 */
describe("FirmwareStatusCard", () => {
	it("says an AI update that stopped part way is not finished", () => {
		render(
			<FirmwareStatusCard
				firmwareStatus={status({ isOutdated: true, unfinished: { endVariant: "HM0360", done: 1, total: 2 } })}
				theme={theme}
				onShowHelp={jest.fn()}
			/>,
		)

		expect(screen.getByText("UPDATE NOT FINISHED")).toBeTruthy()
		expect(screen.queryByText("UPDATE AVAILABLE")).toBeNull()
	})

	it("keeps UPDATE AVAILABLE for an ordinary update", () => {
		render(<FirmwareStatusCard firmwareStatus={status({ isOutdated: true })} theme={theme} onShowHelp={jest.fn()} />)

		expect(screen.getByText("UPDATE AVAILABLE")).toBeTruthy()
	})
})
