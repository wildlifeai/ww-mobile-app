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
