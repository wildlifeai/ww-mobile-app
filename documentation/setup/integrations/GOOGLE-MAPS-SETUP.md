# Google Maps API Configuration for Wildlife Watcher

**Issue**: Map tiles not loading (transparent background with spinner)
**Root Cause**: Google Maps API key not properly configured in Google Cloud Console

## Quick Fix Steps

### 0. Set up Project Environment

**Security Note:** We do not hardcode API keys in the app.

#### For Local Development (`npx expo run:android`)
1.  Create a `.env` file in the project root (`wildlife-watcher-mobile-app/.env`).
2.  Add your API key:
    ```bash
    GOOGLE_MAPS_API_KEY_ANDROID=your_api_key_here
    ```
    *Note: The native Android build has been modified to automatically read this file.*

#### For Cloud Builds (EAS)
1.  Add the secret to EAS:
    ```bash
    eas secret:create --scope project --name GOOGLE_MAPS_API_KEY_ANDROID --value "your_api_key_here"
    ```

### 1. Enable Required APIs

Go to: https://console.cloud.google.com/apis/library

Enable these APIs:
- ✅ **Maps SDK for Android** (CRITICAL - without this, tiles won't load)
- ✅ **Maps SDK for iOS** (for future iOS builds)
- ✅ Geolocation API (optional, improves location accuracy)

### 2. Configure API Key Restrictions

Go to: https://console.cloud.google.com/google/maps-apis/credentials

**Your API Key**: `<YOUR_API_KEY>`

Click on the API key, then:

#### Application Restrictions:
- Select: **Android apps**
- Click: **Add an app**

**Development Build (Debug):**
- Package name: `com.wildlife.wildlifewatcher.expo`
- SHA-1: `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`

**Production Build (Release):**
- Package name: `com.wildlife.wildlifewatcher` (when you switch from .expo suffix)
- SHA-1: Get from your release keystore when ready

#### API Restrictions:
- Select: **Restrict key**
- Enable only:
  - Maps SDK for Android
  - Maps SDK for iOS
  - Geolocation API (optional)

### 3. Test After Configuration

After saving changes in Google Cloud Console:

1. **Wait 2-5 minutes** for changes to propagate
2. **Reload the app** (press R R in Metro bundler)
3. **Check**: Map tiles should now load showing your location in New Zealand

## Current Configuration

**Package Name (Development)**: `com.wildlife.wildlifewatcher.expo`
**Debug SHA-1**: `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`
**Location**: AndroidManifest.xml line 22
**Environment Variables**: .env.local

## Alternative: No Restrictions (Testing Only)

For quick testing, you can temporarily set:
- Application restrictions: **None**
- API restrictions: **Don't restrict key**

⚠️ **Warning**: This is less secure. Add restrictions before production!

## Verification

After configuration, you should see in Metro logs:
```
[MapScreen] Centering on user location: {"latitude": -39.0814439, "longitude": 174.0851391}
```

And the map should display tiles showing New Zealand geography.

## Troubleshooting

**Still not working after 5 minutes?**
1. Check API key is correct in AndroidManifest.xml
2. Verify Maps SDK for Android is enabled
3. Check package name matches exactly: `com.wildlife.wildlifewatcher.expo`
4. Try removing all restrictions temporarily
5. Check Google Cloud Console quota/billing

**Reference Documentation:**
- https://developers.google.com/maps/documentation/android-sdk/get-api-key
- https://github.com/react-native-maps/react-native-maps/blob/master/docs/installation.md

---

**Last Updated**: 2025-10-09
**Status**: Maps feature functional, waiting for Google Cloud configuration
