Here are a few **things to consider or revisit** to ensure nothing is missed:

---

### ✅ Confirmed You're Doing Right

* ✅ In-place Expo migration (not copying from PoC) — correctly reflected in your current steps.
* ✅ Using Expo SDK 51 — suitable for BLE/DFU and current requirements.
* ✅ Bundle/package IDs defined and unchanged — good, but still changeable until store submission.
* ✅ Using `expo-build-properties` to meet Android 35 and iOS 15.1+ compliance — correct and current.

---

### 🔶 Items to Consider (Some Missing from Plan)

#### 1. **Splash Screen Configuration**

* Currently not mentioned.
* Use `expo-splash-screen` config to ensure branded loading:

  ```json
  "splash": {
    "image": "./assets/splash.png",
    "resizeMode": "contain",
    "backgroundColor": "#ffffff"
  }
  ```

#### 2. **Environment-Specific Config**

* `app.config.js` should support dynamic env loading if needed later:

  ```js
  import 'dotenv/config';
  export default ({ config }) => ({
    ...config,
    extra: {
      apiUrl: process.env.API_URL
    }
  });
  ```

#### 3. **Expo OTA Updates Strategy**

* Your plan mentions `eas update`, but consider:

  * Add `expo-updates` to control OTA behavior.
  * Restrict OTA updates from applying to DFU/BLE logic — critical.

#### 4. **Push Notifications (Future-Proofing)**

* If push notifications are in your roadmap, configure:

  * FCM for Android
  * APNs setup (p8 or p12 keys) for iOS
* Even if not now, blocking time later is harder.

#### 5. **App Icon Fallbacks**

* Your plan calls for 1024x1024 icons, but also ensure:

  * `app.config.js` references correct icon paths
  * You generate assets using `expo generate:icons` or similar tools

#### 6. **iOS Device Testing Reminder**

* Make sure the test iOS device used (your friend’s phone):

  * Has TestFlight installed
  * Is included in internal testing group
  * Has a backup or dev profile if needed for custom dev client

#### 7. **Versioning**

* Add app versioning control:

  ```json
  "version": "1.0.0",
  "ios": {
    "buildNumber": "1"
  },
  "android": {
    "versionCode": 1
  }
  ```
* Automate bumping versions for builds to avoid store rejections.

#### 8. **Privacy Policy and App Tracking Transparency (ATT)**

* Apple requires:

  * A **privacy policy link** in the App Store listing
  * Optional: ATT prompt (if using analytics or tracking)

#### 9. **Real-World Scenarios Testing**

* Test BLE/DFU/Maps with:

  * Bluetooth OFF
  * Location permissions denied
  * Airplane mode enabled
  * No GPS fix
* Helps catch edge case crashes or blank screens early.

---

### 🧩 Optional (But Valuable)

* **Crash reporting and analytics**: Consider adding [Sentry](https://docs.expo.dev/guides/using-sentry/) or Expo’s [EAS Insights](https://expo.dev/insights).
* **Accessibility**: At least validate minimum contrast and voiceover support.
* **Loading/error states**: Ensure async BLE and API calls have appropriate UX fallbacks.

---

### ✅ Final Checklist Before Submitting to Store

| Item                                                | Status |
| --------------------------------------------------- | ------ |
| Splash screen configured                            | ⬜      |
| Icon + assets in place                              | ⬜      |
| `version` + build numbers defined                   | ⬜      |
| OTA exclusions documented                           | ⬜      |
| Store screenshots and privacy policy ready          | ⬜      |
| Manual test coverage for offline/denied permissions | ⬜      |

---

Would you like this added as a new section in your canvas doc, or kept here as your internal working checklist?
