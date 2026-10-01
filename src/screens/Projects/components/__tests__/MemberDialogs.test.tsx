import { Alert } from "react-native"
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import { RemoveMemberDialog } from "../RemoveMemberDialog"
import { ChangeRoleDialog } from "../ChangeRoleDialog"
import { removeProjectMember, updateProjectMemberRole } from "../../../../services/UserRoleService"

jest.mock("../../../../services/UserRoleService", () => ({
	removeProjectMember: jest.fn(),
	updateProjectMemberRole: jest.fn(),
}))

// The global paper mock in tests/setup/sanitySetup.ts has no Chip, which the
// role dialog shows; these dialogs only need their words and buttons
jest.mock("react-native-paper", () => {
	const React = require("react")
	const RN = require("react-native")
	const pass = ({ children }: any) => React.createElement(RN.View, null, children)
	const text = ({ children }: any) => React.createElement(RN.Text, null, children)
	return {
		Portal: pass,
		Dialog: Object.assign(pass, { Title: pass, Content: pass, Actions: pass }),
		Button: ({ children, onPress, disabled }: any) =>
			React.createElement(RN.Text, { onPress: disabled ? undefined : onPress }, children),
		Text: text,
		Chip: text,
		IconButton: () => null,
		useTheme: () => ({ colors: {} }),
	}
})

const me = { id: "user-me", email: "victor@ww.org" }
const admin = {
	id: "user-me", name: "Victor Anton (You)", email: "victor@ww.org", role: "project_admin",
	granted_at: "2026-09-01T00:00:00Z", granted_by: "user-me",
}
const tama = {
	id: "user-tama", name: "Tama Te Rangi", email: "tama@ww.org", role: "project_member",
	granted_at: "2026-09-01T00:00:00Z", granted_by: "user-me",
}

const refusal = (reason: string, error: string) => ({
	success: false, user_id: tama.id, project_id: "project-1", reason, error,
})

/**
 * The member dialogs tell the operator what the server did (#335): a removal
 * RLS refused used to be reported as done.
 */
describe("RemoveMemberDialog", () => {
	let alert: jest.SpyInstance
	const onSuccess = jest.fn()

	const removeTama = () => {
		render(
			<RemoveMemberDialog
				projectId="project-1" visible member={tama} members={[admin, tama]} user={me}
				onDismiss={jest.fn()} onSuccess={onSuccess}
			/>,
		)
		fireEvent.press(screen.getByText("Remove"))
	}

	beforeEach(() => {
		jest.useRealTimers()
		alert = jest.spyOn(Alert, "alert").mockImplementation(() => {})
	})

	it("reports a removal the server made and refreshes the list", async () => {
		;(removeProjectMember as jest.Mock).mockResolvedValue({ success: true, user_id: tama.id, project_id: "project-1" })

		removeTama()

		await waitFor(() => expect(onSuccess).toHaveBeenCalled())
		expect(removeProjectMember).toHaveBeenCalledWith({ project_id: "project-1", user_id: tama.id, removed_by: me.id })
		expect(alert).toHaveBeenCalledWith("Success", "Member removed successfully")
	})

	it("shows the server's refusal and does not claim the member is gone", async () => {
		;(removeProjectMember as jest.Mock).mockResolvedValue(
			refusal("not_allowed", "Only project admins can change members. Nothing was changed."),
		)

		removeTama()

		await waitFor(() => expect(alert).toHaveBeenCalled())
		expect(alert).toHaveBeenCalledWith("Member not removed", "Only project admins can change members. Nothing was changed.")
		expect(onSuccess).not.toHaveBeenCalled()
	})

	it("says a removal needs a connection when offline", async () => {
		;(removeProjectMember as jest.Mock).mockResolvedValue(
			refusal("offline", "Removing a member needs a connection. Try again when you are online."),
		)

		removeTama()

		await waitFor(() => expect(alert).toHaveBeenCalled())
		expect(alert).toHaveBeenCalledWith("No connection", expect.stringContaining("needs a connection"))
		expect(onSuccess).not.toHaveBeenCalled()
	})
})

describe("ChangeRoleDialog", () => {
	let alert: jest.SpyInstance
	const onSuccess = jest.fn()

	const promoteTama = () => {
		render(
			<ChangeRoleDialog
				projectId="project-1" visible member={tama} user={me}
				onDismiss={jest.fn()} onSuccess={onSuccess}
			/>,
		)
		fireEvent.press(screen.getByText("Change Role"))
	}

	beforeEach(() => {
		jest.useRealTimers()
		alert = jest.spyOn(Alert, "alert").mockImplementation(() => {})
	})

	it("asks the server to make a member an admin", async () => {
		;(updateProjectMemberRole as jest.Mock).mockResolvedValue({ success: true, user_id: tama.id, project_id: "project-1" })

		promoteTama()

		await waitFor(() => expect(onSuccess).toHaveBeenCalled())
		expect(updateProjectMemberRole).toHaveBeenCalledWith({
			project_id: "project-1", user_id: tama.id, new_role: "project_admin", updated_by: me.id,
		})
	})

	it("shows the server's refusal and keeps the old role", async () => {
		;(updateProjectMemberRole as jest.Mock).mockResolvedValue(
			refusal("last_admin", "A project needs at least one admin. Make someone else an admin first."),
		)

		promoteTama()

		await waitFor(() => expect(alert).toHaveBeenCalled())
		expect(alert).toHaveBeenCalledWith("Role not changed", expect.stringContaining("at least one admin"))
		expect(onSuccess).not.toHaveBeenCalled()
	})

	it("says a role change needs a connection when offline", async () => {
		;(updateProjectMemberRole as jest.Mock).mockResolvedValue(
			refusal("offline", "Changing a role needs a connection. Try again when you are online."),
		)

		promoteTama()

		await waitFor(() => expect(alert).toHaveBeenCalled())
		expect(alert).toHaveBeenCalledWith("No connection", expect.stringContaining("needs a connection"))
	})
})
