# Device Preparation Quick Start

## What is Device Preparation?

Device preparation configures your Wildlife Watcher camera for field deployment. It ensures the device is:
- ✅ **Connected** via Bluetooth
- ✅ **Updated** with the latest firmware
- ✅ **Configured** for your specific Project (Motion vs Timelapse)
- ✅ **Tested** (Battery, SD Card, Camera View)
- ✅ **Ready** for deployment

## Prerequisites

- [ ] Charged Wildlife Watcher device (>30% battery)
- [ ] SD card inserted
- [ ] Mobile app installed and logged in
- [ ] Project created in the app
- [ ] Device within Bluetooth range

## Step-by-Step Guide

### 1. Navigate to Device Preparation

1. Open the **Wildlife Watcher** app.
2. Go to the **Devices** tab.
3. Tap on a device card (or scan for a new one).
4. Select the **"Engineer Device"** button (Green Wrench Icon) or **"Prepare & Test"** if available.

### 2. Connect & Initialize

The app will connect to the device. Watch for initialization warnings:
- **Time Sync**: The app automatically syncs the device time to your phone's time.
- **Selftest**: The device runs an internal self-check on boot.

### 3. Project Association (Required)

**Action**: Select the **Project** this device will be deployed for.

This step is critical as it determines the camera's behavior:
- **Motion Detection**: Camera sleeps and triggers only on movement.
- **Timelapse**: Camera wakes up at set intervals to take photos.

> **Note**: You cannot finish preparation without selecting a project.

### 4. System Checks

Unlike passive checks, you have interactive control:

1. **Battery Level**: Tap **Check Battery Level**.
   - *Requirement*: Must be >30% for firmware updates.
   - *Recommendation*: Charge fully before deployment.

2. **SD Card Status**: Tap **Check SD Card**.
   - *Requirement*: Card must be detected and have free space.
   - *Status*: The app shows % free space.

### 5. Firmware Update (If Available)

If a new BLE firmware version is available, you will see a prompt.

1. **Check Version**: Tap "Check Firmware Version" if not shown.
2. **Update**: If an update is available (and battery >30%), tap **Update BLE Firmware**.
   - *Process*: Takes 2-3 minutes. Do not close the app or move away.

### 6. Camera View Test

Verify the camera lens is working and positioned correctly.

1. Point the camera at a subject.
2. Tap **Test Camera View**.
3. The device will capture a low-res preview image and send it to your phone.
4. Verify the image is clear.

> **Note**: This requires the SD card check to pass first.

### 7. Finish Preparation

Once all checks pass:

1. Tap **"Finish Preparation & Testing"**.
2. The app will:
   - Finalize device settings (Intervals, Image counts).
   - **Disable the Camera** (to save battery during transport).
   - Mark the device as "Prepared" in the database.

### Success State

You will see a confirmation: **"Device ready to be deployed"**.
The device is now safe to turn off (if needed) and transport to the deployment site.

---

## Technical Flow Reference

| Step | Action | Device Command |
|------|--------|----------------|
| 1 | Connect | `connect()` |
| 2 | Time Sync | `setUtc()` |
| 3 | Battery | `getBatteryLevel()` |
| 4 | SD Card | `checkSdCard()` |
| 5 | Firmware | `getDeviceVer()` + DFU |
| 6 | Camera Test | `captureTestImage()` |
| 7 | Configure | `setOperationalParam()` |

## Troubleshooting

### "SD Card Check Failed"
- **Cause**: Card not fully inserted, wrong format (NTFS instead of FAT32), or damaged.
- **Fix**: Re-insert card, format to FAT32 on PC, try a different card.

### "Project Required"
- **Cause**: You attempted to finish without selecting a project.
- **Fix**: Select a project from the dropdown.

### "Battery too low for update"
- **Cause**: Battery is under 30%.
- **Fix**: Replace batteries or charge unit. The update is blocked to prevent bricking.

## What's Next?

Once your device is prepared and ready, proceed to the deployment guide:

➡️ **[Go to Deployment Flow Guide](./03-DEPLOYMENT-FLOW.md)**
