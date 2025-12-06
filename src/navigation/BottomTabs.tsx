import { useState, useEffect } from "react"
import { BottomNavigation } from "react-native-paper"
import { Deployments } from "./screens/Deployments"
import { Maps } from "./screens/Maps"
import { Projects } from "./screens/Projects"
import { Devices } from "./screens/Devices"
import { useExtendedTheme } from "../theme"
import InvitationService from "../services/InvitationService"
import { getSupabaseClient } from "../services/supabase"

export const BottomTabs = () => {
	const [index, setIndex] = useState(2) // Start with Deployment tab active
	const [invitationCount, setInvitationCount] = useState(0)
	const { colors } = useExtendedTheme()

	useEffect(() => {
		let mounted = true

		const fetchCount = async () => {
			const count = await InvitationService.getPendingInvitationCount()
			if (mounted) setInvitationCount(count)
		}

		fetchCount()

		// Subscribe to realtime updates
		const setupSubscription = async () => {
			const { data: { user } } = await getSupabaseClient().auth.getUser()
			if (user?.email) {
				InvitationService.subscribeToInvitations(user.email, () => {
					fetchCount()
				})
			}
		}

		setupSubscription()

		return () => {
			mounted = false
			InvitationService.unsubscribeFromInvitations()
		}
	}, [])

	const routes = [
		{
			key: "maps",
			title: "Maps",
			focusedIcon: "map",
			unfocusedIcon: "map-outline",
		},
		{
			key: "projects",
			title: "Projects",
			focusedIcon: "folder",
			unfocusedIcon: "folder-outline",
			badge: invitationCount > 0 ? invitationCount : undefined,
		},
		{
			key: "deployment",
			title: "Deployment",
			focusedIcon: "upload",
			unfocusedIcon: "upload-outline",
		},
		{
			key: "devices",
			title: "Devices",
			focusedIcon: "devices",
			unfocusedIcon: "devices",
		},
	]

	const renderScene = BottomNavigation.SceneMap({
		maps: Maps,
		projects: Projects,
		deployment: Deployments,
		devices: Devices,
	})

	return (
		<BottomNavigation
			navigationState={{ index, routes }}
			onIndexChange={setIndex}
			renderScene={renderScene}
			activeColor={colors.primary}
			barStyle={{ backgroundColor: colors.background }}
			theme={{
				colors: {
					secondaryContainer: colors.background,
				},
			}}
		/>
	)
}
