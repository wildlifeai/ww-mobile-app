# Expo & EAS Guide

> **Related**: [publishing_guide.md](publishing_guide.md) (store submission), [.env.example](../../.env.example) (environment variables), [GOOGLE-MAPS-SETUP.md](GOOGLE-MAPS-SETUP.md) (Maps API keys).

## Overview

Wildlife Watcher uses **Expo SDK 54** with a hybrid approach: Expo tooling for builds and configuration, plus native modules (BLE, Maps, DFU) that require a development client.

**Key files**: `app.config.ts` (app configuration), `eas.json` (build profiles), `metro.config.js` (bundler)

## Development Workflow

### Expo Go vs Development Client

| Feature | Expo Go | Development Client |
|---------|---------|-------------------|
| Setup | Install from store | Build once with EAS |
| Native modules (BLE, Maps) | ❌ | ✅ |
| Hot reload | ✅ | ✅ |
| Use for | UI/layout work | Full feature testing |

```bash
# Quick UI testing (no native modules)
npx expo start

# Full functionality (requires dev client build)
npx expo start --dev-client
```

### Daily Development

```bash
# Start dev server (after dev client is installed on device)
npx expo start --dev-client

# If network issues (WSL2, firewall)
npx expo start --dev-client --tunnel

# Clear bundler cache
npx expo start --clear
```

**Keyboard shortcuts in Metro terminal**: `r` = reload, `d` = debug menu

### When You Need a New Build

You only need to rebuild the dev client when:
- Adding/removing native modules
- Changing permissions in `app.config.ts`
- Updating `eas.json` build config

JS/TS changes, UI updates, Redux, and navigation changes work with hot reload — no rebuild needed.

## EAS Build Profiles

Configured in `eas.json`:

| Profile | Output | Supabase | Purpose |
|---------|--------|----------|---------|
| `development` | APK/IPA (internal) | Dev (`qegeovogqxiouqbrxmnh`) | Dev client for testing |
| `preview` | APK/IPA (internal) | Stag (`nuhwmubvygxyddkycmpa`) | Internal team testing |
| `production` | AAB/IPA (stores) | Stag (`nuhwmubvygxyddkycmpa`) | Store submission |

### Build Commands

```bash
# Development client (one-time, then use hot reload)
eas build --profile development --platform android

# Preview (staging)
eas build --profile preview --platform all

# Production (for store submission)
eas build --profile production --platform all

# Check build status
eas build:list

# Clear cache if build fails
eas build --profile development --platform android --clear-cache
```

## Environment Variables

### How It Works

1. **Build-time Configuration (`eas.json`)**: Environment variables are defined in the `env` blocks.
2. **Dynamic Injection (EAS Dashboard)**: Sensitive variables (URLs, Keys) are stored in the Expo Dashboard (Project Settings → Environment variables) and automatically injected by EAS at build-time.
3. **App Configuration (`app.config.ts`)**: Reads variables via `process.env` and exposes them to the app bundle via the `extra` object.
4. **Runtime Access**: The app reads `Constants.expoConfig?.extra` through the `EnvironmentManager`.

### EAS Secrets and Visibility (CRITICAL)

EAS has strict rules about environment variable visibility and interpolation:

| Visibility | Hidden in UI/Logs? | Works with `${...}` in `eas.json`? | Allows `EXPO_PUBLIC_` prefix? |
|------------|--------------------|------------------------------------|-------------------------------|
| **Plain text** | No | ✅ Yes | ✅ Yes (but discouraged for keys) |
| **Sensitive** | Yes (Logs `*****`) | ✅ Yes | ❌ No (Will cause warnings) |
| **Secret** | Yes (Completely) | ❌ **No** (Resolves to literal string) | ❌ No |

**The Golden Rule for Secrets (e.g., Supabase Keys):**
Do NOT use `${...}` interpolation in `eas.json` for secrets stored on the Expo dashboard.
Instead, create the variables on the dashboard natively without suffixed environment names (e.g., strictly `SUPABASE_URL` and `SUPABASE_ANON_KEY` mapped directly to the active `preview` or `production` EAS Environment tabs with **Sensitive** visibility). Then read them directly in `app.config.ts`:

```typescript
// app.config.ts
extra: {
  supabaseUrl: process.env.SUPABASE_URL, // Injected directly by EAS based on the active profile environment
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
}
```

### Accessing Config in Code

```typescript
// ✅ Correct — via expo-constants (after being mapped in app.config.ts)
import Constants from 'expo-constants'
const url = Constants.expoConfig?.extra?.supabaseUrl

// ✅ Correct — via EnvironmentManager (supports runtime switching)
import { getEnvironmentConfig } from "../config/EnvironmentManager"
const config = await getEnvironmentConfig()

// ❌ Wrong — Bypasses the EnvironmentManager, which is the single source of truth for runtime config.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL
```

### Local Development

Copy `.env.example` → `.env.local` and fill in your keys. Local builds will load these from the `.env` file via Expo's dot-env support.

> [!NOTE]
> `EXPO_PUBLIC_` prefixed vars are automatically embedded into the client bundle at build time. Non-prefixed vars are strictly build-time only, and must be explicitly mapped in `app.config.ts` `extra` to be available at runtime.

## Android Keystores

### EAS-Managed (Current Approach)

EAS creates and stores release keystores in the cloud. No local files to manage.

```bash
# View/manage credentials
eas credentials

# First production build: EAS prompts to generate keystore
eas build --profile production --platform android
```

### Debug Keystore (Local Development)

Local builds use the debug keystore at `~/.android/debug.keystore` (auto-generated by Android SDK). The `build.gradle` conditionally loads release keystores only when present — this allows dev builds without release keystore files.

> [!CAUTION]
> If you lose your release keystore, you **cannot update your app** on Google Play. EAS manages this for you — don't manually delete EAS credentials.

### SHA-1 Fingerprint Issues

If Google Play rejects builds due to SHA-1 mismatch:
1. Check EAS key: `eas credentials` → look for SHA-1
2. Check Play Console: Release → Setup → App Integrity
3. Fix: upload your keystore to EAS via `eas credentials`, or request "Reset Upload Key" in Google Play

## Account & Project Setup

```bash
# Login
npx expo login

# Check project info
eas project:info

# Switch account (if authorization errors)
npx eas logout
npx eas login
# Then clear owner/projectId from app.config.ts and run:
npx eas init
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Build fails | `eas build --clear-cache`; check `eas build:list` for logs |
| Env vars not loading | Check `eas.json` env block; verify `app.config.ts` reads them |
| Device can't connect to Metro | Try `--tunnel` mode; check firewall; `adb reverse tcp:8081 tcp:8081` |
| `maestro: command not found` on EAS | Maestro is local-only, not for cloud builds |
| `releaseStatus` error on Play | Set `"releaseStatus": "draft"` in `eas.json` if store listing incomplete |

## Official Resources

- [EAS Build docs](https://docs.expo.dev/build/introduction/)
- [EAS credentials](https://docs.expo.dev/app-signing/app-credentials/)
- [Environment variables](https://docs.expo.dev/build-reference/variables/)
- [eas.json reference](https://docs.expo.dev/build-reference/eas-json/)

---

**Last Updated**: 2026-03-22
