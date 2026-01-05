# Deployment Flow Guide

## What is a Deployment?

A **Deployment** is the act of placing a prepared Wildlife Watcher camera in a specific physical location to monitor a target area. 

In the app data model, a Deployment links:
- 📸 A **Device** (Camera)
- 📍 A **Location** (GPS Coordinates)
- 📅 A **Time Period** (Start Date to End Date)
- ⚙️ **Configuration** (Motion sensitivity, Timelapse interval)

---

## Part 1: Starting a Deployment

### Prerequisites

Before starting a deployment, ensure you have:
- [ ] A **Prepared Device** (See [02-DEVICE-PREPARATION.md](./02-DEVICE-PREPARATION.md))
- [ ] The device physically with you
- [ ] Good GPS visibility (clear view of the sky)
- [ ] Your phone's GPS enabled
- [ ] Physical installation gear (straps, mounts)

### Step-by-Step Guide

#### 1. Start Deployment Wizard

1. Open the **Wildlife Watcher** app.
2. Navigate to the **Maps** tab.
3. Tap the **"New Deployment"** FAB (Plus icon).

#### 2. Device Discovery & Connection

The app scans for nearby devices.
1. Hold your phone close to the WW camera.
2. Select the target device from the list.
   - *Tip*: Verify the Device ID matches the label on the unit.
3. The app establishes a BLE connection.

**Smart Routing Logic:**
- If device is **already deployed**: App warns and offers to end current deployment
- If device is **not prepared**: App redirects to preparation flow with option to continue to deployment after
- If device is **prepared and ready**: Proceeds to deployment details

#### 3. Location Capture

Accurate geolocation is critical for data analysis. The app captures:
1. **Latitude & Longitude**: High-accuracy GPS from the phone.
2. **Altitude**: Height above sea level.
3. **Accuracy**: GPS precision estimate (wait for Green indicator).
 
**Tip**: Wait for the accuracy to settle (Green indicator) and ideally reach below 5-10 meters for optimal data quality.
3. **Confirm Location**.

#### 4. Deployment Details

Enter additional deployment information:
- **Deployment Name**: Descriptive name for this deployment location
- **Location Description**: Optional notes about the specific site
- **Camera Height**: Height of camera from ground (in centimeters)
- **Camera View Images**: Optional photos showing the camera's field of view
- **Start Comments**: Any notes about deployment conditions

#### 5. Configuration Review

Review the settings automatically inherited from the project:
- **Project**: Confirms the correct project is selected
- **Capture Method**: Inherited from project (Motion Detection, Timelapse, or Both)
- **Activity Sensitivity**: Motion detection threshold (if applicable)
- **Timelapse Interval**: Photo interval in seconds (if applicable)
- **AI Model**: Detection model assigned to this project

These settings are **snapshotted** to the deployment record and stored in `capture_method_id`, `activity_detection_sensitivity_id`, and `timelapse_interval_seconds` fields.

#### 6. Final Device Time Check

The device's internal clock is synchronized with the phone to ensure accurate photo timestamps:
1. App sends `getutc` command to verify device time
2. Checks if device time is within acceptable threshold
3. If needed, sends `setutc` command with current UTC timestamp in ISO 8601 format
4. Validates the update was successful

#### 7. Create Deployment Record

The app saves the deployment to the local database **before** sending commands to the device. This ensures:
- If BLE commands fail, you still have a record of the deployment attempt
- The deployment UUID is generated and available to send to the device
- Data integrity is maintained even if the device disconnects unexpectedly

The record includes:
- Deployment UUID
- Device Preparation ID (links to preparation record)
- **Location Data**: GPS coordinates, altitude, accuracy
- **Metadata**: Location name, description, camera height (converted to meters)
- **Configuration Snapshot**: capture_method_id, activity_detection_sensitivity_id, timelapse_interval_seconds
- **Timestamps**: deployment_start, created_at, updated_at
- **Audit**: setup_by (user ID)
- **Status**: deployment_status_id = 1 (Active/Deployed)

#### 8. Sync Deployment ID to Device

To ensure photos can be linked back to this specific deployment:
1. **UUID Splitting**: The 128-bit UUID is parsed into 8 x 16-bit integers
2. **Optimized Transmission**: Uses `setDeploymentIdAsOps()` hook which:
   - Sends 8 separate `AI setop <index> <value>` commands (OP 20-27)
   - Includes 200ms wake delay after FIRST command (if device was in Deep Power Down)
   - Global 20ms pause between commands ensures completion within 1000ms window
3. **Retry Logic**: Up to 3 attempts with 1-second delays if transmission fails
4. **Validation**: Each command is logged and verified

**Example:**
```
Deployment ID: 11f59ca9-5aca-4dd3-a101-92205ca07384
Parsed to: [4597, 40105, 23242, 19923, 41217, 37408, 23712, 29572]
Sent as:
  AI setop 20 4597
  [200ms wake delay]
  AI setop 21 40105
  ...
  AI setop 27 29572
```

