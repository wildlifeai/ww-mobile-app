import { Alert } from "react-native"
import { fireEvent, screen, waitFor } from "@testing-library/react-native"
import { renderWithProviders } from "../../../../../tests/setup/utils/testUtils"
import { InviteMemberCard } from "../InviteMemberCard"
import InvitationService from "../../../../services/InvitationService"

// Helpers of the NetInfo mock in tests/__mocks__ (mapped in jest.config.js), not part of
// the real module's types; require keeps the instance the components use
const { __setNetworkState, __resetNetworkState } = require("@react-native-community/netinfo") as {
	__setNetworkState: (state: { isConnected: boolean }) => void
	__resetNetworkState: () => void
}

jest.mock("../../../../services/InvitationService", () => ({
	__esModule: true,
	default: { sendInvitation: jest.fn() },
}))

const signedIn = {
	authentication: {
		token: "jwt",
		user: { id: "user-me", email: "victor@ww.org", role: "project_admin", organisation_id: "org-1" },
		permissions: {},
		loading: false,
		initialLoad: false,
		sessionPersisted: true,
		profileLoading: false,
		pendingTutorial: false,
	},
}

const invite = async (email: string) => {
	renderWithProviders(
		<InviteMemberCard projectId="project-1" onInviteSent={jest.fn()} styles={{}} />,
		{ preloadedState: signedIn },
	)
	// react-native-paper is mocked in tests/setup/sanitySetup.ts, so the one
	// input on the card is a bare TextInput with an empty value
	fireEvent.changeText(screen.getByDisplayValue(""), email)
	fireEvent.press(screen.getByText("Send Invite"))
}

describe("InviteMemberCard (#308)", () => {
	let alert: jest.SpyInstance

	beforeEach(() => {
		jest.useRealTimers()
		alert = jest.spyOn(Alert, "alert").mockImplementation(() => {})
	})

	// The words must not depend on whether the address has an account
	it("confirms with the same wording for any address", async () => {
		;(InvitationService.sendInvitation as jest.Mock).mockResolvedValue("invitation-id")

		await invite("tama@ww.org")

		await waitFor(() => expect(alert).toHaveBeenCalled())
		expect(InvitationService.sendInvitation).toHaveBeenCalledWith("project-1", "tama@ww.org", "project_member")
		expect(alert).toHaveBeenCalledWith(
			"Invitation sent",
			expect.stringContaining("If they have a Wildlife Watcher account"),
		)
	})

	it("says inviting needs a connection when offline, without calling the server", async () => {
		__setNetworkState({ isConnected: false })
		try {
			await invite("tama@ww.org")

			await waitFor(() => expect(alert).toHaveBeenCalled())
			expect(alert).toHaveBeenCalledWith("No connection", expect.stringContaining("needs a connection"))
			expect(InvitationService.sendInvitation).not.toHaveBeenCalled()
		} finally {
			__resetNetworkState()
		}
	})

	it("explains a second invitation to the same address", async () => {
		;(InvitationService.sendInvitation as jest.Mock).mockRejectedValue({
			code: "23505",
			message: 'duplicate key value violates unique constraint "idx_unique_pending_invitation"',
		})

		await invite("tama@ww.org")

		await waitFor(() => expect(alert).toHaveBeenCalled())
		expect(alert).toHaveBeenCalledWith("Error", "This email address already has a pending invitation to this project.")
	})
})
