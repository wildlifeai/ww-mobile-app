# Device Preparation & Testing Workflow Specification

**Version**: 1.0
**Date**: October 18, 2025
**Status**: For Implementation

---

## 1. Overview

This document specifies the user interface, interactions, and underlying logic for the "Prepare and Test Nearby Devices" workflow. This workflow is initiated from the main "Devices" screen and provides a comprehensive "workbench" for a single, non-deployed camera connected via Bluetooth.

## 2. User Interface and Interactions

When a user connects to a nearby, non-deployed device, they are presented with a screen containing the following fields and controls.

### 2.1. Project Association

*   **Display**: Shows the name of the project the device is currently associated with. If none, it displays "No Project Associated".
*   **Interaction**: Tapping this field opens a project selector, allowing the user to change the association.
    *   A device **must** be associated with a project before it can be used in the "Start Deployment" flow.
    *   This field can be left blank during the preparation phase.
*   **Access Control Logic**:
    *   If the device is already associated with a project the user is **not** a member of, the UI must display a warning icon and message.
    *   The user will be prompted with two options:
        1.  **Change Project**: Re-associate the device with a project they are a member of.
        2.  **Request Access**: A message will suggest: "To use this device with its current project, ask the Project Admin to add you as a member."

### 2.2. Device Name

*   **Display**: Shows the current, user-assigned name of the device (e.g., "Camera-101-SiteA").
*   **Interaction**: This is an **editable** text field.

### 2.3. UID (Unique Identifier)

*   **Display**: Shows the device's unique hardware ID (e.g., `A4:C1:38:9F:B2:11`).
*   **Interaction**: This field is **read-only**.

### 2.4. Battery Level

*   **Display**: Shows the current battery percentage, retrieved via a BLE characteristic read.
*   **Interaction**: This field is **read-only**.

### 2.5. SD Card Storage

*   **Display**: Shows the available storage space on the SD card (e.g., "58.2 GB free"). Retrieved via a BLE characteristic read.
*   **Interaction**: This field is **read-only**.

### 2.6. AI Model

*   **Display**: Shows the name of the AI model currently loaded on the camera.
*   **Interaction**: This field is **editable only if the user has the `project_admin` role** for the project the device is associated with. Tapping it opens a selector with AI models available to the organization.

### 2.7. Firmware Version

*   **Display**: Shows the currently installed firmware version (e.g., "v1.4.6").
*   **Interaction**:
    *   The app will query the Supabase `firmware` repository to get the latest available version.
    *   If the installed version matches the latest, the UI will display a "Latest version installed" message.
    *   If a newer version is available, the UI will display "Update available to v1.5.0" and enable an **"Update Firmware"** button, which initiates the DFU process.
    *   If there is no internet connection, the app cannot check for the latest version. It will display a warning message like, "Offline: Unable to check for firmware updates." The update button will be disabled.

*   **Workflow**: The DFU process is detailed in the [Device Firmware Update Workflow](./device-firmware-update-workflow.md) document.
### 2.8. "Check camera view" Button

*   **Display**: A prominent button labeled "Check camera view".
*   **Interaction**:
    1.  Tapping the button sends a `TAKE_PHOTO` command over BLE.
    2.  The app listens for an incoming photo data transfer over a BLE characteristic.
    3.  The received image is displayed in a modal or a dedicated preview area on the screen.
    4.  This allows the user to confirm the camera lens is clear and the sensor is functioning correctly.

## 3. Bluetooth (BLE) Command & Characteristic Mapping

This section outlines the expected BLE commands the mobile app will send. The exact characteristic UUIDs and payload formats are to be finalized with the hardware team.

| Action | BLE Command (App → Camera) | Expected Response (Camera → App) |
| :--- | :--- | :--- |
| **Get Status** | `GET_STATUS` | A data packet containing Battery Level, SD Card Storage, Firmware Version, and AI Model Name. |
| **Take Photo** | `TAKE_PHOTO` | A stream of data packets containing the JPEG image data. |
| **Update AI Model** | `SET_MODEL <model_id>` | `ACK` or `NACK` response. |
| **Initiate DFU** | (Handled by Nordic DFU library) | (Handled by Nordic DFU library) |

---


# Workflow: Prepare and Test Nearby Devices

**Version**: 1.0
**Date**: January 17, 2025
**Status**: Active
**Purpose**: To detail the user workflow for preparing a wildlife camera for field deployment, including status checks and firmware updates.

---

## 1. Overview

Before a researcher takes a camera into the field, they need to ensure it's fully prepared. The "Prepare and Test Nearby Devices" feature provides a "workbench" screen for a single camera, allowing the user to check its status, test its functionality, and perform necessary updates.

