# Future Improvements for Wildlife Watcher App

## Native Module Modernization (Deferred)

### Task 7: Replace Native Modules with Expo Equivalents - PARTIALLY COMPLETED

**Status**: Deferred due to Expo module build issues  
**Date**: August 1, 2025  
**Decision**: Keep working native modules, revisit later

### What We Tried

1. **expo-device@~5.9.0** - Build failed with Gradle configuration errors
2. **expo-document-picker@~11.10.0** - Build failed with Gradle configuration errors  
3. **expo-location@~16.5.0** - Build failed with Gradle configuration errors

### Build Errors Encountered

```
compileSdkVersion is not specified. Please add it to build.gradle
Could not get unknown property 'release' for SoftwareComponent
```

### Root Cause Analysis

- Expo SDK 51 modules have compatibility issues with our bare workflow setup
- Android SDK 34 + Gradle 8.8 configuration conflicts
- Modules don't inherit build configuration from expo-build-properties properly
- Mix of native modules (BLE, Maps, Nordic DFU) may cause conflicts

### Current Working Modules (Keep)

- ✅ **react-native-device-info@^10.13.1** - Device info, version display, location status
- ✅ **react-native-document-picker@^9.3.1** - DFU firmware file selection  
- ✅ **@react-native-community/geolocation@^3.4.0** - GPS location for maps

### Future Migration Plan

**When to Retry:**
- Next major Expo SDK release (SDK 52+)
- When we need to rebuild dev client for other reasons
- When Expo modules mature and fix build issues

**How to Retry:**
1. Start with one module at a time (expo-location first)
2. Test build after each addition
3. Update build configuration if needed
4. Consider pure managed workflow migration

**Estimated Effort:** 2-3 hours when ready

### Files That Would Need Updates (Future Reference)

- `src/navigation/screens/DfuScreen.tsx` - DocumentPicker.pick() → DocumentPicker.getDocumentAsync()
- `src/navigation/screens/Maps.tsx` - Geolocation.getCurrentPosition() → Location.getCurrentPositionAsync()
- `src/hooks/useLocationStatus.ts` - deviceInfoModule.isLocationEnabled() → Location permissions check
- Remove old packages after successful migration

### Benefits When Completed
- Better Expo integration
- More consistent API patterns
- Improved TypeScript support
- Better error handling
- Future-proof for Expo updates