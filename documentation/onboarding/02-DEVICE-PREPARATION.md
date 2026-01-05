# Device Preparation Quick Start

## What is Device Preparation?

Device preparation configures your Wildlife Watcher camera for field deployment. It ensures the device is:
- ✅ **Connected** via Bluetooth
- ✅ **Initialized** (selftest, time sync, clear old deployment)
- ✅ **Updated** with the latest firmware
- ✅ **Configured** for your specific Project (Motion vs Timelapse)
- ✅ **Tested** (Battery, SD Card, Camera View)
- ✅ **Ready** for deployment

## Prerequisites

- [ ] Charged Wildlife Watcher device (>30% battery recommended)
- [ ] SD card inserted
- [ ] Mobile app installed and logged in
- [ ] Project created in the app
- [ ] Device within Bluetooth range

## Step-by-Step Guide

### 1. Navigate to Device Preparation

1. Open the **Wildlife Watcher** app.
2. Go to the **Devices** tab.
3. Tap on a device card (or scan for a new one).
4. Select the **"Prepare & Test"** option.

> **Note**: If the device has an active deployment, you must end it before preparing.

### 2. Connect & Initialize

The app connects and automatically runs initialization commands:

| Command | Purpose |
|---------|---------|
| `disable_camera` | Ensures camera is off during preparation |
| `selftest` | Internal hardware check (non-blocking alert if fails) |
| `setutc` | Syncs device RTC to current UTC time |
| `setop 20 0` (test) | Checks if firmware supports extended OPs |

> **Initialization Warnings**: Any selftest or time sync failures appear as non-blocking warnings. You can still proceed with preparation.

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
4. Verify the image is clear.

> **Note**: Requires SD card check to pass first.

### 7. Finish Preparation

Once all checks pass, tap **"Finish Preparation & Testing"**. The app will:

1. **Sync time**: `setutc` (final time sync)
2. **Configure capture method**: 
   - Motion: `setop 11 1000` (1s interval), `setop 7 0` (disable timelapse)
   - Timelapse: `setop 7 <interval>`, `setop 11 0` (disable motion)
3. **Disable camera**: `disable_camera` (saves battery during transport)
4. **Confirm with LED**: Green LED flashes 2x
5. **Disconnect**: Clean BLE disconnect

### Success State

You will see: **"Device ready to be deployed"**.

The device's green LED flashes twice to confirm preparation is complete. The device is now safe to transport to the deployment site.

---

## Technical Flow Reference

### On Mount (Automatic)

The app executes these commands **sequentially** with optimized timing:

| Step | Command | Purpose | Timing Note |
|------|---------|---------|-------------|
| 0    | `disable_camera` | Clean state, wake AI processor | Wakes device from DPD |
| 0a   | *Wait 1000ms* | Stabilization delay | AI processor fully awake |
| 1    | `selftest` | Hardware check | Device now responsive |
| 2    | `setutc <timestamp>` | Time sync | - |
| 3    | `setop 11 0`, `setop 7 0`, `setop 10 0` | Quiesce Device | 500ms delay between commands to ensure processing |
| 4    | **DPD Latch Cycle** | Latch Config | Wait 2.5s -> OP 19 -> Wait 1.5s |
| 5    | `setDeploymentIdAsOps(null)` | Clear old deployment ID | 600ms wake delay, 150ms inter-command delay |
| 6    | `clearGpsLocation` | Clear GPS (`0 0 0`) | - |

> **Why Sequential?** The firmware has a single-slot command buffer. Rapid commands during device wake-up get discarded. See [BLE Architecture Guide](../app-technical-guides/ble-architecture-guide.md#ble-timing-requirements--firmware-constraints) for details.

### User Actions
| Action | Command |
|--------|---------|
| Check Battery | `battery` → Parses `Battery = XXXXmV YY%` |
| Check SD Card | `AI info` → Parses total/available space |
| Check Firmware | `ver` → Parses `WW500-A00 V XX.YY.ZZ` |
| Update Firmware | `dfu` → DFU mode → Nordic DFU process |
| Camera Test | `capture 1 0` → Image data via BLE notifications |

### On Finish (Automatic)

| Step | Command | Notes |
|------|---------|-------|
| 1 | `setutc <timestamp>` | Final time sync |
| 2a | Motion Detection: `setop 11 1000`, `setop 7 0` | Enable motion, disable timelapse |
| 2b | Timelapse: `setop 7 <interval>`, `setop 11 0` | Enable timelapse, disable motion |
| 3 | `disable_camera` | Saves battery during transport |
| 4 | `flashg 2 500` | Green LED 2x confirmation |
| 5 | `dis` | Graceful disconnect |

> **GPS Format**: Commands use unquoted space-separated values, e.g., `setgps 0 0 0` to clear.

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

## What's Next?

Once your device is prepared and ready, proceed to the deployment guide:

➡️ **[Go to Deployment Flow Guide](./03-DEPLOYMENT-FLOW.md)**
