import Config from "../../utils/environment"

const { API_BASE } = Config

const prefixUrl = (path: string) => `${API_BASE}/api${path}`

export const API_URLS = {
	// Users
	USERS: prefixUrl("/users"),
	USER_BY_ID: (id: string) => prefixUrl(`/users/${id}`),

	// Devices
	DEVICES: prefixUrl("/devices"),
	DEVICE_BY_ID: (id: string) => prefixUrl(`/devices/${id}`),

	// Media
	MEDIA: prefixUrl("/media"),
	MEDIA_BY_ID: (id: string) => prefixUrl(`/media/${id}`),

	// Observations
	OBSERVATIONS: prefixUrl("/observations"),
	OBSERVATION_BY_ID: (id: string) => prefixUrl(`/observations/${id}`),

	// Projects
	PROJECTS: prefixUrl("/projects"),
	PROJECT_BY_ID: (id: string) => prefixUrl(`/projects/${id}`),

	// Sensor Records
	SENSOR_RECORDS: prefixUrl("/sensorrecords"),
	SENSOR_RECORD_BY_ID: (id: string) => prefixUrl(`/sensorrecords/${id}`),

	// Deployments
	DEPLOYMENTS: prefixUrl("/deployments"),
	DEPLOYMENT_BY_ID: (id: string) => prefixUrl(`/deployments/${id}`),

	// API Logs
	API_LOGS: prefixUrl("/api-logs"),
	API_LOG_BY_ID: (id: string) => prefixUrl(`/api-logs/${id}`),

	// Auth
	AUTH_LOGIN: prefixUrl("/auth/local"),
	AUTH_REGISTER: prefixUrl("/auth/local/register"),
	AUTH_ME: prefixUrl("/users/me"),
} as const
