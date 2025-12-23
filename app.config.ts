import { ExpoConfig, ConfigContext } from 'expo/config';

const IS_DEV = process.env.APP_VARIANT === 'development';
const BUNDLE_ID = IS_DEV ? 'com.wildlife.wildlifewatcher.expo' : 'com.wildlife.wildlifewatcher';

export default ({ config }: ConfigContext): ExpoConfig => ({
    ...config,
    name: IS_DEV ? 'Wildlife Watcher (Dev)' : 'Wildlife Watcher',
    slug: 'ww-expo-poc',
    owner: 'wildlifeai',
    version: '1.0.0',
    newArchEnabled: true,
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
        bundleIdentifier: BUNDLE_ID,
        config: {
            googleMapsApiKey: process.env['GOOGLE_MAPS_API_KEY_IOS'],
        },
        infoPlist: {
            NSLocationWhenInUseUsageDescription: "We need your location to set GPS coordinates on camera devices for accurate wildlife tracking and habitat mapping.",
            NSBluetoothAlwaysUsageDescription: "This app uses Bluetooth to connect to wildlife camera devices.",
            NSBluetoothPeripheralUsageDescription: "This app uses Bluetooth to connect to wildlife camera devices.",
            NSCameraUsageDescription: "We need access to your camera to take photos of the deployment site.",
            NSPhotoLibraryUsageDescription: "We need access to your photo library to select deployment photos.",
            NSPhotoLibraryAddUsageDescription: "We need access to save deployment photos to your library.",
            ITSAppUsesNonExemptEncryption: false
        }
    },
    android: {
        package: BUNDLE_ID,
        adaptiveIcon: {
            foregroundImage: "./assets/adaptive-icon.png",
            backgroundColor: "#ffffff"
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
    updates: {
        url: "https://u.expo.dev/eb6d9e5f-0daa-4451-8e6d-813330e0c557"
    },
    runtimeVersion: "1.0.0",
    extra: {
        eas: {
            projectId: "eb6d9e5f-0daa-4451-8e6d-813330e0c557"
        }
    },
    plugins: [
        [
            "expo-build-properties",
            {
                "android": {
                    "compileSdkVersion": 35,
                    "targetSdkVersion": 35,
                    "newArchEnabled": true
                },
                "ios": {
                    "deploymentTarget": "17.0",
                    "useFrameworks": "static",
                    "newArchEnabled": true,
                    "bridgeless": false
                }
            }
        ],
        "expo-localization"
    ]
});
