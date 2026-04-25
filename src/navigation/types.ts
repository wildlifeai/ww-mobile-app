import { ParamListBase, RouteProp } from "@react-navigation/native"

export interface InitPayload {
    batteryLevel: number | null
    sdCardStatus: { total: number; free: number } | null
    deviceFirmwareVersion: string | null
    himaxFirmwareVersion: string | null
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
	StandaloneCapturePreviewScreen: { deviceId: string }
	CameraSettingsTestScreen: { deviceId: string }
	FirmwareUpdateScreen: { deviceId: string; target: 'ble' | 'himax' }
	FileTransferTestScreen: { deviceId: string }
	ModelValidationTestScreen: { deviceId: string }
	ConfigTransferScreen: { deviceId: string }
	AiModelTransferScreen: { deviceId: string; modelId?: string }
	FirmwareStatusScreen: { deviceId: string }

	StartMonitoringDetailsStep: { projectId?: string; deviceId?: string; bleDeviceId?: string; initPayload?: InitPayload }
	DeploymentDetails: { deploymentId: string }
	StopMonitoringDetailsStep: { deploymentId: string; deviceId: string; bleDeviceId: string; initPayload?: InitPayload }
}

export type Routes = keyof RootStackParamList

export type AppParams<T extends keyof RootStackParamList> = RouteProp<
	RootStackParamList,
	T
>
