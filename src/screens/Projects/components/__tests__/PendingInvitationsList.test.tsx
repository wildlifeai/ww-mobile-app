import { fireEvent, render, screen } from "@testing-library/react-native"
import { PendingInvitationsList } from "../PendingInvitationsList"

// The global paper mock has no Card; the list only needs its words and buttons
jest.mock("react-native-paper", () => {
	const React = require("react")
	const RN = require("react-native")
	const pass = ({ children }: any) => React.createElement(RN.View, null, children)
	return {
		Card: Object.assign(pass, { Content: pass }),
		Text: ({ children }: any) => React.createElement(RN.Text, null, children),
		Button: ({ children, onPress, accessibilityLabel }: any) =>
			React.createElement(RN.Text, { onPress, accessibilityLabel }, children),
		Divider: () => null,
	}
})

const invitation: any = {
	id: "invitation-1", remoteId: "invitation-1", inviteeEmail: "bench356@ww.org",
	role: "project_member", expiresAt: "2026-10-31T00:00:00Z",
}

// #364: each pending invitation can be withdrawn
it("offers Cancel on each pending invitation", () => {
	const onCancel = jest.fn()
	render(
		<PendingInvitationsList
			pendingInvitations={[invitation]}
			getRoleDisplayName={() => "Member"}
			onCancel={onCancel}
			dynamicStyles={{}}
		/>,
	)

	fireEvent.press(screen.getByLabelText("Cancel the invitation to bench356@ww.org"))

	expect(onCancel).toHaveBeenCalledWith(invitation)
})
