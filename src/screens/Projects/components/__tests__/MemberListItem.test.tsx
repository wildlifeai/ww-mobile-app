import { render, screen } from "@testing-library/react-native"
import { MemberListItem } from "../MemberListItem"

// The global paper mock has no Card, Avatar or Menu; the row only needs its words
jest.mock("react-native-paper", () => {
	const React = require("react")
	const RN = require("react-native")
	const pass = ({ children }: any) => React.createElement(RN.View, null, children)
	const text = ({ children }: any) => React.createElement(RN.Text, null, children)
	return {
		Card: Object.assign(pass, { Content: pass }),
		Avatar: { Text: ({ label }: any) => React.createElement(RN.Text, null, label) },
		Text: text,
		Chip: text,
		IconButton: () => null,
		Menu: Object.assign(pass, { Item: () => null }),
		Divider: () => null,
		useTheme: () => ({ colors: {} }),
	}
})

const row = (member: any, userId: string) =>
	render(
		<MemberListItem
			member={member}
			user={{ id: userId }}
			adminCount={1}
			canManageMembers={false}
			menuVisible={false}
			openMenu={jest.fn()}
			closeMenu={jest.fn()}
			handleMenuChangeRole={jest.fn()}
			handleMenuRemove={jest.fn()}
			getRoleBadgeColor={() => "#000000"}
			getRoleDisplayName={(role) => (role === "project_admin" ? "Admin" : "Member")}
			dynamicStyles={{}}
		/>,
	)

const tama = { id: "user-tama", name: "Tama Jones", email: "tama@ww.org", role: "project_admin" }

/**
 * #362: the bench showed "Tama Jones (You) (You)". The members service puts a
 * plain name in the member and the row adds "(You)", once.
 */
describe("MemberListItem name", () => {
	it("marks the signed-in member once", () => {
		row(tama, "user-tama")

		expect(screen.getByText("Tama Jones (You)")).toBeTruthy()
		expect(screen.queryByText(/\(You\) \(You\)/)).toBeNull()
		expect(screen.getByText("TJ")).toBeTruthy()
	})

	it("shows anyone else by name alone", () => {
		row(tama, "user-tui")

		expect(screen.getByText("Tama Jones")).toBeTruthy()
		expect(screen.queryByText(/\(You\)/)).toBeNull()
	})
})
