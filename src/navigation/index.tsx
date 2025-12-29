import { useEffect } from "react"
import { ParamListBase, RouteProp } from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { useAppSelector } from "../redux"
import { BluetoothProblems } from "./screens/BluetoothProblems"
import { LocationProblems } from "./screens/LocationProblems"
import { BleProblems } from "./screens/BleProblems"
import * as SplashScreen from "expo-splash-screen"
import { NavigationBar } from "../components/NavigationBar"
import { AppLoading } from "./screens/AppLoading"
import { AppDrawer } from "../components/AppDrawer"
import { Notifications } from "./screens/Notifications"
import { Profile } from "./screens/Profile"
import { Settings } from "./screens/Settings"
import { DfuScreen } from "./screens/DfuScreen"
import { Login } from "./screens/Login"
import { Register } from "./screens/Register"
import { ForgotPassword } from "./screens/ForgotPassword"
import { AddDeployment } from "./screens/AddDeployment"
import type { Option } from "../components/ui/WWSelect"
import { NewProjectScreen } from "./screens/NewProjectScreen"
import { ProjectDetailsScreen } from "./screens/ProjectDetailsScreen"
import { ProjectMembersScreen } from "../screens/ProjectMembersScreen"
import { BottomTabs } from "./BottomTabs"
import { DevBuildInfo } from "./screens/DevBuildInfo"
import { AuthTestScreen } from "../screens/AuthTestScreen"
import { DeveloperSettingsScreen } from "../screens/DeveloperSettingsScreen"
import { useDeepLinking } from "../hooks/useDeepLinking"
import { DeviceDiscoveryScreen } from "../screens/device/DeviceDiscoveryScreen"
import { DeploymentDetailsStep } from "../screens/deployment/DeploymentDetailsStep"
import { DeviceDetailsScreen } from "../screens/device/DeviceDetailsScreen"
import { EngineerConsoleScreen } from "./screens/EngineerConsoleScreen"
import { PrepareAndTestScreen } from "../screens/device/PrepareAndTestScreen"
// Import new screens
import { DeploymentDetailsScreen } from '../navigation/screens/deployment/DeploymentDetailsScreen'
import { EndDeploymentDetailsStep } from '../navigation/screens/deployment/EndDeploymentDetailsStep'

export interface RootStackParamList extends ParamListBase {
	Notifications: undefined
	Profile: undefined
	Settings: undefined
	Home: { initialTab?: string } | undefined
	DfuScreen: { deviceId: string }
	Login: { confirmed?: boolean } | undefined
	Register: undefined
	ForgotPassword:
	| { token?: string; refreshToken?: string; mode?: string }
	| undefined
	AddDeployment: { selectedProject?: Option } | undefined
	NewProjectScreen: undefined
	ProjectDetailsScreen: { projectId: string }
	ProjectMembersScreen: { projectId: string; projectName: string }
	DevBuildInfo: undefined
	AuthTestScreen: undefined
	DeveloperSettings: undefined
	DeviceDiscovery: { mode: 'prepare' | 'engineer' | 'deployment' }
	DeviceDetails: { deviceId: string }
	EngineerConsoleScreen: { deviceId: string }
	PrepareAndTest: { deviceId: string; bleDeviceId: string; selftestError?: string; setUtcError?: string; nextRoute?: string }
	StartDeploymentWizard: { mode: 'deployment' }
	DeploymentDetailsStep: { devicePreparationId: string; deviceId: string; bleDeviceId: string }
	DeploymentDetails: { deploymentId: string }
	EndDeploymentWizard: { mode: 'end_deployment'; deploymentId?: string }
	EndDeploymentDetailsStep: { deploymentId: string; deviceId: string; bleDeviceId: string }
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
			<Stack.Navigator initialRouteName="Home">
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
					<Stack.Group
						screenOptions={{
							header: (props) => (
								<NavigationBar
									{...props}
								/>
							),
						}}
					>
						<Stack.Screen
							name="Home"
							component={BottomTabs}
							options={{ headerShown: false }}
						/>
						<Stack.Screen
							name="Notifications"
							component={Notifications}
							options={{ title: "Notifications" }}
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
						<Stack.Screen
							name="DeviceDiscovery"
							component={DeviceDiscoveryScreen}
							options={{ title: "Select Device", headerTitleAlign: 'center' }}
						/>
						<Stack.Screen
							name="DeviceDetails"
							component={DeviceDetailsScreen}
							options={{ title: "Device Details" }}
						/>
						<Stack.Screen
							name="EngineerConsoleScreen"
							component={EngineerConsoleScreen}
							options={{ title: "Engineer Console", headerTitleAlign: 'center' }}
						/>
						<Stack.Screen
							name="StartDeploymentWizard"
							component={DeviceDiscoveryScreen}
							initialParams={{ mode: 'deployment' }}
							options={{ title: "Select Device", headerTitleAlign: 'center' }}
						/>
						<Stack.Screen
							name="DeploymentDetailsStep"
							component={DeploymentDetailsStep}
							options={{ title: "Deployment Details", headerTitleAlign: 'center' }}
						/>
						<Stack.Screen
							name="EndDeploymentWizard"
							component={DeviceDiscoveryScreen}
							options={{ title: "End Deployment" }}
							initialParams={{ mode: 'end_deployment' }}
						/>
						<Stack.Screen
							name="EndDeploymentDetailsStep"
							component={EndDeploymentDetailsStep}
							options={{ title: "Confirm End Deployment" }}
						/>
						<Stack.Screen
							name="DeploymentDetails"
							component={DeploymentDetailsScreen}
							options={{ title: "Deployment" }}
						/>
						<Stack.Screen
							name="PrepareAndTest"
							component={PrepareAndTestScreen}
							options={{ title: "Prepare & Test", headerTitleAlign: 'center' }}
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
								<Stack.Screen
									name="DeveloperSettings"
									component={DeveloperSettingsScreen}
									options={{ title: "Developer Settings" }}
								/>
							</>
						)}
					</Stack.Group>
				)}
			</Stack.Navigator>
		</AppDrawer>
	)
}
