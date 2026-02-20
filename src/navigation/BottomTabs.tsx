import { useState, useEffect } from "react"
import { BottomNavigation } from "react-native-paper"
import { useRoute, RouteProp } from "@react-navigation/native"
import { RootStackParamList } from "./types"
import { Deployments } from "../screens/Deployments/DeploymentsListScreen"
import { Maps } from "./screens/MapsScreen"
import { Projects } from "../screens/Projects/ProjectsListScreen"
import { Devices } from "../screens/Devices/DevicesListScreen"
import { useExtendedTheme } from "../theme"
// import InvitationService from "../services/InvitationService"
// import { getSupabaseClient } from "../services/supabase"
import { useAppNavigation } from "../hooks/useAppNavigation"

const routes = [
	{
		key: "maps",
		title: "Map",
		focusedIcon: "map-marker",
		unfocusedIcon: "map-marker-outline",
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
		focusedIcon: "arrow-up-bold-box",
		unfocusedIcon: "arrow-up-bold-box-outline",
	},
	{
		key: "devices",
		title: "Devices",
		focusedIcon: "cellphone-link",
		unfocusedIcon: "cellphone-link",
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
	// const [invitationCount, setInvitationCount] = useState(0)
	const { colors } = useExtendedTheme()
	const navigation = useAppNavigation()
	const route = useRoute<RouteProp<RootStackParamList, "Home">>()

	useEffect(() => {
		if (route.params?.initialTab === "devices") {
			setIndex(3)
			navigation.setParams({ initialTab: undefined })
		} else if (route.params?.initialTab === "deployment") {
			setIndex(2)
			navigation.setParams({ initialTab: undefined })
		}
	}, [route.params?.initialTab, navigation])


	return (
		<BottomNavigation
			navigationState={{ index, routes }}
			onIndexChange={setIndex}
			renderScene={renderScene}
			activeColor={colors.primary}
			inactiveColor={colors.onSurfaceVariant}
			barStyle={{ backgroundColor: colors.surface }}
			theme={{ colors: { secondaryContainer: 'transparent' } }}
		/>
	)
}
