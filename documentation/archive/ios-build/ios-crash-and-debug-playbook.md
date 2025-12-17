# Wildlife Watcher – iOS Diagnosis & Fix Plan (Expo SDK 51)

*Last updated: {{today}}*

## 0) Executive Summary

* **Problem:** iOS developer build starts to load (Metro shows bundle + logs) but app appears to crash/terminate or stall. Android works.
* **What we know from logs:**

  * JS **does run** (so not an immediate native crash before bundle load).
  * NetInfo repeatedly reports **offline → sync paused**.
  * BLE library initializes but iOS state is **Unknown**, and there are **no cached peripherals**.
* **Top likely causes (ranked):**

  1. **Missing iOS Bluetooth permissions** (`NSBluetoothAlwaysUsageDescription`, `NSBluetoothPeripheralUsageDescription`, plus camera/location as used).
  2. **Nordic DFU library (custom fork) not fully initialized on iOS** (missing `AppDelegate` init, pods not fully integrated, or dev-client stale).
  3. **Stale iOS Development Client** after native change (BLE/DFU/Maps) → requires rebuild.
  4. **Hermes runtime with older iOS targets** → early-runtime instability (use **JSC** while debugging).
  5. WSL2/LAN quirks → use **`expo start --tunnel`** for reliable iPhone ↔ Metro.

**Resolution strategy:** Add required permissions → rebuild **iOS Development Client** → defer BLE/DFU init until permissions + `PoweredOn` → (if needed) inject DFU iOS init via config plugin → A/B remove the DFU fork → validate with TestFlight or device analytics logs if still failing.

---

## 1) Environment Snapshot

* **Expo SDK:** 51
* **iOS Deployment Target:** Podfile shows `13.4`; Expo config shows **15.1** (preferred). If possible, use **≥ 14.0** during debugging.
* **Native libraries of note:**

  * `react-native-ble-manager`
  * `react-native-bluetooth-state-manager`
  * **Custom** `react-native-nordic-dfu` (GitHub fork)
  * Expo modules: `expo-dev-client`, `expo-location`, `expo-file-system`, `expo-sqlite`, etc.

---

## 2) Visible Symptoms & What They Imply

* **Metro logs show:** "Loading main app…", deep-link setup, ProjectService init, **BLE library initialized**, then repeated **Network offline – sync paused**, BLE state **Unknown**.
* **Implications:**

  * JS is running (so early native bootstrap is OK).
  * BLE central manager likely not yet ready/authorized → iOS state stays **Unknown** without required Info.plist strings or before permission handling.
  * Sync layer pauses because NetInfo reports offline; app may appear frozen though not strictly crashing.

---

## 3) iOS-Specific Issues Identified

### 3.1 Missing Info.plist Permissions (Critical)

**Missing keys:**

* `NSBluetoothAlwaysUsageDescription`
* `NSBluetoothPeripheralUsageDescription`
* `NSCameraUsageDescription` (if scanning QR codes)
* `NSPhotoLibraryAddUsageDescription` (if saving exports)

**Why it matters:** iOS may hold CoreBluetooth in **Unknown** state or terminate access before JS sees errors. Some permission issues can abort flows before any useful log.

**Fix (add to `app.config.js` / `app.json` → rebuild dev client):**

```json
{
  "expo": {
    "ios": {
      "deploymentTarget": "14.0",
      "infoPlist": {
        "NSBluetoothAlwaysUsageDescription": "Wildlife Watcher needs Bluetooth to connect to cameras and sensors.",
        "NSBluetoothPeripheralUsageDescription": "Wildlife Watcher uses Bluetooth to update device firmware.",
        "NSLocationWhenInUseUsageDescription": "Location is used to discover nearby devices.",
        "NSCameraUsageDescription": "Camera is used to scan device QR codes.",
        "NSPhotoLibraryAddUsageDescription": "Used to export and save files."
      }
    },
    "jsEngine": "jsc"  
  }
}
```

### 3.2 Nordic DFU iOS Initialization Missing (High)

* The DFU library requires **AppDelegate** initialization on iOS (e.g., setting a central manager getter and DFU callbacks). Without this, importing DFU may crash or misbehave.
* We can inject this in **managed** workflows via a **config plugin**, so no Mac/Xcode edits are required locally.

