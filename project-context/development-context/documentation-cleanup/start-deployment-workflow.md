# Start Deployment Workflow Specification

**Version**: 1.0
**Date**: January 17, 2025
**Status**: For Implementation

---

## 1. Overview

This document specifies the user interface, interactions, and logic for the "Start Deployment" wizard. This workflow is initiated from the "Start Deployment" button on the **Maps screen** or **Deployments screen**. It guides a user through deploying a camera trap in the field, prioritizing physical camera setup and location viability before metadata entry. The wizard is designed to be robust and work completely offline.

## 2. The 6-Step Wizard

The user progresses through six distinct steps. They can navigate back to previous steps to make corrections before final submission.

### Step 1: Device Selection & Pairing

*   **Interface**:
    *   A list of nearby Bluetooth devices, similar to the "Prepare and Test" workflow.
    *   The list shows device name, signal strength, and battery level.
*   **Logic**:
    *   The user must select an available (not already deployed) camera to begin the deployment process.
    
### Step 2: Connectivity Setup
*   **Interface**:
    *   A brief message explaining the benefits of a connected camera (e.g., receiving status updates on battery and SD card space).
    *   A choice for the user:
        *   "Enable LoRaWAN Connectivity" (selected by default).
        *   "No Connectivity (Offline Only)".
    *   If LoRaWAN is enabled, a "Test Reception" button is visible.
*   **Logic**:
    *   If the user selects "No Connectivity", the camera will be configured to not use its LoRaWAN module, and the user proceeds to the next step.
    *   If "Enable LoRaWAN Connectivity" is selected, the user needs to tap "Test Reception" to test the signal. Tapping "Test Reception" sends a command to the camera to transmit a test signal, and the app displays the signal strength (RSSI, SNR). This helps the user find an optimal physical location for the camera.
    *   The "Test Reception" button will be disabled if the device has not been registered for LoRaWAN during the "Prepare and Test" workflow. A message will prompt the user to complete that step first.
    *   The user can proceed without testing, but a small warning will appear if they do: "Without testing, the device may not be able to send status updates from the field. Proceed anyway?"

### Step 3: Camera View & Adjustment

*   **Interface**:
    *   A test photo preview from the connected camera.
    *   A "Take Test Photo" button to capture a new image.
*   **Logic**:
    *   This step allows the user to physically adjust the camera's position and field of view.
    *   The user can take multiple test photos until they are satisfied with the camera's placement. Once happy, they proceed to the next step.
    *   **Note**: Photo files captured during this step are for test photos only and should be stored temporarily. They must be deleted from the app's local storage and device sd card after the user navigates away from this screen to conserve space.

### Step 4: Location

*   **Interface**:
    *   A display of nn interactive map view.
    *   **GPS Coordinates**: Latitude and Longitude fields.
    *   **Site Name/Address**: A text field for a human-readable location name.
    *   **Location Description**: An optional free-text area for notes (e.g., "Under a big tree close to the radio tower," "10 meters north of the stream crossing").
    *   A "Use My Current Location" button.
    *   A "Take Photo of Deployed Camera" button that opens the phone's native camera.
*   **Logic**:
    *   On screen entry, the app attempts to get the device's current GPS coordinates.
    *   Tapping "Use My Current Location" re-acquires the GPS fix.
    *   Users can manually drag a pin on the map to set the coordinates or type them in.
    *   The photo of the Setup is taken with the **user's mobile phone**, not the wildlife camera.
    *   Its purpose is to help researchers locate the physical camera upon return. The photo is stored with the deployment record offline first and on supabase when available online.

### Step 5: Deployment Details

*   **Interface**:
    *   **Deployment Name**: A text input, pre-filled with a suggestion (e.g., "Deployment #[auto-number]").
    *   **Project Selector**: A list or dropdown to select the project this deployment belongs to. A "Create New Project" button is available.
    *   **Start Date & Time**: Date and time pickers, pre-filled with the current date and time.
    *   **Capture Method**: A choice (radio buttons) between "Motion Detection" and "Time-lapse".
    *   **Time-lapse Interval**: If "Time-lapse" is selected, a dropdown or picker appears for setting the interval (e.g., 30s, 1min, 5min, 1hr).
    *   **Motion Sensitivity**: A slider or choice (e.g., Low, Medium, High).
    *   **Enable ML Model**: A toggle switch, enabled by default.
*   **Logic**:
    *   The user must select a project to proceed.
    *   **Project Pre-selection**: If the device was configured for a specific project in the "Prepare and Test" workflow, that project will be pre-selected here. Any project-specific settings (like the AI Model) are already configured on the camera.
    *   **Project Change**: If the user selects a different project, the app will update all project-related settings on the camera in the final step of this wizard.
    *   All fields are required.
    *   **AI Model**: The user can manually enable or disable the ML model for the deployment. The model used is the one assigned to the selected project.
        - If the ML model is enabled but LoRaWAN connectivity was disabled in Step 2, the app must display a warning: "The camera will still identify animals on-device, but detection alerts won't be sent remotely because LoRaWAN is disabled."
        - Enabling the ML model with LoRaWAN connectivity also enables notifications for the deployment.
    *   The UI adapts based on the capture method selected. The `Time-lapse Interval` is only shown if "Time-lapse" was chosen.
    *   These settings will be sent to the camera via **WWUS** in the final step.

### Step 6: Confirmation & Submit

*   **Interface**:
    *   A read-only summary of all data entered in the previous steps.
    *   Each section (Location, Device, etc.) is collapsible.
    *   A prominent "Submit Deployment" button.
*   **Logic**:
    *   Tapping "Submit Deployment" performs the final actions:
        1.  A `deployment` record is created in the local SQLite database.
        2.  The record is added to the `offline_queue` for syncing.
        3.  The selected `device`'s status is updated to "in-use" locally.
        4.  The app sends the final configuration (sampling design, etc.) to the camera via **WWUS**.
        5.  Upon successful **WWUS** communication, the user is shown a "Deployment Successful" screen and navigated away.
        6.  If **WWUS** communication fails, the user is notified, and the local deployment record is marked as "pending hardware config" to be retried later.

---
