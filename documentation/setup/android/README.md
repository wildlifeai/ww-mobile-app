# Android Development Setup on Windows

## ⚠️ Critical: Path Length Limitation
**You MUST clone this project into a short path to avoid build failures.**
Windows has a 260-character path limit that causes C++ compilation errors in the new architecture.

**✅ Recommended Path:** `C:\dev\ww`
**❌ Avoid:** `C:\Users\YourName\Documents\GitHub\wildlife-watcher-mobile-app`

If you are already in a long path:
1. Move the folder to `C:\dev\ww`
2. Delete `node_modules` and `android/.gradle`
3. Re-run `npm install`

## Prerequisites

### 1. Java Development Kit (JDK)
*   **Version:** JDK 17 (Required)
*   **Recommendation:** [Azul Zulu JDK 17](https://www.azul.com/downloads/?version=java-17-lts&package=jdk)
*   **Verify:** `java -version` should output "17.x.x".

### 2. Android Studio & SDK
*   **Install:** Android Studio (latest)
*   **SDK Manager (Tools > SDK Manager):**
    *   **SDK Platforms:** Check **Android 15 (VanillaIceCream) / API Level 35**.
    *   **SDK Tools:** Check **Android SDK Build-Tools 35**.
*   **Environment Variable:**
    *   Set `ANDROID_HOME` to your SDK location (usually `C:\Users\YourName\AppData\Local\Android\Sdk`).

## Running the App

1. **Start Metro Bundler:**
   ```bash
   # Always use --clear to ensure latest patches are loaded
   npx expo start --clear
   ```

2. **Launch Android Build:**
   ```bash
   npx expo run:android
   ```

## Troubleshooting Build Errors

### "C++ Compilation Failed" / "Project not found"
*   **Cause:** Almost always due to long file paths.
*   **Fix:** Move project to `C:\dev\ww`.

### "Unsupported class file major version"
*   **Cause:** You are using Java 21 or newer.
*   **Fix:** Downgrade to Java 17 or set `JAVA_HOME` to point to JDK 17.

### "SDK location not found"
*   **Cause:** `local.properties` file is missing or `ANDROID_HOME` is unset.
*   **Fix:** Create `android/local.properties` with:
    ```properties
    sdk.dir=C:\\Users\\YOUR_USERNAME\\AppData\\Local\\Android\\Sdk
    ```

### "Runtime version policy" Error
*   **Cause:** Expo "bare workflow" mismatch.
*   **Fix:** Ensure `app.config.ts` has `runtimeVersion: "1.0.0"` (string), NOT a policy object.