**Config plugin approach:** Create `plugins/withNordicDfuInit.js` and register it in `app.config.js` to inject the necessary code into `ios/AppDelegate.mm` during EAS prebuild.

```js
// app.config.js (excerpt)
export default ({ config }) => ({
  ...config,
  plugins: [
    [
      "expo-build-properties",
      { ios: { flipper: false, useFrameworks: "static" } }
    ],
    "./plugins/withNordicDfuInit"
  ],
  ios: { ...config.ios, deploymentTarget: "14.0" }
});
```

```js
// plugins/withNordicDfuInit.js
const { withAppDelegate } = require("@expo/config-plugins");

module.exports = function withNordicDfuInit(config) {
  return withAppDelegate(config, (cfg) => {
    let c = cfg.modResults.contents;

    if (!c.includes('#import <CoreBluetooth/CoreBluetooth.h>')) {
      c = c.replace(
        '#import "AppDelegate.h"',
        '#import "AppDelegate.h"\n#import <CoreBluetooth/CoreBluetooth.h>'
      );
    }
    if (!c.includes('#import "RNNordicDfu.h"')) {
      c = c.replace(
        '#import "AppDelegate.h"',
        '#import "AppDelegate.h"\n#import "RNNordicDfu.h"'
      );
    }
    c = c.replace(/didFinishLaunchingWithOptions:\(NSDictionary \*\)launchOptions\]\s*\{\n/, (m) =>
      m +
      `  [RNNordicDfu setCentralManagerGetter:^(){\n` +
      `    return [[CBCentralManager alloc] initWithDelegate:nil queue:dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_BACKGROUND, 0)];\n` +
      `  }];\n` +
      `  [RNNordicDfu setOnDFUComplete:^(){ NSLog(@"onDFUComplete"); }];\n` +
      `  [RNNordicDfu setOnDFUError:^(){ NSLog(@"onDFUError"); }];\n`
    );

    cfg.modResults.contents = c;
    return cfg;
  });
};
```

### 3.3 Stale Development Client (High)

* Any change to native code (adding/removing BLE/DFU/Maps, Info.plist keys, Hermes/JSC switch) requires a **fresh iOS Development Client** build.

### 3.4 Hermes vs JSC (Medium)

* On older iOS targets, Hermes can crash early. Use **JSC** during diagnosis to reduce variables.

### 3.5 WSL2 Networking (Medium)

* Use `expo start --tunnel` instead of LAN/port-forwarding to avoid WSL2/Firewall/Bonjour problems.

### 3.6 App Startup Sequencing (Medium)

* Avoid initializing BLE/DFU at module scope. Mount the UI first, request permissions, wait for CoreBluetooth **PoweredOn** state, then proceed.

---

## 4) Prioritized Action Plan (Most → Least Impact)

1. **Add missing Info.plist keys** (Bluetooth/Camera/Location) and set `ios.deploymentTarget` ≥ **14.0**.
2. **Switch to JSC** while debugging: `"jsEngine": "jsc"`.
3. **Rebuild iOS Development Client** and run with a tunnel:

   ```bash
   expo doctor && expo install --fix
   eas build -p ios --profile development
   expo start --tunnel
   ```
4. **Gate BLE/DFU initialization**

   * No BLE/DFU imports or `start()` at module scope.
   * After mount, subscribe to `BleManagerDidUpdateState` and proceed only when `PoweredOn`.
5. **Inject Nordic DFU init via config plugin** (if DFU remains required at runtime).
6. **A/B test the DFU fork**

   * Temporarily remove `react-native-nordic-dfu` + code paths, rebuild dev client.
   * If app stabilizes → fork or init sequence is the root cause.
7. **If still failing:**

   * Build **preview** and submit to **TestFlight** for symbolicated crash stacks (no Mac needed).
   * Or pull `.ips` logs: iPhone → Settings → Privacy & Security → Analytics Data → share latest `YourApp-*.ips`.
8. **Optional hardening:** Disable Flipper/new-arch, keep initial screen “pure UI,” defer Maps/DFU/BLE to a second screen.

---

## 5) Implementation Snippets

