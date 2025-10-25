# Wildlife Watcher App: BLE & LoRaWAN Communication Guide

**Version**: 1.0
**Date**: October 18, 2025
**Status**: For Implementation
**Purpose**: To provide a unified technical guide for mobile app developers on all device communication protocols, including Bluetooth Low Energy (BLE) and LoRaWAN. 

---

## 1. Overview

The Wildlife Watcher camera hardware (WW500 series) contains two main processors:

1.  **BLE Processor (nRF52832)**: The "communications computer." It handles all Bluetooth connections with the mobile app. It runs two distinct modes:
    *   **Application Mode**: For normal day-to-day operations.
    *   **Bootloader Mode**: Exclusively for receiving firmware updates for itself.
2.  **AI Processor**: The "brains" of the camera. It controls the camera, runs AI models, and manages the SD card. It does **not** talk directly to the mobile app.

The two processors communicate internally over an I2C bus. The mobile app only ever talks directly to the **BLE Processor**.

### 1.1. Command & Control Flow

The mobile app sends text-based commands to the BLE Processor via the WWUS service. The BLE processor is responsible for interpreting these commands.

1.  **Direct Commands**: Some commands (like checking the BLE processor's version or battery status) are handled directly by the BLE Processor.
2.  **Proxied Commands**: Commands intended for the AI Processor (e.g., taking a photo, checking the SD card) are prefixed with `"AI "`. The BLE Processor strips this prefix and forwards the rest of the command to the AI Processor over the internal I2C bus.

The AI Processor executes the command and sends a response back to the BLE Processor, which then relays it to the mobile app.

```mermaid
graph TD
    A[Mobile App] -- WWUS Command --> B(BLE Processor);
    B -- Direct Command --> B;
    B -- "AI Command" --> C{AI Processor};
    C -- I2C Response --> B;
    B -- WWUS Response --> A;
```

---

## 2. Bluetooth Low Energy (BLE) Services

The mobile app must handle two completely separate BLE services.

### 2.1. WWUS (Wildlife Watcher UART Service) - Normal Operations

This is the service used for **99% of interactions**, such as checking battery, taking photos, and configuring the device.

*   **When it's active**: During the camera's normal application mode.
*   **Purpose**: Sending text-based commands and receiving text-based responses.
*   **Service UUID**: `6e400001-b5a3-f393-e0a9-e50e24dcca9d`
*   **Characteristics**:
    *   **Write (TX)**: `6e400002-b5a3-f393-e0a9-e50e24dcca9d` (Send commands to camera)
    *   **Read (RX)**: `6e400003-b5a3-f393-e0a9-e50e24dcca9d` (Receive responses from camera)

**Command Example**:
To check the battery, the app sends the string `"battery\n"` to the Write characteristic. The camera responds with something like `"Battery = 85%\n"` on the Read characteristic.

#### 2.1.1. How to Take and Display a Test Photo

This is a multi-step process involving both processors and demonstrating the proxied command architecture.

1.  **App Action**: The user taps the "Take Test Photo" button in the app.
2.  **App Sends Command**: The app sends the command string `"AI snap\n"` to the BLE Processor via the WWUS Write characteristic.
3.  **BLE Processor Proxies**: The BLE Processor sees the `"AI "` prefix, strips it, and sends the command `"snap"` to the AI Processor over I2C.
4.  **AI Processor Acts**: The AI Processor instructs the camera module to take a picture and save it to a temporary file on the SD card (e.g., `temp_pic.jpg`).
5.  **AI Processor Responds**: The AI Processor sends a response back to the BLE Processor, like `"File created: temp_pic.jpg"`. The BLE processor forwards this to the app.
6.  **App Requests File**: The app receives the confirmation and filename. It then sends a new command: `"AI read temp_pic.jpg\n"`.
7.  **File Transfer**: The AI Processor reads the JPEG file from the SD card and sends it to the BLE Processor in chunks of 244 bytes. The BLE Processor forwards each chunk to the app. The app must reassemble these chunks into a complete file.
8.  **App Displays Image**: Once the file transfer is complete, the app displays the reassembled JPEG image to the user.
9.  **Cleanup**: The app should send a final command like `"AI rm temp_pic.jpg\n"` to delete the temporary photo from the SD card to conserve space.

#### 2.1.2. How to Share Mobile App Data with the Camera

To share information like the current time or GPS coordinates from the phone to the camera, the app will use a similar command structure.

*   **Example (Set Time)**: The app can get the current UTC time and send it as a command:
    `"AI set_time 2025-10-18T10:00:00Z\n"`
*   **Example (Set Location)**: The app can get the current GPS coordinates and send them:
    `"AI set_gps -34.9285,138.6007\n"`

The AI Processor will parse these strings and update its internal state or use the information when creating EXIF metadata for photos.

### 2.2. DFU (Device Firmware Update) - BLE Processor Updates

This service is **only** used to update the firmware of the **BLE Processor (nRF52832)** itself. It cannot be used for anything else.

*   **When it's active**: Only after the camera has been put into DFU mode.
*   **Purpose**: Transferring a binary firmware file (`.zip`).
*   **Service UUID**: `00001530-1212-efde-1523-785feabcd123` (Nordic DFU Service)
*   **Storage**: The firmware update is for the **BLE Processor's internal flash memory**, not the SD card. The `.zip` file is transferred directly from the mobile app to the BLE Processor's bootloader.

**Workflow**:
1.  **In WWUS mode**, send the `"dfu"` command.
2.  The camera disconnects. This is expected.
3.  The camera reboots and starts advertising the DFU service.
4.  The app must scan again, find the DFU service, and connect to it.
5.  The app uses the `react-native-nordic-dfu` library to send the firmware file.
6.  The camera installs the update and reboots back into normal (WWUS) mode.

### 2.3. WWFT (Wildlife Watcher File Transfer) - Future-Proofing

To update the AI processor, transfer AI models, or download photos, a new service called **WWFT** is proposed. This service will run alongside WWUS in the normal application mode and is designed for transferring binary files.

*   **Status**: Proposed, not yet implemented in hardware.
*   **Purpose**:
    *   Update AI Processor firmware.
    *   Upload new AI models.
    *   Download photos from the SD card.
*   **Architecture**: The mobile app will send files to the BLE processor via the WWFT service, which will then forward the data to the AI processor over the internal I2C bus.

**Developer Note**: For MVP2, you only need to be concerned with **WWUS** and **DFU**. WWFT is for future planning.

## 3. LoRaWAN Integration - Long-Range Status Updates

LoRaWAN is a long-range, low-power radio system. It is completely separate from Bluetooth and is used by the camera to "phone home" with status updates when it's deployed in the field. The mobile app **does not** interact with LoRaWAN directly.

### How It Works

1.  A deployed camera periodically sends a small data packet via LoRaWAN (e.g., once per day).
2.  This packet is picked up by a LoRaWAN gateway in the area.
3.  The gateway forwards the data to the Wildlife Watcher backend server.
4.  A server-side **Edge Function** (webhook) parses the data.
5.  The backend database is updated with the new information.
6.  The mobile app receives these updates from the backend database the next time it syncs.

```mermaid
graph TD
    A[Camera in Field] -- LoRaWAN Packet --> B(LoRaWAN Gateway);
    B -- Internet --> C{Wildlife Watcher Backend};
    C -- Webhook Trigger --> D[Edge Function];
    D -- Update Record --> E[(Supabase DB)];
    F[Mobile App] <-- Syncs Data --> E;
```

### Data Received via LoRaWAN

The backend is responsible for parsing the LoRaWAN payload. The mobile app will simply see updated fields in the `deployments` and `devices` tables.

*   **Battery Level**: `devices.battery_level` (integer percentage)
*   **SD Card Usage**: `devices.sd_card_usage` (integer percentage)
*   **Last Heard From**: `devices.last_seen` (timestamp)

### Mobile App Responsibilities

- **Display Data**: Show the battery level and SD card usage in the UI (e.g., on the Devices and Deployments screens).
- **Display "Last Seen"**: Show the `last_seen` timestamp to indicate when the camera last reported in.
- **Handle Stale Data**: If `last_seen` is old (e.g., > 48 hours), display a warning icon indicating the camera may be offline or having issues.
- **No Direct Communication**: The app never tries to communicate with the camera via LoRaWAN. All data comes from the synchronized backend.

### 3.1. Device Provisioning and Registration

For a camera to use LoRaWAN, it must first be registered with a LoRaWAN Network Server (LNS), such as The Things Network (TTN) or a private Chirpstack instance. This is a one-time setup process that should be performed during the "Prepare and Test Nearby Devices" workflow in the office, not in the field.

The process is orchestrated by the mobile app but brokered by the Wildlife Watcher backend.

1.  **App Initiates Registration**: From the "Camera Workbench" screen, the user taps a "Register for LoRaWAN" button.
2.  **Backend Creates Device on LNS**: The app sends a request to the Wildlife Watcher backend. The backend then makes an API call to the LNS to register the camera's unique hardware ID (DevEUI).
3.  **Backend Receives Keys**: The LNS generates and returns a set of security keys (e.g., AppKey) for the device.
4.  **Backend Stores Keys**: The backend securely stores these keys and associates them with the device record in the database.
5.  **App Receives Keys**: The backend sends the necessary keys back to the mobile app.
6.  **App Provisions Camera**: The mobile app connects to the camera via BLE (using the WWUS service) and sends a special command to program the security keys into the camera's secure storage.
    *   **Example Command**: `"AI set_lora_keys <DevEUI> <AppKey> ...\n"`
7.  **Confirmation**: The camera confirms the keys are saved, and the app updates the UI to show the device is "Registered" for LoRaWAN.

Once registered, the device is capable of joining the LoRaWAN network and sending status updates whenever it is configured to do so during a deployment.

```mermaid
sequenceDiagram
    participant App
    participant Backend
    participant LNS
    participant Camera
    App->>Backend: Request LoRaWAN Registration for Device
    Backend->>LNS: Register Device (via API)
    LNS-->>Backend: Return Security Keys
    Backend-->>App: Send Keys to App
    App->>Camera: Send "set_lora_keys" command (via BLE)
    Camera-->>App: Confirm Keys Saved
    App->>App: Update UI to "Registered"
```

---

## 4. Summary for App Implementation

### 4.1. Device Preparation & Firmware Updates

The "Prepare and Test Nearby Devices" workflow involves connecting to a camera to check its status and update its firmware.

*   **Reference**: For a detailed breakdown of this user flow, see the `device-preparation-workflow.md` document.
*   **Communication**: This workflow uses **WWUS** for status checks and may trigger the **DFU** process for BLE processor firmware updates.

### 4.2. Normal Operations

*   **Connect to**: WWUS service (`6e40...`).
*   **Send**: Text commands like `"battery\n"`.
*   **Receive**: Text responses like `"Battery = 85%\n"`.

### 4.3. BLE Firmware Updates

*   **Trigger**: Send `"dfu"` command via WWUS.
*   **Reconnect**: Scan and connect to the DFU service (`00001530...`).
*   **Transfer**: Use the Nordic DFU library to send the `.zip` file.

### 4.4. LoRaWAN Status

*   **Source**: Read `battery_level`, `sd_card_usage`, and `last_seen` fields from the `devices` table in the local synchronized database.
*   **Action**: Display this information in the UI. Do not attempt to get it directly from the device via BLE unless the user explicitly requests a real-time check (which would use a WWUS command).

---

## 5. Key Concepts

*   **UUID**: A unique "phone number" for a Bluetooth service. Your app uses these to find and connect to the right service (WWUS vs. DFU).
*   **Service**: A collection of features offered by a BLE device.
*   **Characteristic**: A specific data point or command channel within a service.
*   **I2C Bus**: The internal "wire" connecting the BLE and AI processors. The speed of this bus can be a bottleneck for large file transfers, which is why the WWFT protocol is being carefully designed.
*   **Bootloader**: A small, protected program on the BLE processor that runs on startup. Its only job is to decide whether to run the main application or enter DFU update mode.
