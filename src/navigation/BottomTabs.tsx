import { useState, useEffect } from "react"
import { BottomNavigation } from "react-native-paper"
import { useRoute, RouteProp } from "@react-navigation/native"
import { RootStackParamList } from "./index"
import { Deployments } from "./screens/Deployments"
import { Maps } from "./screens/Maps"
import { Projects } from "./screens/Projects"
import { Devices } from "./screens/Devices"
import { useExtendedTheme } from "../theme"
import InvitationService from "../services/InvitationService"
import { getSupabaseClient } from "../services/supabase"
import { useAppNavigation } from "../hooks/useAppNavigation"

const routes = [
	{
		key: "maps",
		title: "Map",
		focusedIcon: "map",
		unfocusedIcon: "map-outline",
	},
	{
		key: "projects",
		title: "Projects",
		focusedIcon: "folder",
		unfocusedIcon: "folder-outline",
	},
	{
		key: "deployment",
		title: "Deployments",
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

export const BottomTabs = () => {
	const [index, setIndex] = useState(0) // Start with Maps tab active
	// Note: We can't use invitationCount in routes if routes is static outside.
	// But invitationCount is used for badge.
	// So routes MUST be inside or memoized if it depends on state.

	const [invitationCount, setInvitationCount] = useState(0)
	const { colors } = useExtendedTheme()
	const navigation = useAppNavigation()
	const route = useRoute<RouteProp<RootStackParamList, "Home">>()

	useEffect(() => {
		if (route.params?.initialTab === "devices") {
			setIndex(3)
			// Clear params so it doesn't keep resetting on re-renders/focus
			navigation.setParams({ initialTab: undefined })
		}
	}, [route.params?.initialTab])


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
