# Expo Environment Variables Documentation

This document outlines the environment variables required for the Expo SDK 51 migration.

## Variable Types

### 1. Build-time Variables (Server-side only)
These variables are available during the build process but not in client-side code:
- `API_BASE` - Backend API base URL
- `GOOGLE_MAPS_API_KEY_ANDROID` - Android Maps API key
- `GOOGLE_MAPS_API_KEY_IOS` - iOS Maps API key

### 2. Client-side Variables (EXPO_PUBLIC_ prefix)
These variables are embedded in the client bundle and accessible in React Native code:
- `EXPO_PUBLIC_API_BASE` - Client-side API base URL
- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID` - Android Maps key for client
- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS` - iOS Maps key for client
- `EXPO_PUBLIC_SUPABASE_URL` - Supabase project API URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous/public API key

## Migration Changes

### From react-native-config to Expo Constants
**Before (react-native-config):**
```javascript
import Config from 'react-native-config';
const apiBase = Config.API_BASE;
```

**After (Expo Constants):**
```javascript
import Constants from 'expo-constants';
const apiBase = Constants.expoConfig?.extra?.apiBase || Constants.manifest?.extra?.apiBase;
```

### Environment Variable Access Patterns
**Client-side access (new pattern):**
```javascript
import { EXPO_PUBLIC_API_BASE } from '@env'; // or
const apiBase = process.env.EXPO_PUBLIC_API_BASE;
```

## Configuration Files

### app.json/expo.json Extra Configuration
```json
{
  "expo": {
    "extra": {
      "apiBase": process.env.API_BASE,
      "googleMapsApiKeyAndroid": process.env.GOOGLE_MAPS_API_KEY_ANDROID,
      "googleMapsApiKeyIos": process.env.GOOGLE_MAPS_API_KEY_IOS,
      "supabaseUrl": process.env.EXPO_PUBLIC_SUPABASE_URL,
      "supabaseAnonKey": process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    }
  }
}
```

## Bundle Identifiers (from migration-config-snapshot.json)
- **iOS**: `com.wildlife.wildlifewatcher`
- **Android**: `com.wildlife.wildlifewatcher`

## URL Schemes
- `com.wildlife.auth` - Authentication flow
- `com.wildlife.watcher` - Deep linking

## Security Notes
- Never commit actual API keys to version control
- Use `.env.local` for development (excluded by .gitignore)
- Production values should be set via EAS Build environment variables
- Client-side variables (EXPO_PUBLIC_) are visible in the bundle

## Required for Migration
Based on migration-config-snapshot.json and Supabase backend integration, these runtime environment variables are critical:
1. `API_BASE` / `EXPO_PUBLIC_API_BASE`
2. `GOOGLE_MAPS_API_KEY_ANDROID` / `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID`
3. `GOOGLE_MAPS_API_KEY_IOS` / `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS`
4. `EXPO_PUBLIC_SUPABASE_URL` - From existing Dev_Wildlife_Watcher instance
5. `EXPO_PUBLIC_SUPABASE_ANON_KEY` - From Supabase project API settings