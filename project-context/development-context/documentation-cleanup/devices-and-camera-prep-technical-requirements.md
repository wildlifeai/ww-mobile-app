# Technical Requirements: Devices & Camera Prep Workflow
[VA - my comments, responses and updates should be highlighted as diffs. If the comments are not relevant anymore, please delete, if they are please follow with the thread]

**Version**: 1.2
**Date**: November 3, 2025
**Purpose**: This document outlines the technical requirements for implementing the "Devices" section and the "Camera Preparation" workflow. 

---

## 1. General Communication & Data Model

- **Primary Interface**: All direct, real-time communication with the camera hardware is conducted over Bluetooth Low Energy (BLE).
- **Service for Normal Operations**: The app **must** use the **Wildlife Watcher UART Service (WWUS)** for all standard commands and configurations.

- **Service for Engineering Operations**: The app **must** provide an engineering console for testing non-standard commands and configurations.

    - **Service UUID**: `6e400001-b5a3-f393-e0a9-e50e24dcca9d`
- **Local Data Source**: All data displayed is a) sourced from a local mobile database, which syncs with the backend Supabase database, and b) read from the device (such as battery level, LoRaWAN signal strength)

- **Backend-Driven Updates**: LoRaWAN status updates (e.g., battery level) are sent from the device to the backend. The app receives these changes during its regular sync process. 

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
    - **Device Status**: if device_id exists in active deployment → 'deployed', else 'available'
        - If `'deployed'`, this is a link to the active **Deployment Details Screen**.
    - **Deployment History**: A list queried from the `deployments` table where `deployments.device_id` matches.
- **Core Action**: If `devices.status` is `'available'`, a **"Prepare and Test"** button is displayed, which starts the Prepare and Test Nearby Devices.


---

## 3. Prepare and Test Nearby Devices

This workflow is for checking, configuring, and updating a camera before deployment. 
- **Intended Location**: This workflow is primarily designed to be performed indoors (e.g., in an office or lab) before taking the device into the field. However, it can also be initiated from the "Start Deployment" wizard if initial device checks fail, allowing for on-the-spot troubleshooting and preparation.

