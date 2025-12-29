# BLE Command Architecture & Development Guide

## Overview

The Wildlife Watcher mobile app uses a **centralized BLE command architecture** to ensure consistency and maintainability. This guide explains how to work with BLE commands and processes correctly.

## Core Principles

### 1. Single Source of Truth
- **Engineer Console** is the testing ground and reference implementation
- All BLE commands and processes are first implemented and tested there
- Other screens reuse these commands via hooks and utilities

### 2. Hook-First Approach
- Never duplicate BLE logic in multiple places
- Always use or create reusable hooks
- Update hooks to propagate changes everywhere

## Architecture Components

### Command Reference (`src/ble/types.ts`)

Central registry of all BLE commands. Every command is defined once:

```typescript
export const COMMANDS = {
  battery: {
    name: CommandNames.battery,
    writeCommand: () => "Battery",
    readCommand: "Battery = {value}mV {percent}%",
    description: "Check battery level",
    type: 'command'
  },
  // ... more commands
}
```

**Rules:**
- ✅ Add new commands here first
- ✅ Test via Engineer Console
- ❌ Never hardcode command strings elsewhere

### BLE Hooks (`src/hooks/`)

#### `useBleCommands.ts`
Individual command functions:

```typescript
const { getBatteryLevel, checkSdCard, ping Network } = useBleCommands()

// Use like this:
await getBatteryLevel(device)
```

#### `useCapturePreview.ts`
Complete CAPTURE_REVIEW process:

```typescript
const { capturedImageUri, isCapturing, startCapture } = useCapturePreview({
  device: bleDevice,
  logs: bleDeviceLogs,
  write: bleWrite,
  onImageReceived: (uri) => console.log('Image:', uri)
})
```

**Purpose:** Encapsulate multi-step BLE processes

## Development Workflow

### Adding a New Command

1. **Define in `types.ts`**
   ```typescript
   [CommandNames.newCommand]: {
     name: CommandNames.newCommand,
     writeCommand: () => "New Command",
     description: "What it does",
     type: 'command'
   }
   ```

2. **Add to `useBleCommands.ts`**
   ```typescript
   const runNewCommand = useCallback(async (peripheral) => {
     await write(peripheral, [[CommandNames.newCommand, { control: READ }]])
   }, [write])
   ```

3. **Test in Engineer Console**
   - Add to `handleQuickAction` switch
   - Test all edge cases
   - Verify response parsing

4. **Use in Other Screens**
   ```typescript
   const { runNewCommand } = useBleCommands()
   await runNewCommand(device)
   ```

### Creating a Process Hook

For multi-step processes (like CAPTURE_PREVIEW):

1. **Create hook file** (`src/hooks/useMyProcess.ts`)
2. **Encapsulate entire flow**
   - State management
   - Command sending
   - Response monitoring
   - Error handling
3. **Test in Engineer Console first**
4. **Use across multiple screens**

## Device Preparation & Operational Parameters

### Overview

Device preparation configures Wildlife Watcher camera settings for field deployment. The process uses **operational parameters** stored in `CONFIG.TXT` on the device SD card.

### `useDeviceSettings` Hook

Manages operational parameters with friendly property names:

```typescript
const { updateSettings, applyPreset, isUpdating } = useDeviceSettings({
    device: bleDevice,
    onSettingsUpdated: () => console.log('Settings saved!'),
    onError: (error) => Alert.alert('Error', error.message)
})

// Update individual settings
await updateSettings({
    cameraEnabled: false,
    motionDetectInterval: 1000,
    timelapseInterval: 0
})

// Or use presets
await applyPreset('motion-detect')
```

### Operational Parameters

14 configurable parameters control camera behavior:

