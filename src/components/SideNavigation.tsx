import { useState, useEffect, useMemo, Dispatch, SetStateAction } from "react"
import { StyleSheet, View } from "react-native"
import { Button, Divider, Badge, Text } from "react-native-paper"
import { useAppNavigation } from "../hooks/useAppNavigation"
import { useExtendedTheme } from "../theme"
import { useAppDispatch } from "../redux"
import { logout } from "../redux/slices/authSlice"
import { OrgSwitcher } from "./OrgSwitcher"
import { useUserOrganisations } from "../hooks/useUserOrganisations"
import InvitationService from "../services/InvitationService"
import { useAppSelector } from "../redux"
import { selectCurrentUser } from "../redux/slices/authSlice"

type Props = {
	drawerControls: Dispatch<SetStateAction<boolean>>
}

export const SideNavigation = ({ drawerControls }: Props) => {
	const navigation = useAppNavigation()
	const dispatch = useAppDispatch()
	const { spacing, colors, appPadding } = useExtendedTheme()

	const dynamicStyles = useMemo(() => ({
		container: {
			marginVertical: appPadding
		},
		divider: {
			marginVertical: spacing
		},
		link: {
			margin: spacing
		},
		badge: {
			backgroundColor: colors.error
		},
		separator: {
			backgroundColor: colors.outline,
			marginVertical: spacing
		}
	}), [spacing, colors, appPadding])

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
		InvitationService.subscribeToInvitations(user.email, () => {
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
		<View style={[styles.list, dynamicStyles.container]}>
			{/* Organisation Switcher (WW Admin or multi-org users only) */}
			{canSwitchOrganisations && (
				<>
					<OrgSwitcher />
					<Divider style={dynamicStyles.divider} />
				</>
			)}

			<View>
				<Button
					textColor={colors.onBackground}
					style={[dynamicStyles.link, styles.link]}
					icon="bell"
					onPress={() => goTo("Notifications")}
				>
					<Text>Notifications</Text>
				</Button>
				{invitationCount > 0 && (
					<Badge
						size={20}
						style={[styles.badge, dynamicStyles.badge]}
					>
						{invitationCount}
					</Badge>
				)}
			</View>
			<Button
				textColor={colors.onBackground}
				style={[dynamicStyles.link, styles.link]}
				icon="account"
				onPress={() => goTo("Profile")}
			>
				<Text>Profile</Text>
			</Button>
			<Button
				textColor={colors.onBackground}
				style={[dynamicStyles.link, styles.link]}
				icon="cog"
				onPress={() => goTo("Settings")}
			>
				<Text>Settings</Text>
			</Button>
			<Button
				textColor={colors.onBackground}
				style={[dynamicStyles.link, styles.link]}
				icon="logout"
				onPress={onLogout}
			>
				<Text>Sign out</Text>
			</Button>
			{__DEV__ && (
				<>
					<View
						style={[styles.separator, dynamicStyles.separator]}
					/>
					<Button
						textColor={colors.primary}
						style={[dynamicStyles.link, styles.link]}
						icon="developer-board"
						onPress={() => goTo("DevBuildInfo")}
					>
						<Text>Dev Build Info</Text>
					</Button>
					<Button
						textColor={colors.primary}
						style={[dynamicStyles.link, styles.link]}
						icon="shield-key"
						onPress={() => goTo("AuthTestScreen")}
					>
						<Text>🔐 Auth Test</Text>
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
	badge: {
		position: 'absolute',
		top: 5,
		right: 10,
	},
	separator: {
		height: 1,
		width: "100%",
	},
})
