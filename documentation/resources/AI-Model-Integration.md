# AI Model Integration

> **Related**: [File-Transfer-Protocol.md](File-Transfer-Protocol.md) (BLE file transfer), [04-ENGINEER-CONSOLE.md](../onboarding/04-ENGINEER-CONSOLE.md) (OP parameters, `loadmodel` command).
>
> **Where this fits:** the mobile app owns **deployment** (stage 5) of the end-to-end
> [Embedded Model Lifecycle](../../../ww-website/documentation/resources/embedded-model-lifecycle.md)
> — models are uploaded, converted, and label-mapped on the website, then this app transfers a
> `validated` model to the device over BLE (or the user copies the SD-card manifest). On-device
> inference and the resulting EXIF predictions are downstream.

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

## Labels

Every model carries a label set — the class names it predicts (e.g. `not rat`, `rat`).
The app deploys these **alongside** the `.TFL` binary; both are needed for the device to
turn output class indices into named predictions.

### Where labels live

Labels are tracked on the `ai_models` row (created/owned by the website + backend):

| Field | What it is | Synced to mobile? |
|---|---|---|
| `detection_capabilities` | the **ordered class list** (canonical record) | ✅ (`detection_capabilities`, optional) |
| `labels_path` | storage path to the deployable **`.TXT`** labels file (one label per line, in class order) | ✅ (`labels_path`) |
| `label_map` | website-side mapping of each class → a species/taxon or "background" | ❌ (website-only; used to reflect predictions on the website, not needed on-device) |

### What the app does with them

`AiModelService.ensureFilesDownloaded` ([`src/services/AiModelService.ts`](../../src/services/AiModelService.ts))
downloads **both** files from storage when preparing a model:

```typescript
// model binary
const modelUri  = await this.downloadFileIfMissing(model.modelPath, …)
// labels file (model.labelsPath → labels_<cacheKey>.txt)
const labelsUri = model.labelsPath
    ? await this.downloadFileIfMissing(model.labelsPath, …)  // no size check for labels
    : null
```

The labels file is then transferred to the SD card `/MANIFEST/` next to the `.TFL`
(same BLE file-transfer pipeline), so the firmware can load `labels.txt` and write named
NN scores into each photo's EXIF. The label **order must match** the model's output
tensor — the website writes `labels.txt` in the model's class order to guarantee this.

> The full label lifecycle (origin → website mapping → device → EXIF) is in the
> [Embedded Model Lifecycle](../../../ww-website/documentation/resources/embedded-model-lifecycle.md).

---

## Key Source Files

| File | Purpose |
|------|---------|
| `src/database/models/AiModel.ts` | WatermelonDB model with firmware ID fields |
| `src/services/AiModelService.ts` | AI model metadata, label + binary download, registration |
| `src/screens/Devices/AiModelTransferScreen.tsx` | Model upload UI |
| `src/ble/protocol/fileTransfer/` | File transfer pipeline |
| `src/ble/protocol/commandRegistry.ts` | `loadmodel`, `erasemodel`, `getop` commands |

---

*Last Updated: June 20, 2026*
