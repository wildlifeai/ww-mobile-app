# AI Model Integration Guide (Mobile)

**Last Updated:** 2026-04-26
**Status:** Phase 1 Complete — See Phase 2 below
**Backend Branch:** `feature/ai-model-families`

---

## 1. Architecture Overview

The backend now uses a **family + version** model for AI models. This solves the firmware integer ID problem and adds lifecycle tracking.

### Key Concepts

| Concept | DB Table | Firmware Relevance |
|---------|----------|-------------------|
| **Model Family** | `ai_model_families` | Owns `firmware_model_id` (stable integer for OP 14) |
| **Model Version** | `ai_models` | Each row = one binary. Has `version_number` (integer for OP 15) |
| **Lifecycle Status** | `ai_models.status` | Only `validated` and `deployed` models should be synced |

### Firmware ID Mapping

The device loads models using two integers from `CONFIG.TXT`:

| Firmware OP | DB Column | Example |
|-------------|-----------|---------|
| OP 14 (`project_id`) | `ai_model_families.firmware_model_id` | `42` |
| OP 15 (`deploy_version`) | `ai_models.version_number` | `2` |

These produce the SD card filename: `42V2.TFL` (8.3 format under `/MANIFEST/`)

### Storage Path Convention

```
ai-models/{org_id}/{firmware_model_id}/{version_number}/model.tfl
```

Each version is a unique, immutable path. No accidental overwrites.

---

## 2. WatermelonDB Schema (Already Implemented)

The `AiModel` model in `src/database/models/AiModel.ts` already has the required fields:

```typescript
@field('model_family_id') modelFamilyId?: string    // UUID FK to ai_model_families
@field('version_number') versionNumber?: number      // Integer for firmware OP 15
@field('firmware_model_id') firmwareModelId?: number  // Integer for firmware OP 14
@field('status') status?: string                     // ai_model_status enum
@field('file_hash') fileHash?: string                // SHA-256 of the .TFL binary
```

### Sync Filtering Rule

**Critical**: Only sync models with `status IN ('validated', 'deployed')`.

Draft, uploading, or failed models must **never** appear in the model picker. Filter in your pull query or WatermelonDB query.

---

## 3. BLE Transfer Safety Protocol

When transferring a model to a device, follow this exact sequence:

```
1. Transfer file       → runFileTransferPipeline (CRC verified at packet level)
2. List /MANIFEST/     → AI dir (confirm filename exists on SD card)
3. Verify presence     → check targetFilename appears in dir listing
4. Load model          → loadmodel <id> <version>
5. Read back OP 14     → getop 14
6. Read back OP 15     → getop 15
7. Confirm match       → compare readback to expected values
```

Steps 2-3 are **critical** — before issuing `loadmodel`, confirm the file actually exists on the SD card. This prevents silent corruption from edge cases like interrupted transfers that reported success.

### Defensive Guards

```typescript
const modelId = selectedModel.firmwareModelId;
const versionId = selectedModel.versionNumber;

// Guard: reject invalid IDs
if (!modelId || modelId <= 0 || !versionId || versionId <= 0) {
    throw new Error(
        `Invalid firmware IDs: modelId=${modelId}, versionId=${versionId}. `
        + `Sync may be stale — pull latest data.`
    );
}

const targetFilename = `${modelId}V${versionId}.TFL`;
```

---

## 4. Phase 2: Active Model Tracking (Not Yet Implemented)

**Goal:** Record which model is currently running on each device.

### Option A: Per-device active model record

Create a `device_active_models` table:

```sql
CREATE TABLE device_active_models (
    device_id UUID PRIMARY KEY REFERENCES devices(id),
    firmware_model_id INTEGER NOT NULL,
    version_number INTEGER NOT NULL,
    loaded_at TIMESTAMPTZ DEFAULT now(),
    reported_by UUID REFERENCES auth.users(id)
);
```

### Option B: Device sync endpoint

The mobile app reports OP 14/15 values on BLE connect, updating `devices.active_model_id`.

### Implementation Steps (Mobile)

1. After successful `loadmodel` + OP 14/15 verification (step 7 above), call a Supabase RPC or upsert to record the active model.
2. On BLE connect, read OP 14 and OP 15 from the device and report the current state.
3. Display the active model in the device detail screen.

> **Decision needed:** Which option (A or B) to implement. Option A is more explicit; Option B is lighter but requires the mobile app to always report on connect.

---

## 5. File Format Handling

The backend normalizes all model formats before storage:

| Input Format | Backend Action |
|---|---|
| `.tflite` (raw TFLite) | Rename to `{id}V{ver}.TFL`, store directly |
| `.zip` (Edge Impulse) | Extract `trained.tflite`, run Vela conversion, rename |
| `.cc` (C hex array) | Parse hex array → raw bytes → store as `.TFL` |

The mobile app should **never** need to handle format conversion. It always receives a ready-to-deploy `.TFL` binary from storage.

---

*Maintained by Backend Team — see `ww-backend/docs/DATABASE_REFERENCE.md` for full schema details.*