| Index | Parameter | Default | Description |
|-------|-----------|---------|-------------|
| 5 | NUM_PICTURES | 3 | Images per trigger |
| 6 | PICTURE_INTERVAL | 1500 | Interval between images (ms) |
| 7 | TIMELAPSE_INTERVAL | 60 | Timelapse interval (s), 0=off |
| 9 | LED_BRIGHTNESS | 5 | Flash brightness (%) |
| 10 | CAMERA_ENABLED | 1 | 0=disabled, 1=enabled |
| 11 | MD_INTERVAL | 1000 | Motion detection interval (ms), 0=off |
| 12 | FLASH_DURATION | 100 | LED flash duration (ms) |
| 13 | FLASH_LED | 0 | LED mask: 1=visible, 2=IR |

### Preset Commands

User-friendly commands for common configurations:

```typescript
ENABLE_CAMERA               // Turn camera on
DISABLE_CAMERA              // Turn camera off
SET_MOTION_DETECT_INTERVAL  // Configure motion detection (default: 1000ms)
DISABLE_MOTION_DETECT       // Turn off motion detection
SET_TIMELAPSE_INTERVAL      // Configure timelapse (default: 900s)
DISABLE_TIMELAPSE           // Turn off timelapse
SET_NUM_PICTURES            // Set images per trigger (default: 3)
SET_PICTURE_INTERVAL        // Set interval between images (default: 1500ms)
```

All preset commands:
- Appear as 'process' type in Command Reference
- Use correct `AI setop <index> <value>` format
- Include sensible defaults
- Can be tested in Engineer Console

### Device Preparation Flow

**Step 1:** Select project → determines capture method (Motion Detection vs Timelapse)

**Step 2:** Connect and run system checks (battery, SD card, selftest, firmware)

**Step 3:** Sync device time with phone

**Step 4:** Test camera capture

**Step 5:** Configure settings based on project:

```typescript
if (project.capture_method_id === 1) {
    // Activity Detection
    await updateSettings({
        motionDetectInterval: 1000,
        timelapseInterval: 0,
        cameraEnabled: false  // Disable camera, keep settings for deployment
    })
} else if (project.capture_method_id === 2) {
    // Timelapse
    await updateSettings({
        motionDetectInterval: 0,
        timelapseInterval: project.timelapse_interval_seconds || 900,
        cameraEnabled: false  // Disable camera, keep settings for deployment
    })
}
```

**Why Disable Camera?**
- Prevents accidental captures during transport
- Saves battery
- Settings are preserved in CONFIG.TXT

**Step 6:** Save preparation record to WatermelonDB

**Step 7:** Navigate back to previous screen with message:
- ✅ Success: "Device ready to be deployed"
- ❌ Failed: Lists specific reasons (SD card issue, config failed)

### Testing

**Engineer Console:**
1. Open Command Reference modal
2. Find preset commands under "Process Commands"
3. Click "Run" to test with defaults
4. Verify in device stats logs

**Device Preparation:**
1. Select Motion Detection project
2. Complete preparation
3. Check device stats: Index 11 = 1000, Index 7 = 0, Index 10 = 0 ✅

## BLE Timing Requirements & Firmware Constraints

> **⚠️ CRITICAL**: Understanding these timing requirements is essential for reliable BLE communication with Wildlife Watcher devices.

### Deep Power Down (DPD) Wake Cycle

The AI processor enters **Deep Power Down mode** after 1000ms of inactivity to conserve battery. This has critical implications for command sequences:

**Firmware Behavior** (from `aiProcessor.c`):
- **Inactivity Timer**: 1000ms (hardware-enforced, cannot be changed from app)
- **Wake Mechanism**: First command after DPD triggers a wake pulse
- **Wake Process**: ~200-500ms for AI processor to fully wake and become responsive
- **State Tracking**: Firmware tracks `aiIsAwake` boolean

**Command Queueing**:
```c
// From aiProcessor.c line 702-708
if (i2cTxPendingMsg != NULL) {
    LOG("Discarding message as there is already one pending");
}
```
- **Single-slot buffer**: Only ONE pending command allowed during wake
- **Dropped commands**: Rapid-fire commands during wake-up get discarded
- **Retry mechanism**: Commands sent while asleep are queued and retried after "Wake" message

