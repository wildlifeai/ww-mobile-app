import { ParamListBase, RouteProp } from "@react-navigation/native"
import type { Option } from "../components/ui/WWSelect"

export interface InitPayload {
    batteryLevel: number | null
    sdCardStatus: { total: number; free: number } | null
    deviceFirmwareVersion: string | null
    bleFirmwareUpdateAvailable: boolean
    initErrors: { selftest?: string; setUtc?: string; deviceHealth?: string[] }
}

export interface RootStackParamList extends ParamListBase {
	Notifications: undefined
	Profile: undefined
	Settings: undefined
	Home: { initialTab?: string; selectedDeploymentId?: string } | undefined
	DfuScreen: { deviceId: string }
	Login: { confirmed?: boolean } | undefined
	Register: undefined
	ForgotPassword:
	| { token?: string; refreshToken?: string; mode?: string }
	| undefined
	AddDeployment: { selectedProject?: Option } | undefined
	NewProjectScreen: undefined
	ProjectDetailsScreen: { projectId: string }
	EditProjectScreen: { projectId: string }
	ProjectDevicesScreen: { projectId: string; projectName: string }
	ProjectMembersScreen: { projectId: string; projectName: string }
	DevBuildInfo: undefined
	AuthTestScreen: undefined
	DeveloperSettings: undefined
	DeviceDiscovery: { mode: 'auto' | 'end_deployment' } | undefined
	DeviceDetails: { deviceId: string }
	EngineerConsoleScreen: { deviceId: string }
	StandaloneMotionDetectionScreen: { deviceId: string }

	DeploymentDetailsStep: { projectId: string; deviceId: string; bleDeviceId: string; initPayload?: InitPayload }
	DeploymentDetails: { deploymentId: string }
	EndDeploymentWizard: { mode: 'end_deployment'; deploymentId?: string }
	EndDeploymentDetailsStep: { deploymentId: string; deviceId: string; bleDeviceId: string; initPayload?: InitPayload }
}

export type Routes = keyof RootStackParamList

export type AppParams<T extends keyof RootStackParamList> = RouteProp<
	RootStackParamList,
	T
>
