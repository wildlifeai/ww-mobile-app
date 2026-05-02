import { ExpoConfig, ConfigContext } from 'expo/config';
import pkg from './package.json';

const IS_DEV = process.env.APP_VARIANT === 'development';
const BUNDLE_ID = IS_DEV ? 'com.wildlife.wildlifewatcher.expo' : 'com.wildlife.wildlifewatcher';

export default ({ config }: ConfigContext): ExpoConfig => ({
    ...config,
    name: IS_DEV ? 'Wildlife Watcher (Dev)' : 'Wildlife Watcher',
    slug: 'ww-expo-poc',
    owner: 'wildlifeai',
    version: pkg.version,
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
        buildNumber: "45",
        config: {
            googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY_IOS,
        },
        infoPlist: {
            NSLocationWhenInUseUsageDescription: "We need your location to set GPS coordinates on camera devices for accurate wildlife tracking and habitat mapping.",
            NSBluetoothAlwaysUsageDescription: "This app uses Bluetooth to connect to wildlife camera devices.",
            NSBluetoothPeripheralUsageDescription: "This app uses Bluetooth to connect to wildlife camera devices.",
            NSCameraUsageDescription: "We need access to your camera to take photos of the deployment site.",
            NSPhotoLibraryUsageDescription: "We need access to your photo library to select deployment photos.",
            NSPhotoLibraryAddUsageDescription: "We need access to save deployment photos to your library.",
            ITSAppUsesNonExemptEncryption: false
        },
        associatedDomains: IS_DEV ? [] : [
            'applinks:wildlifewatcher.ai'
        ]
    },
    android: {
        package: BUNDLE_ID,
        versionCode: 51,
        adaptiveIcon: {
            foregroundImage: "./assets/adaptive-icon.png",
            backgroundColor: "#ffffff"
        },
        config: {
            googleMaps: {
                apiKey: "${GOOGLE_MAPS_API_KEY_ANDROID}",
            },
        },
        permissions: [
            "ACCESS_FINE_LOCATION",
            "ACCESS_COARSE_LOCATION",
            "BLUETOOTH",
            "BLUETOOTH_ADMIN",
            "BLUETOOTH_CONNECT",
            "BLUETOOTH_SCAN"
        ],
        softwareKeyboardLayoutMode: "pan",
        intentFilters: [
            {
                action: "VIEW",
                autoVerify: true,
                data: [
                    {
                        scheme: IS_DEV ? "http" : "https",
                        host: IS_DEV ? "localhost" : "wildlifewatcher.ai",
                        ...(IS_DEV && { port: "5173" }),
                        pathPrefix: "/reset-password"
                    }
                ],
                category: ["BROWSABLE", "DEFAULT"]
            }
        ],
    },
    web: {
        favicon: "./assets/favicon.png"
    },
    updates: {
        url: "https://u.expo.dev/eb6d9e5f-0daa-4451-8e6d-813330e0c557"
    },
    runtimeVersion: pkg.version,
    extra: {
        eas: {
            projectId: "eb6d9e5f-0daa-4451-8e6d-813330e0c557"
        },
        // Expose env vars to Expo Constants
        supabaseEnv: process.env.EXPO_PUBLIC_SUPABASE_ENV,
        supabaseUrl: process.env.SUPABASE_URL,
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
        isDevelopment: IS_DEV,
    },
    plugins: [
        [
            "expo-build-properties",
            {
                "android": {
                    "compileSdkVersion": 35,
                    "targetSdkVersion": 35,
                    "newArchEnabled": true,
                    "enableProguardInReleaseBuilds": true,
                    "enableShrinkResourcesInReleaseBuilds": true
                },
                "ios": {
                    "deploymentTarget": "17.0",
                    "useFrameworks": "static",
                    "newArchEnabled": true,
                    "bridgeless": false
                }
            }
        ],
        "expo-localization",
        [
            "expo-location",
            {
                "isAndroidBackgroundLocationEnabled": false,
                "isAndroidMockLocationEnabled": false
            }
        ],
        "./plugins/withOptionalHardwareFeatures.js",
        "./plugins/withReactNativeMapsModularHeaders.js",
        [
            "./plugins/withGoogleMapsKey.js",
            {
                "iosApiKey": process.env.GOOGLE_MAPS_API_KEY_IOS
            }
        ]
    ]
});