[It occurs to me that some of the operations in this section are best done in the office and others are best doen in the field. Or at any rate, repeated in the field. The latter include taking test photo(s) and checking LoRaWAN connectivity.][VA - Yes, I agree these operations are not a must, the user can perform them in the office if wanted. I still think it's valuable to check the previews of the photos in the office and test the lorawan as a reassurance there is nothing wrong with the device]

### 3.1. Initiation and Connection

1.  **BLE Scan**: Scan for devices advertising the **WWUS**.
2.  **Device Selection**: User selects a device, and the app connects over BLE.
3.  **Pre-condition Checks**: The app queries the db to check if it is deployed or not. If the device is deployed, notify the user, block the workflow, and suggest they "End Deployment" before proceeding. The app then sends a "selftest" message to the device. The device returns a hex number as 'Error bits = 0x0000' - bit mask to follow or a zero if no errors. The app displays the fail message with a) "Accept" and b) "Cancel" buttons that a) let the user continue with the "Preapare and Test" wokflow or b) redirects the user to the "Devices" navigation tab. For context, the device has an internal self-test at power-on (e.g. battery insertion), if it fails, the failure messages stored in the device following a bit-mask (set bits to indicate failure of different tests).  
[It is not clear to me that the device needs to know whether it is 'deployed' or not - this seems an admin-level state rather than a device-level state. The app might change its behaviour based on a query of the database, rather than a query of the device. If you thought it appropriate we could add a new "operational parameter" to the existing list - these values are placed in the CONFIG.TXT file and can be both read and written by the app. But my gut feeling is that this is not the way to deal with this.][VA - Yes, I tried to cover those cases when a deployed device runs out of batteries and doesn't have LoRaWAN comms but it makes sense to rely on the db for this. If the device is still recorded as deployed in the db and the user wants to run this "Prepare and Test" flow they first need to stop the deployment.]

### 3.2. Prepare and Test Nearby Devices Screen

#### 3.2.1. Project Association

- **Project Selection**: The UI must display the device's currently associated project (from `devices.project_id`). The user must be able to change this association at any time by selecting from a list of projects they are a member or administrator of.
- **New Device Workflow**: If `devices.project_id` is `null`, the user **must** be required to select a project before the "Finish Preparation & Testing" button is enabled, a warning message asking the user to select a project should be displayed.
- **Empty State**: If the user is not associated with any projects, a "Create Project" button must be displayed instead of a project list. Tapping this button initiates the "Create Project Workflow" (defined elsewhere in project documentation).
- **Database Action**: This selection updates the `devices.project_id` field in the local database.

#### 3.2.2. Real-time Status Checks

- The app must fetch and display the following using WWUS commands:
    - **Battery Level**:
        - **Command**: `battery\n`
        - **Success Response**: A string like `Battery = 5482mV 73%`. The app must parse the percentage value.
        
    - **SD Card Status**:
        - **Command**: `AI sdstatus\n`
        - **Success Response**: A string detailing card status, e.g., `SD card found, 11 images\n`. The app should parse and display this information.
        - **Failure Response**: A string indicating an issue, e.g., `No SD card\n`. The app must handle this by disabling SD-card-dependent actions like the Camera View Test.

        [There are a number of SD card commands already implemented, including 'AI info' which returns an SD card volume label (can be empty string), serial number, bytes used, byte available. The  current file system commands are [here](https://github.com/wildlifeai/Seeed_Grove_Vision_AI_Module_V2/blob/effd4626f493b10f009c59180d08955cb0206953/EPII_CM55M_APP_S/app/ww_projects/ww500_md/CLI-FATFS-commands.c#L623) It is non-trivial to request the number of image files on the disk - there is an intention to write files to multiple directories (I can explain why) so not so easy to simply count them. At present there is an 'image file number' available as one of the Operational Parameters - which increments with every image saved. Would that do? Maybe we should chat about this.][VA - Yes, the image file number will work as long as this number gets reset every new deployment. The points here are for users to have a confirmation that 1) there is an sd card inserted and readable in the device and 2) there is enough space in the card for new photos. Please try to update the success response and failure response process if possible.]

#### 3.2.3. Camera View Test

- **Implementation**:
    1.  Send `AI capture 1\n`.
        - **Success Response**: `File created: <filename>\n` (e.g., `temp_pic.jpg`).
        - **Failure Response**: `No SD card\n` or `ERROR: Snap failed\n`. The app must handle this gracefully.
        [The 'snap' is replaced with 'capture' which takes 2 parameters - number of pics to take an interval in ms between them.][VA - 'AI capture 1' should do right?]
    2.  On success, receive the filename and then send `AI txfile .`.
    3.  Reassemble the image from 244-byte chunks.
    4.  Display the image.
    5.  Send `AI rm <filename>\n` to clean up.
        - **Success Response**: [PB to confirm] Assumed to be a confirmation like `File removed: <filename>\n`.
        - **Failure Response**: [PB to confirm] Assumed to be an error string like `ERROR: File not found\n`.
        [I have not implemented a file delete function (yet) and I'd prefer to not have to unless there is a compelling reason. It looks like this would require [unlink](https://elm-chan.org/fsw/ff/doc/unlink.html). Discuss if you want to make the case.][VA- The main idea behind removing the test photos was to facilitate the annotation process. Ideally, the photos in the sd card should be from the deployment not from tests. I guess, we could have "Test" and "Deployment" folders? Also, each photo should have embeded the deployment id information, as EXIF. The software used for annotating the images, AddaxAI or Wildlife Insights, will read the deployment id from the images directly and get the deployment information from our db. If we have test photos, should we add a NA for deployment id?]

#### 3.2.4. Firmware Update (DFU)

- **Implementation**:
    1.  **Version Check**: Compare device version (from WWUS) with records in the local `firmware` table.
    [I don't know what is in your database. At present files have a name like 'WildlifeWatcher_1_ww500_c01_nus_000808.zip' where  'WildlifeWatcher_1' is the name of the app, 'ww500_c01' is the name of the hardware and model (sort of included in the 'ver' command), 'nus' or 'wwus' is the BLE service used, 000808 is the firmware version 0.8.8 - so you could check the file name against the string prodiced by 'ver' - I could chnage either the format of teh file name or the output of the 'ver' command to make this comparision simpler/more consistent, if you ask. ] [VA- I started a different md with Tobyn to capture how the artifacts (firmware, models and config files) are generated and tracked. Once the process is agreed upon, we will review and update this section]

    [The DFU process is quite robust in terms of checks like this, so you could rely on error messages from the DFU process to capture gross errors like checksums.][VA-I removed this step as the mobile app syncs and downloads locally the latest firmware versions every time the app starts]

    2.  **Safety Checks**: Verify battery > 30% via WWUS.
    3.  **Enter DFU Mode**: Send `dfu\n` command. The device will not send a text response; it will disconnect its BLE connection and reboot into DFU mode. The app must handle this expected disconnection and connect to the device as a DFU device.
    [The switch to DFU mode happens after the disconnect. At that point the device starts advertsing as a DFU device. Red & Blue LEDs turn on. If the process does not start after (I think) 2 minutes then the device reboots as a WW500. It does not start advertising.][VA- CP, please edit the explanation for the app on what it needs to do to enter the DFU mode if needed.]
    5.  **Transfer**: Use `react-native-nordic-dfu` to send the `.zip` to the DFU Service (`00001530-1212-efde-1523-785feabcd123`).
    6.  **Verification & DB Update**: After reboot, reconnect to WWUS, verify the version, and update `devices.firmware_version` in the local DB.

#### 3.2.5. AI Model Update

- **Check**: The app queries the device for its currently installed AI model ( via an `AI model_info\n` command) and compares its version/ID with the model associated with the currently selected project (`projects.model_id`).
[Should there be an app command to interrogate the AI processor for its model name/version/id etc? If so, what is the syntax and the respionse string? IMHO you should compare what is actually in the device with what the database or manifest file or whatever says should be in the device.][VA-The artifacts .md file should cover this. We will update this section once an approach is agreed.]
- **Action**: If they differ, enable the "Update AI Model" button.
- **Implementation**:
    1.  Download the model file from `ai_models.storage_path`.
    2.  Transfer the file to the camera via BLE.
        - **[PB to confirm]** The specific WWUS command for initiating an AI model transfer needs to be defined.
        [In the short/mid term the model and any of its metadata will have to be on a file on the SD card, as app-device file transfer is some time off...][VA- copied that. We could ask Tobyn for a workaround on this one.]
    3.  **Database Action**: On success, update the `ai_model_id` in the `device_preparation` table for this device to match the `projects.model_id`. This ensures the correct model is recorded when a new deployment is created.

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
    - The result is for immediate feedback and is not persisted in the database.


### 3.3. Workflow Completion

- A **"Finish Preparation & Testing"** button finalizes the workflow.
[Is there a corresponding 'Start Preparation' button?][VA-Yes, I clarified that under the devices list there should be two buttons. One to start the preparation and test and for engineering purposed]
- **Database Action**: Save the changes first and then delete the corresponding record from the `device_preparation` table.
- **Navigation Logic**:
    - The app must track the entry point into this workflow.
    - **If the entry point was the Start Deployment wizard**: The user is automatically navigated back to the wizard to continue the deployment with the now-prepared device.
    - **Otherwise** (from Devices list or Details): The user is returned to the **Device List Screen**.

---

## 4. Engineer Console

### 4.1. Initiation and Connection

1.  **BLE Scan**: Scan for devices advertising the **WWUS**.
2.  **Device Selection**: User selects a device, and the app connects over BLE.

### 4.2. Console Interface Screen
Once connected the app will display a text field at the bottom of the screen the user can use to freely interact with the device and above this text field it shoould show the outputs and messages received from the device.

## 5. Error Handling and Disconnections

- **BLE Connection Loss**: If the BLE connection is lost at any point during the workflow:
    1.  **Immediate Feedback**: Display a non-blocking notification (e.g., a toast or banner) informing the user that the connection was lost.
    2.  **User Prompt**: Present a modal dialog with two options:
        - **"I have pressed the device button, retry connection"**: Dismisses the dialog and resumes the process if possible, if not start a new flow.
        - **"Cancel"**: Aborts the workflow, discards any unsaved changes, and deletes the record from the `device_preparation` table to revert the device's status to `'available'`. The user is then navigated back to the **Device List Screen**.
- **Command Failure**: If a WWUS command fails to produce an expected response, the app should show an error and offer a retry option.
[I expect that there are normally only 3 ways for the connection to be lost: the device and app go out of radio range, or the device drops the connection after 1 minute of inactivity, or the app deliberately drops the connection (one way to do this is to send 'dis' command). Timeout could be prevented by the app sending traffic. In any case the device won't re-advertise unless and until the button is pressed. You might want to associate the app "Scanning" screen with an instruction to press the button.][VA-Yes, good points. I have updated the option to retry to reconnect and there is already captured the need to show how to press the button in the WW to advertise BLE]