### Critical Timing Parameters

**Global BLE Write Pause** (`useBle.ts`):
```typescript
const PAUSE = 20  // milliseconds between queued BLE writes
```
- Optimized from original 500ms → 50ms → 20ms
- Ensures 8-command sequence completes within 1000ms window
- Prevents device from entering DPD mid-sequence

**Wake-Up Delay** (`useBleCommands.ts: setDeploymentIdAsOps`):
```typescript
if (i === 0) {
    await new Promise(r => setTimeout(r, 200))  // Wake delay after first setop
}
```
- 200ms delay after FIRST `setop` command
- Allows AI processor to transition from DPD → Awake
- Prevents subsequent commands from being discarded

**Stabilization Delay** (End Deployment):
```typescript
await disableCamera(bleDevice)
await new Promise(r => setTimeout(r, 1000))  // Stabilization delay
```
- 1000ms delay after `disableCamera` command
- `disableCamera` wakes the AI processor
- Subsequent config changes need device fully awake

### Command Format Requirements

**GPS String Format**:
```typescript
// ❌ WRONG - Firmware does NOT strip quotes
await write(device, [[CommandNames.setgps, { value: '"0 0 0"' }]])

// ✅ CORRECT - Send raw values
await write(device, [[CommandNames.setgps, { value: "0 0 0" }]])
```

**Evidence from `ble_commands.c:processSetGps()`**:
```c
// Line 1098: Direct string copy without quote stripping
snprintf(gpsString, GPSSTRINGLENGTH, "%s", p_gpsString);
```

**Format**: `latitude longitude altitude` (space-separated, no quotes)
- Valid: `"20.123 -100.456 120.5"`
- Valid (clear): `"0 0 0"`
- Invalid: `""` (empty string)
- Invalid: `"\"0 0 0\""` (quoted values)

### Best Practices for Command Sequencing

**✅ DO**:
1. **Use existing hooks**: `setDeploymentIdAsOps` includes optimized timing
2. **Serialize multi-command operations**: Wait for completion before starting next flow
3. **Add stabilization delays**: 1000ms after wake-triggering commands
4. **Use `clearGpsLocation` hook**: Sends correct `"0 0 0"` format

**❌ DON'T**:
1. **Send rapid commands**: Violates firmware's single-slot buffer
2. **Skip wake delays**: Commands will be discarded
3. **Hardcode timing**: Use hooks that encapsulate correct delays
4. **Send quoted GPS values**: Firmware doesn't parse quotes

### Example: Correct Preparation Flow

```typescript
// From PrepareAndTestScreen.tsx
const runBleInitialization = async () => {
    // Step 0: Disable camera (wakes device)
    await disableCamera(bleDevice)
    await new Promise(r => setTimeout(r, 1000))  // Stabilization

    // Step 1: Selftest (device now awake)
    await runSelfTest(bleDevice)
    await waitForLogMatch(/Error\s*bits/, 3000)

    // Step 2: Set UTC
    await setUtc(bleDevice)
    await waitForLogMatch(/UTC is:/, 2000)

    //Step 3: Clear deployment ID (uses optimized hook with 200ms wake delay)
    await setDeploymentIdAsOps(bleDevice, null)

    // Step 4: Clear GPS (uses correct format)
    await clearGpsLocation(bleDevice)
}
```

### Debugging Command Issues

**Symptoms of Timing Violations**:
- Log message: `"Discarding message as there is already one pending"`
- Commands appear sent but device doesn't respond
- Intermittent failures that succeed on retry

