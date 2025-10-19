import { useEffect } from "react"
import { ParamListBase, RouteProp, useRoute } from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { useAppSelector } from "../redux"
import { BluetoothProblems } from "./screens/BluetoothProblems"
import { LocationProblems } from "./screens/LocationProblems"
import { BleProblems } from "./screens/BleProblems"
import { DeviceReconnectProvider } from "../providers/DeviceReconnectProvider"
import { Terminal } from "./screens/TerminalScreen"
import * as SplashScreen from "expo-splash-screen"
import { NavigationBar } from "../components/NavigationBar"
import { AppLoading } from "./screens/AppLoading"
import { AppDrawer } from "../components/AppDrawer"
import { Notifications } from "./screens/Notifications"
import { CommunityDiscussion } from "./screens/CommunityDiscussion"
import { Profile } from "./screens/Profile"
import { Settings } from "./screens/Settings"
import { DfuScreen } from "./screens/DfuScreen"
import { Login } from "./screens/Login"
import { Register } from "./screens/Register"
import { ForgotPassword } from "./screens/ForgotPassword"
import { AddDeployment } from "./screens/AddDeployment"
import type { Option } from "../components/ui/WWSelect"
import { AddProject } from "./screens/AddProject"
import { NewProjectScreen } from "./screens/NewProjectScreen"
import { ProjectDetailsScreen } from "./screens/ProjectDetailsScreen"
import { ProjectMembersScreen } from "../screens/ProjectMembersScreen"
import { BottomTabs } from "./BottomTabs"
import { DevBuildInfo } from "./screens/DevBuildInfo"
import { AuthTestScreen } from "../screens/AuthTestScreen"
import { useDeepLinking } from "../hooks/useDeepLinking"

export interface RootStackParamList extends ParamListBase {
	CommunityDiscussion: undefined
	Notifications: undefined
	Profile: undefined
	Settings: undefined
	Home: undefined
	DeviceNavigator: { deviceId: string }
	Terminal: { deviceId: string }
	DfuScreen: { deviceId: string }
	Login: { confirmed?: boolean } | undefined
	Register: undefined
	ForgotPassword: { token?: string; refreshToken?: string; mode?: string } | undefined
	AddDeployment: { selectedProject?: Option } | undefined
	AddProject: undefined
	NewProjectScreen: undefined
	ProjectDetailsScreen: { projectId: string }
	ProjectMembersScreen: { projectId: string; projectName: string }
	DevBuildInfo: undefined
	AuthTestScreen: undefined
}

export type Routes = keyof RootStackParamList

export type AppParams<T extends keyof RootStackParamList> = RouteProp<
	RootStackParamList,
	T
>

export const Stack = createNativeStackNavigator<RootStackParamList>()

