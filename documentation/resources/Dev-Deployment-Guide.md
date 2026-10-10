# Dev Deployment Guide

Developer-only deployment mode for trying a project's settings, a camera, a flash and a picture count on a real device before committing to a field deployment.

## Overview

The Dev Deployment flow is a **developer-facing** alternative to the standard Start Deployment flow. It provides control over the parameters a normal deployment takes from the project, allowing developers to:

- Choose which camera the deployment runs on, Colour or Black & White, switched at Start (#301)
- Try any of the project's capture methods (Activity Detection, Timelapse, Mixed) and motion sensitivities
- Try any of the project's capture flash settings (mode, LED, time-of-day window in local time), plus the two brightnesses that have no project column, and light the white LED to check it
- Set the number of pictures per trigger
- Override the AI model, LoRaWAN and GPS settings per deployment
- Validate device health (battery, SD card, self-test) before committing to a full deployment

> [!IMPORTANT]
> Dev Deployment changes to project settings (capture method, sensitivity, flash, model, and so on) **persist to the database**. This is by design: it allows developers to iterate on project configuration without leaving the deployment screen. The camera choice, the LED brightness and the motion-detection light are the settings with no project home; they reach the device and nothing else.

## Access

**Screen:** `DevDeploymentTestScreen.tsx`
**Hook:** `useDevDeployment.ts`
**Entry:** Engineer Console → Flows Reference → "Dev Deployment Test"

The Dev Deployment screen is only accessible from the Engineer Console's Flows menu. It is **not** available to regular users.

---

## How It Differs From Standard Deployment

| Aspect | Standard Deployment | Dev Deployment |
|--------|--------------------|----|
| **Access** | Scanner tab → auto-connect → "Start Monitoring" | Engineer Console → Flows → "Dev Deployment Test" |
| **Camera** | Whatever slot is running when the deployment starts; Start Monitoring warns on a flash that does not suit it (#321) and never switches | Chosen on screen and switched as the first pipeline step when it is not the one running |
| **Capture method** | Inherited from project settings | The project's own fields, chosen on screen and persisted |
| **Flash settings** | Mode and LED inherited from the project (op34, op13, and op35/op36 for the window) | The same fields, chosen on screen and persisted, plus the LED brightness (op9) and the motion-detection light (op22) as dev-only extras |
| **Pictures per trigger** | The project's count and interval (op5, op6), with op8 raised past the interval for a burst (#317) | Any number, default 3; op6 stays at the reset's 500 ms and op8 at 1000 |
| **AI model** | Inherited from project | Overridable dropdown (including "None"), applied to this deployment and persisted |
| **Detection threshold** | The project's `detection_threshold_pct`, written as op16 (#342) | The same, from the selected project; no field, so a model chosen here runs at the threshold the project would deploy it at |
| **LoRaWAN / GPS** | Inherited from project | Toggleable switches |
| **SD card** | Pre-deployment checks block on the self-test's SD card bit (#303) | The health banner shows the bit and Start is disabled while it is set |
| **BLE init** | Upstream in Scanner flow | No BLE init, assumes connection from Engineer Console |
| **Disconnect handling** | Alert-based auto-navigation | No automatic disconnect handling (uses `WWBleDisconnectedBanner`) |
| **Monitoring view** | Same `DeploymentMonitorView` | Same `DeploymentMonitorView` |
| **End deployment** | Same `useEndDeployment` flow | Same `useEndDeployment` flow |

---

## Pipeline Comparison

### Shared Steps

Both flows share these pipeline functions from `deploymentPipeline.ts`:

| Step | Function | Purpose |
|------|----------|---------|
| AI Model Sync | `pipeline.syncAiModel()` | Checks SD card for existing model files; only downloads and transfers missing files. Loads with `loadmodel` if OPs mismatch, never `erasemodel` first. Stops the start when the model is on neither the camera nor the card and the phone cannot get its files (#333), when the transfer is refused over [BLE firmware below the floor](File-Transfer-Protocol.md#the-ble-firmware-floor) (#289), when the phone's copy is not a TFLite model, and when the camera never answers `loadmodel` (#428). Runs first to stay within firmware's 1000ms IMAGE task window. |
| Time Sync | `pipeline.syncTime()` | `setutc`, syncs the device clock (BLE module, not AI processor) |
| Reset OPs | `pipeline.resetOps()` | Diff-writes `FACTORY_DEFAULTS`, keeps the model and the identity, returns the resulting table |
| Configure Device | `pipeline.configureDevice()` | Sets capture method OPs, deployment ID, GPS, the capture flash and the project's detection threshold (op16) |

### Standard Deployment Pipeline

| Step | Action |
|------|--------|
| 1 | AI Model Sync |
| 2 | Time Sync |
| 3 | Snapshot Data (battery, network, version) |
| 4 | Create DB Record |
| 5 | Reset OPs (skip configure-managed OPs) |
| 6 | Configure Device |
| 7 | Live Monitor |
| 8 | Disconnect |

### Dev Deployment Pipeline

| Step | Action |
|------|--------|
| 0 | Camera switch, when the chosen camera is not the one running. `useCameraSwitch.switchTo`: `AI switchslot`, wait for the Sleep, wait for the Wake, confirm with `AI slots`. First, so everything after it is asked of the image that will run the deployment. A switch that does not come back on the chosen camera **aborts the start**. So does a camera that boots and finds no sensor: `AI slots` reports the image's label, not whether its sensor answered, so after the switch the post-boot self-test is read, and bit 8 (main camera not responding) switches back to the previous camera and aborts. Found on WILD-SIFK, whose IMX708 stayed silent for the first four minutes after a switch (22 September 2026) |
| 1 | AI Model Sync, with the model chosen on screen. It runs after step 0, so a start stopped here for a model the phone lacks has already switched the camera. The screen says under the model picker whether the model is on the phone |
| 2 | Time Sync |
| 3 | Persist project settings to DB |
| 4 | Reset OPs |
| 5 | Create DB Record |
| 6 | Configure Device (capture method, deployment ID, GPS, the flash as the project's four columns, and the project's detection threshold as op16) |
| 7 | Flash brightness (`LED_BRIGHTNESS`, op9) and motion-detection light (`MD_FLASH_BRIGHTNESS_PERCENT`, op22), only when the flash mode is not off |
| 8 | Pictures per trigger (`NUM_PICTURES`), written explicitly because the reset preserves OP 5 |
| 9 | Live Monitor |

> [!NOTE]
> Dev Deployment runs the same `pipeline.resetOps` as Start Monitoring before it applies the dev configuration (step 4b in `useDevDeployment`), and since #268 a refused reset aborts the deployment. Connecting no longer resets anything, so this is the only clean slate the dev deployment gets; every parameter the cards do not set starts at its factory default.

> [!NOTE]
> The raw BMP capture option (`TEST_MODE_BITS` bit 1, with an even picture count so the alternating file types made JPG/BMP pairs) was retired on 21 September 2026. Its code is commented out in the hook and the screen rather than deleted, until it is certain nothing wants it back. The reset leaves OP 18 at 0, so nothing writes it any more. For a BMP run, set `AI setop 18 2` from the console after the deployment has started.

---

## Screen Layout

The `DevDeploymentTestScreen` is a single scrollable page (no accordion). A `DeviceHealthBanner` sits under the connection banner, fed by the self-test the device broadcasts after every wake. The cards:

### 1. Project Settings
- **Project selector**: dropdown to pick the working project
- **Capture Method**: the project form's dropdown, from the `capture_methods` reference data
- **Motion Sensitivity**: dropdown (shown for Activity or Mixed)
- **Time-lapse Interval**: numeric input (shown for Timelapse or Mixed)
- **Feature chips**: LoRaWAN, GPS, AI Model indicators

### 2. AI & Connectivity
- **AI Model**: dropdown of all registered models, plus "None (no AI)"
- **LoRaWAN Required**: toggle switch
- **Record GPS in Images**: toggle switch

### Already deployed

A device carries one deployment at a time. The scanner routes a deployed device to its summary instead of Start Monitoring, but this screen is reached through the Engineer Console, which does no such thing. So the screen asks the local database for an active deployment on the device (`DeploymentService.getActiveDeploymentForDeviceId`) on every focus, and while one exists it shows a red "Already deployed" card with the site and start time, an **End deployment** button, and Start reads "Already deployed". Start asks again at the moment of the press, in case another phone deployed the device meanwhile, and then asks the server about an open deployment this phone does not hold, before the camera switch, the same check and messages as [Start Monitoring](../onboarding/05-DEVICE-FLOWS.md#start-deployment-sequence) (#448). End deployment runs the same sequence as Stop Monitoring (`endDeploymentSequence` in `useMonitoringActions.ts`: read the ops, clear the deployment id and the GPS, end the record, quiesce) but keeps the BLE link and stays on the screen, so the next Start can follow at once; it needs the device connected. Ending it anywhere else clears the block on the next focus (22 September 2026).

### 3. Camera
- **Colour / Black & White**: one per firmware slot, seeded from an `AI slots` read on connect. The switch happens at Start, not on selection; the note under the control says which camera is running and whether Start will switch.

### 4. Capture Flash
- **Flash Mode**: Off / Always on / Time of day / Light sensor (in development), the project form's list, from `FLASH_MODE_OPTIONS` in
  [`projectFlash.ts`](../../src/utils/projectFlash.ts)
- **Flash LED**: IR / white, shown when the mode is not off
- **Flash on at / Flash off at**: shown in time-of-day mode, in the phone's local time. The project and the camera keep the window in UTC (op35 start, op36 minutes), and the line under the fields shows what they will get. The conversion uses today's offset, so a window set before a daylight-saving change is an hour out after it until it is set again
- **LED Brightness**: numeric input 0-100% (OP 9), shown when the mode is not off. Written to the device only; it has no project column, so a real deployment of the project uses the factory value
- **Motion-detection light**: 0-100% (OP 22), shown when the mode is not off. How bright the light is that the HM0360's motion frames get at night, through the LED op21 picks (IR by default). Device only, like op9; a real deployment uses the factory 50%
- **Test the white LED**: sends `AI flash <op9> 500`, which lights the white LED directly whatever the mode and LED say. It proves the LED, its driver and the command path. The camera sends no reply, so the screen reports only a refusal. The firmware's `flash` also writes op12, which nothing reads

The flash goes to the device as the project's four columns, through the same `configureFlash` a standard deployment uses, so a mode and LED tried here are what a real deployment of the project would write. See [Light-Sensor.md](Light-Sensor.md), "How the decision reaches the flash LED".

### 5. Pictures per Trigger
- **Pictures per trigger**: numeric input (OP 5), default 3. It is not persisted: Start Monitoring writes the project's `photos_per_trigger` and `photo_interval_milliseconds` since #317, which only the website edits.

### 6. Location
- **Site Name**: free text
- **Camera Height (cm)**: numeric input

### 7. Device Health
- **Battery Level**: manual check button
- **SD Card Status**: manual check button (total/free KB)

### 8. Footer
- **"Start Dev Deployment"** button: green when connected and a project is selected, disabled otherwise, and disabled with the label "No SD card" while the self-test reports none

---

## Key Source Files

| File | Purpose |
|------|---------|
| [`DevDeploymentTestScreen.tsx`](../../src/screens/Devices/DevDeploymentTestScreen.tsx) | Screen component (full scrollable layout) |
| [`useDevDeployment.ts`](../../src/screens/Devices/hooks/useDevDeployment.ts) | Hook: state management, pipeline orchestration, project persistence |
| [`useCameraSwitch.ts`](../../src/hooks/useCameraSwitch.ts) | The camera switch the start sequence runs first |
| [`deploymentPipeline.ts`](../../src/ble/workflows/deploymentPipeline.ts) | Shared pipeline functions (syncTime, syncAiModel, resetOps, configureDevice) |
| [`useDeploymentConfiguration.ts`](../../src/hooks/useDeploymentConfiguration.ts) | Shared capture method and flash → OP parameter mapping |
| [`projectFlash.ts`](../../src/utils/projectFlash.ts) | The flash columns, their option lists and their op values |
| [`projectDetectionThreshold.ts`](../../src/utils/projectDetectionThreshold.ts) | The detection threshold column and its op16 value |
| [`useDeviceSettings.ts`](../../src/hooks/useDeviceSettings.ts) | `OP_PARAMETER` enum, `FACTORY_DEFAULTS`, `RESET_PRESERVED_OPS` |

---

*Last Updated: 1 October 2026*
