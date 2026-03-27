import { ParamListBase, RouteProp } from "@react-navigation/native"
import type { Option } from "../components/ui/WWSelect"

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
	DeviceDiscovery: { mode: 'prepare' | 'engineer' | 'deployment' | 'auto' | 'end_deployment' } | undefined
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
