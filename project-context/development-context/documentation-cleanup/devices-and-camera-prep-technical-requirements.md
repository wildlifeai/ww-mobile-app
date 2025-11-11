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
- **Filtering**: The list must be filtered to show only devices associated with projects that the current user is a member or administrator of. This is determined by checking the `user_roles` table for the user's project-scoped roles.
- **UI and Data Mapping**:
    - Each item displays:
        - **Device Name**: `devices.name`.
        - **Status**: if device_id exists in active deployment → 'deployed', if in device_preparation table → 'in_preparation', else 'available'
    - For `'deployed'` devices, also show:
        - **Deployment Association**: Deployment name.
        - **Last Known Battery Level**: `devices.battery_level`.
- **Core Action**: A **"Prepare and Test Nearby Devices"** button initiates the [Camera Prep Workflow](#3-camera-prep-workflow-prepare-and-test).
- **Navigation**: Tapping a device card navigates to the **Device Details Screen**, passing the `devices.id`.


### 2.2. Device Details Screen

- **Data Source**: Displays details for a single device using the passed `devices.id`.
- **UI and Data Mapping**:
    - **Device Name**: `devices.name`
    - **Device Hardware ID**: `devices.bluetooth_id`.
        - For a device already in the local database, this is read from the `devices.bluetooth_id` field.
        - For a new device discovered during a BLE scan, this ID is read directly from the advertised BLE peripheral identifier before a database record is created.
    - **Firmware Version**: `devices.firmware_id` -> `firmware.name` `firmware.version`
    - **AI Model**: To determine the current AI model on the device, the app must query the `deployments` table for the most recent (latest `deployment_start`) entry for the given `devices.id`. The model name and version are then retrieved via `deployments.ai_model_id` -> `ai_models.name`, `ai_models.version`. If there are no deployments, this should be displayed as "N/A".
    - **Device Status**: if device_id exists in active deployment → 'deployed', if in device_preparation table → 'in_preparation', else 'available'
        - If `'deployed'`, this is a link to the active **Deployment Details Screen**.
    - **Deployment History**: A list queried from the `deployments` table where `deployments.device_id` matches.
- **Core Action**: If `devices.status` is `'available'`, a **"Prepare and Test"** button is displayed, which starts the [Camera Prep Workflow](#3-camera-prep-workflow-prepare-and-test).

---

## 3. Camera Prep Workflow ("Prepare and Test")

This workflow is for checking, configuring, and updating a camera before deployment. Upon entering this workflow, the device's status must be set to `'in_preparation'`.
- **Intended Location**: This workflow is primarily designed to be performed indoors (e.g., in an office or lab) before taking the device into the field. However, it can also be initiated from the "Start Deployment" wizard if initial device checks fail, allowing for on-the-spot troubleshooting and preparation.

### 3.1. Initiation and Connection

1.  **BLE Scan**: Scan for devices advertising the **WWUS**.
2.  **Device Selection**: User selects a device, and the app connects over BLE.
3.  **Pre-condition Check**: The device should send a message to the app specifying if the device is 'deployed' or not (CP to implement or suggest how to do this). If the device is deployed, notify the user, block the workflow, and suggest they "End Deployment" before proceeding.

### 3.2. Camera Workbench Screen

#### 3.2.1. Project Association

- **Project Selection**: The UI must display the device's currently associated project (from `devices.project_id`). The user must be able to change this association at any time by selecting from a list of projects they are a member or administrator of.
- **New Device Workflow**: If `devices.project_id` is `null`, the user **must** be required to select a project before other workbench actions are enabled.
- **Empty State**: If the user is not associated with any projects, a "Create Project" button must be displayed instead of a project list. Tapping this button initiates the "Create Project Workflow" (defined elsewhere in project documentation).
- **Database Action**: This selection updates the `devices.project_id` field in the local database.

#### 3.2.2. Real-time Status Checks

- The app must fetch and display the following using WWUS commands:
    - **Battery Level**:
        - **Command**: `battery\n`
        - **Success Response**: A string like `Battery = 85%\n`. The app must parse the integer value.
        - **Failure Response**: [PB to confirm] An error string, e.g., `ERROR: Battery check failed\n`.
    - **SD Card Status**:
        - **Command**: `AI sdstatus\n`
        - **Success Response**: A string detailing card status, e.g., `SD card found, 11 images\n`. The app should parse and display this information.
        - **Failure Response**: A string indicating an issue, e.g., `No SD card\n`. The app must handle this by disabling SD-card-dependent actions like the Camera View Test.

#### 3.2.3. Camera View Test

- **Implementation**:
    1.  Send `AI snap\n`.
        - **Success Response**: `File created: <filename>\n` (e.g., `temp_pic.jpg`).
        - **Failure Response**: `No SD card\n` or `ERROR: Snap failed\n`. The app must handle this gracefully.
    2.  On success, receive the filename and then send `AI read <filename>\n`.
    3.  Reassemble the image from 244-byte chunks.
    4.  Display the image.
    5.  Send `AI rm <filename>\n` to clean up.
        - **Success Response**: [PB to confirm] Assumed to be a confirmation like `File removed: <filename>\n`.
        - **Failure Response**: [PB to confirm] Assumed to be an error string like `ERROR: File not found\n`.

#### 3.2.4. Firmware Update (DFU)

- **Implementation**:
    1.  **Version Check**: Compare device version (from WWUS) with records in the local `firmware` table.
    2.  **Download**: If needed, download the file from `firmware.storage_path` and verify against `firmware.checksum`.
    3.  **Safety Checks**: Verify battery > 30% via WWUS.
    4.  **Enter DFU Mode**: Send `dfu\n` command. The device will not send a text response; it will disconnect its BLE connection and reboot into DFU mode. The app must handle this expected disconnection.
    5.  **Transfer**: Use `react-native-nordic-dfu` to send the `.zip` to the DFU Service (`00001530-1212-efde-1523-785feabcd123`).
    6.  **Verification & DB Update**: After reboot, reconnect to WWUS, verify the version, and update `devices.firmware_version` in the local DB.

#### 3.2.5. AI Model Update

- **Check**: The app compares the `ai_model_id` from the device's most recent deployment (if any) with the `model_id` and version of the currently selected project (`projects.model_id`).
- **Action**: If they differ, enable the "Update AI Model" button.
- **Implementation**:
    1.  Download the model file from `ai_models.storage_path`.
    2.  Transfer the file to the camera via BLE.
        - **[PB to confirm]** The specific WWUS command for initiating an AI model transfer needs to be defined.
    3.  **Database Action**: On success, update the `ai_model_id` in the `device_preparation` table for this device to match the `projects.model_id`. This ensures the correct model is recorded when a new deployment is created.

#### 3.2.6. LoRaWAN Verification

- **UI Display**:
    - If `devices.device_eui` is `null`, display: "Device not registered for remote updates."
    - If populated, a **"Ping Network"** button should be visible.
- **Ping Test**:
    - Tapping the button sends a `ping\n` command via WWUS.
    - **Success Response**: After a few seconds, the device will respond with the signal strength, e.g., `RSSI=-85, SNR=7.5\n`. The app must parse and display these values.
    - **Failure Response**: If no LoRaWAN gateway is reached, the device will respond with `No response\n`.
    - The result is for immediate feedback and is not persisted in the database.

### 3.3. Workflow Completion

- A **"Finish Preparation"** button finalizes the workflow.
- **Database Action**: Deletes the corresponding record from the `device_preparation` table, which implicitly sets the device's status back to `'available'`.
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
        - **"Cancel"**: Aborts the workflow, discards any unsaved changes, and deletes the record from the `device_preparation` table to revert the device's status to `'available'`. The user is then navigated back to the **Device List Screen**.
- **Command Failure**: If a WWUS command fails to produce an expected response, the app should show an error and offer a retry option.
