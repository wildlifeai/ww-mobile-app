import { ParamListBase, RouteProp } from "@react-navigation/native"

export interface InitPayload {
    batteryLevel: number | null
    sdCardStatus: { total: number; free: number } | null
    deviceFirmwareVersion: string | null
    himaxFirmwareVersion: string | null
    aiProcessorFailed: boolean
    initErrors: { selftest?: string; setUtc?: string; deviceHealth?: string[] }
}

export interface RootStackParamList extends ParamListBase {
	Notifications: undefined
	Profile: undefined
	Settings: undefined
	Tutorial: undefined
	Home: { initialTab?: 'devices' | 'maps'; selectedDeploymentId?: string } | undefined
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
	DeviceDiscovery: undefined
	DeviceMonitoringSummary: { deviceId?: string; deploymentId?: string }
	ProjectVisualizationScreen: { projectId: string }
	EngineerConsoleScreen: { deviceId: string }
	StandaloneMotionDetectionScreen: { deviceId: string }
	CapturePictureScreen: { deviceId: string }
	LightSensorScreen: { deviceId: string }
	FirmwareUpdateScreen: { deviceId: string; target: 'ble' | 'himax' }
	// Start Monitoring's one Update software: every step the camera needs, in order (#529)
	SoftwareUpdateScreen: { deviceId: string }
	FileTransferTestScreen: { deviceId: string }
	ModelValidationTestScreen: { deviceId: string }
	FirmwareStatusScreen: { deviceId: string }
	DeviceResetScreen: { deviceId: string }
	DevDeploymentTestScreen: { deviceId: string; bleDeviceId: string }
	DeviceCheckScreen: { deviceId: string }

	StartMonitoringDetailsStep: { projectId?: string; deviceId?: string; bleDeviceId?: string; initPayload?: InitPayload }
	StopMonitoringDetailsStep: { deploymentId: string; deviceId: string; bleDeviceId: string; initPayload?: InitPayload }
}

export type AppParams<T extends keyof RootStackParamList> = RouteProp<
	RootStackParamList,
	T
>