> **Timing Critical**: Device has 1000ms inactivity timer. All 8 commands must complete before device sleeps. See [BLE Architecture Guide](../app-technical-guides/ble-architecture-guide.md#ble-timing-requirements--firmware-constraints).

#### 9. Configure Capture Method

The device is configured according to the project's capture requirements.

**For Activity Detection:**
- **Enables Camera**: `AI setop 10 1` (Must be enabled for value to persist)
- Sets motion detection interval: `AI setop 11 1000` (1000ms)
- Disables timelapse: `AI setop 7 0`

**For Timelapse:**
- **Enables Camera**: `AI setop 10 1`
- Sets timelapse interval: `AI setop 7 <seconds>` (from project config)
- Disables motion detection: `AI setop 11 0`

**For Both (Activity + Timelapse):**
- **Enables Camera**: `AI setop 10 1`
- Sets motion detection interval: `AI setop 11 1000`
- Sets timelapse interval: `AI setop 7 <seconds>`

#### 10. Enable Camera, Reset & Disconnect

1. **Enable Camera**: Explicitly ensures camera is enabled (`AI setop 10 1`) if not already set.
2. **Visual Confirmation**: Flashes green LED (5 times, 500ms each)
3. **DPD Latch Cycle**:
   - Wait 2500ms (Enter DPD)
   - `setop 19 0` (Wake Up & Latch Config)
   - Wait 1500ms (Stabilize)
4. **Disconnect**: Sends `dis` command to gracefully close BLE connection

> [!IMPORTANT]
> **The reset command is essential!** Without it, the device stays in DPD and never enters motion detection mode. The reset causes the HiMAX processor to:
> - Read the updated CONFIG.TXT parameters
> - Initialize the camera in motion detection mode (Mode 2)
> - Begin monitoring for motion/timelapse triggers

The device reboots and enters low-power monitoring state, capturing according to the configured method.

### Success State

The device is now **"Deployed"**. It will appear as a **Green Camera Icon** on the map with status "Active".

---

## Part 2: Ending a Deployment

### Prerequisites

- [ ] Device is within BLE range
- [ ] You have retrieved the physical device from the field
- [ ] Optional: SD card contents backed up

### Step-by-Step Guide

#### 1. Initiate End Deployment

**From Maps Screen:**
1. Tap on the deployed device marker
2. Select "End Deployment"

**From Devices List:**
1. Navigate to Devices screen
2. Find device showing "Device is deployed: [Name]"
3. Tap "End Deployment" button

**From Deployment Details:**
1. Navigate to the specific deployment
2. Tap "End Deployment" action

#### 2. Device Discovery & Connection

1. App scans for nearby devices
2. Select the deployed device from the list
3. App establishes BLE connection

**Validation:**
- App checks if device has an **active deployment** in the database
- If NO active deployment found: Shows blocking alert "This device is not part of an active deployment"
- If active deployment found: Proceeds to end deployment screen

#### 3. Confirm Deployment to End

Review screen shows:
- **Deployment Name**
- **Deployment Start Date**
- **Duration** (calculated from start to now)

Enter optional **Retrieval Notes**:
- Condition of device (battery level, damage, etc.)
- SD card status (full, corrupted, etc.)
- Reason for ending (project complete, device failure, relocation, etc.)

#### 4. End Deployment Process

When user taps "End Deployment", the app executes the following sequence:

**Step 1: Disable Camera**
- Sends `AI setop 10 0` to stop camera and AI system
- Prevents further photo captures
- Status: "Disabling Camera..."

**Step 2: Clear Deployment ID**
- Sends 8 commands to clear OPs 20-27: `AI setop <index> 0`
- Uses `setDeploymentIdAsOps(null)` with optimized 200ms wake delay
- Wipes the deployment UUID from device memory
- Retry logic: Up to 3 attempts with 1-second delays
- If fails: Shows warning but continues (user must manually reset device)
- Status: "Clearing Config..."

**Step 3: Clear GPS Location**
- Sends `setgps 0 0 0` to reset GPS data for next deployment
- **Note**: GPS values are unquoted, space-separated (not empty string)
- Ensures old location data doesn't persist
- Non-blocking: Logs warning if fails but continues
- Status: "Checking Firmware..."

**Step 4: Update Database**
- Sets `deployment_end` to current timestamp
- Sets `ended_by` to current user ID
- Stores `end_deployment_comments` (retrieval notes)
- Updates `deployment_status_id` to ended/retrieved status
- Marks device as available for re-preparation
- Status: "Updating Record..."

**Step 5: Visual Confirmation Sequence**
LED sequence provides clear visual feedback that deployment has ended:
1. Flash **Green** LED (1 second, 1 time)
2. Wait 100ms
3. Flash **Blue** LED (1 second, 1 time)
4. Wait 100ms
5. Flash **Red** LED (1 second, 1 time)
6. Wait 100ms
7. Flash **Green** LED (4 seconds, 1 time) - Final confirmation
8. Total duration: ~7.3 seconds
- Status: "Confirming..."

**Step 6: DPD Latch Cycle (Finalize)**
- Triggers latch cycle to ensure "Stop" settings (camera disabled) are persisted
- Wait 2.5s -> OP 19 -> Wait 1.5s
- Status: "Finalizing..."

**Step 7: Disconnect**
- Sends `dis` command to device
- Closes BLE connection gracefully
- Status: "Disconnecting..."

#### 5. Success Confirmation

App shows success alert:
```
Deployment Ended
The deployment has been successfully ended.
[View Details]
```

Tapping "View Details" navigates to the deployment record showing:
- Complete deployment history
- Start and end dates
- All metadata and photos
- Retrieval notes

### Post-Deployment State

**Device Status:**
- Shows as **"Last deployment: [Name]"** on device card
- Ready for re-preparation for next deployment
- GPS and configuration data cleared

**Deployment Record:**
- Status changed to "Ended" or "Retrieved"
- End timestamp recorded
- Available for data export and analysis
- Photos can still be associated via deployment ID

---

## Technical Flow Reference

### Start Deployment Flow

| Step | Action | BLE Commands | Database Operations |
|------|--------|--------------|---------------------|
| 1 | Discovery | BLE scan for service UUID | Check device exists in DB |
| 2 | Validation | - | Verify device is prepared |
| 3 | Location | - | Capture GPS via expo-location |
| 4 | Time Check | `getutc`, `setutc [timestamp]` | - |
| 5 | DB Create | - | Create deployment record with snapshots |
| 6 | ID Sync | `AI setop 20 [value]` × 8 (retry 3x) | - |
| 7 | Configure | Activity: `AI setop 10 1`, `AI setop 11 1000`, `AI setop 7 0` | - |
| | | Timelapse: `AI setop 10 1`, `AI setop 7 [secs]`, `AI setop 11 0` | - |
| 8 | Enable | `AI setop 10 1` (Redundant check) | - |
| 9 | Latch | **DPD Latch Cycle** (Wait -> OP 19 -> Wait) | *Ensures Config Applied* |
| 10 | Disconnect | `dis` | Mark device as deployed |
| 11 | Sync | - | Push to Supabase via SupabaseSyncService |

### End Deployment Flow

| Step | Action | BLE Commands | Database Operations |
|------|--------|--------------|---------------------|
| 1 | Validation | - | Check device has active deployment |
| 2 | Disable | `AI setop 10 0` | - |
| 3 | Clear ID | `AI setop 20 0` × 8 (retry 3x) | - |
| 4 | Clear GPS | `setgps ""` | - |
| 5 | DB Update | - | Set deployment_end, ended_by, comments |
| 6 | LED Sequence | `flashg 1 1000`, `flashb 1 1000`, `flashr 1 1000`, `flashg 1 4000` | - |
| 7 | Latch | **DPD Latch Cycle** | *Persist Stop Settings* |
| 8 | Disconnect | `dis` | Mark device as available |
| 9 | Sync | - | Push to Supabase via SupabaseSyncService |

---

## Troubleshooting

### Start Deployment Issues

**"GPS Accuracy Too Low"**
- **Cause**: Weak GPS signal (under canopy/dense trees).
- **Fix**: Move to a clearing to get a fix, then return to the deployment site.

**"Device Not Found"**
- **Cause**: Device is asleep or battery dead.
- **Fix**: Wake the device (magnet swipe or button press) and rescan.

**"Device Not Prepared"**
- **Cause**: Device hasn't completed preparation checks.
- **Fix**: Go through preparation flow first (see [02-DEVICE-PREPARATION.md](./02-DEVICE-PREPARATION.md)).

**"Failed to Set Deployment ID"**
- **Cause**: BLE connection unstable or device doesn't support extended OPs.
- **Fix**: Keep phone within 1 meter. Retry. If persistent, check device firmware version.

**"Write Failed"**
- **Cause**: BLE connection unstable.
- **Fix**: Keep phone within 1 meter of the device. Retry the step.

### End Deployment Issues

**"No Active Deployment"**
- **Cause**: Device is not currently deployed, or deployment already ended.
- **Fix**: Verify correct device. Check deployment status in Deployments list.

**"Failed to Clear Deployment ID"**
- **Cause**: BLE write failure or device unresponsive.
- **Fix**: Retry process. If continues to fail, manually reset device using Engineer Console.

**"GPS Clear Failed"**
- **Cause**: Legacy firmware or BLE timeout.
- **Impact**: Non-critical. GPS will be overwritten on next deployment.
- **Fix**: Can be ignored, or manually clear via Engineer Console: `setgps ""`

**"LED Sequence Not Visible"**
- **Cause**: Device LED damaged or BLE commands not reaching device.
- **Impact**: Non-critical. Deployment is still ended in database.
- **Fix**: Verify physically that deployment was ended. Check device status in app.

---

## Related Documentation

- [Device Preparation](./02-DEVICE-PREPARATION.md) - Must be completed before deployment
- [Offline Architecture](./03-OFFLINE-FIRST-ARCHITECTURE.md) - How data syncs work
- [BLE Architecture Guide](../ble-architecture-guide.md) - Complete BLE command reference

---

**Last Updated**: December 2025  
**Maintained By**: Wildlife Watcher Development Team
