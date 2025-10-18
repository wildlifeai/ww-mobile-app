# Device Firmware Update (DFU) Workflow Specification

**Version**: 1.0
**Date**: October 18, 2025
**Status**: For Implementation

---

## 1. Overview

This document specifies the end-to-end process for updating the firmware on a Wildlife Watcher camera device using the mobile app. The process uses the Nordic DFU (Device Firmware Update) protocol over Bluetooth Low Energy (BLE).

The primary goal is to provide a safe, reliable, and user-friendly way to keep camera hardware up-to-date with the latest features and bug fixes, even in field conditions.

## 2. Pre-Update Checks & User Interaction

The DFU process is initiated from the "Prepare and Test Nearby Devices" screen. Before the update can begin, several conditions must be met.

1.  **Update Availability**:
    *   The app checks the installed firmware version against the latest version available in the Supabase `firmware` repository.
    *   If an update is available, an "Update Firmware" button is enabled.

2.  **Firmware Download**:
    *   When the user taps "Update Firmware", the app first checks if the required firmware version is already stored locally on the device.
    *   **If not found locally**: The app downloads the new firmware `.zip` package from Supabase Storage. After a successful download, it is saved locally for future use.
    *   A progress indicator is shown during the download. If the download fails, the user is notified and can retry.
    *   The app must verify the checksum of the downloaded file (or the locally cached file) to ensure its integrity before proceeding with the update.

3.  **Safety Pre-Checks**:
    *   Before starting the transfer, the app performs a series of automated checks by communicating with the camera over BLE:
        *   **Battery Level**: Must be > 30%. If not, the app displays a warning: "Battery too low. Please charge the device to at least 30% before updating."
        *   **Deployment Status**: The device must **not** be part of an active deployment. If it is, the update is blocked.
        *   **BLE Connection**: A stable BLE connection is required.

4.  **User Confirmation**:
    *   After all checks pass, the app displays a final confirmation dialog:
        > **"Ready to Update Firmware"**
        > "This will update the camera from version `v1.4.6` to `v1.5.0`. The process will take about 2-3 minutes. Keep your phone near the camera and do not close the app."
        > `[Cancel]` `[Start Update]`

## 3. The DFU Process

This process is handled by the `react-native-nordic-dfu` library.

1.  **Initiation**: Upon user confirmation, the app sends a command to the camera to enter DFU mode. The camera will restart into a special bootloader mode and begin advertising a new DFU-specific BLE service.

2.  **Connection**: The app disconnects from the standard camera service and reconnects to the new DFU service.

3.  **File Transfer**: The app begins transferring the firmware `.zip` package to the camera in chunks.
    *   **UI Feedback**: The screen must display a clear progress indicator throughout this process, showing:
        *   The current state (e.g., "Uploading...", "Validating...").
        *   A percentage of completion (e.g., "45%").
        *   An estimated time remaining.

4.  **Validation & Activation**:
    *   Once the transfer is complete, the camera's bootloader validates the integrity of the new firmware.
    *   If valid, it installs the update and restarts the camera into its normal operating mode.

## 4. Post-Update

1.  **Reconnection**: The app waits for the camera to restart and begin advertising its standard BLE service. It then automatically reconnects.

2.  **Verification**: After reconnecting, the app reads the firmware version from the camera again to confirm that the new version is installed.

3.  **User Notification**:
    *   **On Success**: A success message is displayed: "Update Complete! Camera is now running firmware `v1.5.0`."
    *   **On Failure**: A descriptive error message is shown (e.g., "Update failed: Connection lost," "Update failed: Invalid firmware file."). The user is given the option to retry.

4.  **Database Update**: The app updates the `firmware_version` field for the device in the local database and queues the change for synchronization with the Supabase backend.

---

## 5. Error Handling

The workflow must gracefully handle potential failures at any step:
*   **Download Failure**: Retry option.
*   **Pre-check Failure**: Clear, actionable user message.
*   **Connection Loss during DFU**: The Nordic DFU library provides error codes. The app should attempt to reconnect and resume if possible, or prompt the user to retry.
*   **Validation Failure**: The camera's bootloader will reject the firmware. The app should notify the user and suggest downloading the file again.

---