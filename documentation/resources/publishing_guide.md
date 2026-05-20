# Publishing Guide — Android & iOS

> **Related**: [00-GETTING-STARTED.md](../onboarding/00-GETTING-STARTED.md) (project overview), [Maps.md](Maps.md) (Maps API keys).

## Overview

The app uses **EAS (Expo Application Services)** for building and submitting to both stores. Configuration lives in `eas.json`.

| EAS Profile | Purpose | Supabase | Trigger |
|-------------|---------|----------|---------|
| `development` | Dev client builds | Dev (`qegeovogqxiouqbrxmnh`) | Manual: `eas build` |
| `preview` | Internal testing / staging | Stag (`nuhwmubvygxyddkycmpa`) | Push to `main` (via GitHub Action) |
| `production` | Store submission | Stag (`nuhwmubvygxyddkycmpa`) | Git tag `v*` (via GitHub Action) |

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
2. **Bump the application version** in the following three files/locations:
   - **`package.json`**: Update the `"version"` field (e.g. `"0.0.53"` -> `"0.0.54"`).
   - **`app.config.ts`**:
     - Increment the Android `versionCode` integer (e.g. `53` -> `54`).
     - Increment the iOS `buildNumber` string value (e.g. `"53"` -> `"54"`).
   
   *Tip: You can use `npm version patch` to update `package.json`, but remember to also manually increment the `versionCode` and `buildNumber` in `app.config.ts`.*

3. **Commit the version bumps**:
   ```bash
   git add package.json app.config.ts
   git commit -m "chore: bump version to 0.0.54 (build 54)"
   ```

4. **Push and tag**:
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

### iOS (App Store Connect)

EAS submits to App Store Connect. Review takes 1-3 days.

> [!NOTE]
> First submission to each store requires manual setup of the store listing (title, description, screenshots, etc.) via their respective consoles.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Google Play API not enabled" | Enable "Google Play Android Developer API" in Cloud Console |
| "Forbidden / Permission Denied" | Add service account to Play Console Users & Permissions |
| EAS build fails | Check `eas build:list` for logs; verify `EXPO_TOKEN` secret |
| iOS submission rejected | Check App Store Connect for specific rejection reasons |
| Keystore issues | Run `eas credentials` → Android → Keystore → manage |

---

**Last Updated**: 2026-02-19
