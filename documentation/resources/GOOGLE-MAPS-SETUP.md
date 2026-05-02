# Google Maps API Setup

> **Related**: See the [maps feature README](../../src/features/maps/README.md) for component architecture and usage patterns.

## Overview

The app uses `react-native-maps` (v1.20.1) with Google Maps provider for deployment location display and map interactions. API keys are configured via environment variables — never hardcoded.

**Key config**: `app.config.ts` reads `GOOGLE_MAPS_API_KEY_ANDROID` and `GOOGLE_MAPS_API_KEY_IOS` from the environment and passes them to the native SDKs. A custom Expo config plugin (`plugins/withGoogleMapsKey.js`) handles iOS integration.

## Environment Setup

### Local Development (`npx expo run:android`)

Create `.env.local` in the project root (gitignored):

```bash
GOOGLE_MAPS_API_KEY_ANDROID=your_android_key_here
GOOGLE_MAPS_API_KEY_IOS=your_ios_key_here
```

### Cloud Builds (EAS)

```bash
eas secret:create --scope project --name GOOGLE_MAPS_API_KEY_ANDROID --value "your_key"
eas secret:create --scope project --name GOOGLE_MAPS_API_KEY_IOS --value "your_key"
```

## Google Cloud Console Setup

### 1. Enable Required APIs

Go to: https://console.cloud.google.com/apis/library

- ✅ **Maps SDK for Android** (required — without this, tiles won't load)
- ✅ **Maps SDK for iOS** (required for iOS builds)
- ✅ Geolocation API (optional, improves location accuracy)

### 2. Configure API Key Restrictions

Go to: https://console.cloud.google.com/google/maps-apis/credentials

#### Android Key Restrictions

| Build | Package Name | SHA-1 |
|-------|-------------|-------|
| Development | `com.wildlife.wildlifewatcher.expo` | `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` |
| Production | `com.wildlife.wildlifewatcher` | Get from release keystore |

> [!NOTE]
> The package name switches based on `APP_VARIANT` in `app.config.ts`: development builds use `.expo` suffix, production builds don't.

#### API Restrictions

Restrict the key to only:
- Maps SDK for Android
- Maps SDK for iOS
- Geolocation API (if enabled)

### 3. Test

1. Wait 2–5 minutes for changes to propagate
2. Rebuild the app (`npx expo run:android`)
3. Map tiles should load on the Maps tab and deployment detail screens

## Troubleshooting

| Symptom | Check |
|---------|-------|
| Transparent map / spinner | Maps SDK for Android not enabled in Cloud Console |
| Key not working after setup | Wait 5 min; verify package name + SHA-1 match exactly |
| Tiles load in dev but not prod | Different package name — add production entry to key restrictions |
| Still broken | Temporarily remove all key restrictions to isolate the issue |

**Reference**:
- [Google Maps Android SDK setup](https://developers.google.com/maps/documentation/android-sdk/get-api-key)
- [react-native-maps installation](https://github.com/react-native-maps/react-native-maps/blob/master/docs/installation.md)

---

**Last Updated**: 2026-02-19