This workflow is initiated from the "Devices" screen by tapping a button to scan for nearby, non-deployed cameras.

**Technical Reference**: For all details regarding the underlying communication protocols (BLE, DFU, LoRaWAN), refer to the **`ble-communication-and-lorawan-integration.md`** guide. This document focuses only on the user-facing workflow.

## 2. User Workflow Steps

```mermaid
graph TD
    A[Devices Screen] -->|User taps "Prepare Nearby Device"| B(Scanning for Devices);
    B --> C{Device List};
    C -->|User selects a camera| D(Connecting...);
    D --> E[Camera Workbench Screen];

    subgraph "Camera Workbench Actions"
        E --> F[View Status];
        E --> G[Test Camera];
        E --> H[Manage Project Association];
        E --> I[Update Firmware];
        E --> J[Configure AI Model];
        E --> K[Name Device];
    end

    I --> L{Firmware Update Sub-flow};
```

### Step 1: Scan for Nearby Devices

1.  **Action**: The user taps the "Prepare Nearby Device" button on the "Devices" screen.
2.  **App Behavior**:
   *   The app requests Bluetooth and Location permissions if not already granted.
   *   The app begins scanning for nearby BLE devices.
   *   A list of discovered devices is displayed, showing device name and signal strength (RSSI). The list is filtered to show likely Wildlife Watcher cameras first.

### Step 2: Connect to a Device

1.  **Action**: The user selects a camera from the list.
2.  **App Behavior**:
   *   The app attempts to connect to the selected device over BLE using the **WWUS** (Wildlife Watcher UART Service).
   *   A loading indicator is shown.
   *   Upon successful connection, the app navigates to the "Camera Workbench" screen.

### Step 3: Use the Camera Workbench

The "Camera Workbench" is the main screen for managing a single, connected camera. It provides several capabilities:

#### A. View Camera Status

*   **What it is**: A real-time dashboard of the camera's health.
*   **Information Displayed**:
    *   **Battery Level**: Fetched via a WWUS command.
    *   **SD Card Storage**: Fetched via a WWUS command.
    *   **Firmware Version**: Fetched via a WWUS command.
    *   **Device ID / Name**.
*   **Communication Protocol**: WWUS.

#### B. Test Camera

*   **What it is**: A function to take a test photo to ensure the camera's lens is clear and its field of view is correct.
*   **App Behavior**:
    1.  User taps "Test Photo".
    2.  App sends a command via WWUS to capture and transmit an image.
    3.  The image is displayed on the screen.
*   **Communication Protocol**: WWUS (and potentially WWFT in the future for faster image transfer).

#### C. Manage Project Association

*   **What it is**: Assigns the camera to a specific research project.
*   **App Behavior**:
    *   Displays the currently associated project, if any.
    *   Allows the user to select a project from a list. The app prevents associating a camera with a project the user doesn't have access to.
*   **Communication Protocol**: This is a mobile app/backend operation. The association is stored in the app's local database and synced to the cloud. No BLE communication is required for this step.

#### D. Update Firmware (Sub-Workflow)

*   **What it is**: Updates the firmware for the camera's **BLE processor**.
*   **App Behavior**:
    1.  The app compares the camera's current firmware version (from the status check) with the latest version available from the backend.
    2.  If an update is available, an "Update Available" button is shown.
    3.  User taps the button. A confirmation dialog explains the process.
    4.  The app sends the `"dfu"` command via **WWUS**.
    5.  The app disconnects and begins scanning for the device in **DFU mode**.
    6.  The app connects to the DFU service and uses the `react-native-nordic-dfu` library to transfer the firmware file.
    7.  A progress bar is displayed.
    8.  Upon completion, the camera reboots. The app waits and reconnects via **WWUS** to verify the new firmware version.
*   **Communication Protocols**: WWUS and DFU.

#### E. Configure AI Model (Project Admin only)

*   **What it is**: Changes the AI detection model loaded on the camera.
*   **Status**: This is a future feature dependent on the **WWFT** service. For MVP2, this may be a placeholder or disabled.
*   **Communication Protocol**: WWFT (proposed).

#### F. Name Device

*   **What it is**: Gives the camera a custom, human-readable name (e.g., "Ranger Station 3 Cam").
*   **App Behavior**: The user can edit the device name, which is saved in the app's local database and synced to the backend.
*   **Communication Protocol**: None (app/backend operation).

## 3. Conclusion

The device preparation workflow is a critical pre-deployment step that combines multiple communication protocols (WWUS and DFU) into a seamless user experience. By consolidating all single-camera management tasks onto one "Workbench" screen, the app provides an efficient way for researchers to ensure their equipment is ready for the field.

