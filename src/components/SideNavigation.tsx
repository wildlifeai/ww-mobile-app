import { StyleSheet, View } from "react-native"
import { Button, Divider } from "react-native-paper"
import { useAppNavigation } from "../hooks/useAppNavigation"
import { useExtendedTheme } from "../theme"
import { Dispatch } from "react"
import { useAppDispatch } from "../redux"
import { logout } from "../redux/slices/authSlice"
import { OrgSwitcher } from "./OrgSwitcher"
import { useUserOrganisations } from "../hooks/useUserOrganisations"
import { Badge } from "react-native-paper"
import { useState, useEffect } from "react"
import InvitationService from "../services/InvitationService"
import { useAppSelector } from "../redux"
import { selectCurrentUser } from "../redux/slices/authSlice"

type Props = {
	drawerControls: Dispatch<React.SetStateAction<boolean>>
}

export const SideNavigation = ({ drawerControls }: Props) => {
	const navigation = useAppNavigation()
	const dispatch = useAppDispatch()
	const { spacing, colors, appPadding } = useExtendedTheme()

	const { canSwitchOrganisations } = useUserOrganisations()
	const user = useAppSelector(selectCurrentUser)
	const [invitationCount, setInvitationCount] = useState(0)

	useEffect(() => {
		if (!user?.email) return

		const loadCount = async () => {
			const count = await InvitationService.getPendingInvitationCount()
			setInvitationCount(count)
		}

		loadCount()

		// Subscribe to realtime updates
		const channel = InvitationService.subscribeToInvitations(user.email, () => {
			loadCount()
		})

		return () => {
			InvitationService.unsubscribeFromInvitations()
		}
	}, [user?.email])

	const goTo = (link: string) => {
		navigation.navigate(link)
		drawerControls(false)
	}

	const onLogout = () => {
		dispatch(logout())
		drawerControls(false)
	}

	return (
		<View style={[styles.list, { marginVertical: appPadding }]}>
			{/* Organisation Switcher (WW Admin or multi-org users only) */}
			{canSwitchOrganisations && (
				<>
					<OrgSwitcher />
					<Divider style={{ marginVertical: spacing }} />
				</>
			)}

			<View>
				<Button
					textColor={colors.onBackground}
					style={[{ margin: spacing }, styles.link]}
					icon="bell"
					onPress={() => goTo("Notifications")}
				>
					Notifications
				</Button>
				{invitationCount > 0 && (
					<Badge
						size={20}
						style={{
							position: 'absolute',
							top: 5,
							right: 10,
							backgroundColor: colors.error
						}}
					>
						{invitationCount}
					</Badge>
				)}
			</View>
			<Button
				textColor={colors.onBackground}
				style={[{ margin: spacing }, styles.link]}
				icon="account"
				onPress={() => goTo("Profile")}
			>
				Profile
			</Button>
			<Button
				textColor={colors.onBackground}
				style={[{ margin: spacing }, styles.link]}
				icon="cog"
				onPress={() => goTo("Settings")}
			>
				Settings
			</Button>
			<Button
				textColor={colors.onBackground}
				style={[{ margin: spacing }, styles.link]}
				icon="logout"
				onPress={onLogout}
			>
				Sign out
			</Button>
			{__DEV__ && (
				<>
					<View
						style={{
							height: 1,
							backgroundColor: colors.outline,
							marginVertical: spacing,
							width: "100%",
						}}
					/>
					<Button
						textColor={colors.primary}
						style={[{ margin: spacing }, styles.link]}
						icon="developer-board"
						onPress={() => goTo("DevBuildInfo")}
					>
						Dev Build Info
					</Button>
					<Button
						textColor={colors.primary}
						style={[{ margin: spacing }, styles.link]}
						icon="shield-key"
						onPress={() => goTo("AuthTestScreen")}
					>
						🔐 Auth Test
					</Button>
				</>
			)}
		</View>
	)
}

const styles = StyleSheet.create({
	list: {
		flex: 1,
		alignItems: "flex-start",
	},
	link: {
		margin: 10,
	},
})
