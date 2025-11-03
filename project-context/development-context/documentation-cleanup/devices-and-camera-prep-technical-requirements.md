# Technical Requirements: Devices & Camera Prep Workflow

**Version**: 1.2
**Date**: November 3, 2025
**Purpose**: This document outlines the technical requirements for implementing the "Devices" section and the "Camera Preparation" workflow. 

---

## 1. General Communication & Data Model

- **Primary Interface**: All direct, real-time communication with the camera hardware is conducted over Bluetooth Low Energy (BLE).
- **Service for Normal Operations**: The app **must** use the **Wildlife Watcher UART Service (WWUS)** for all standard commands and configurations.
    - **Service UUID**: `6e400001-b5a3-f393-e0a9-e50e24dcca9d`
- **Local Data Source**: All data displayed is sourced from a local mobile database, which syncs with the backend Supabase database.
- **Backend-Driven Updates**: LoRaWAN status updates (e.g., battery level) are sent from the device to the backend. The app receives these changes during its regular sync process.

---

## 2. Devices Section Functionality

Corresponds to the **"Devices"** tab in the main app navigation.

### 2.1. Device List Screen

- **Data Source**: Displays a list of cameras by querying the local `devices` table.
- **UI and Data Mapping**:
    - Each item displays:
        - **Device Name**: `devices.name`.
        - **Status**: `devices.status` (enum: `'available'`, `'in_preparation'`, `'deployed'`)
    - For `'deployed'` devices, also show:
        - **Project Association**: Project name, via `devices.project_id` -> `projects.id`.
        - **Last Known Battery Level**: `devices.battery_level`.
- **Core Action**: A **"Prepare and Test Nearby Devices"** button initiates the [Camera Prep Workflow](#3-camera-prep-workflow-prepare-and-test).
- **Navigation**: Tapping a device card navigates to the **Device Details Screen**, passing the `devices.id`.

### 2.2. Device Details Screen

- **Data Source**: Displays details for a single device using the passed `devices.id`.
- **UI and Data Mapping**:
    - **Device Name**: `devices.name`
    - **Device Hardware ID**: `devices.hardware_id`.
    - **Firmware Version**: `devices.firmware_version`.
    - **AI Model**: Name and version, via `devices.ai_model_id` -> `ai_models.id`.
    - **Device Status**: `devices.status`.
        - If `'deployed'`, this is a link to the active **Deployment Details Screen**.
    - **Deployment History**: A list queried from the `deployments` table where `deployments.device_id` matches.
- **Core Action**: If `devices.status` is `'available'`, a **"Prepare and Test"** button is displayed, which starts the [Camera Prep Workflow](#3-camera-prep-workflow-prepare-and-test).

---

## 3. Camera Prep Workflow ("Prepare and Test")

This workflow is for checking, configuring, and updating a camera before deployment. Upon entering this workflow, the device's status must be set to `'in_preparation'`.

### 3.1. Initiation and Connection

1.  **BLE Scan**: Scan for devices advertising the **WWUS**.
2.  **Device Selection**: User selects a device, and the app connects over BLE.
3.  **Pre-condition Check**: If the device's `status` is `'deployed'`, notify the user and block the workflow.

### 3.2. Camera Workbench Screen

#### 3.2.1. Project Association

- **New Device Handling**: If the device's `project_id` is `null`, the UI must treat it as a new device. The user **must** be required to select a project from a list of their associated projects before any other actions in the workbench are enabled.
- **Database Action**: This selection updates the `devices.project_id` field in the local database.

#### 3.2.2. Real-time Status Checks

- The app must fetch and display the following using WWUS commands:
    - **Battery Level**: "battery\n"
    - **SD Card Status**: "AI sdstatus\n"

#### 3.2.3. Camera View Test

- **Implementation**:
    1.  Send "AI snap\n".
    2.  Receive filename, then send "AI read <filename>\n".
    3.  Reassemble the image from 244-byte chunks.
    4.  Display the image.
    5.  Send "AI rm <filename>\n" to clean up.

#### 3.2.4. Firmware Update (DFU)

- **Implementation**:
    1.  **Version Check**: Compare device version (from WWUS) with records in the local `firmware` table.
    2.  **Download**: If needed, download the file from `firmware.storage_path` and verify against `firmware.checksum`.
    3.  **Safety Checks**: Verify battery > 30% via WWUS.
    4.  **Enter DFU Mode**: Send "dfu\n" command.
    5.  **Transfer**: Use `react-native-nordic-dfu` to send the `.zip` to the DFU Service (`00001530-1212-efde-1523-785feabcd123`).
    6.  **Verification & DB Update**: After reboot, reconnect to WWUS, verify the version, and update `devices.firmware_version` in the local DB.

#### 3.2.5. AI Model Update

- **Check**: Compare `devices.ai_model_id` with the `projects.default_ai_model_id` for the selected project.
- **Action**: If they differ, enable the "Update AI Model" button.
- **Implementation**:
    1.  Download the model file from `ai_models.storage_path`.
    2.  Transfer the file to the camera via BLE.
    3.  **Database Action**: On success, update `devices.ai_model_id` in the local DB.

#### 3.2.6. LoRaWAN Verification

- **UI Display**:
    - If `devices.deveui` is `null`, display: "Device not registered for remote updates."
    - If populated, a **"Ping Network"** button should be visible.
- **Ping Test**:
    - Tapping the button sends a "ping\n" command via WWUS.
    - The app displays the resulting signal strength (RSSI/SNR) to the user. This result is for immediate feedback and is not persisted.

### 3.3. Workflow Completion

- A **"Finish Preparation"** button finalizes the workflow.
- **Database Action**: Sets the device's `devices.status` back to `'available'`.
- **Navigation Logic**:
    - The app must track the entry point into this workflow.
    - **If the entry point was the Start Deployment wizard**: The user is automatically navigated back to the wizard to continue the deployment with the now-prepared device.
    - **Otherwise** (from Devices list or Details): The user is returned to the **Device List Screen**.

### 3.4. Error Handling and Disconnections

- **BLE Connection Loss**: If the BLE connection is lost at any point during the workflow:
    1.  **Immediate Feedback**: Display a non-blocking notification (e.g., a toast or banner) informing the user that the connection was lost.
    2.  **Automatic Reconnection**: The app should attempt to automatically reconnect to the device in the background for a short period (e.g., 5-10 seconds).
    3.  **User Prompt**: If automatic reconnection fails, present a modal dialog with two options:
        - **"Retry"**: Dismisses the dialog and re-initiates the device scanning and connection process.
        - **"Cancel"**: Aborts the workflow, discards any unsaved changes, and reverts the device `status` to `'available'`. The user is then navigated back to the **Device List Screen**.
- **Command Failure**: If a WWUS command fails to produce an expected response, the app should show an error and offer a retry option.
