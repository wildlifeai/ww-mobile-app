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
import { TutorialScreen } from "./screens/user/TutorialScreen"

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
import { ProjectVisualizationScreen } from "../screens/Projects/ProjectVisualizationScreen"

// Deployment screens
// import { Deployments as DeploymentsListScreen } from "../screens/Deployments/DeploymentsListScreen"

import { StartMonitoringDetailsStep } from "../screens/Deployments/StartMonitoringScreen"
import { StopMonitoringDetailsStep } from "../screens/Deployments/StopMonitoringScreen"

// Device screens
// import { Devices as DevicesListScreen } from "../screens/Devices/DevicesListScreen"
import { DeviceDiscoveryScreen } from "../screens/Devices/DeviceDiscoveryScreen"
import { DeviceMonitoringSummaryScreen } from "../screens/Devices/DeviceMonitoringSummaryScreen"
import { EngineerConsoleScreen } from "../screens/Devices/EngineerConsoleScreen"
import { StandaloneMotionDetectionScreen } from "../screens/Devices/StandaloneMotionDetectionScreen"
import { StandaloneCapturePreviewScreen } from "../screens/Devices/StandaloneCapturePreviewScreen"
import { CameraSettingsTestScreen } from "../screens/Devices/CameraSettingsTestScreen"
import { DevDeploymentTestScreen } from "../screens/Devices/DevDeploymentTestScreen"
import { FirmwareUpdateScreen } from "../screens/Devices/FirmwareUpdateScreen"
import { FileTransferTestScreen } from "../screens/Devices/FileTransferTestScreen"
import { ModelValidationTestScreen } from "../screens/Devices/ModelValidationTestScreen"
import { ConfigTransferScreen } from "../screens/Devices/ConfigTransferScreen"
import { AiModelTransferScreen } from "../screens/Devices/AiModelTransferScreen"
import { FirmwareStatusScreen } from "../screens/Devices/FirmwareStatusScreen"
import { DeviceResetScreen } from "../screens/Devices/DeviceResetScreen"
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
	const { token, initialLoad: authLoading, pendingTutorial } = useAppSelector(
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
				) : pendingTutorial ? (
					<Stack.Screen
						name="Tutorial"
						component={TutorialScreen}
						options={{ headerShown: false }}
					/>
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
							name="Tutorial"
							component={TutorialScreen}
							options={{ headerShown: false }}
						/>

						<Stack.Screen
							name="DfuScreen"
							component={DfuScreen}
							options={{ title: "Firmware Update" }}
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
							options={{ headerBackTitleVisible: false }}
						/>
						<Stack.Screen
							name="DeviceDiscovery"
							component={DeviceDiscoveryScreen}
							options={{ headerShown: false }}
						/>
						<Stack.Screen
							name="DeviceMonitoringSummary"
							component={DeviceMonitoringSummaryScreen}
							options={{ title: "Device Summary" }}
						/>
						<Stack.Screen
							name="ProjectVisualizationScreen"
							component={ProjectVisualizationScreen}
							options={{ title: "Project Details" }}
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
							name="StandaloneCapturePreviewScreen"
							component={StandaloneCapturePreviewScreen}
						/>
						<Stack.Screen
							name="CameraSettingsTestScreen"
							component={CameraSettingsTestScreen}
							options={{ title: "Camera Settings Test" }}
						/>
						<Stack.Screen
							name="FirmwareUpdateScreen"
							component={FirmwareUpdateScreen}
							options={{ title: "Firmware Update" }}
						/>
						<Stack.Screen
							name="FileTransferTestScreen"
							component={FileTransferTestScreen}
							options={{
								title: "File Transfer Test",
								headerBackTitle: "Back",
							}}
						/>
						<Stack.Screen
							name="ModelValidationTestScreen"
							component={ModelValidationTestScreen}
							options={{
								title: "Model Validation Test",
								headerBackTitle: "Back",
							}}
						/>
						<Stack.Screen
							name="ConfigTransferScreen"
							component={ConfigTransferScreen}
							options={{ title: "Config Transfer" }}
						/>
						<Stack.Screen
							name="AiModelTransferScreen"
							component={AiModelTransferScreen}
							options={{ title: "AI Model Transfer" }}
						/>
						<Stack.Screen
							name="FirmwareStatusScreen"
							component={FirmwareStatusScreen}
							options={{ title: "Firmware Status" }}
						/>
						<Stack.Screen
							name="DeviceResetScreen"
							component={DeviceResetScreen}
							options={{ title: "Reset to Defaults" }}
						/>

						<Stack.Screen
							name="StartMonitoringDetailsStep"
							component={StartMonitoringDetailsStep}
							options={{ title: "Device Interaction", headerTitleAlign: 'center' }}
						/>

						<Stack.Screen
							name="StopMonitoringDetailsStep"
							component={StopMonitoringDetailsStep}
							options={{ title: "End monitoring" }}
						/>

						<Stack.Screen
							name="DevDeploymentTestScreen"
							component={DevDeploymentTestScreen}
							options={{ title: "Dev Deployment Test" }}
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