export const MainNavigation = () => {
	const { status, initialLoad: blLoading } = useAppSelector(
		(state) => state.blStatus,
	)
	const { locationEnabled, initialLoad: locLoading } = useAppSelector(
		(state) => state.locationStatus,
	)
	const { initialized, initialLoad: bleLoading } = useAppSelector(
		(state) => state.bleLibrary,
	)
	const { token, initialLoad: authLoading } = useAppSelector(
		(state) => state.authentication,
	)
	
	// Initialize deep linking
	useDeepLinking()

	const appLoading = blLoading || locLoading || bleLoading || authLoading

	useEffect(() => {
		if (!appLoading) {
			SplashScreen.hideAsync()
		}
	}, [appLoading])

	/*
	 * Stops the app from running until every important component
	 * loads. In theory this code never runs since the splahscreen
	 * covers the loading, but I kept it here as a last resort since
	 * the app could crash without this check.
	 */
	if (appLoading) {
		return (
			<Stack.Navigator initialRouteName="AppLoading">
				<Stack.Screen
					name="AppLoading"
					component={AppLoading}
					options={{ headerShown: false }}
				/>
			</Stack.Navigator>
		)
	}

	return (
		<AppDrawer>
			<Stack.Navigator
				initialRouteName="Home"
				screenOptions={{
					header: NavigationBar,
				}}
			>
				{!["PoweredOn", "Unsupported"].includes(status) ? (
					<Stack.Screen
						name="BluetoothProblems"
						component={BluetoothProblems}
						options={{ headerShown: false }}
					/>
				) : !locationEnabled ? (
					<Stack.Screen
						options={{ headerShown: false }}
						name="LocationProblems"
						component={LocationProblems}
					/>
				) : !initialized ? (
					<Stack.Screen
						options={{ headerShown: false }}
						name="BLEProblems"
						component={BleProblems}
					/>
				) : !token ? (
					<Stack.Group screenOptions={{ headerShown: false }}>
						<Stack.Screen name="Login" component={Login} />
						<Stack.Screen name="Register" component={Register} />
						<Stack.Screen name="ForgotPassword" component={ForgotPassword} />
					</Stack.Group>
				) : (
					<Stack.Group>
						<Stack.Screen
							name="Home"
							component={BottomTabs}
							options={{ title: "Wildlife Watcher" }}
						/>
						<Stack.Screen
							name="Notifications"
							component={Notifications}
							options={{ title: "Notifications" }}
						/>
						<Stack.Screen
							name="CommunityDiscussion"
							component={CommunityDiscussion}
							options={{ title: "Community Discussion" }}
						/>
						<Stack.Screen
							name="Profile"
							component={Profile}
							options={{ title: "Profile" }}
						/>
						<Stack.Screen
							name="Settings"
							component={Settings}
							options={{ title: "Settings" }}
						/>
						<Stack.Screen
							name="DeviceNavigator"
							options={{ title: "Configure device" }}
							component={DeviceNavigation} // Nested navigator here
						/>
						<Stack.Screen
							name="DfuScreen"
							component={DfuScreen}
							options={{ title: "Firmware Update" }}
						/>
						<Stack.Screen
							name="AddDeployment"
							component={AddDeployment}
							options={{ title: "Start deployment" }}
						/>
						<Stack.Screen
							name="AddProject"
							component={AddProject}
							options={{ title: "New project details" }}
						/>
						<Stack.Screen
							name="NewProjectScreen"
							component={NewProjectScreen}
							options={{ title: "Create Project" }}
						/>
						<Stack.Screen
							name="ProjectDetailsScreen"
							component={ProjectDetailsScreen}
							options={{ title: "Project Details" }}
						/>
						<Stack.Screen
							name="ProjectMembersScreen"
							component={ProjectMembersScreen}
							options={{ title: "Project Members" }}
						/>
						{__DEV__ && (
							<>
								<Stack.Screen
									name="DevBuildInfo"
									component={DevBuildInfo}
									options={{ title: "Dev Build Info" }}
								/>
								<Stack.Screen
									name="AuthTestScreen"
									component={AuthTestScreen}
									options={{ title: "🔐 Auth Test" }}
								/>
							</>
						)}
					</Stack.Group>
				)}
			</Stack.Navigator>
		</AppDrawer>
	)
}

/**
 * This is just a wrapper for device that checks whether the device
 * is locked/connected/inBootloader/upgrading or not. As a provider,
 * it is unique, other providers will later on wrap the navigators
 * as DeviceProviders in the <Device /> component once the device is
 * unlocked.
 */
export const DeviceNavigation = () => {
	const {
		params: { deviceId },
	} = useRoute<AppParams<"DeviceNavigator">>()

	return (
		<DeviceReconnectProvider deviceId={deviceId}>
			<Stack.Navigator screenOptions={{ headerShown: false }}>
				<Stack.Screen
					name="Terminal"
					component={Terminal}
					initialParams={{ deviceId }}
				/>
			</Stack.Navigator>
		</DeviceReconnectProvider>
	)
}
