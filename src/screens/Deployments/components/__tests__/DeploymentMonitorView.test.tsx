import { fireEvent, render, screen } from "@testing-library/react-native"
import { Alert, Keyboard } from "react-native"
import { DeploymentMonitorView } from "../DeploymentMonitorView"

jest.mock("../../../../theme", () => ({
	useExtendedTheme: () => ({ colors: { background: "#fff", surface: "#fff", surfaceVariant: "#eee", onSurface: "#000", onSurfaceVariant: "#333", primary: "#00f", error: "red", outline: "#999" } }),
}))
jest.mock("../../hooks/useDeploymentMonitor", () => ({
	useDeploymentMonitor: () => ({
		stats: { photoCount: 0, motionCount: 0, timelapseCount: 0, deviceImageCount: null, timeActiveMs: 0 },
		activityLog: [],
	}),
}))
jest.mock("../LiveActivityLog", () => ({ LiveActivityLog: () => null }))
jest.mock("../../../../services/deploymentAccess", () => ({ END_REFUSED_TITLE: "Cannot End This Deployment" }))

const view = (stopBlockedReason?: string | null) => {
	const onStopMonitoring = jest.fn()
	render(
		<DeploymentMonitorView
			device={null}
			onContinueMonitoring={jest.fn()}
			onStopMonitoring={onStopMonitoring}
			stopBlockedReason={stopBlockedReason}
		/>,
	)
	return onStopMonitoring
}

/**
 * #450: someone who may not end the deployment, a viewer, is told who can
 * when they press Stop Monitoring, instead of being asked for notes for an
 * end that would not happen.
 */
describe("DeploymentMonitorView, Stop Monitoring", () => {
	beforeEach(() => {
		jest.spyOn(Alert, "alert").mockImplementation(() => {})
		// The notes page's KeyboardAvoidingView removes its listener on unmount
		jest.spyOn(Keyboard, "addListener").mockReturnValue({ remove: jest.fn() } as any)
	})

	it("says why instead of asking for notes when the account may not end it", () => {
		const reason = "You are a viewer in \"Sinbad Gully\", and viewers cannot end deployments. Only Tui Smith, who started it, or a project admin can end it."
		const onStopMonitoring = view(reason)

		fireEvent.press(screen.getByText("Stop Monitoring"))

		expect(Alert.alert).toHaveBeenCalledWith("Cannot End This Deployment", reason)
		expect(screen.queryByText("Confirm Stop")).toBeNull()
		expect(onStopMonitoring).not.toHaveBeenCalled()
	})

	it("asks for notes when it may", () => {
		view(null)

		fireEvent.press(screen.getByText("Stop Monitoring"))

		expect(Alert.alert).not.toHaveBeenCalled()
		expect(screen.getByText("Confirm Stop")).toBeTruthy()
	})
})
