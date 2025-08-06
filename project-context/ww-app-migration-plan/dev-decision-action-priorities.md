You're right to think ahead. While you're still in the **active development phase**, it's smart to focus only on decisions that are either **hard to change later** or that can **block or complicate store deployment** later if deferred. Here’s a breakdown of what’s **critical to lock in now**, what’s **best to keep in sync during dev**, and what’s **safe to leave for later**.

---

## ✅ **CRITICAL TO DECIDE NOW (Hard to Change Later)**

### 1. **Bundle Identifiers / Package Names**

* **iOS**: `com.wildlifeai.wildlifewatcher`
* **Android**: `com.wildlifeai.wildlifewatcher`
* 🔒 Once submitted to stores, these **cannot be changed** without publishing a new app.
* ✅ You’ve already chosen — make sure it’s final and consistent in `app.config.js`.

### 2. **Minimum OS Versions**

* **Android minSdkVersion**: 24 (Android 7.0)
* **iOS deploymentTarget**: 15.1
* 🔒 If you build features relying on newer APIs, you may **exclude older devices** later.
* ✅ Stick with these values during dev to avoid feature rewrites.

### 3. **Required Permissions**

* Set these early in `app.config.js`:

  * BLE: `BLUETOOTH_CONNECT`, `BLUETOOTH_SCAN`, etc.
  * Location: `ACCESS_FINE_LOCATION`, `NSLocationWhenInUseUsageDescription`
* 🔒 These must be declared upfront — especially for iOS, where permissions **trigger app review issues** if wrong or missing.

### 4. **expo-build-properties Plugin**

* Needed to target **Android API 35** and **iOS SDK 18 (Xcode 16)** by store deadlines.
* 🔒 It’s not hard to change, but **forgetting it until late can block app store submission**.
* ✅ Install it now and keep it in your `app.config.js`.

---

## ⚠️ **IMPORTANT TO SET UP DURING DEV** (Easy to forget later)

### 5. **Device Testing**

* ✅ Test **BLE + DFU + Maps** on:

  * Android 10–13 devices
  * iPhones running iOS 15–17
* 📱 BLE/DFU can behave differently depending on OS/hardware.

### 6. **Custom Dev Clients**

* Don’t delay setting these up.
* EAS Build > install on real phones > verify features.
* ✅ Keeps development iterative and aligned with production behavior.

### 7. **eas.json Setup**

* Create early so that you're not relying on CLI defaults.
* ✅ Dev/test/staging/prod profiles help isolate builds and environments.

---

## 💤 **SAFE TO DEFER UNTIL LATER**

### 8. **Store Metadata**

* App icons, screenshots, privacy policy, descriptions
* 📸 You don’t need these until \~1 week before submission

### 9. **Submission to App Stores**

* `eas submit` is a last-step activity.
* 🔐 But ensure your Apple & Google dev accounts are set up now.

### 10. **TestFlight / Internal Testing**

* Can be configured just before submission or even post-submission

---

## 💡 Bonus Advice: Device Coverage Strategy

| Platform | Recommended Minimum  | Notes                                             |
| -------- | -------------------- | ------------------------------------------------- |
| Android  | Android 7.0 (API 24) | BLE + Maps supported, but test on Android 11+     |
| iOS      | iOS 15.1+            | Ensures compatibility with 90%+ of active devices |

> 🧪 Use Expo Go only for early UI tests — BLE/DFU requires dev clients.

---

## ✅ Summary: What to Do Now

| Item                            | Status        | Action                                    |
| ------------------------------- | ------------- | ----------------------------------------- |
| Bundle identifiers              | ✅ Defined     | Lock them in `app.config.js`              |
| app.config.js permissions       | ⚠️ Review now | Add all BLE + Maps permissions            |
| expo-build-properties           | ⚠️ Add now    | Set targetSdkVersion and deploymentTarget |
| Device testing                  | ⚠️ Start now  | Android + iOS testing with dev client     |
| EAS build profiles (`eas.json`) | ⚠️ Set up     | Create dev/test/staging/prod configs      |
| Store assets                    | ⏳ Later       | Finalize during polish phase              |

Would you like a checklist version of this to include in the canvas? Or should we break it into GitHub issues or dev cards to track progress?