**Solutions**:
1. Add delays between command sequences (200-1000ms)
2. Use `setDeploymentIdAsOps` instead of manual loops
3. Serialize operations (don't send concurrent commands)
4. Check firmware logs for wake/sleep cycles

**Firmware Log Indicators**:
```
AI processor is awake at '2025-12-29T10:07:56Z'  // Device ready
AI processor is in DPD (sends parameters).       // Device sleeping
```

## Best Practices

### ✅ DO:

- **Reuse existing hooks**
  ```typescript
  // Good ✅
  const { getBatteryLevel } = useBleCommands()
  await getBatteryLevel(device)
  ```

- **Create hooks for reusable processes**
  ```typescript
  // Good ✅ - Used in 3+ places
  const { startCapture } = useCapturePreview({ ... })
  ```

- **Test in Engineer Console first**
  - Verify command syntax
  - Test error cases
  - Confirm response parsing

### ❌ DON'T:

- **Hardcode command strings**
  ```typescript
  // Bad ❌
  await write(device, ['Battery'])
  
  // Good ✅
  await getBatteryLevel(device)
  ```

- **Duplicate BLE logic**
  ```typescript
  // Bad ❌ - Same logic in 3 screens!
  const [isCapturing, setIsCapturing] = useState(false)
  useEffect(() => {
    if (logs.includes('Captured')) { /* ... */ }
  }, [logs])
  
  // Good ✅ - One hook used everywhere
  const { isCapturing, startCapture } = useCapturePreview({ ... })
  ```

- **Create screen-specific BLE implementations**
  - Always extract to hooks
  - Make it reusable

## Testing & Verification

### Engineer Console is Your Test Tool

1. **Command Reference Modal**
   - Shows all available commands
   - Click "Run" to test
   - View raw responses

2. **Manual Command Entry**
   - Type raw commands
   - See TX/RX logs
   - Debug issues

3. **Quick Actions**
   - Test common workflows
   - Verify automation
   - Check edge cases

## File Structure

```
src/
├── ble/
│   ├── types.ts              # Command definitions (SOURCE OF TRUTH)
│   ├── parser.ts             # Response parsing
│   └── emitters.ts           # Event emitters
├── hooks/
│   ├── useBle.ts             # Low-level BLE operations
│   ├── useBleCommands.ts     # Individual commands
│   ├── useCapturePreview.ts  # CAPTURE_PREVIEW process
│   └── ...                   # Other process hooks
└── navigation/screens/
    └── EngineerConsoleScreen.tsx  # Testing ground & reference
```

## Common Patterns

### Battery Check
```typescript
const { getBatteryLevel } = useBleCommands()
const [batteryLevel, setBatteryLevel] = useState<number | null>(null)

// Send command
await getBatteryLevel(device)

// Parse from logs
useEffect(() => {
  const match = logs.match(/Battery = \d+mV (\d+)%/)
  if (match) setBatteryLevel(parseInt(match[1]))
}, [logs])
```

### Image Capture
```typescript
const { capturedImageUri, isCapturing, startCapture } = useCapturePreview({
  device: bleDevice,
  logs: logs,
  write: write,
  onImageReceived: (uri) => {
    // Handle received image
  }
})

// UI
<Button onPress={startCapture} loading={isCapturing}>
  Capture Image
</Button>
{capturedImageUri && <Image source={{ uri: capturedImageUri }} />}
```

## Maintenance

### When to Update a Hook

Update hooks when:
- Command response format changes
- New features needed across multiple screens
- Bug fixes required
- Performance improvements possible

### Propagation is Automatic

✅ Change hook → All screens updated automatically
❌ Change inline code → Must update every screen manually

## Quick Reference

| Need to... | Use... |
|------------|--------|
| Send single command | `useBleCommands()` |
| Capture image | `useCapturePreview()` |
| Parse responses | Check `src/ble/parser.ts` |
| Test commands | Engineer Console |
| Add new command | 1. `types.ts` 2. `useBleCommands.ts` 3. Test |
| Create process | New hook in `src/hooks/` |

## Questions?

1. Check Engineer Console implementation
2. Review existing hooks
3. Look for similar patterns
4. When in doubt, extract to a hook

---

**Remember:** Engineer Console is your playground. Test there, extract to hooks, reuse everywhere!
