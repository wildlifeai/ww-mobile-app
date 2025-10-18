# End Deployment Workflow Specification

**Version**: 1.0
**Date**: January 17, 2025
**Status**: For Implementation

---

## 1. Overview

This document specifies the user interface, interactions, and logic for the "End Deployment" workflow. This process allows a user to formally conclude a camera's monitoring session in the field, retrieve the hardware, and make the device available for a new deployment.

## 2. User Workflow

The workflow is designed to be simple and efficient for field use.

### 1. Initiation

*   **Entry Point**: The user can initiate the flow in two ways:
    1.  From the **Map Screen**: Tapping on an active deployment marker and selecting "End Deployment".
    2.  From the **Deployments List Screen**: Tapping the "End" button on an active deployment card.

### 2. Confirmation
*   **Interface**: A confirmation screen or modal appears, displaying key details of the deployment to be ended.
    *   Deployment Name
    *   Project Name
    *   Device Name
    *   Start Date
    *   Deployment Duration (calculated, e.g., "Active for 42 days").
    *   A map showing the deployment's location.
*   **Logic**: This step ensures the user is ending the correct deployment, which is especially important if multiple cameras are in close proximity.

### 3. Finalization

*   **Interface**:
    *   **End Date & Time**: Date and time pickers, pre-filled with the current date and time.
    *   **End Notes**: An optional multi-line text area for the user to add notes about the retrieval (e.g., "SD card full," "Device damaged by animal").
    *   A prominent **"Confirm End Deployment"** button.
*   **Logic**:
    *   Tapping the confirmation button performs the following actions:
        1.  The local `deployment` record is updated with the `end_date`, `end_time`, and `notes`. Its status is changed to "Ended".
        2.  The update operation is added to the `offline_queue` for syncing.
        3.  The associated `device`'s status is updated to "available" locally.
        4.  The app attempts to connect to the camera via BLE to send a "power down" or "session end" command (if supported by hardware). This is a non-critical step; the workflow succeeds even if the device is not reachable.
        5.  The user is shown a "Deployment Ended Successfully" screen which displays a summary of the device's final state:
            *   Deployment Start Date
            *   Final Battery Status
            *   Final SD Card Storage Space
        6.  The user is then navigated back to the previous screen (Map or Deployments list).

---

## 3. Offline Capability

This entire workflow is fully functional offline. All database changes are made to the local SQLite store and queued for synchronization. The optional BLE command in the final step will be skipped if the device cannot be reached, without affecting the success of the workflow.

---