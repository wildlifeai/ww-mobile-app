# Device Preparation Quick Start

## What is Device Preparation?

Device preparation configures your Wildlife Watcher camera for field deployment. It ensures the device has:
- ✅ **Connect** via Bluetooth
- ✅ **Track actual time and date**
- ✅ **Updated** with the latest firmware
- ✅ **Associated with a Project** 
- ✅ **Battery, SD Card, and Camera View Tested**


## Prerequisites

- [ ] Mobile app installed and logged in
- [ ] Project created in the app
- [ ] Device within Bluetooth range

## Step-by-Step Guide

### 1. Navigate to Device Preparation

1. Open the **Wildlife Watcher** app.
2. Go to the **Devices** tab.
3. Select the **"Prepare & Test"** option.
4. Tap on a device to pair.

> **Note**: If the device has an active deployment, you must end it before preparing.

### 2. Connect & Initialize

On connection, the app executes a three-phase automated sequence to ensure the device is in a known-good state.

#### Phase A: Standard Initialization
*Triggered by a single `setutc` command.*

| Step | Action | Purpose |
|------|--------|--------|
| 1 | **Time Sync** | Aligns device clock with current UTC time. |
| 2 | **System Wake** | Device auto-wakes Himax processor to process time sync. |
| 3 | **Stabilization** | App waits for `RTC set to` confirmation (10s timeout). |
| 4 | **Health Check** | Decodes `Error bits` for hardware status warnings. |

> [!NOTE]
> This foundation sequence runs on **all** main connection flows (Prepare, Start, and End Deployment) for consistency.

#### Phase B: Screen-Specific Setup
*The app resets the environment for a fresh preparation flow.*

*   **Camera Lock**: `setop 10 0` (Prevents accidental triggers during setup).
*   **GPS Zeroing**: Resets coordinates to default `0,0`.
*   **ID Cleanup**: Clears OPs 20–27 to remove any stale deployment markers.

#### Phase C: Automated Diagnostics
*Once initialized, the app automatically pulls current metrics:*

*   🔋 **Battery Level**: Verifies power status (30% threshold).
*   💾 **SD Card**: Checks local storage health and available space.
*   🏷️ **Firmware**: Confirms version compatibility.



### 3. Project Association (Required)

**Action**: Select the **Project** this device will be deployed for.

This determines the camera's capture behavior:
- **Motion Detection**: Camera sleeps and triggers only on movement.
- **Timelapse**: Camera wakes at set intervals to take photos.

> **Note**: You cannot finish preparation without selecting a project.

### 4. System Checks

Interactive checks you can run:

1. **Battery Level**: Tap **Check Battery Level**.
   - *Recommendation*: Charge fully before deployment.

2. **SD Card Status**: Tap **Check SD Card**.
   - *Requirement*: Card must be detected and have free space.

### 5. Firmware Update (If Available)

If a new BLE firmware version is available:

1. **Check Version**: The app auto-checks on connect.
2. **Update**: Tap **Update BLE Firmware** if available.
   - *Warning*: Low battery (<30%) shows a warning but doesn't block.
   - *Process*: Takes 2-3 minutes. Do not close the app.
   - *Connection*: Device disconnects during DFU (this is normal).

### 6. Camera View Test

Verify the camera lens is working:

1. Point the camera at a subject.
2. Tap **Test Camera View**.
3. The device captures a low-res preview image.
4. Verify the image and field of view are clear.

> **Note**: Requires SD card check to pass first.

### 7. Finish Preparation

Once all checks pass, tap **"Finish Preparation & Testing"**. The app runs a **Safe Quiesce Sequence** to ensure the device is in a known good state for transport:

1.  **Set Deployment ID**: `setop 20 <deployment_id>`, `setop 21 <deployment_id>` ... `setop 27 <deployment_id>`
2.  **Confirm**: Green LED flashes
3.  **Disconnect**: Clean BLE disconnect `dis`

### Success State

You will see: **"Device ready to be deployed"**.

The device's green LED flashes twice to confirm preparation is complete. The device is now safe to transport to the deployment site.

---

## Technical Flow Reference

### On Mount (The Three-Phase Flow)

The app uses the **`useBleInitialization` hook** and screen logic to drive the startup sequence:

#### Phase A: Standard Initialization (useBleInitialization)
| Step | Action | Technical Details |
|------|--------|------------------|
| 1 | **Set UTC** | Sends `setutc <timestamp>` immediately. |
| 2 | **Confirmation** | Manager matching: `RTC set to` (Regex). |
| 3 | **Health Check** | Manager matching: `Error bits = 0xXXXX` (3s timeout). |

**Why Standardized?**
- **Single Trigger**: `setutc` is the only command sent; firmware handles the rest.
- **Reliability**: Manager handles request-response correlation to avoid races.
- **Consistency**: Used in Prepare, Start Deployment, and End Deployment.

#### Phase B: Preparation Setup (PrepareAndTestScreen)
*Executed linearly after Phase A succeeds:*
1. **Disable Camera**: `AI setop 10 0` (via `disableCamera`).
2. **Reset GPS**: `setgps 0°0'0.00"_N_0°0'0.00"_E...` (via `clearGpsLocation`).
3. **Clear IDs**: `AI setop 20 0` through `27 0` (via `setDeploymentIdAsOps(null)`).

#### Phase C: Automated Diagnostics
*Triggered concurrently at the end of setup:*
1. **Battery Level**: Calls `getBatteryLevel` -> Parses `Battery = ...%`.
2. **SD Card Info**: Calls `checkSdCard` (AI info) -> Parses space.
3. **Firmware Check**: Calls `getDeviceVer` (ver) -> Parses string.



### User Actions
| Action | Command | Result |
|--------|---------|--------|
| Check Battery | `battery` | Parses `Battery = XXXXmV YY%` |
| Check SD Card | `AI info` | Parses total/available space |
| Check Firmware | `ver` | Parses `WW500-A00 V XX.YY.ZZ` |
| Update Firmware | `dfu` | reboots into Bootloader mode |
| Camera Test | `AI capture 1 0` | Image data via notifications + `txfile` |

### On Finish (Safe Quiesce Sequence)

When tapping **"Finish Preparation"**, the app executes this hardware-first sequence:

| Step | Action | Detail |
|------|--------|--------|
| 1 | **Set ID** | `AI setop 20 <val>` ... `27 <val>` (Stores Preparation ID) |
| 2 | **Confirm** | `flashg 2 500` (Green LED double flash) |
| 3 | **Disconnect** | `dis` (Graceful BLE closure) |



## Troubleshooting

### "SD Card Check Failed"
- **Cause**: Card not inserted, wrong format, or damaged.
- **Fix**: Re-insert card, format to FAT32, or try a different card.

### "Project Required"
- **Cause**: Attempted to finish without selecting a project.
- **Fix**: Select a project from the dropdown.

### "Device Already Deployed"
- **Cause**: Device has an active deployment.
- **Fix**: End the current deployment before preparing.

### "Connection Lost" during DFU
- **Note**: This is expected! The device disconnects during firmware updates.
- **Wait**: The app handles reconnection after DFU completes.

### "Command Timeout" (App Error)
- **Cause**: Low signal or momentary I2C bus congestion on the device.
- **Fix**: The app has built-in **Command Reliability** logic to catch fast responses. If it persists, try reconnecting or moving closer to the device.

## What's Next?

Once your device is prepared and ready, proceed to the deployment guide:

➡️ **[Go to Deployment Flow Guide](./03-DEPLOYMENT-FLOW.md)**
