import { Alert } from "react-native"
import { fireEvent, screen, waitFor } from "@testing-library/react-native"
import { renderWithProviders } from "../../../../tests/setup/utils/testUtils"
import { ProjectMembersScreen } from "../ProjectMembersScreen"
import { getProjectMembers } from "../../../services/UserRoleService"
import InvitationService from "../../../services/InvitationService"

// Helpers of the NetInfo mock in tests/__mocks__ (mapped in jest.config.js), not part of
// the real module's types; require keeps the instance the components use
const { __setNetworkState, __resetNetworkState } = require("@react-native-community/netinfo") as {
	__setNetworkState: (state: { isConnected: boolean }) => void
	__resetNetworkState: () => void
}

jest.mock("@react-navigation/native", () => ({
	...jest.requireActual("@react-navigation/native"),
	useRoute: () => ({ params: { projectId: "fb7fd590", projectName: "Offline project" } }),
}))

jest.mock("../../../services/UserRoleService", () => ({ getProjectMembers: jest.fn() }))

jest.mock("../../../services/InvitationService", () => ({
	__esModule: true,
	default: {
		getProjectPendingInvitations: jest.fn(() => Promise.resolve([])),
		cancelInvitation: jest.fn(() => Promise.resolve()),
	},
	describeCancelInvitationError: () => "It had already been accepted, declined or had expired.",
}))

// The children use paper components the global mock does not have; the list
// only needs to show who is in it, and a tap on a name opens the remove dialog
jest.mock("../components/MemberListItem", () => ({
	MemberListItem: ({ member, handleMenuRemove }: any) =>
		require("react").createElement(require("react-native").Text, { onPress: () => handleMenuRemove(member) }, member.name),
}))
jest.mock("../components/InviteMemberCard", () => ({ InviteMemberCard: () => null }))
// Each pending invitation as its Cancel button
jest.mock("../components/PendingInvitationsList", () => ({
	PendingInvitationsList: ({ pendingInvitations, onCancel }: any) =>
		pendingInvitations.map((invite: any) =>
			require("react").createElement(require("react-native").Text, { key: invite.id, onPress: () => onCancel(invite) }, `Cancel ${invite.inviteeEmail}`)),
}))
jest.mock("../components/ChangeRoleDialog", () => ({ ChangeRoleDialog: () => null }))
// Stands for a removal the server confirmed
jest.mock("../components/RemoveMemberDialog", () => ({
	RemoveMemberDialog: ({ visible, member, onSuccess }: any) => visible
		? require("react").createElement(require("react-native").Text, { onPress: onSuccess }, `Remove ${member.name}?`)
		: null,
}))

// Signed in, with the org loaded, but no profile: it comes from the cloud
const signedInOffline = {
	authentication: {
		token: "jwt",
		user: { id: "user-me", email: "victor@ww.org", role: "project_member", organisation_id: "org-1" },
		permissions: {},
		loading: false,
		initialLoad: false,
		sessionPersisted: true,
		profileLoading: false,
		pendingTutorial: false,
	},
}

// What the local fallback returns for a project created on this phone
const me = {
	id: "user-me",
	name: "Unknown User",
	email: "",
	role: "project_admin",
	granted_at: "2026-09-29T04:00:00Z",
	granted_by: "user-me",
}

describe("ProjectMembersScreen offline", () => {
	let alert: jest.SpyInstance

	beforeEach(() => {
		jest.useRealTimers()
		alert = jest.spyOn(Alert, "alert").mockImplementation(() => {})
		__setNetworkState({ isConnected: false })
	})

	afterEach(() => {
		__resetNetworkState()
	})

	it("lists the current user from local data, with no alert", async () => {
		;(getProjectMembers as jest.Mock).mockResolvedValue([me])

		renderWithProviders(<ProjectMembersScreen />, { preloadedState: signedInOffline })

		// The session email, plain: the row adds "(You)" (#362)
		expect(await screen.findByText("victor@ww.org")).toBeTruthy()
		expect(alert).not.toHaveBeenCalled()
		// Pending invitations live only on the server
		expect(InvitationService.getProjectPendingInvitations).not.toHaveBeenCalled()
	})

	it("does not alert even when the load fails", async () => {
		;(getProjectMembers as jest.Mock).mockRejectedValue(new Error("Network request failed"))

		renderWithProviders(<ProjectMembersScreen />, { preloadedState: signedInOffline })

		await waitFor(() => expect(getProjectMembers).toHaveBeenCalled())
		await new Promise((resolve) => setTimeout(resolve, 0))
		expect(alert).not.toHaveBeenCalled()
	})

	it("still alerts on a failed load online", async () => {
		__setNetworkState({ isConnected: true })
		;(getProjectMembers as jest.Mock).mockRejectedValue(new Error("boom"))

		renderWithProviders(<ProjectMembersScreen />, { preloadedState: signedInOffline })

		await waitFor(() => expect(alert).toHaveBeenCalledWith("Error", "Failed to load project members"))
	})
})

