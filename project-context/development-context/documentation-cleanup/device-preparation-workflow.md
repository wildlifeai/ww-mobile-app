# Device Preparation & Testing Workflow Specification

**Version**: 1.0
**Date**: January 17, 2025
**Status**: For Implementation

---

## 1. Overview

The "Prepare and Test Nearby Devices" feature provides a "workbench" screen for a single camera, allowing a user to check its status, test its functionality, and perform necessary updates before taking it into the field.

This workflow is initiated from the "Devices" screen by tapping a button to scan for nearby, non-deployed cameras.

**Technical Reference**: For all details regarding the underlying communication protocols (BLE, DFU, LoRaWAN), refer to the **`ble-lorawan-communication-spec.md`** guide. This document focuses only on the user-facing workflow.

---

## 2. Connecting to a Device

### 2.1. Scan for Nearby Devices

1.  **Action**: The user taps the "Prepare Nearby Device" button on the "Devices" screen.
2.  **App Behavior**:
    *   The app requests Bluetooth and Location permissions if not already granted.
    *   The app begins scanning for nearby BLE devices.
    *   A list of discovered devices is displayed, showing device name and signal strength (RSSI). The list is filtered to show likely Wildlife Watcher cameras first.

### 2.2. Connect to a Device

1.  **Action**: The user selects a camera from the list.
2.  **App Behavior**:
    *   The app attempts to connect to the selected device over BLE using the **WWUS** (Wildlife Watcher UART Service).
    *   A loading indicator is shown.
    *   Upon successful connection, the app navigates to the **Camera Workbench** screen.

---

## 3. The Camera Workbench Screen

When a user connects to a nearby, non-deployed device, they are presented with the **Camera Workbench** screen containing the following fields and controls.

### 3.1. Project Association

*   **Display**: Shows the name of the project the device is currently associated with. If none, it displays "No Project Associated".
*   **Interaction**: Tapping this field opens a project selector, allowing the user to change the association.
    *   A device **must** be associated with a project before it can be used in the "Start Deployment" flow.
    *   This field can be left blank during the preparation phase.
*   **Access Control Logic**:
    *   If the device is already associated with a project the user is **not** a member of, the UI must display a warning icon and message.
    *   The user will be prompted with two options:
        1.  **Change Project**: Re-associate the device with a project they are a member of.
        2.  **Request Access**: A message will suggest: "To use this device with its current project, ask the Project Admin to add you as a member."

### 3.2. Device Name

*   **Display**: Shows the current, user-assigned name of the device (e.g., "Camera-101-SiteA").
*   **Interaction**: This is an **editable** text field.

### 3.3. UID (Unique Identifier)

*   **Display**: Shows the device's unique hardware ID (e.g., `A4:C1:38:9F:B2:11`).
*   **Interaction**: This field is **read-only**.

### 3.4. Battery Level

*   **Display**: Shows the current battery percentage, retrieved via a WWUS command.
*   **Interaction**: This field is **read-only**.

### 3.5. SD Card Storage

*   **Display**: Shows the available storage space on the SD card (e.g., "58.2 GB free"), retrieved via a WWUS command.
*   **Interaction**: This field is **read-only**.

### 3.6. AI Model

*   **Display**: Shows the name of the AI model currently loaded on the camera.
*   **Interaction**: This field is **editable only if the user has the `project_admin` role** for the project the device is associated with. Tapping it opens a selector with AI models available to the organization.

### 3.7. Firmware Version

*   **Display**: Shows the currently installed firmware version (e.g., "v1.4.6").
*   **Interaction**:
    *   The app will query the Supabase `firmware` repository to get the latest available version.
    *   If the installed version matches the latest, the UI will display a "Latest version installed" message.
    *   If a newer version is available, the UI will display "Update available to v1.5.0" and enable an **"Update Firmware"** button, which initiates the DFU process after checking the battery level and deployment status.
    *   If there is no internet connection, the app will display a warning: "Offline: Unable to check for firmware updates." The update button will be disabled.
*   **Workflow**: The DFU process is detailed in the Device Firmware Update Workflow document.

### 3.8. "Check camera view" Button

*   **Display**: A prominent button labeled "Check camera view".
*   **Interaction**:
    1.  Tapping the button sends a command via WWUS to take a test photo.
    2.  The app listens for the incoming photo data transfer.
    3.  The received image is displayed in a modal or a dedicated preview area on the screen.
    4.  This allows the user to confirm the camera lens is clear and the sensor is functioning correctly.

### 3.9. "Finish Preparation" Button

*   **Display**: A button at the bottom of the screen, labeled "Finish Preparation" or "Done".
*   **Interaction**:
    1.  Tapping this button saves any changes made on the workbench screen (e.g., Device Name, Project Association).
    2.  The app disconnects from the BLE device.
    3.  The user is navigated back to the "Devices" screen.
    4.  A confirmation toast message like "Device [Device Name] is ready for deployment" is displayed.
    