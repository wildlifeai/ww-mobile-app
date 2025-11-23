# Technical Requirements: Devices & Camera Prep Workflow
[Edits by Chares incorporating comments from Victor of 13/11/25 - some comments are in square brackets.]

**Version**: 1.4
**Date**: November 20, 2025
**Purpose**: This document outlines the technical requirements for implementing the "Devices" section and the "Camera Preparation" workflow. 

---

## 1. General Communication & Data Model

- **Primary Interface**: All direct, real-time communication with the camera hardware is conducted over Bluetooth Low Energy (BLE).
- **Service for Normal Operations**: The app **must** use the **Wildlife Watcher UART Service (WWUS)** for all standard commands and configurations.

- **Service for Engineering Operations**: The app **must** provide an engineering console for software development.

    - **Service UUID**: `6e400001-b5a3-f393-e0a9-e50e24dcca9d`
- **Local Data Source**: All data displayed is a) sourced from a local mobile database, which syncs with the backend Supabase database, or b) read from the device (such as battery level, LoRaWAN signal strength)

- **Backend-Driven Updates**: LoRaWAN status updates (e.g., battery level) are sent from the WW device to the backend. The app receives these changes during its regular sync process. 

---

## 2. Devices Section Functionality

Corresponds to the **"Devices"** tab in the main app navigation.

### 2.1. Device List Screen

- **Data Source**: Displays a list of cameras by querying the local `devices` table from the database.
- **Filtering**: The list must be filtered to show only devices associated with projects that the current user is a member or administrator of. This is determined by checking the `user_roles` table for the user's project-scoped roles. 
- **UI and Data Mapping**:
    - Each item displays:
        - **Device Name**: `devices.name`.
        - **Status**: if device_id exists in active deployment → 'deployed', else 'available'
    - For `'deployed'` devices, also show:
        - **Deployment Association**: Deployment name.
        - **Last Known Battery Level**: `devices.battery_level`.
- **Navigation**: Tapping a device card navigates to the **Device Details Screen**, passing the `devices.id`.
- **Core Action**: A prominent **"Prepare and Test Nearby Devices"** button at the bottom of the screen initiates the [Camera Prep Workflow](#3-camera-prep-workflow-prepare-and-test).
- **Secondary Action**: A small **"Engineer Nearby Devices"** button at the bottom of the screen initiates the [Engineer console](#4-engineer-console).



### 2.2. Device Details Screen

- **Data Source**: Displays details for a single device using the passed `devices.id`.
- **UI and Data Mapping**:
    - **Device Name**: `devices.name`
    - **Device Hardware ID**: `devices.bluetooth_id`.
        - For a device already in the local database, this is read from the `devices.bluetooth_id` field.
        - For a new device discovered during a BLE scan, this ID is read directly from the advertised BLE peripheral identifier before a database record is created.
    - **Firmware Version**: `devices.firmware_id` -> `firmware.name` `firmware.version`
    - **AI Model**: To determine the current AI model on the device, the app must query the `deployments` table for the most recent (latest `deployment_start`) entry for the given `devices.id`. The model name and version are then retrieved via `deployments.ai_model_id` -> `ai_models.name`, `ai_models.version`. If there are no deployments, this should be displayed as "N/A".
    - **Device Deployment Status** (calculated field, not stored). The logic is as follows:
        1.  **Check for Active Deployment**:
            - Query: `SELECT COUNT(*) FROM deployments WHERE device_id = ? AND deployment_end IS NULL AND deleted_at IS NULL`
            - If `count > 0`, the status is `'deployed'`. The UI should display "Deployed" and provide a link to the active deployment's details screen.
        2.  **Check for Completed Preparation**:
            - If not deployed, query: `SELECT completed_at FROM device_preparation WHERE device_id = ? AND status = 'completed' ORDER BY completed_at DESC LIMIT 1`
            - If a record is found, the status is `'prepared'`. The UI should display a message like `Prepared on {completed_at}` (e.g., "Prepared on July 4th, 2025 at 14:21").
        3.  **Default to Needs Preparation**:
            - If not deployed and no completed preparation record exists, the status is `'needs_preparation'`. The UI should display "Needs Preparation".
    - **Deployment History**: A list queried from the `deployments` table where `deployments.device_id` matches.
- **Core Action**: If the device status is not `'deployed'` (i.e., it is `'prepared'` or `'needs_preparation'`), a **"Prepare and Test"** button is displayed, which starts the "Prepare and Test Nearby Devices" workflow.


---

## 3. Prepare and Test Nearby Devices

This workflow checks, configures, and updates a camera before deployment. **All actions are recorded in the `device_preparation` table for compliance and troubleshooting.** 
- **Intended Location**: This workflow is primarily designed to be performed indoors (e.g., in an office or lab) before taking the device into the field. However, it can also be initiated from the "Start Deployment" wizard if initial device checks fail, allowing for on-the-spot troubleshooting and preparation.

### 3.1. Initiation and Connection

1.  **BLE Scan**: Scan for devices advertising the **WWUS**.
2.  **Device Selection**: User selects a device, and the app connects over BLE.
3.  **Device Discovery Help**: If no devices are found, the app must display a message with instructions, for example: "No devices found. To make your camera discoverable, press the button on the Wildlife Watcher until the blue Bluetooth icon lights up."
4.  **Pre-condition Checks**: The app queries the db to check if it is deployed or not. If the device is deployed, notify the user, block the workflow, and suggest they "End Deployment" before proceeding. The app then sends a "selftest" message to the device.
    - **Success Response**: `Error bits = 0x0000` (all tests passed)
    - **Failure Response**: `Error bits = 0xXXXX` where each bit represents a specific failure:
        - Bit 0: SD card test failed
        - Bit 1: Camera test failed
        - Bit 2: LoRaWAN module test failed
        - [CP to provide complete bit mask definition]
    - **UI Behavior**:
        - If success: Proceed to Prepare and Test screen
        - If failure: Display message "Device self-test failed: [list of failed components]. Do you want to continue anyway?" with "Continue" and "Cancel" buttonsThe device returns a hex number as 'Error bits = 0x0000' - bit mask to follow or a zero if no errors. The app displays the fail message with a) "Accept" and b) "Cancel" buttons that a) let the user continue with the "Preapare and Test" wokflow or b) redirects the user to the "Devices" navigation tab. For context, the device has an internal self-test at power-on (e.g. battery insertion), if it fails, the failure messages stored in the device following a bit-mask (set bits to indicate failure of different tests).  If a user starts a workflow and there is already a in_progress preparation record for that device, set the previous record to cancelled and start a new one.