describe("ProjectMembersScreen after a member change (#335)", () => {
	const tama = { ...me, id: "user-tama", name: "Tama Te Rangi", email: "tama@ww.org", role: "project_member" }

	beforeEach(() => {
		jest.useRealTimers()
		jest.spyOn(Alert, "alert").mockImplementation(() => {})
	})

	it("closes the dialog and shows the list the server now returns", async () => {
		;(getProjectMembers as jest.Mock)
			.mockResolvedValueOnce([me, tama])
			.mockResolvedValue([me])

		renderWithProviders(<ProjectMembersScreen />, { preloadedState: signedInOffline })
		fireEvent.press(await screen.findByText("Tama Te Rangi"))
		fireEvent.press(await screen.findByText("Remove Tama Te Rangi?"))

		// The reload goes through the whole screen; under a full parallel run it
		// can take longer than waitFor's 1 s default
		await waitFor(() => expect(screen.queryByText("Tama Te Rangi")).toBeNull(), { timeout: 5000 })
		expect(screen.queryByText("Remove Tama Te Rangi?")).toBeNull()
		expect(getProjectMembers).toHaveBeenCalledTimes(2)
	})
})

// #364: an admin withdraws a pending invitation
describe("ProjectMembersScreen cancelling an invitation", () => {
	const invitation = {
		id: "invitation-1", remoteId: "invitation-1", inviteeEmail: "bench356@ww.org",
		role: "project_member", expiresAt: "2026-10-31T00:00:00Z",
	}
	let alert: jest.SpyInstance

	beforeEach(() => {
		jest.useRealTimers()
		alert = jest.spyOn(Alert, "alert").mockImplementation(() => {})
		;(getProjectMembers as jest.Mock).mockResolvedValue([me])
		;(InvitationService.getProjectPendingInvitations as jest.Mock).mockResolvedValue([invitation])
		;(InvitationService.cancelInvitation as jest.Mock).mockClear().mockResolvedValue(undefined)
		__setNetworkState({ isConnected: true })
	})

	afterEach(() => {
		__resetNetworkState()
	})

	// The button the confirmation offers, pressed
	const confirm = async () => {
		await waitFor(() => expect(alert).toHaveBeenCalledWith("Cancel invitation?", expect.any(String), expect.any(Array)))
		const buttons = alert.mock.calls.find((call) => call[0] === "Cancel invitation?")[2]
		await buttons.find((b: any) => b.text === "Cancel invitation").onPress()
	}

	it("asks first, then cancels it and fetches the list again", async () => {
		renderWithProviders(<ProjectMembersScreen />, { preloadedState: signedInOffline })
		fireEvent.press(await screen.findByText("Cancel bench356@ww.org"))
		await confirm()

		expect(InvitationService.cancelInvitation).toHaveBeenCalledWith("invitation-1")
		await waitFor(() => expect(InvitationService.getProjectPendingInvitations).toHaveBeenCalledTimes(2))
	})

	it("says why when the server refuses", async () => {
		;(InvitationService.cancelInvitation as jest.Mock).mockRejectedValue({ code: "P0002" })

		renderWithProviders(<ProjectMembersScreen />, { preloadedState: signedInOffline })
		fireEvent.press(await screen.findByText("Cancel bench356@ww.org"))
		await confirm()

		expect(alert).toHaveBeenCalledWith("Invitation not cancelled", expect.stringContaining("already been accepted"))
	})

	it("says it needs a connection when offline, without asking or calling the server", async () => {
		renderWithProviders(<ProjectMembersScreen />, { preloadedState: signedInOffline })
		const button = await screen.findByText("Cancel bench356@ww.org")
		__setNetworkState({ isConnected: false })
		fireEvent.press(button)

		await waitFor(() => expect(alert).toHaveBeenCalledWith("No connection", expect.stringContaining("needs a connection")))
		expect(alert).not.toHaveBeenCalledWith("Cancel invitation?", expect.anything(), expect.anything())
		expect(InvitationService.cancelInvitation).not.toHaveBeenCalled()
	})
})
