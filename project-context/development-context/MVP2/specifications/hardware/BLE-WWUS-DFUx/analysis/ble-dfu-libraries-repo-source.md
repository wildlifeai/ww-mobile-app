I have comprehensive information about the BLE and DFU component source repositories. Let me provide you with a complete summary:

  BLE and DFU Component Source Repositories

  🔵 BLE Component: react-native-ble-manager

  Official Repository

  - GitHub: https://github.com/innoveit/react-native-ble-manager
  - Maintainer: Innoveit (https://github.com/innoveit)
  - License: Apache-2.0
  - Documentation: https://innoveit.github.io/react-native-ble-manager/

  Version Used in Wildlife Watcher

  - Package.json: "react-native-ble-manager": "^11.3.2"
  - Installed Version: 11.5.7 (from package-lock.json)
  - Registry: https://registry.npmjs.org/react-native-ble-manager

  Key Features

  - React Native BLE communication module
  - Written in TypeScript
  - Simple connection with OS APIs
  - Cross-platform (iOS/Android) support
  - Standard BLE stack implementation

  Version Support

  - RN 0.76+: Only new architecture supported
  - RN 0.60-0.75: Supported until version 11.5.X
  - RN 0.40-0.59: Supported until version 6.7.X
  - RN 0.30-0.39: Supported until version 2.4.3

  ---
  🟡 DFU Component: react-native-nordic-dfu

  Current Repository (Used by Wildlife Watcher)

  - GitHub: https://github.com/Salt-PepperEngineering/react-native-nordic-dfu
  - Maintainer: Salt-PepperEngineering
  - License: MIT
  - Installation: "react-native-nordic-dfu": "github:Salt-PepperEngineering/react-native-nordic-dfu"

  Version Details from Package-lock

  - Installed Version: 3.3.0
  - Commit Hash: 5debe9940bbc4fb69a3e62271a46db9708f4b6bd
  - Resolved URL: git+ssh://git@github.com/Salt-PepperEngineering/react-native-nordic-dfu.git

  Repository Heritage Chain

  Nordic SDK (Official) → Pilloxa Fork → Salt-PepperEngineering Fork (Current)

  Original Repository (No Longer Maintained)

  - GitHub: https://github.com/Pilloxa/react-native-nordic-dfu
  - Status: ⚠️ No longer actively maintained
  - Last Version: 3.2.1
  - License: MIT

  Key Differences in Salt-PepperEngineering Fork

  - Updated Dependencies: Latest versions of iOSDFULibrary & Android-BLE-Library
  - Limited Maintenance: Based on project needs only
  - iOS Platform: Written in Objective-C, considering Swift rewrite
  - Framework Requirement: Uses use_frameworks! :linkage => :static

  ---
  🔴 Underlying Nordic SDK Components

  Official Nordic DFU Libraries

  1. Android DFU Library
    - GitHub: https://github.com/NordicSemiconductor/Android-DFU-Library
    - Purpose: Device Firmware Update library and Android app
  2. iOS DFU Library
    - Swift Package: https://swiftpackageindex.com/NordicSemiconductor/IOS-DFU-Library
    - Documentation: https://nordicsemiconductor.github.io/IOS-DFU-Library/documentation/nordicdfu/

  Nordic nRF5 SDK

  - Downloads: https://www.nordicsemi.com/Products/Development-software/nRF5-SDK/Download
  - DFU Evolution: Legacy DFU → Secure DFU (SDK v12+)
  - Target Chips: nRF51, nRF52 series (including nRF52832)

  ---
  📋 Component Relationship Summary

  Wildlife Watcher Mobile App
  ├── BLE Communication (Normal Operations/WWUS)
  │   └── react-native-ble-manager@11.5.7
  │       └── innoveit/react-native-ble-manager (Official)
  │
  └── DFU Updates (Firmware Updates)
      └── react-native-nordic-dfu@3.3.0
          └── Salt-PepperEngineering/react-native-nordic-dfu (Fork)
              └── Pilloxa/react-native-nordic-dfu (Original, Unmaintained)
                  └── Nordic Semiconductor Official SDK
                      ├── Android-DFU-Library
                      └── IOS-DFU-Library

  ---
  🚨 Important Considerations

  Maintenance Status

  - ✅ BLE Manager: Actively maintained by Innoveit
  - ⚠️ DFU Library: Limited maintenance by Salt-PepperEngineering
  - ❌ Original DFU: Pilloxa version abandoned

  UUID Heritage

  The UUID 6e400001-b5a3-f393-e0a9-e50e24dcca9d used in the codebase is the Nordic UART Service (NUS) standard UUID, which explains why it should be called "WWUS" rather than
  generic "BLE".

  Security & Updates

  - Both libraries depend on underlying Nordic SDK components
  - Nordic has evolved to Secure DFU (not backward compatible with Legacy DFU)
  - The DFU implementation should be validated against Nordic's latest security guidelines

  Development Implications

  - BLE Component: Well-maintained, good long-term viability
  - DFU Component: Potential technical debt due to limited maintenance
  - Migration Path: Consider Nordic's official mobile libraries for future updates

  This repository analysis explains why Charles Palmer's feedback was so crucial - the codebase abstractions hide the fact that these are specific Nordic UART Service
  implementations, not generic "BLE" protocols.