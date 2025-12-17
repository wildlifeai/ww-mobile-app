# Proposal: Deployment ID Sync via Operational Parameters

## Problem
The current method of sending the Deployment ID (`setdeploymentid <36-char-uuid>`) creates a BLE packet effectively larger than 50 bytes. 
On devices that fail to negotiate a higher MTU (like the Samsung Galaxy A05 falling back to 27 bytes), this command exceeds the maximum payload size (~20 bytes) and fails to transmit.

## Function
To reliably transmit the 36-character UUID (128-bit + hyphens) over a low-MTU connection, we propose splitting the ID into **8 Operational Parameters** (16 bits each).

### 1. Mobile App Logic

**Step 1: Parsing**
1.  Take the UUID string (e.g., `550e8400-e29b-41d4-a716-446655440000`).
2.  Remove hyphens to get a 32-character hex string.
3.  Split this string into 8 chunks of 4 characters each.
    *   Chunk 1: `550e`
    *   Chunk 2: `8400`
    *   ...etc.
4.  Convert each hex chunk into a decimal integer (0-65535).

**Step 2: Transmission**
Send 8 separate BLE commands using `setop`. We propose using indices **20-27**.

*   `AI setop 20 <chunk1_int>`
*   `AI setop 21 <chunk2_int>`
*   ...
*   `AI setop 27 <chunk8_int>`

*Note: Each command string (e.g., `AI setop 20 65535`) is ~17 bytes, which fits safely within the 20-byte payload limit of a default BLE connection.*

### 3. End Deployment (Clearing ID)
When ending a deployment, the Mobile App must clear the Deployment ID on the device.
1.  Send 8 separate BLE commands setting all Operational Parameters (20-27) to `0`.
    *   `AI setop 20 0`
    *   ...
    *   `AI setop 27 0`
2.  The firmware will reconstruct this as `00000000-0000-0000-0000-000000000000`, indicating no active deployment.

### 2. Hardware / Firmware Changes

**CONFIG.TXT Updates**
Add the following default keys to `CONFIG.TXT` on the SD card to initialize the storage:
```text
OP20 = 0
OP21 = 0
OP22 = 0
OP23 = 0
OP24 = 0
OP25 = 0
OP26 = 0
OP27 = 0
```

**Firmware Logic (Himax)**
On wake-up/initialization:
1.  Read Operational Parameters 20 through 27.
2.  Convert each integer value back to a 4-digit hex string (padded with leading zeros if needed).
3.  Concatenate the 8 hex strings to form the 32-char sequence.
4.  Insert hyphens at the standard positions (8-4-4-4-12) to reconstruct the UUID.
    *   Format: `XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX`
5.  **Usage**:
    *   Store as `Deployment ID` in internal state.
    *   Embed in the "UserComment" or "Notes" field of the image EXIF metadata.
    *   Save to the image metadata sidecar file (if applicable).

## Implementation Plan

### Mobile App (`wildlife-watcher-mobile-app`)
1.  **Modify `src/utils/helpers.ts`**: Add `parseUuidToOps(uuid: string): number[]`.
2.  **Modify `src/hooks/useBleCommands.ts`**: Add `setDeploymentIdAsOps` function that iterates and calls `setOperationalParam`.
3.  **Modify `DeploymentService.ts`**: Update the Start Deployment flow to use `setDeploymentIdAsOps` instead of `setDeploymentId`.
4.  **End Deployment Flow**: Implement logic to send 8 zeros to correct indices when ending deployment.
5.  **Remove Legacy Code**: Completely remove `setdeploymentid` command definition and usage to prevent accidental usage.

### Seed Grove / WW Hardware
1.  **Update `CONFIG.TXT`**: Add `OP20`..`OP27` defaults.
2.  **Update Firmware C++**:
    *   Define `OP_DEPLOYMENT_ID_START 20`.
    *   Implement reconstruction function `get_deployment_id_string()`.
    *   Call this function when tagging images.

## Example Data Flow

**Input UUID**: `550e8400-e29b-41d4-a716-446655440000`

| Op Index | Hex Chunk | Decimal Value | Command Sent |
| :--- | :--- | :--- | :--- |
| 20 | `550e` | 21774 | `AI setop 20 21774` |
| 21 | `8400` | 33792 | `AI setop 21 33792` |
| 22 | `e29b` | 58011 | `AI setop 22 58011` |
| 23 | `41d4` | 16852 | `AI setop 23 16852` |
| 24 | `a716` | 42774 | `AI setop 24 42774` |
| 25 | `4466` | 17510 | `AI setop 25 17510` |
| 26 | `5544` | 21828 | `AI setop 26 21828` |
| 27 | `0000` | 0 | `AI setop 27 0` |
