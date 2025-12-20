# Deployment Flow Guide

## What is a Deployment?

A **Deployment** is the act of placing a prepared Wildlife Watcher camera in a specific physical location to monitor a target area. 

In the app data model, a Deployment links:
- 📸 A **Device** (Camera)
- 📍 A **Location** (GPS Coordinates)
- 📅 A **Time Period** (Start Date to End Date)
- ⚙️ **Configuration** (Motion sensitivity, Timelapse interval)

## Prerequisites

Before starting a deployment, ensure you have:
- [ ] A **Prepared Device** (See [02-DEVICE-PREPARATION.md](./02-DEVICE-PREPARATION.md))
- [ ] The device physically with you
- [ ] Good GPS visibility (clear view of the sky)
- [ ] Physical installation gear (straps, mounts)

## Step-by-Step Guide

### 1. Start Deployment Wizard

1. Open the **Wildlife Watcher** app.
2. Navigate to the **Maps** tab.
3. Tap the **"New Deployment"** FAB (Plus icon).
4. Select **"Deployment"** mode.

### 2. Device Discovery & Connection

The app scans for nearby devices.
1. Holds your phone close to the camera.
2. Select the target device from the list.
   - *Tip*: Verify the Device ID matches the label on the unit.
3. The app establishes a BLE connection.

### 3. Location Capture

Accurate geolocation is critical for data analysis.
1. The app requests high-accuracy GPS from the phone.
2. Wait for the accuracy to settle (Green indicator).
3. **Confirm Location**.

### 4. Configuration Check

Review the settings applied during preparation:
- **Project**: Confirm the correct project is selected.
- **Capture Method**: Automatically inherited from the Project settings (e.g., Motion Detection or Timelapse).
- **Validation**: The app ensures the configuration matches the project requirements.

### 5. Final Camera Test (On-Site)

One last check to ensure the camera view is not obstructed by leaves or branches.
1. Mount the camera in its final position.
2. Tap **"Test Camera View"**.
3. Review the received image. 
   - *Is the angle right?*
   - *Is the view clear?*

### 6. Sync Device Time

The device's internal clock is synchronized with the phone to ensure accurate photo timestamps.
1. The app reads the current time from the phone.
2. Sends `setUtc` command with ISO 8601 timestamp (e.g., `2025-12-18T16:27:00.000Z`).
3. This ensures metadata accuracy for data analysis.

### 7. Sync Deployment ID

To ensure photos can be linked back to this specific deployment, the app syncs the Deployment Unique ID (UUID) to the device.
1. The app generates a 36-character UUID for the deployment.
2. **Splitting Process**: The UUID is split into 8 chunks of 4 characters.
3. **Transmission**: The app sends 8 separate "Set Operational Parameter" commands (indices 20-27) to the device. This ensures compatibility with all phones, including those with limited Bluetooth data packet size (MTU).
4. **Retry Logic**: The app retries up to 3 times with 1-second delays if transmission fails.

### 8. Configure Capture Method

The device is configured according to the project's capture requirements.

**For Activity Detection Projects:**
- Sets motion detection interval to 1000ms
- Disables timelapse mode

**For Timelapse Projects:**
- Sets timelapse interval (from project settings, default 15 minutes)
- Disables motion detection

This ensures the device captures data exactly as specified by the project configuration.

### 9. Create Deployment Record

The app saves the deployment to the local database **before** sending commands to the device. This ensures:
- If BLE commands fail, you still have a record of the deployment attempt
- The deployment UUID is generated and available to send to the device
- Data integrity is maintained even if the device disconnects unexpectedly

The record includes:
- Deployment UUID
- Device ID
- Project ID
- Location coordinates
- Capture method configuration
- Status: "Active"

### 10. Configure Device via BLE

Now that the deployment exists, the app configures the physical device:

1. **Sends Deployment ID** (8x `setOperationalParam` OP20-27, retries 3x if needed)
2. **Configures Capture Method**:
   - Activity Detection: Sets motion interval to 1000ms, disables timelapse
   - Timelapse: Sets timelapse interval (from project), disables motion
3. **Enables Camera** (sends `ENABLE_CAMERA` command)
4. **Disconnects Gracefully** (sends `disconnect` command)

The device enters low-power monitoring state and begins capturing according to the configured method.

### Success State

The device is now "Deployed". It will appear as a **Green Camera Icon** on the map.

---

## Technical Flow Reference

| Step | Action | Technical Detail |
|------|--------|------------------|
| 1 | Discovery | Scans for `ServiceUUID` match |
| 2 | Connect | Connects & bonds BLE |
| 3 | Location | Uses `expo-location` (High Accuracy) |
| 4 | UTC Sync | Sends `setUtc` with ISO timestamp |
| 5 | ID Sync | Sends 8x `setOperationalParam` (OP20-27), retries 3x |
| 6 | Capture Config | Sends motion (1000ms) OR timelapse (project interval) |
| 7 | Deploy | Sends `enableCamera` |
| 8 | Disconnect | Sends `disconnect` command |
| 9 | Persist | Creates `Deployment` with `capture_method_id` in WatermelonDB |
| 10 | Sync | `SupabaseSyncService` pushes to Cloud |

## Troubleshooting

### "GPS Accuracy Too Low"
- **Cause**: Weak GPS signal (under canopy/dense trees).
- **Fix**: Move to a clearing to get a fix, then return to the deployment site.

### "Device Not Found"
- **Cause**: Device is asleep or battery dead.
- **Fix**: Wake the device (magnet swipe or button press) and rescan.

### "Write Failed"
- **Cause**: BLE connection unstable.
- **Fix**: Keep phone within 1 meter of the device. Retry the step.
