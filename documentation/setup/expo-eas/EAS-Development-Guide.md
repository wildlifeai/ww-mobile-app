# EAS Development Guide

## Quick Start

### Prerequisites
- Node.js 18+
- EAS CLI: `npm install -g @expo/cli`
- Expo account (sign up at expo.dev)

### Initial Setup
```bash
# Login to Expo
npx expo login

# Check project status
eas project:info
```

### Switching Accounts & Relinking Projects
If you need to change the EAS account (e.g., Personal -> Organization) or fix authorization errors:
1. **Logout & Login:**
    ```bash
    npx eas logout
    npx eas login
    ```
2. **Clear Configuration:**
    *   Open `app.config.ts`.
    *   Comment out or remove `owner`, `updates.url` and `extra.eas.projectId`.
3. **Relink Project:**
    ```bash
    npx eas init
    ```
    *   Select the correct account when prompted.
    *   This generates a new Project ID and updates your config.

## Development Workflow

### 1. Development Client
```bash
# Build development client (one-time setup)
eas build --profile development --platform android

# Start development server
npx expo start --dev-client
```

### 2. Environment Variables
```bash
# View current environment variables
eas env:list --environment development

# Add new environment variable
eas env:create --name VAR_NAME --value "value" --environment development --visibility plaintext

# Update existing variable
eas env:update --name VAR_NAME --value "new_value" --environment development
```

#### Handling Sensitive Credentials (EAS Secrets)
For sensitive values (like API Keys, Apple IDs), **never** commit them to `eas.json` or git.

1.  **Create EAS Secret** (Cloud):
    ```bash
    eas secret:create --scope project --name APPLE_ID --value "your@email.com"
    ```
2.  **Reference in `eas.json`**:
    Use `${VAR_NAME}` syntax in `eas.json`.
3.  **Local Validation Requirement**:
    Even though the build happens in the cloud, the **local EAS CLI** needs to see these variables to validate the `eas.json` structure before upload.
    *   **Option A (Temporary)**: Export in shell before running build:
        ```powershell
        $env:APPLE_ID="value"; eas build ...
        ```
    *   **Option B (Local .env)**: Maintain a local `.env` file (gitignored) and ensure your shell sources it. Note that `eas build` does *not* automatically load `.env` files for CLI validation; you must load them into your shell environment first.

### 3. Building

#### Development Builds
```bash
# Android development build
eas build --profile development --platform android

# iOS development build (requires Apple Developer account)
eas build --profile development --platform ios

# Both platforms
eas build --profile development --platform all
```

#### Production Builds
```bash
# Android production build (Auto Submit)
eas build --platform android --profile production --auto-submit

# Android production build (Manual Submit)
eas build --profile production --platform android

# iOS production build
eas build --profile production --platform ios
```

### 4. Common Commands

#### Build Management
```bash
# List recent builds
eas build:list

# View specific build details
eas build:view [BUILD_ID]

# Cancel running build
eas build:cancel [BUILD_ID]
```

#### Project Management
```bash
# View project information
eas project:info

# Check build configuration
eas build:configure
```

## Build Profiles

### Development Profile
- **Purpose**: Testing on physical devices
- **Output**: APK (Android), IPA (iOS)
- **Features**: Hot reload, debugging enabled
- **Distribution**: Internal testing only

### Production Profile
- **Purpose**: App store releases
- **Output**: AAB (Android), IPA (iOS)
- **Features**: Optimized, minified
- **Distribution**: Public app stores

## Troubleshooting

### Common Issues

#### Build Fails
```bash
# Clear cache and retry
eas build --profile development --platform android --clear-cache
```

#### Environment Variables Not Loading
```bash
# Verify environment configuration
eas env:list --environment development

# Check app.config.js extra field configuration
```

#### Android Device Connection
```bash
# For WSL2 users - forward ADB ports
adb reverse tcp:8081 tcp:8081

# Use tunnel mode if network issues
npx expo start --dev-client --tunnel
```

### Build Time Optimization
- Use `--local` flag for local builds (requires Android Studio/Xcode)
- Cache node_modules with custom Docker images
- Parallelize iOS/Android builds

## Migration Notes

### From Traditional React Native
- Remove react-native CLI usage (`npx react-native run-android`)
- Use `npx expo start --dev-client` instead
- Environment variables now in EAS, not local .env files
- Build process moved to cloud (EAS) from local machines

### Key Differences
- **Old**: Local builds with Android Studio/Xcode
- **New**: Cloud builds with EAS
- **Old**: Manual keystore management
- **New**: EAS manages certificates automatically
- **Old**: Complex CI/CD with Fastlane
- **New**: Simple EAS build commands

## Best Practices

### Development
1. **Use development builds** for daily development
2. **Set up environment variables** in EAS, not local files
3. **Test on physical devices** regularly
4. **Monitor build times** and optimize as needed

### Production
1. **Test production builds** before store submission
2. **Use semantic versioning** for releases
3. **Configure auto-increment** for build numbers

4. **Set up proper app signing** for distribution

### Android Versioning & Submission
*   **Version Name**: We modified `android/app/build.gradle` to read the version directly from `package.json`. Always update `package.json` version before a release.
*   **Version Code**: Handled automatically by EAS (`autoIncrement: true` in `eas.json`).
*   **New App Submission**: If the app is still in "Draft" state on Google Play (incomplete store listing), you must set `"releaseStatus": "draft"` in `eas.json`.

## Quick Reference

```bash
# Essential commands for daily development
npx expo start --dev-client          # Start development server
eas build:list                       # Check recent builds
eas env:list --environment development # View environment variables
eas build --profile development --platform android # New development build
```

## Resources

### Official Documentation
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [Environment Variables Guide](https://docs.expo.dev/build-reference/variables/)
- [Build Configuration Reference](https://docs.expo.dev/build-reference/eas-json/)
- [Troubleshooting Guide](https://docs.expo.dev/build-reference/troubleshooting/)

### Wildlife Watcher Specific
- **[Expo Fundamentals Guide](./Expo-Fundamentals-Guide.md)** - Essential concepts to understand before using EAS
- **[EAS Concepts and Keystores](./EAS-Concepts-and-Keystores.md)** - Deep dive into EAS architecture and Android keystores

---

*Last updated: Post-Expo migration*