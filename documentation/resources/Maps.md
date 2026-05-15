# Maps Feature

## Overview

The app uses `react-native-maps` with `PROVIDER_GOOGLE` on both platforms for deployment location display and map interactions. The maps feature lives in `src/features/maps/` as a self-contained module.

---

## Architecture

```
src/features/maps/
├── components/
│   ├── BasicMapView.tsx             # Core map with Google provider, gesture handling
│   ├── DeploymentMarker.tsx         # Deployment location pins
│   ├── DeploymentCard.tsx           # Deployment info card overlay
│   ├── MapControls.tsx              # Zoom, center-on-user, map type controls
│   └── LocationPermissionPrompt.tsx # Permission request UI
├── hooks/
│   ├── useLocation.ts               # Location permission & tracking (expo-location)
│   └── useMapRegion.ts              # Map viewport/region management
├── screens/
│   └── MapScreen.tsx                # Main map screen (used in tab navigation)
├── types/
│   └── index.ts                     # MapRegion, MapType, MapViewConfig types
└── index.ts                         # Public exports
```

### Key Design Decisions

- **`PROVIDER_GOOGLE`** on both platforms for visual consistency
- **`expo-location`** over `@react-native-community/geolocation` (better Expo integration)
- **Gesture-only region updates** — `handleRegionChangeComplete` ignores programmatic changes to prevent infinite loops
- **5-second location interval** with `balanced` priority for battery efficiency
- **Custom controls** — built-in Android toolbar disabled, custom `MapControls` used instead

---

## Google Maps API Setup

### Environment Variables

Create `.env.local` in the project root (gitignored):

```bash
GOOGLE_MAPS_API_KEY_ANDROID=your_android_key_here
GOOGLE_MAPS_API_KEY_IOS=your_ios_key_here
```

For EAS cloud builds:

```bash
eas secret:create --scope project --name GOOGLE_MAPS_API_KEY_ANDROID --value "your_key"
eas secret:create --scope project --name GOOGLE_MAPS_API_KEY_IOS --value "your_key"
```

### Expo Config

`app.config.ts` reads the environment variables and passes them to native SDKs. A custom Expo config plugin (`plugins/withGoogleMapsKey.js`) handles iOS `Info.plist` injection.

```javascript
// Plugins configured in app.config.ts
plugins: [
  'react-native-maps',
  [
    'expo-location',
    {
      locationAlwaysAndWhenInUsePermission: 'Wildlife Watcher needs access to your location...',
      locationWhenInUsePermission: 'Wildlife Watcher needs access to your location...',
      isAndroidBackgroundLocationEnabled: false
    }
  ]
]
```

### Google Cloud Console

1. **Enable APIs** at https://console.cloud.google.com/apis/library:
   - ✅ Maps SDK for Android (required)
   - ✅ Maps SDK for iOS (required)
   - ✅ Geolocation API (optional, improves accuracy)

2. **Configure key restrictions** at https://console.cloud.google.com/google/maps-apis/credentials:

   | Build | Package Name | SHA-1 |
   |-------|-------------|-------|
   | Development | `com.wildlife.wildlifewatcher.expo` | `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` |
   | Production | `com.wildlife.wildlifewatcher` | Get from release keystore |

   > [!NOTE]
   > Package name switches based on `APP_VARIANT` in `app.config.ts`: development builds use `.expo` suffix, production builds don't.

3. **Restrict API access** to Maps SDK for Android, Maps SDK for iOS, and Geolocation API only.

---

## Usage

### Screen Integration

```typescript
// Already wired in tab navigation
import { MapScreen } from "../../features/maps"
export const Maps = MapScreen
```

### Using Components Directly

```typescript
import {
  BasicMapView,
  MapControls,
  useLocation,
  useMapRegion,
} from '../features/maps';

const MyMapScreen = () => {
  const { location, permissions, requestPermissions } = useLocation();
  const { region, zoomIn, zoomOut, resetToUserLocation, mapRef } = useMapRegion();

  return (
    <BasicMapView
      region={region}
      onRegionChangeComplete={setRegion}
      mapRef={mapRef}
    >
      <MapControls
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onCenterUser={() => resetToUserLocation(location)}
        onMapTypeChange={setMapType}
        currentMapType={mapType}
      />
    </BasicMapView>
  );
};
```

---

## Troubleshooting

| Symptom | Check |
|---------|-------|
| Transparent map / spinner | Maps SDK for Android not enabled in Cloud Console |
| Key not working after setup | Wait 5 min; verify package name + SHA-1 match exactly |
| Tiles load in dev but not prod | Different package name — add production entry to key restrictions |
| Still broken | Temporarily remove all key restrictions to isolate the issue |

---

## References

- [Google Maps Android SDK setup](https://developers.google.com/maps/documentation/android-sdk/get-api-key)
- [react-native-maps](https://github.com/react-native-maps/react-native-maps)
- [expo-location](https://docs.expo.dev/versions/latest/sdk/location/)

*Last Updated: May 16, 2026*
