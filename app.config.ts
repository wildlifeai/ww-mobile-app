import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
    ...config,
    name: 'WildlifeWatcher',
    slug: 'localwatcher',
    owner: 'victor_wildlife',
    version: '1.0.0', // Default version
    scheme: 'wildlifewatcher',
    orientation: 'portrait',
    icon: './assets/icon.png', // Standard default
    userInterfaceStyle: 'light',
    splash: {
        image: './assets/splash.png',
        resizeMode: 'contain',
        backgroundColor: '#ffffff'
    },
    assetBundlePatterns: [
        "**/*"
    ],
    ios: {
        supportsTablet: true,
        bundleIdentifier: 'com.wildlifewatcher.app',
        config: {
            googleMapsApiKey: process.env['GOOGLE_MAPS_API_KEY_IOS'],
        },
        infoPlist: {
            NSLocationWhenInUseUsageDescription: "We need your location to set GPS coordinates on camera devices for accurate wildlife tracking and habitat mapping.",
            NSBluetoothAlwaysUsageDescription: "This app uses Bluetooth to connect to wildlife camera devices.",
            NSBluetoothPeripheralUsageDescription: "This app uses Bluetooth to connect to wildlife camera devices.",
            NSCameraUsageDescription: "We need access to your camera to take photos of the deployment site.",
            NSPhotoLibraryUsageDescription: "We need access to your photo library to select deployment photos.",
            NSPhotoLibraryAddUsageDescription: "We need access to save deployment photos to your library."
        }
    },
    android: {
        package: 'com.wildlifewatcher.app',
        adaptiveIcon: {
            foregroundImage: "./assets/adaptive-icon.png",
            backgroundColor: "#ffffff"
        },
        statusBar: {
            barStyle: "light-content",
            backgroundColor: "#000000",
            translucent: false
        },
        config: {
            googleMaps: {
                apiKey: process.env['GOOGLE_MAPS_API_KEY_ANDROID'],
            },
        },
        permissions: [
            "ACCESS_FINE_LOCATION",
            "ACCESS_COARSE_LOCATION",
            "BLUETOOTH",
            "BLUETOOTH_ADMIN",
            "BLUETOOTH_CONNECT",
            "BLUETOOTH_SCAN",
            "ACCESS_BACKGROUND_LOCATION"
        ]
    },
    web: {
        favicon: "./assets/favicon.png"
    },
    extra: {
        eas: {
            projectId: "3efab2c3-5606-4c24-a20c-38f979b5dc4b"
        }
    },
    plugins: [
        [
            "expo-build-properties",
            {
                "android": {
                    "compileSdkVersion": 34,
                    "targetSdkVersion": 34,
                    "buildToolsVersion": "34.0.0"
                },
                "ios": {
                    "deploymentTarget": "14.0",
                    "useFrameworks": "static"
                }
            }
        ],
        "expo-localization"
    ]
});
