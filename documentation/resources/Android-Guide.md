# Android Development Guide

> **Related**: [Expo-EAS-Guide.md](Expo-EAS-Guide.md) (EAS builds), [publishing_guide.md](publishing_guide.md) (store submission), [WSL2-Setup-Guide.md](WSL2-Setup-Guide.md) (WSL2 networking), [Maps.md](Maps.md) (Maps API keys).

## Prerequisites

### Required Software

| Tool | Version | Verify |
|------|---------|--------|
| JDK | **17** (not 21+) | `java -version` |
| Android Studio | Latest | SDK Manager |
| Android SDK | API 35 (Android 15) | SDK Manager → SDK Platforms |
| Build Tools | 35 | SDK Manager → SDK Tools |

Set `ANDROID_HOME` to your SDK path (usually `C:\Users\<Name>\AppData\Local\Android\Sdk`).

> [!CAUTION]
> **Windows path length limit**: Clone the project to a short path like `C:\dev\ww`. Long paths like `C:\Users\Name\Documents\GitHub\wildlife-watcher-mobile-app` cause C++ compilation failures.

### Recommended JDK

[Azul Zulu JDK 17](https://www.azul.com/downloads/?version=java-17-lts) — if you see "Unsupported class file major version", you're on JDK 21+. Downgrade to 17 or set `JAVA_HOME` accordingly.

## Running Locally

```bash
# Start Metro + build + install on connected device/emulator
npx expo run:android

# Or start Metro separately
npx expo start --dev-client --clear
```

For EAS cloud builds, see [Expo-EAS-Guide.md](Expo-EAS-Guide.md).

## Local Build (via EAS)

```bash
# Local development build (APK, debug-enabled)
eas build --platform android --local --profile development

# Local preview build (APK, no debug, for testing)
eas build --platform android --local --profile preview

# Install via ADB
adb install ./path/to/app.apk
```

> [!NOTE]
> Environment variables must be in `eas.json` (not `.env.local`) for EAS builds. They're baked into the bundle at build time. See [.env.example](../../.env.example).

> [!CAUTION]
> **API Key Leaks via Expo Prebuild**: Because this is a Bare workflow project where the `android/` folder is tracked in Git, do NOT use `process.env` directly in `app.config.ts` for native config properties (like `android.config.googleMaps.apiKey`). If you do, running `npx expo prebuild` will bake the raw secret directly into `AndroidManifest.xml`, which will then be accidentally committed to Git. Instead, use a placeholder string in `app.config.ts` (e.g., `"${GOOGLE_MAPS_API_KEY_ANDROID}"`) and let Gradle resolve it from the environment dynamically.

## Device Setup (First Time)

1. **Developer Options**: Settings → About Phone → tap "Build Number" 7 times
2. **USB Debugging**: Settings → Developer Options → enable "USB Debugging"
3. **Unknown Sources**: Settings → Security → enable "Install unknown apps" for your file manager

## 16 KB Page Size Compliance

Google Play requires apps targeting Android 15+ to support 16 KB memory pages.

**Wildlife Watcher status**: ✅ Low risk — primarily JS/TS code. React Native core and Hermes engine already support 16 KB.

### Native Dependencies to Monitor

| Dependency | Risk | Status |
|-----------|------|--------|
| `react-native-ble-manager` | Medium | Popular, likely compatible |
| `react-native-nordic-dfu` | **High** | Custom fork with native C/C++ — test on 16 KB emulator |
| `react-native-maps` | Low | Google-maintained |
| Expo modules | Low | Expo team maintains |

### Testing on 16 KB Emulator

```bash
# Create 16 KB emulator in Android Studio AVD Manager
# Select "16 KB RAM" system image (Android 15+)

# Verify page size
adb shell getconf PAGE_SIZE
# Expected: 16384

# If native libs crash, add to android/app/build.gradle:
android {
    packagingOptions {
        jniLibs { useLegacyPackaging false }
    }
}
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "C++ Compilation Failed" / path errors | Move project to `C:\dev\ww` (path length limit) |
| "Unsupported class file major version" | Use JDK 17, not 21+ |
| "SDK location not found" | Create `android/local.properties`: `sdk.dir=C:\\Users\\YOU\\AppData\\Local\\Android\\Sdk` |
| "compileSdkVersion not specified" | Add `subprojects { afterEvaluate { ... compileSdkVersion } }` to `android/build.gradle` |
| Build exits non-zero | `cd android && ./gradlew clean && cd ..` then `npx expo prebuild --clean` |
| "Missing Supabase configuration" | Env vars must be in `eas.json`, not just `.env.local`. Rebuild after updating. |
| EAS build queued too long | Use `--local` flag |

### Clean Rebuild Sequence

```bash
cd android && ./gradlew clean && cd ..
rm -rf node_modules
npm install
npx expo prebuild --clean
eas build --platform android --local --profile preview
```

---

**Last Updated**: 2026-02-19