5. **Create Preparation Record**: create a new `device_preparation` record.

### 3.2. Prepare and Test Nearby Devices Screen
This is a single screen where all preparation activities occur. **Each action updates the `device_preparation` record.**

#### 3.2.0 Local Asset Management (Firmware & AI Models)

- **Local Caching**: The mobile app must maintain a local cache of all available firmware and AI model files.
- **App Initialization Sync**: On app startup, when an internet connection is available, the app must:
    1.  Query the `firmware` and `ai_models` tables from the Supabase backend.
    2.  Compare the versions/IDs of the available files with its local cache.
    3.  If a newer version of any file exists on the backend, the app must download it and update its local cache.
- **Offline-First Principle**: During the "Prepare and Test" workflow, all update files (firmware `.zip` files, AI models) must be sourced directly from the app's local cache. This ensures that, if needed, the device updates can be performed reliably in the field without requiring an active internet connection at the time of preparation.

#### 3.2.1. Project Association

- **Project Selection**: The UI must display the device's currently associated project by querying the most recent completed `device_preparation` record for this device (`device_preparation.project_id` WHERE `status='completed'` ORDER BY `completed_at` DESC LIMIT 1). The user must be able to change this association by selecting from a list of projects they are a member or administrator of.
- **New Device Workflow**: If no completed device_preparation record exists, the user **must** be required to select a project before the "Finish Preparation & Testing" button is enabled.
- **Empty State**: If the user is not associated with any projects, a "Create Project" button must be displayed instead of a project list. Tapping this button initiates the "Create Project Workflow" (defined elsewhere in project documentation).
- **Database Action**: This selection updates the `device_preparation.project_id` field for the current preparation session.
**Validation**:
- Project selection is REQUIRED before "Finish Preparation" can be enabled
- Display warning: "Please select a project to continue"

### 3.2.2. Real-time Status Checks

- The app must fetch and display the following using WWUS commands:
    - **Battery Level**:
        - **Command**: `battery\n`
        - **Success Response**: A string like `Battery = 5482mV 73%`. The app must parse the percentage value.
        - **Database Action**: Updates the `device_preparation.battery_level_at_check` field in the local database.
        
    - **SD Card Status**:
        - **Command**: `AI info\n`
        - **Purpose**: This command checks if the SD card is present and readable, and returns its total and available space.
        - **Success Response**: A multi-line string like `Label: SDCARD\nSerial No: 0x12345678\n   15628800 K total drive space.\r\n    8433984 K available.`. The app should parse the "total" and "available" space values to confirm the card is ready and has sufficient space.
        - **Failure Response**: If the card is not present or fails to initialize, the command will return an error like `f_getfree() failed (3)\r\n` (where `3` corresponds to `FR_NOT_READY`). The app must handle this by displaying a "No SD card" or "SD Card Error" message and disabling SD-card-dependent actions like the Camera View Test.
        - **Database Action**: Updates the `device_preparation.sd_card_total_kb_at_check` and `device_preparation.sd_card_free_kb_at_check` fields in the local database.


