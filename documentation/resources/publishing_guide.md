# Publishing Guide — Android & iOS

> **Related**: [00-GETTING-STARTED.md](../onboarding/00-GETTING-STARTED.md) (project overview), [Maps.md](Maps.md) (Maps API keys).

## Overview

The app uses **EAS (Expo Application Services)** for building and submitting to both stores. Configuration lives in `eas.json`.

| EAS Profile | Purpose | `EXPO_PUBLIC_SUPABASE_ENV` | Trigger |
|-------------|---------|---------------------------|---------|
| `e2e` | CI builds for the Maestro flows (release-type, built locally on the runner) | `cloud-dev` | CI workflows |
| `development` | Dev client builds | *(unset — local `.env`)* | Manual: `eas build` |
| `staging` | Pre-production validation | `cloud-staging` | Manual: `eas build` |
| `preview` | Internal testing | `cloud-dev` | Manual dispatch of EAS Build & Submit, or `eas build` |
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
| `PLAY_SERVICE_ACCOUNT_KEY` | The contents of the Play key file above. The release run writes it to the path in `eas.json`; iOS needs no secret, its App Store Connect key is stored on EAS |

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

The `eas-build.yml` workflow handles this, and it is the only workflow a `v*` tag starts (#373):

- **Git tag `v*`** → builds `production` profile → submits to stores
- **Manual dispatch** → choose profile + platform, the way to get a `preview` build

A push to `main` builds nothing, so a release costs the two production builds and not two preview builds as well.

If the submit step fails, the builds are still there. Submit each one from a checkout of the tag (Android needs the key file in it): `eas submit --profile production --platform android --id <buildId>`, then the same with `ios`.

### Release Process

The version is bumped on `dev` before the release, so the release PR carries it to `main`, and the
tag goes on that PR's merge commit.

1. **Merge everything for the release into `dev`.**
2. **Bump the version in a PR into `dev`**, from a branch `chore/bump-0.0.X`, with the commit and
   title `chore(release): 0.0.X`. These values must agree, or EAS and OTA updates disagree about
   what is installed:

   | File | Field | Example (0.0.70 to 0.0.71) |
   |------|-------|----------------------------|
   | `package.json` | `version` | `"0.0.71"` |
   | `app.config.ts` | `android.versionCode` | `71` |
   | `app.config.ts` | `ios.buildNumber` | `"71"` |
   | `android/app/build.gradle` | `versionCode` / `versionName` | `71` / `"0.0.71"` |
   | `android/app/src/main/res/values/strings.xml` | `expo_runtime_version` | `0.0.71` |
   | `package-lock.json` | `version` (twice, top of file) | `"0.0.71"` |

   `app.config.ts` derives `version` and `runtimeVersion` from `package.json`. The Android values
   do not: `android/` is tracked, so EAS reads `build.gradle` and `strings.xml` and ignores
   `app.config.ts`. Edit them with the rest. `npx expo prebuild --no-install --platform android`
   writes the same two files, but it regenerates the native project, so keep its output only if
   its diff touches nothing else. Then:

   ```bash
   npm run version:check
   ```

3. **Merge the release PR from `dev` to `main`** with a merge commit.
4. **Tag that merge commit and push the tag.** The tag starts `eas-build.yml`: production builds
   for both platforms, submitted to the stores.

   ```bash
   git fetch origin main
   git tag -a v0.0.71 -m "0.0.71" origin/main
   git push origin v0.0.71
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
| **Submission shows `ERRORED` with `error: null`, `logFiles: []`, `completedAt: null`** | It failed before uploading, so the web console has nothing to show. Re-run the same submission from the CLI, `eas submit --platform ios --profile production --id <buildId>`, which prints Apple's actual response. A month-old mystery turned out to be one wrong number this way |
| **`There is no resource of type 'apps' with id '…'` on every iOS submission** | A stale `ascAppId` in `eas.json`. Store identifiers must match EAS's credential records, not memory: `remoteAppStoreConnectApps` on the EAS GraphQL API lists what the stored App Store Connect key can see. The web console ignores `eas.json` and uses stored credentials, so a wrong value there hides until CI submits |
| Dispatching a build submits it too | `eas.json` has five profiles, not three, and `production` in the GitHub workflow also submits to the stores. Check the profile before dispatching |
| Keystore issues | Run `eas credentials` → Android → Keystore → manage |

---

**Last Updated**: 2026-09-04 (troubleshooting rows moved here from the agent skill)
