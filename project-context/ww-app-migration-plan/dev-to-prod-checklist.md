Here’s a **full checklist**, grouped by your plan and priorities, to take the Wildlife Watcher app from its current development stage through to production and store deployment. I've structured this to help you and your team stay on track, showing **what to do now vs. what can come later**, and how everything ties together.

---

# ✅ Wildlife Watcher Deployment Checklist (Dev → Production)

---

## 🔸 PHASE 1: IMMEDIATE MIGRATION (Next 24 Hours)

### 🔹 Must-Do Now (Blockers for MVP 1/2 Dev Start)

* [ ] ✅ **Backup current working `ww-app` repo**
* [ ] ✅ **Switch to dedicated `expo-migration` branch** (optional, for safety)
* [ ] ✅ **Install and configure Expo SDK 51**
* [ ] ✅ **Replace `react-native-fs` with `expo-file-system`**
* [ ] ✅ **Run `expo doctor` and resolve any peer dependency warnings**
* [ ] ✅ **Validate app starts on Android (your device) and iOS (friend's device)**
* [ ] ✅ **Ensure BLE, DFU, Maps work as expected from PoC**
* [ ] ✅ **Cutover Decision: Migrate forward in Expo or revert**

---

## 🔸 PHASE 2: MVP 1 + 2 FEATURE DEVELOPMENT (Npost Phase 1)

### 🔹 Foundation Setup

* [ ] ✅ Confirm `app.config.js` has correct base config (name, bundle ID, permissions)
* [ ] ✅ Add `expo-build-properties` with correct Android/iOS targets
* [ ] ✅ Create `eas.json` with `development` and `production` profiles
* [ ] ✅ Install working `expo-dev-client` on test Android/iOS

### 🔹 Supabase Integration

* [ ] ✅ Add Supabase JS client
* [ ] ✅ Enable user signup and login
* [ ] ✅ Scope API access by user account/project
* [ ] ✅ Validate API calls work from mobile (and use appropriate auth headers)
* [ ] ⬜ Create reusable API module for CRUD actions

### 🔹 Development Milestones

* [ ] ✅ Complete all MVP 1 features
* [ ] ⬜ Complete all MVP 2 features
* [ ] ⬜ Manual test plan for BLE, DFU, Map, File, and Supabase flows
* [ ] ⬜ Test edge cases (denied permissions, no GPS, airplane mode, Bluetooth off)

---

## 🔸 PHASE 3: BUILD PREP AND TESTING (Do Before Submission)

### 🔹 Finalize App Metadata

* [ ] ⬜ Finalize `bundleIdentifier` and `android.package` (can't change post-upload)
* [ ] ⬜ Set app name and slug in `app.config.js`
* [ ] ⬜ Add app icon (1024x1024) and splash screen

### 🔹 Build Production Releases

* [ ] ⬜ Build dev client for Android and iOS
* [ ] ⬜ Build production `.aab` and `.ipa` with EAS
* [ ] ⬜ Confirm builds run on test devices
* [ ] ⬜ Confirm DFU and BLE still work in builds

---

## 🔸 PHASE 4: STORE CONFIGURATION AND SUBMISSION

### 🔹 Store Metadata and Assets

* [ ] ⬜ App descriptions (short and long)
* [ ] ⬜ Feature graphic (Android)
* [ ] ⬜ Screenshots for both Android and iOS
* [ ] ⬜ Privacy policy URL (host it yourself or via a public Google Doc)
* [ ] ⬜ Support contact email and website

### 🔹 App Store Setup

* [ ] ⬜ Create App Store Connect app entry
* [ ] ⬜ Create Google Play app entry
* [ ] ⬜ Upload production builds
* [ ] ⬜ Submit to internal testing (TestFlight, Android Closed Track)

---

## 🔸 PHASE 5: POST-SUBMISSION AND RELEASE

### 🔹 Testing and QA

* [ ] ⬜ Confirm both apps install via store links
* [ ] ⬜ Onboard users or testers
* [ ] ⬜ Collect feedback and error reports
* [ ] ⬜ Test analytics and error logging (optional: use Sentry)

### 🔹 OTA and Versioning

* [ ] ⬜ Define OTA update strategy
* [ ] ⬜ Set release channel in EAS
* [ ] ⬜ Add `version`, `versionCode`, and `buildNumber` to `app.config.js`

---

## 🔸 PHASE 6: STABILITY + HANDOVER

### 🔹 Ongoing Maintenance

* [ ] ⬜ Monitor for crash reports (TestFlight + Play Store)
* [ ] ⬜ Create handover documentation for contributors or maintainers
* [ ] ⬜ Update GitHub README with dev + prod instructions
* [ ] ⬜ Set calendar reminders for SDK target updates (Android/iOS deadlines)

---

## 🔹 Decision Points to Revisit (As You Build)

| Area               | Decision Needed                                        |
| ------------------ | ------------------------------------------------------ |
| Bundle IDs         | Are they final before store submit?                    |
| OTA Strategy       | What features should never be updated OTA?             |
| Privacy Policy     | Will it live in the Supabase website or a static site? |
| Push Notifications | Needed now or later (if ever)?                         |
| iOS Devices        | Any iPads or older models to test on?                  |
| Offline Mode       | Should app degrade gracefully when offline?            |