#### 3.2.3. Camera View Test

- **Implementation**:
    1.  Send `AI capture 1 0\n`.
        - **Success Response**: 'Captured 1 images. Last is <filename>' e.g. <filename is 'TL001296.JPG'.
        - **Failure Response**: `No SD card\n` or `ERROR: Snap failed\n`. The app must handle this gracefully.
    [ See see [txfile.md](https://github.com/wildlifeai/Seeed_Grove_Vision_AI_Module_V2/blob/main/_Documentation/txfile.md) for details.] 
    2.  On success, receive the filename and then send `AI txfile <filename>`.
    3.  Reassemble the image from 244-byte chunks.
    4.  Display the image.
    5.  Send `AI rm <filename>\n` to clean up.
        - **Success Response**: [PB to confirm] Assumed to be a confirmation like `File removed: <filename>\n`.
        - **Failure Response**: [PB to confirm] Assumed to be an error string like `ERROR: File not found\n`.
        [I have not implemented a file delete function (yet) and I'd prefer to not have to unless there is a compelling reason. It looks like this would require [unlink](https://elm-chan.org/fsw/ff/doc/unlink.html). Discuss if you want to make the case.][VA- The main idea behind removing the test photos was to facilitate the annotation process. Ideally, the photos in the sd card should be from the deployment not from tests. I guess, we could have "Test" and "Deployment" folders? Also, each photo should have embeded the deployment id information, as EXIF. The software used for annotating the images, AddaxAI or Wildlife Insights, will read the deployment id from the images directly and get the deployment information from our db. If we have test photos, should we add a NA for deployment id?]
    [Let's discuss options, with a view to keeping it simple.]

#### 3.2.4. Firmware Update (DFU, Himax and Config)
- **Overview**: The firmware update process is a unified workflow that handles three distinct artifacts: BLE firmware, Himax AI firmware, and the device configuration file. The app must check the version of each artifact on the device, querying the local db, against the latest versions available in its local cache.

- **Version Check**:
    - **Source of Truth**: The app must use its local database as the source of truth for the device's currently installed artifact versions.
    - **On Device Connection**: When the app connects to a device in the "Prepare and Test" workflow, it must:
        1.  Read the installed version for each artifact (`ble`, `himax`, `config`) from the corresponding record in the local `devices` table.
        2.  Compare these versions against the latest versions for each artifact type available in the app's local cache (which is synced from the `firmware` table in Supabase).

- **UI**:
    - If any of the device's artifacts are out of date, an "Update Firmware" button must be enabled.

- **Implementation**:
    1.  **Safety Check**: Before starting any update, verify the device's battery is > 30% using the `battery\n` command.

    2.  **BLE Firmware Update**:
        - **Source File**: The `ble_firmware_v{version}.zip` file from the app's local cache.
        - **Enter DFU Mode**: Send `dfu\n` command. The device will disconnect its BLE connection and reboot into DFU mode. The app must handle this expected disconnection.
        - **Connect to DFU**: Scan for and connect to the device advertising the DFU service (`00001530-1212-efde-1523-785feabcd123`).
        - **Transfer**: Use `react-native-nordic-dfu` to send the locally cached `.zip` file.
        - **Verification & DB Update**: After the device reboots, reconnect to the WWUS service, send `ver\n` to confirm the new version is installed, and then update the corresponding version field in the local `devices` table.

    3.  **Himax AI Firmware Update**:
        - **Source File**: The `output_v{version}.img` file from the app's local cache.
        - **Transfer**: Transfer the `.img` file to the device via a dedicated BLE file transfer service/command. **[CP to confirm transfer mechanism, likely a new WWFT service or extending existing commands]**.
        - **Verification & DB Update**: After transfer, send `AI ver\n` to confirm the new version.

    4.  **Config File Update**:
        - **Source File**: The `config_v{version}.txt` file from the app's local cache.
        - **Transfer**: Transfer the `.txt` file to the device via BLE commands. **[CP to confirm transfer mechanism]**.
        - **Verification & DB Update**: After transfer, send `AI config_ver\n` to confirm the new version.

    5.  **Database Update**: After each successful artifact update and verification, the app must immediately update the corresponding fields in the local `devices` table:
        - BLE firmware update: Update `devices.ble_firmware_id` and `devices.ble_firmware_updated_at`
        - Himax firmware update: Update `devices.himax_firmware_id` and `devices.himax_firmware_updated_at`  
        - Config update: Update `devices.config_firmware_id` and `devices.config_firmware_updated_at`

        Additionally, record this update in the current `device_preparation` record:
        - Update `device_preparation.ble_firmware_id` (or himax/config equivalent)
        - This creates an audit trail of what was installed during this prep session

#### 3.2.5. AI Model Update
- **Overview**: The AI Model update process ensures the camera is loaded with the correct machine learning model required by its associated project. For the Beta release, this is a manual process requiring the user to load the model file onto the SD card. The app's role is to verify that the correct model is present and guide the user if an update is needed.
 
- **Version Check**:
    - **Source of Truth**: The app must use its local database as the source of truth for the device's currently installed AI model version.
    - **On Device Connection**: When the app connects to a device in the "Prepare and Test" workflow, it must:
        1.  Read the device's currently installed AI model version from the corresponding record in the local `devices` table.
        2.  Compare this version with the model required by the device's associated project (`projects.model_id`), which is synced from the `ai_models` table in Supabase.

- **UI**:
    - If the device's installed AI model does not match the project's required model, an "Update AI Model" button must be enabled.
    - Tapping this button should display instructions for the user on how to manually update the model via the SD card.

- **Implementation**:
    1.  **Manual Update Guidance**: When the "Update AI Model" button is tapped, the app will display a message guiding the user through the manual update process (e.g., "Please download the required model from [link] and place the 'Manifest.zip' file on the SD card.").
    2.  **Verification**: After the user has manually updated the SD card and re-inserted it, they can trigger a re-check in the app. The app will send a command to the device to report the version of the model now on the SD card.
        - **Command**: `AI model_ver\n` **[CP to confirm command and response format]**
        - **Success Response**: A string containing the model version, e.g., `Model Version: 1.2.3`.
    3.  **Database Update**: Once the app confirms the correct model version is present, it must update the `ai_model_id` in the local `devices` table to match the `projects.model_id`.

#### 3.2.6. LoRaWAN Verification

[There are perhaps 3 things to test: (1) Is the device known to "our" LoRaWAN server? (2) Has it completed a LoRaWAN 'join'? (3) Does it have an acceptable radio signal?
The answer to (1) could be found in the database (though how the data gets there is another matter). (2) is available in the 'status' command. (3) is available in the 'network' command . You can get the LoRaWAN device EUI from 'get deveui' - or it can be derived from the BLE address.][VA-let's jum in a call to discuss the best way to tackle #1]
- **UI Display**:
    - If `devices.device_eui` is `null`, display: "Device not registered for remote updates."
    - If populated, a **"Ping Network"** button should be visible.
- **Ping Test**:
    - Tapping the button sends a `ping\n` command via WWUS.
    - **Success Response**: After a few seconds, the device will respond with the signal strength, e.g., `RSSI=-85, SNR=7.5\n`. The app must parse and display these values.
    - **Failure Response**: If no LoRaWAN gateway is reached, the device will respond with `No response\n`.
- **Database Action**: Updates the `device_preparation.lorawan_rssi_at_check` and `device_preparation.lorawan_snr_at_check` fields in the local database.


### 3.3. Workflow Completion

- A **"Finish Preparation & Testing"** button finalizes the workflow.
- **Database Action**: Save the changes first and updates the status to completed. It does **not** delete the corresponding record from the `device_preparation` table.
- **Navigation Logic**:
    - The app must track the entry point into this workflow.
    - **If the entry point was the Start Deployment wizard**: The user is automatically navigated back to the wizard to continue the deployment with the now-prepared device.
    - **Otherwise** (from Devices list or Details): The user is returned to the **Device List Screen**.
- **Deployment Readiness**: Upon completion, this device_preparation record becomes the "deployment-ready" configuration snapshot. Any subsequent deployment created for this device will reference this preparation record via `deployments.device_preparation_id`.
---

## 4. Engineer Console

### 4.1. Initiation and Connection

1.  **BLE Scan**: Scan for devices advertising the **WWUS**.
2.  **Device Selection**: User selects a device, and the app connects over BLE.

### 4.2. Console Interface Screen
Once connected the app will display a text field at the bottom of the screen the user can use to freely interact with the device and above this text field it shoould show the outputs and messages received from the device.

## 5. Error Handling and Disconnections

- **BLE Connection Loss**: If the BLE connection is lost at any point during the workflow:
    1.  **Immediate Feedback**: Display a non-blocking notification (e.g., a toast) informing the user that the connection was lost and report a reason (e.g., "Connection lost. Device may be out of range" or "Connection lost. Device BLE timed out.").
    2.  **Abort Workflow**: The app must automatically abort the current workflow, set device_preparation status to cancelled, and navigate the user back to the start of the flow (the **Device List Screen**).
- **Command Failure**: If a WWUS command fails to produce an expected response, the app should show an error and offer a retry option.