### 5.1 BLE init hook (safe sequencing)

```ts
import { useEffect } from 'react';
import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import BleManager from 'react-native-ble-manager';

export function useBleInit() {
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const emitter = new NativeEventEmitter(NativeModules.BleManager);
    let sub: any;

    (async () => {
      try {
        await BleManager.start({ showAlert: false });
        // Ask iOS to emit current state
        // @ts-ignore
        BleManager.checkState();
        sub = emitter.addListener('BleManagerDidUpdateState', ({ state }) => {
          console.log('[BLE] state:', state);
          if (state === 'on' || state === 'PoweredOn') {
            // safe to scan/connect/DFU
          }
        });
      } catch (e) {
        console.log('BLE start error', e);
      }
    })();

    return () => sub?.remove?.();
  }, []);
}
```

### 5.2 NetInfo probe (diagnose “offline”)

```ts
import NetInfo from '@react-native-community/netinfo';
NetInfo.addEventListener(s => {
  console.log('[NetInfo] isConnected:', s.isConnected, 'isInternetReachable:', s.isInternetReachable, 'type:', s.type);
});
```

---

## 6) Validation & Exit Criteria

* **Startup:** App boots to home screen without appearing to crash; Dev Menu logs visible.
* **Permissions:** iOS prompts appear as expected; BLE state transitions to `PoweredOn`.
* **Networking:** NetInfo reports `isConnected=true`, `isInternetReachable=true`; sync resumes.
* **DFU:** DFU screen launches only after user action; operations complete without app termination.
* **No device logs of fatal exceptions** after basic navigation.

---

## 7) Troubleshooting Matrix

| Symptom                          | Likely Cause                               | Action                                                  |
| -------------------------------- | ------------------------------------------ | ------------------------------------------------------- |
| App dies before any JS log       | Stale dev client or native crash           | Rebuild **dev client**; try JSC; TestFlight for crashes |
| BLE state stays `Unknown`        | Missing Info.plist or init too early       | Add permissions; defer init; wait for `PoweredOn`       |
| Repeated "offline – sync paused" | NetInfo false-negative / WSL2 tunnel       | Use `expo start --tunnel`; verify cellular permissions  |
| Crash when importing DFU         | Missing AppDelegate init / pod integration | Add config plugin; run clean prebuild; disable Flipper  |
| Simulator works, device crashes  | Entitlements/permissions/ATS               | Verify Info.plist, ATS, real-device permissions         |

---

## 8) Operational Checklist (copy/paste)

* [ ] Add Info.plist Bluetooth/Camera/Location keys (see §3.1).
* [ ] Set `ios.deploymentTarget` ≥ 14.0 (unless 13.x required).
* [ ] Set `jsEngine` = `jsc` for now.
* [ ] Ensure no BLE/DFU startup code at module scope.
* [ ] Add DFU AppDelegate init via config plugin (if DFU used).
* [ ] `expo doctor && expo install --fix`.
* [ ] **Rebuild iOS Development Client** (`eas build -p ios --profile development`).
* [ ] Run with **`expo start --tunnel`**.
* [ ] If unresolved, do Preview + TestFlight and/or pull `.ips` logs.

---

## 9) Appendix – Commands

```bash
# Clean + align deps
expo doctor
expo install --fix

# Dev client build (cloud; works on Windows)
eas build -p ios --profile development

# Start Metro with reliable connectivity
epxo start --tunnel

# Force clean native regen (if switching plugins)
rm -rf ios android        # locally if prebuilt; optional in managed
# rely on EAS to prebuild/clean in the cloud

# Preview + TestFlight (for symbolicated crashes)
eas build -p ios --profile preview
.eas submit -p ios --latest
```

---

## 10) Ownership & Next Actions

* **Tobyn**: Apply Info.plist keys, switch to JSC, rebuild dev client, run with tunnel, verify logs; then add config plugin if DFU still required.
* **Adarsh**: Confirm iOS 13.x support requirements; decide whether raising deployment target to 14/15 is acceptable.
* **Team**: If issues persist, remove DFU fork temporarily; report whether app stabilizes; if not, attach a `.ips` crash log and current `app.config.js` iOS block.
