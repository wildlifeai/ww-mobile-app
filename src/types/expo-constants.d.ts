import { ExpoConfig } from "expo/config"

declare module "expo-constants" {
	interface ExpoConfig {
		extra?: {
			eas?: {
				projectId?: string
			}
			// Environment variables from app.config.js
			apiBase?: string
			googleMapsApiKeyAndroid?: string
			googleMapsApiKeyIos?: string
			// Bundle identifier info
			bundleIdentifier?: string
			isDevelopment?: boolean
		}
	}
}

// Environment variable interface compatible with react-native-config
export interface ExpoEnvironmentVariables {
	API_BASE?: string
	GOOGLE_MAPS_API_KEY_ANDROID?: string
	GOOGLE_MAPS_API_KEY_IOS?: string
}
