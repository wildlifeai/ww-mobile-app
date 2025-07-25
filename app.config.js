module.exports = ({ config }) => ({
	...config,
	expo: {
		name: "WildlifeWatcher",
		slug: "wildlife-watcher",
		version: "1.0.0", // This will be updated by EAS Build
		orientation: "portrait",
		icon: "./assets/icon.png", // Make sure you have this asset
		userInterfaceStyle: "light",
		splash: {
			image: "./assets/splash.png", // Make sure you have this asset
			resizeMode: "contain",
			backgroundColor: "#ffffff",
		},
		extra: {
			// This is where you can pass environment variables to your app's JS code
			// For example, you could access the API key in your app via Constants.expoConfig.extra.googleMapsApiKeyIos
			googleMapsApiKeyIos: process.env.GOOGLE_MAPS_API_KEY_IOS,
		},
		ios: {
			supportsTablet: true,
			bundleIdentifier: "com.wildlife.wildlifewatcher",
			buildNumber: "1", // This will be updated by EAS Build
			infoPlist: {
				NSBluetoothAlwaysUsageDescription:
					"This app uses Bluetooth to connect to Wildlife Watcher cameras.",
				NSBluetoothPeripheralUsageDescription:
					"This app uses Bluetooth to connect to Wildlife Watcher cameras.",
				NSLocationWhenInUseUsageDescription:
					"This app uses your location to find nearby cameras.",
				// Injects the Google Maps API key into the Info.plist
				GMSApiKey: process.env.GOOGLE_MAPS_API_KEY_IOS,
			},
			googleServicesFile: "./GoogleService-Info.plist",
		},
		android: {
			adaptiveIcon: {
				foregroundImage: "./assets/adaptive-icon.png",
				backgroundColor: "#ffffff",
			},
			package: "com.wildlife.wildlifewatcher",
			versionCode: 1, // This will be updated by EAS Build
			permissions: [
				"android.permission.BLUETOOTH",
				"android.permission.BLUETOOTH_ADMIN",
				"android.permission.BLUETOOTH_CONNECT", // For Android 12+
				"android.permission.BLUETOOTH_SCAN", // For Android 12+
				"android.permission.ACCESS_FINE_LOCATION",
			],
			// Injects the Google Maps API key into the AndroidManifest.xml
			config: {
				googleMaps: {
					apiKey: process.env.GOOGLE_MAPS_API_KEY_ANDROID,
				},
			},
			googleServicesFile: "./google-services.json",
		},
		plugins: [
			// Add the Firebase plugin
			"@react-native-firebase/app",
			// Configures react-native-bootsplash
			[
				"react-native-bootsplash",
				{
					"storyboard": "BootSplash",
				},
			],
		],
	},
});