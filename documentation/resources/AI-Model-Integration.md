# AI Model Integration

> **Related**: [File-Transfer-Protocol.md](File-Transfer-Protocol.md) (BLE file transfer), [04-ENGINEER-CONSOLE.md](../onboarding/04-ENGINEER-CONSOLE.md) (OP parameters, `loadmodel` command).

## Architecture

The backend uses a **family + version** model for AI models with lifecycle tracking.

| Concept | DB Table | Firmware Relevance |
|---------|----------|-------------------|
| **Model Family** | `ai_model_families` | Owns `firmware_model_id` (stable integer for OP 14) |
| **Model Version** | `ai_models` | Each row = one binary. Has `version_number` (integer for OP 15) |
| **Lifecycle Status** | `ai_models.status` | Only `validated` and `deployed` models are synced to devices |

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

Each version is a unique, immutable path.

---

## WatermelonDB Schema

The `AiModel` model in `src/database/models/AiModel.ts`:

```typescript
@field('model_family_id') modelFamilyId?: string    // UUID FK to ai_model_families
@field('version_number') versionNumber?: number      // Integer for firmware OP 15
@field('firmware_model_id') firmwareModelId?: number  // Integer for firmware OP 14
@field('status') status?: string                     // ai_model_status enum
@field('file_hash') fileHash?: string                // SHA-256 of the .TFL binary
```

### Sync Filtering

Only models with `status IN ('validated', 'deployed')` are synced. Draft, uploading, or failed models never appear in the model picker.

---

## BLE Transfer Safety Protocol

When transferring a model to a device, the app follows this exact sequence:

```
1. Transfer file       → runFileTransferPipeline (CRC verified at packet level)
2. List /MANIFEST/     → AI dir (confirm filename exists on SD card)
3. Verify presence     → check targetFilename appears in dir listing
4. Load model          → loadmodel <id> <version>
5. Read back OP 14     → getop 14
6. Read back OP 15     → getop 15
7. Confirm match       → compare readback to expected values
```

Steps 2–3 are critical — before issuing `loadmodel`, the app confirms the file actually exists on the SD card to prevent silent corruption from interrupted transfers.

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

## File Format Handling

The backend normalises all model formats before storage:

| Input Format | Backend Action |
|---|---|
| `.tflite` (raw TFLite) | Rename to `{id}V{ver}.TFL`, store directly |
| `.zip` (Edge Impulse) | Extract `trained.tflite`, run Vela conversion, rename |
| `.cc` (C hex array) | Parse hex array → raw bytes → store as `.TFL` |

The mobile app always receives a ready-to-deploy `.TFL` binary from storage — no format conversion is needed on-device.

---

## Key Source Files

| File | Purpose |
|------|---------|
| `src/database/models/AiModel.ts` | WatermelonDB model with firmware ID fields |
| `src/services/AiModelService.ts` | AI model metadata and registration |
| `src/screens/Devices/AiModelTransferScreen.tsx` | Model upload UI |
| `src/ble/protocol/fileTransfer/` | File transfer pipeline |
| `src/ble/protocol/commandRegistry.ts` | `loadmodel`, `erasemodel`, `getop` commands |

---

*Last Updated: May 16, 2026*
