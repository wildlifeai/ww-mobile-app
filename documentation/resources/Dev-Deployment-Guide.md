# Dev Deployment Guide

Developer-only deployment mode for testing capture settings, flash configurations, and diagnostic modes before production use.

## Overview

The Dev Deployment flow is a **developer-facing** alternative to the standard Start Deployment flow. It provides full control over device parameters that are normally locked by project settings, allowing developers to:

- Test different capture methods (Activity Detection, Timelapse, Mixed) independently of project configuration
- Configure flash LED type (Off / Visible / IR) and brightness
- Enable diagnostic capture modes (alternating JPG/BMP for image quality comparison)
- Override AI model, LoRaWAN, and GPS settings per-deployment
- Validate device health (battery, SD card) before committing to a full deployment

> [!IMPORTANT]
> Dev Deployment changes to project settings (capture method, model, etc.) **persist to the database**. This is by design — it allows developers to iterate on project configuration without leaving the deployment screen.

## Access

**Screen:** `DevDeploymentTestScreen.tsx`
**Hook:** `useDevDeployment.ts`
**Entry:** Engineer Console → Flows Reference → "Dev Deployment Test"

The Dev Deployment screen is only accessible from the Engineer Console's Flows menu — it is **not** available to regular users.

---

## How It Differs From Standard Deployment

| Aspect | Standard Deployment | Dev Deployment |
|--------|--------------------|----|
| **Access** | Scanner tab → auto-connect → "Start Monitoring" | Engineer Console → Flows → "Dev Deployment Test" |
| **Capture method** | Inherited from project settings | User selects directly on-screen (Activity / Timelapse / Mixed) |
| **Flash settings** | Not configurable | Full control: LED type (Off / Visible / IR) + brightness (0-100%) |
| **Capture diagnostics** | Not available | `NUM_PICTURES` and `TEST_MODE_BITS` (JPG+BMP alternating) |
| **AI model** | Inherited from project | Overridable dropdown (including "None") |
| **LoRaWAN / GPS** | Inherited from project | Toggleable switches |
| **BLE init** | Upstream in Scanner flow | No BLE init — assumes connection from Engineer Console |
| **Disconnect handling** | Alert-based auto-navigation | No automatic disconnect handling (uses `WWBleDisconnectedBanner`) |
| **Monitoring view** | Same `DeploymentMonitorView` | Same `DeploymentMonitorView` |
| **End deployment** | Same `useEndDeployment` flow | Same `useEndDeployment` flow |

---

## Pipeline Comparison

### Shared Steps

Both flows share these pipeline functions from `deploymentPipeline.ts`:

| Step | Function | Purpose |
|------|----------|---------|
| Time Sync | `pipeline.syncTime()` | `setutc` — syncs device clock |
| AI Model Sync | `pipeline.syncAiModel()` | Compares and transfers model if mismatched |
| Configure Device | `pipeline.configureDevice()` | Sets capture method OPs, deployment ID, GPS |

### Standard Deployment Pipeline

| Step | Action |
|------|--------|
| 1 | Time Sync |
| 2 | AI Model Sync |
| 3 | Snapshot Data (battery, network, version) |
| 4 | Create DB Record |
| 5 | Reset OPs (skip configure-managed OPs) |
| 6 | Configure Device |
| 7 | Live Monitor |
| 8 | Disconnect |

### Dev Deployment Pipeline

| Step | Action |
|------|--------|
| 1 | Time Sync |
| 2 | AI Model Sync |
| 3 | Persist project settings to DB |
| 4 | Create DB Record |
| 5 | Configure Device (capture method, deployment ID, GPS) |
| 6 | Flash OPs (`LED_BRIGHTNESS`, `FLASH_LED`) |
| 7 | Capture Diagnostics (`TEST_MODE_BITS`, `NUM_PICTURES`) |
| 8 | Live Monitor |

> [!NOTE]
> Dev Deployment does **not** run `resetOps` — it assumes the developer wants full control over all parameters. If a clean slate is needed, the developer can run `resetToDefaults` from the Engineer Console first.

---

## Screen Layout

The `DevDeploymentTestScreen` is a single scrollable page (no accordion) with the following cards:

### 1. Project Settings
- **Project selector** — dropdown to pick the working project
- **Capture method** — segmented buttons: Activity / Timelapse / Mixed
- **Timelapse interval** — numeric input (shown when Timelapse or Mixed selected)
- **Motion sensitivity** — segmented buttons (shown when Activity or Mixed selected)
- **Feature chips** — LoRaWAN, GPS, AI Model indicators

### 2. AI & Connectivity
- **AI Model** — dropdown of all registered models, plus "None (no AI)"
- **LoRaWAN Required** — toggle switch
- **Record GPS in Images** — toggle switch

### 3. Flash Settings
- **Flash LED Type** — segmented buttons: Off / White / IR (maps to OP 13)
- **LED Brightness** — numeric input 0-100% (maps to OP 9)

### 4. Capture Diagnostics
- **Pictures per Trigger** — numeric input (default: 2 for JPG+BMP)
- **Save BMP** — toggle switch (sets `TEST_MODE_BITS` bit 1 = `TEST_BIT_SAVE_BMP`)

When BMP mode is enabled and the picture count is odd, it auto-increments to the next even number so that JPG/BMP pairs are always complete.

### 5. Location & Camera
- **Site Name** — free text
- **Camera Height (cm)** — numeric input

### 6. Device Health
- **Battery Level** — manual check button
- **SD Card Status** — manual check button (total/free KB)

### 7. Footer
- **"Start Dev Deployment"** button — green when connected + project selected, disabled otherwise

---

## Key Source Files

| File | Purpose |
|------|---------|
| [`DevDeploymentTestScreen.tsx`](../../src/screens/Devices/DevDeploymentTestScreen.tsx) | Screen component (full scrollable layout) |
| [`useDevDeployment.ts`](../../src/screens/Devices/hooks/useDevDeployment.ts) | Hook: state management, pipeline orchestration, project persistence |
| [`deploymentPipeline.ts`](../../src/ble/workflows/deploymentPipeline.ts) | Shared pipeline functions (syncTime, syncAiModel, configureDevice) |
| [`useDeploymentConfiguration.ts`](../../src/hooks/useDeploymentConfiguration.ts) | Shared capture method → OP parameter mapping |
| [`useDeviceSettings.ts`](../../src/hooks/useDeviceSettings.ts) | `OP_PARAMETER` enum, `FACTORY_DEFAULTS` |

---

*Last Updated: May 15, 2026*
