import { useEffect } from "react"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { useAppSelector } from "../redux"
// System screens
import { BluetoothProblems } from "./screens/system/BluetoothProblemsScreen"

import { BleProblems } from "./screens/system/BleProblemsScreen"
import * as SplashScreen from "expo-splash-screen"
import { NavigationBar } from "../components/NavigationBar"
import { AppLoading } from "./screens/system/AppLoadingScreen"
import { AppDrawer } from "../components/AppDrawer"

// User screens
import { Notifications } from "./screens/user/NotificationsScreen"
import { Profile } from "./screens/user/ProfileScreen"
import { Settings } from "./screens/user/SettingsScreen"

// Auth screens
import { Login } from "./screens/auth/LoginScreen"
import { Register } from "./screens/auth/RegisterScreen"
import { ForgotPassword } from "./screens/auth/ForgotPasswordScreen"

// Project screens
// import { Projects as ProjectsListScreen } from "../screens/Projects/ProjectsListScreen"
import { NewProjectScreen } from "../screens/Projects/NewProjectScreen"
import { ProjectDetailsScreen } from "../screens/Projects/ProjectDetailsScreen"
import { ProjectMembersScreen } from "../screens/Projects/ProjectMembersScreen"
import { ProjectDevicesScreen } from "../screens/Projects/ProjectDevicesScreen"
import { EditProjectScreen } from "../screens/Projects/EditProjectScreen"

// Deployment screens
// import { Deployments as DeploymentsListScreen } from "../screens/Deployments/DeploymentsListScreen"
import { AddDeployment } from "../screens/Deployments/AddDeploymentScreen"
import { DeploymentDetailsScreen } from "../screens/Deployments/DeploymentDetailsScreen"
import { DeploymentDetailsStep } from "../screens/Deployments/StartDeploymentScreen"
import { EndDeploymentDetailsStep } from "../screens/Deployments/EndDeploymentScreen"

// Device screens
// import { Devices as DevicesListScreen } from "../screens/Devices/DevicesListScreen"
import { DeviceDiscoveryScreen } from "../screens/Devices/DeviceDiscoveryScreen"
import { DeviceDetailsScreen } from "../screens/Devices/DeviceDetailsScreen"
import { EngineerConsoleScreen } from "../screens/Devices/EngineerConsoleScreen"
import { StandaloneMotionDetectionScreen } from "../screens/Devices/StandaloneMotionDetectionScreen"
import { DfuScreen } from "../screens/Devices/DfuScreen"

// Developer screens
import { DevBuildInfo } from "./screens/developer/DevBuildInfoScreen"
import { AuthTestScreen } from "./screens/developer/AuthTestScreen"
import { DeveloperSettingsScreen } from "./screens/developer/DeveloperSettingsScreen"

// Other
import { BottomTabs } from "./BottomTabs"
import { useDeepLinking } from "../hooks/useDeepLinking"

import { RootStackParamList } from "./types"

export const Stack = createNativeStackNavigator<RootStackParamList>()

const renderHeader = (props: any) => <NavigationBar {...props} />

export const MainNavigation = () => {
	const { status, initialLoad: blLoading } = useAppSelector(
		(state) => state.blStatus,
	)
	const { initialized, initialLoad: bleLoading } = useAppSelector(
		(state) => state.bleLibrary,
	)
	const { token, initialLoad: authLoading } = useAppSelector(
		(state) => state.authentication,
	)

	// Initialize deep linking
	useDeepLinking()

	const appLoading = blLoading || bleLoading || authLoading

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
							header: renderHeader,
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
							name="EditProjectScreen"
							component={EditProjectScreen}
							options={{ title: "Edit Project" }}
						/>
						<Stack.Screen
							name="ProjectMembersScreen"
							component={ProjectMembersScreen}
							options={{ title: "Project Members" }}
						/>
						<Stack.Screen
							name="ProjectDevicesScreen"
							component={ProjectDevicesScreen}
							options={{ title: "Project Devices" }}
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
							name="StandaloneMotionDetectionScreen"
							component={StandaloneMotionDetectionScreen}
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
