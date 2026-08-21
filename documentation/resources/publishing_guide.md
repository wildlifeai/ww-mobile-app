# Publishing Guide — Android & iOS

> **Related**: [00-GETTING-STARTED.md](../onboarding/00-GETTING-STARTED.md) (project overview), [Maps.md](Maps.md) (Maps API keys).

## Overview

The app uses **EAS (Expo Application Services)** for building and submitting to both stores. Configuration lives in `eas.json`.

| EAS Profile | Purpose | `EXPO_PUBLIC_SUPABASE_ENV` | Trigger |
|-------------|---------|---------------------------|---------|
| `ci` | CI smoke builds | *(unset)* | CI workflows |
| `development` | Dev client builds | *(unset — local `.env`)* | Manual: `eas build` |
| `staging` | Pre-production validation | `cloud-staging` | Manual: `eas build` |
| `preview` | Internal testing | `cloud-dev` | Push to `main` (via GitHub Action) |
| `production` | Store submission | `cloud-staging` | Git tag `v*` (via GitHub Action) |

> Authoritative source: [`eas.json`](../../eas.json). See [Expo-EAS-Guide.md](Expo-EAS-Guide.md#eas-build-profiles) for how the env name resolves to a Supabase instance.

## Prerequisites

### One-Time Setup

1. **Expo account**: `eas login` (project owner: `wildlifeai`)
2. **Google Play service account** (Android):
   - Create in [Google Cloud Console](https://console.cloud.google.com/) → Service Accounts
   - Enable "Google Play Android Developer API"
   - Download JSON key → save as `wwmap-443023-3ed6207e2aa0.json` (gitignored)
   - Invite service account email in [Google Play Console](https://play.google.com/console/) → Users & Permissions
3. **Apple Developer account** (iOS):
   - Apple ID, ASC App ID, and Team ID are already in `eas.json`
   - EAS manages certificates and provisioning profiles automatically

### GitHub Secrets (for CI/CD)

| Secret | Where to get |
|--------|--------------|
| `EXPO_TOKEN` | [expo.dev](https://expo.dev) → Account Settings → Access Tokens |
| `SUPABASE_ACCESS_TOKEN` | Supabase dashboard → Account → Access Tokens |

Google Maps keys and Supabase publishable keys are in `eas.json` (safe to commit).

## Build & Submit

### Manual (Local)

```bash
# Development client (for local testing)
eas build --profile development --platform android

# Preview build (internal test distribution)
eas build --profile preview --platform all

# Production build
eas build --profile production --platform all

# Submit to stores
eas submit --profile production --platform all
```

### Automated (GitHub Actions)

The `eas-build.yml` workflow handles this:

- **Push to `main`** → builds `preview` profile (both platforms)
- **Git tag `v*`** → builds `production` profile → submits to stores
- **Manual dispatch** → choose profile + platform

### Release Process

1. **Merge `dev` → `main`** (via PR)
2. **Bump the application version.** Four files must agree, or EAS and OTA updates disagree about what is installed:

   | File | Field | Example (0.0.61 → 0.0.62) |
   |------|-------|---------------------------|
   | `package.json` | `version` | `"0.0.62"` |
   | `app.config.ts` | `android.versionCode` | `62` |
   | `app.config.ts` | `ios.buildNumber` | `"62"` |
   | `android/app/build.gradle` | `versionCode` / `versionName` | `62` / `"0.0.62"` |
   | `android/app/src/main/res/values/strings.xml` | `expo_runtime_version` | `0.0.62` |
   | `package-lock.json` | `version` (×2, top of file) | `"0.0.62"` — refreshed by `npm install` |

   `app.config.ts` derives `version` and `runtimeVersion` from `package.json`, so those two follow automatically. The Android native values do **not** — see step 3.

   Verify before committing:
   ```bash
   npm run version:check
   ```

3. **Synchronize Android Native Directory**:
   > [!IMPORTANT]
   > Since the `android/` native directory is tracked and committed in git, EAS Build acts as a bare React Native builder. It reads `versionCode` and `versionName` directly from native files (like `android/app/build.gradle`) and ignores `app.config.ts`.
   >
   > **You MUST run the Expo prebuild command to sync the version bumps to the native directory before committing**:
   > ```bash
   > npx expo prebuild --no-install --platform android
   > ```
   > This will update the version code and name in `android/app/build.gradle` and update `expo_runtime_version` in `android/app/src/main/res/values/strings.xml` to match `app.config.ts`.

4. **Commit the version bumps and native changes**:
   ```bash
   git add package.json app.config.ts android/
   git commit -m "chore: bump version to 0.0.54 (build 54)"
   ```

5. **Push and tag**:
   ```bash
   git push origin main
   git tag v0.0.54
   git push origin v0.0.54
   # → GitHub Action builds + submits automatically
   ```

## Store Tracks

### Android (Google Play)

Current config: `internal` track, `draft` release status.

Promotion path: **Internal testing** → **Closed testing** → **Open testing** → **Production**

Promote releases via Google Play Console (manual for now).

#### ⚠️ Store listing device checks (Play Integrity) — the invisible install filter

**Play Console → Protected with Play → Store listing device checks.** This setting decides which devices can *see and install* the app from Play at all. It is the first thing to check when users report "I can't install it" while the build is healthy.

| Level | Who can install |
|-------|-----------------|
| No integrity checks | Everyone |
| **Basic integrity checks** ← **current setting** | Blocks emulators and clearly tampered environments. Custom ROMs (GrapheneOS, CalyxOS, LineageOS) pass. |
| Device integrity checks ("recommended" by Google) | Blocks custom ROMs, rooted phones, unlocked bootloaders, uncertified devices, emulators |
| Strong integrity checks | Above, plus hardware-backed attestation requirements |

> [!CAUTION]
> **This filter is invisible in every other Console view.** Devices excluded by a Play Integrity verdict are explicitly **not** shown in Device catalog → *devices currently excluded* — the page says so in fine print. So a device can appear fully **Supported** in the Device catalog, have no exclusion rule against it, and still be unable to install the app. Do not conclude "the Console is clean" from those pages alone; open this screen.

**History — 6 Aug 2026:** changed from *Device integrity* to *Basic integrity*. Symptom was Pixel 10 users unable to install while others could; all five Pixel 10 models showed **Supported** in the Device catalog and no device exclusion rules existed. Cause was this setting silently filtering devices that fail `MEETS_DEVICE_INTEGRITY` — on Pixels that disproportionately means GrapheneOS/CalyxOS users, so only *some* owners of the same phone were affected. Basic was chosen because the app's real authorisation is enforced server-side by Supabase RLS at the sync boundary (see [03-DATA-AND-SYNC.md](../onboarding/03-DATA-AND-SYNC.md#security--data-integrity)) — the client is untrusted by design and the app makes no Play Integrity API calls of its own, so the stricter levels bought no security while excluding legitimate conservation users.

**Diagnosing a suspected integrity block:** ask the affected user for Play Store → Settings → About → **Play Protect certification**. "Device is not certified" confirms it.

### iOS (App Store Connect)

EAS submits to App Store Connect. Review takes 1-3 days.

> [!NOTE]
> First submission to each store requires manual setup of the store listing (title, description, screenshots, etc.) via their respective consoles.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| **Some users can't install from Play; device shows as Supported** | Check **Protected with Play → Store listing device checks** — integrity-filtered devices are invisible in the Device catalog tables. See [above](#️-store-listing-device-checks-play-integrity--the-invisible-install-filter). |
| "Google Play API not enabled" | Enable "Google Play Android Developer API" in Cloud Console |
| "Forbidden / Permission Denied" | Add service account to Play Console Users & Permissions |
| EAS build fails | Check `eas build:list` for logs; verify `EXPO_TOKEN` secret |
| iOS submission rejected | Check App Store Connect for specific rejection reasons |
| Keystore issues | Run `eas credentials` → Android → Keystore → manage |

---

**Last Updated**: 2026-02-19
