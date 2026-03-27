import { useState, useEffect } from "react"
import { BottomNavigation } from "react-native-paper"
import { useRoute, RouteProp } from "@react-navigation/native"
import { RootStackParamList } from "./types"
import { DeviceDiscoveryScreen } from "../screens/Devices/DeviceDiscoveryScreen"
import { Maps } from "./screens/MapsScreen"
import { Projects } from "../screens/Projects/ProjectsListScreen"
import { useExtendedTheme } from "../theme"
// import InvitationService from "../services/InvitationService"
// import { getSupabaseClient } from "../services/supabase"
import { useAppNavigation } from "../hooks/useAppNavigation"

const routes = [
	{
		key: "devices",
		title: "Scanner",
		focusedIcon: "cellphone-link",
		unfocusedIcon: "cellphone-link",
	},
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
]

const renderScene = BottomNavigation.SceneMap({
	maps: Maps,
	projects: Projects,
	devices: DeviceDiscoveryScreen as any,
})

export const BottomTabs = () => {
	const [index, setIndex] = useState(0) // Start with Devices (Scanner) tab active
	// const [invitationCount, setInvitationCount] = useState(0)
	const { colors } = useExtendedTheme()
	const navigation = useAppNavigation()
	const route = useRoute<RouteProp<RootStackParamList, "Home">>()

	useEffect(() => {
		if (route.params?.initialTab === "devices") {
			setIndex(0)
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
