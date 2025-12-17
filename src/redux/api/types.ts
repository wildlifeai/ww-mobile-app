export enum HttpMethod {
	GET = "GET",
	POST = "POST",
	PUT = "PUT",
	DELETE = "DELETE",
	PATCH = "PATCH",
}

// Common Types
export type BaseEntity = {
	id: string
}

export type BaseResponse = {
	code: number
	message: string
	type?: string
	details?: string
}

// Enums
export enum ProjectRole {
	Manager = "Manager",
	Owner = "Owner",
	User = "User",
}

// Shared Types
export type ProjectMembership = {
	projectID: string
	role: ProjectRole
}

export type GeoLocation = {
	latitude: number
	longitude: number
}

export type ExifData = {
	[key: string]: string
}

// User Types
export type User = BaseEntity & {
	userID: string
	username: string
	email: string
	provider?: string
	confirmed?: boolean
	blocked?: boolean
	name?: string
	publicProfileUrl?: string
	membershipProjects?: ProjectMembership[]
}

export type UserCreate = Omit<User, "id" | "userID">
export type UserUpdate = UserCreate

// Device Types
export type Device = BaseEntity & {
	deviceId: string
	deviceType?: string
	deviceModel?: string
	deploymentID?: string
}

export type DeviceCreate = Omit<Device, "id" | "deviceId">
export type DeviceUpdate = Partial<DeviceCreate>

// Media Types
export type Media = BaseEntity & {
	mediaID: string
	deploymentID?: string
	fileMediaType?: string
	filePath?: string
	filePublic?: boolean
	exifData?: Record<string, any>
	observations?: string[]
	sensorRecords?: string[]
}

export type MediaCreate = Omit<Media, "id" | "mediaID">
export type MediaUpdate = MediaCreate & {
	id: string
}

// Observation Types
export type Observation = BaseEntity & {
	observationID: string
	deploymentID?: string
	mediaID?: string
	eventID?: string
	eventStart?: string
	eventEnd?: string
	observationLevel?: string
	observationType?: string
	scientificName?: string
	count?: number
	individualID?: string
	classificationMethod?: string
	classifiedBy?: string
	classificationTimestamp?: string
	classificationProbability?: number
	observationComments?: string
	classifiedByModelID?: string
}

export type ObservationCreate = Omit<Observation, "id" | "observationID">
export type ObservationUpdate = ObservationCreate

// Project Types
export type Project = BaseEntity & {
	title: string
	acronym: string
	description: string
	samplingDesign: string
	captureMethod: string
	individualAnimals: number
	observationLevel: string
	projectTeam: string
	projectPrivacy: string
}

export type ProjectCreate = Omit<Project, "id">
export type ProjectUpdate = ProjectCreate

// Sensor Record Types
export type SensorRecord = BaseEntity & {
	sensorID: string
	sensorRecordID?: string
	deploymentID?: string
	provider?: string
	mediaID?: string
	date?: string
	submissionDate?: string
	sensorStatus?: string
	network?: string
	gateway?: string
	rssi?: number
	sequence?: number
	counter?: number
	batteryVoltage?: number
	deviceMemoryAvailable?: number
	snr?: number
	timeout?: number
	extra?: Record<string, unknown>
	metadata?: Record<string, unknown>
}

export type SensorRecordCreate = Omit<SensorRecord, "id" | "sensorID">
export type SensorRecordUpdate = SensorRecordCreate

// Deployment Types
export type Deployment = BaseEntity & {
	deploymentID: string
	locationID?: string
	locationName?: string
	projectID?: string
	latitude?: number
	longitude?: number
	coordinateUncertainty?: number
	deploymentStart?: string
	deploymentEnd?: string
	setupBy?: string
	deviceID?: string
	deviceDelay?: number
	deviceHeight?: number
	deviceTilt?: number
	deviceHeading?: number
	detectionDistance?: number
	baitUse?: string
	habitat?: string
	deploymentComments?: string
	deploymentPhotos?: string[]
	mediaID?: string
	observations?: string[]
}

// export type DeploymentCreate = Omit<Deployment, "id" | "deploymentID">
export type DeploymentCreate = Omit<Deployment, "id"> // TODO: Remove this and use above line
export type DeploymentUpdate = DeploymentCreate

// API Log Types
export type ApiLog = BaseEntity & {
	logID: string
	apiEndpoint?: string
	requestDate?: string
	responseStatus?: number
	userID?: string
}

export type ApiLogCreate = Omit<ApiLog, "id" | "logID">
export type ApiLogUpdate = ApiLogCreate

// Response Types
export type PaginatedResponse<T> = {
	data: T[]
	total: number
	page: number
	limit: number
}

export type ApiResponse<T> = {
	data: T
	success: boolean
	error?: BaseResponse
}
