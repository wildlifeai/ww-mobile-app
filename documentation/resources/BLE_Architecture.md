# BLE Architecture & Development Guide

## Overview

The Wildlife Watcher mobile app communicates with hardware devices over **Bluetooth Low Energy (BLE)** using the Nordic UART Service (NUS). All communication is routed through an **event-driven architecture** built around `bleEventBus`, `commandRegistry`, and `bleTransportController`. Commands are serialized, matched against typed response parsers, and resolved through a deterministic pipeline.

The app supports two data channels on the same BLE characteristic:
- **Text commands** — ASCII strings for configuration and control (e.g. `AI capture 1 1`)
- **Binary image data** — Raw JPEG bytes prefixed with a `0x06` marker

> [!CAUTION]
> The legacy `BleCommandManager` (`commandManager.ts`) is **dead code**. It exists only as a quarantine trap file that throws an error if imported. All command execution now flows through `bleEventBus` → `bleTransportController` → `commandRegistry`. Do NOT reference or import it.

---

## Command Routing Decision Matrix

Developers **must** use the correct write path for each use case. Misuse causes unpredictable firmware behavior.

| Use Case | Correct Path | Why |
|---|---|---|
| Raw terminal / Engineer Console | `writeRaw()` | Passive observation; no state dependencies or expected callbacks. |
| Deployment workflow / Safe UI actions | `bleSession.execute()` | Enqueues deterministic commands, blocks UI, handles timeout and parse matching. |
| Internal serialization | `bleTransportController` | Underlying queue engine managing the `bleSession` promises. |
| Binary streaming (Images) | passive `bleEventBus` only | Byte-level routing via `rxRouter`, entirely out-of-band. |
| Motion detection `md` sensitivity | direct `writeToDevice()` | Must bypass the transport controller to avoid blocking `setop`/`capture`. |
| Motion detection `setop`/`capture` | `bleSession.execute()` | Queued commands that follow the md sensitivity write. |
| Motion detection grid events | passive `textLine` subscription | Async text lines parsed via `useMotionDetectionStream`. |

> [!WARNING]
> **Never** call `writeRaw()` from a deployment workflow. Never call `bleSession.execute()` from the Engineer Console. These boundaries exist to prevent determinism violations.
>
> The motion detection `md` command is the **one exception** to the queue rule — it uses direct `writeToDevice()` because the command always times out (~5s) due to the nRF52 Wake(MD) race, and that timeout blocks the queue, pushing `capture` into the Himax's Save State window.

---

## Architecture Diagram

```mermaid
graph TB
    A[useSetupBLELibrary] -->|"BleManager.start()"| B[bleLibrarySlice Redux]
    B -->|"initialized = true"| C[BleEngineProvider]
    C -->|"provides useBle actions"| D[ListenToBleEngineProvider]
    D -->|"useBleListeners()"| E[Native BLE Event Listeners]
    E -->|"raw bytes"| F[rxRouter]
    F -->|"text lines"| G[bleEventBus]
    F -->|"binary packets"| G
    G -->|"textLine"| H[bleTransportController / runCommandPipeline]
    G -->|"binaryPacket"| I[ImageReassembler]
    G -->|"rawRx"| J[Redux Log Store]

    style A fill:#4a9eff,color:#fff
    style C fill:#6c5ce7,color:#fff
    style F fill:#e17055,color:#fff
    style G fill:#00b894,color:#fff
```

> [!IMPORTANT]
> `ListenToBleEngineProvider` **must** exist in the `App.tsx` tree. Without it, no BLE event listeners are registered and the app silently fails to receive any data.

---

## Event Taxonomy (Frozen)

The `bleEventBus` emits **7 event types**. This contract is frozen. All events include `ts` (timestamp) and `deviceId` to prevent crosstalk during multi-device scanning.

| Event | Channel Name | Payload | Purpose |
|---|---|---|---|
| `TEXT_LINE` | `textLine` | `{ line: string, ts: number, deviceId: string }` | Parsed ASCII response from device |
| `RAW_TX` | `rawTx` | `{ command: string, ts: number, deviceId: string }` | Outbound command echo (for logging) |
| `RAW_RX` | `rawRx` | `{ line: string, ts: number, deviceId: string }` | Raw inbound text (for logging) |
| `BINARY_PACKET` | `binaryPacket` | `{ data: Uint8Array, ts: number, deviceId: string, packetNum: number, length: number }` | Image binary data |
| `QUEUE_STATE_CHANGED` | `queueStateChanged` | `{ isBusy: boolean, ts: number, deviceId?: string }` | Command queue busy/idle transitions |
| `DEVICE_SIGNAL` | `deviceSignal` | `{ signal: DeviceSignalType, ts: number, deviceId: string }` | Sleep/Wake/Busy/ConfigError/Disconnect lifecycle signals |
| `HEARTBEAT_PAUSE` | `heartbeatPause` | `{ isPaused: boolean, ts: number, deviceId?: string }` | Pauses/resumes heartbeat during long-running operations |

`DeviceSignalType` is one of: `'SLEEP'`, `'WAKE'`, `'BUSY'`, `'CONFIG_ERROR'`, `'DISCONNECT'`.

- **`BUSY`**: Transient. Device temporarily unavailable. Queue pauses, retries after delay.
- **`CONFIG_ERROR`**: Persistent. Device in invalid state (e.g. `Camera system not enabled` = OP 10 is 0). Queue does NOT pause. Command rejected immediately, non-retryable.

**File:** [eventBus.ts](../../src/ble/protocol/eventBus.ts), [deviceSignals.ts](../../src/ble/protocol/deviceSignals.ts)

---

## Data Flow

### Text Command Pipeline (Session-Based)

```mermaid
sequenceDiagram
    participant UI as Screen/Hook
    participant Sess as useBleSession
    participant Queue as commandQueue
    participant Run as runCommand
    participant Reg as commandRegistry
    participant TX as transport.ts
    participant FW as Firmware
    participant Bus as bleEventBus

    UI->>Sess: session.execute(commandRegistry.battery)
    Sess->>Queue: enqueue(commandContext)
    Queue->>Run: runCommand(peripheral, context)
    Run->>Bus: subscribe to textLine
    Run->>TX: writeToDevice(peripheral, "battery")
    TX->>FW: BLE WriteWithoutResponse
    FW-->>Bus: rxRouter → textLine event
    Bus-->>Run: event.line matches context.successMatcher
    Run->>Run: context.collect(line)
    Run->>Run: context.isComplete() → true
    Run-->>Queue: context.parser() → 100
    Queue-->>Sess: resolve(100)
    Sess-->>UI: batteryLevel = 100
```

### Binary Image Pipeline

```mermaid
sequenceDiagram
    participant UI as useCapturePreview
    participant Sess as useBleSession
    participant TX as transport.ts
    participant Router as rxRouter
    participant Bus as bleEventBus
    participant IR as ImageReassembler
    participant FS as FileSystem

    UI->>Sess: session.execute(capture)
    Sess-->>UI: "Captured 1 images..."
    UI->>Sess: session.execute(txfile)
    Note over Router: "7272 bytes in TL000163.JPG"
    Router->>Bus: textLine (announces byte count)
    Bus->>IR: initialize(7272)

    loop For each BLE notification
        Note over Router: value[0] == 0x06? → binary
        Router->>Bus: binaryPacket event
        Bus->>IR: processPacket(data)
        IR-->>UI: emit onImageProgress 0.45
    end

    Note over IR: totalBytesReceived >= 7272
    IR->>FS: writeAsStringAsync(base64)
    IR-->>UI: emit onImageComplete fileUri

    Note over Router: "Finished sending 7272 bytes"
    Router-->>UI: force_finalize safety net
```

> [!NOTE]
> Image packets are **intercepted in `rxRouter` before any string conversion** to avoid JS thread congestion. They are routed directly to the `ImageReassembler` via `bleEventBus.binaryPacket` and never logged.

---

## Command Registry Schema (Frozen)

Every command in `commandRegistry.ts` is a factory function that returns a `CommandContext<T>`. The schema is frozen:

```typescript
interface CommandContext<T> {
  id: string;
  name: string;
  build: (params?: any) => string;          // UART payload generator

  // --- Matchers ---
  successMatcher: (line: string) => boolean; // Identifies success lines
  failureMatcher: (line: string) => boolean; // Identifies failure lines
  match: (line: string) => boolean;          // Combined (success OR failure)

  // --- Collection ---
  collect: (line: string) => void;           // Accumulate matched lines
  isComplete: () => boolean;                 // Authority on lifecycle

  // --- Extraction ---
  parser: () => T;                           // Semantic result extraction
  getResult: () => T;                        // Alias (backwards compat)

  // --- Safety & Lifecycle ---
  timeoutMs?: number;                        // Per-command timeout
  retryPolicy?: {
    maxRetries: number;
    delayMs?: number;
  };
  responseMode?: 'single_line' | 'multi_line' | 'fire_and_forget' | 'stream';
  idempotent?: boolean;                      // Safe to retry without side effects
  safeDuringStreaming?: boolean;              // Can be sent during active binary stream

  // --- Hooks ---
  onUnexpected?: (line: string) => void;     // Logging for unmatched lines
  onTimeout?: () => void;                    // Custom timeout recovery
}
```

**Two factory helpers** simplify creation:
- `createSingleLineCommand<T>()` — for commands expecting one response line
- `createMultiLineCommand<T>()` — for commands expecting multiple lines terminated by an end marker

**File:** [commandRegistry.ts](../../src/ble/protocol/commandRegistry.ts)

---

## Multi-Step Workflow Failure Semantics

Deployment workflows (e.g. `useStartDeployment`) execute multiple BLE commands as an ordered pipeline. The failure contract is:

### Atomic Segments
Configuration bursts (e.g. `setdid` → `setgps` → `setop` × N → `setutc`) are executed sequentially via `commandQueue`.

### Fail-Fast Boundary
If **any** step times out or fails (e.g., Step 3 `setop` fails), the entire sequence aborts immediately. The queue does not attempt subsequent commands.

### No Automatic Rollback
The BLE queue does **not** revert previously sent commands. Previously-written OpParams remain on the device. This is intentional — it preserves the device state for debugging.

### Partial Success Handling
The UI tracks partial failures explicitly (e.g. `initErrors = { setUtc: "Timeout" }`), transitioning to a "Failed Initialization" state that requires **operator intervention** to retry the workflow from scratch.

### Operator Recovery Path
1. Operator sees the specific error in the UI (e.g. "GPS set failed: Timeout")
2. Operator can retry the entire deployment flow (which re-runs all steps)
3. Read-before-write checks (`getAllOperationalParams()`) skip parameters already at the target value

> [!IMPORTANT]
> There is no partial-retry mechanism. The entire configuration burst is re-executed from scratch. The read-before-write pattern ensures this is safe (already-set values are skipped).

---

## Core Components

### 1. Library Setup (`useSetupBLELibrary`)

Calls `BleManager.start()` on app launch and updates the `bleLibrarySlice` Redux state. All BLE operations check `initialized` before proceeding.

**File:** [useSetupBLELibrary.ts](../../src/hooks/useSetupBLELibrary.ts)

---

### 2. Engine Provider (`BleEngineProvider`)

React Context that wraps the core `useBle` hook. Provides `startScan`, `stopScan`, `connectDevice`, `disconnectDevice`, `writeRaw` and scan/connection control to the entire app tree.

**File:** [BleEngineProvider.tsx](../../src/providers/BleEngineProvider.tsx)

---
### 3. Listener Provider (`ListenToBleEngineProvider`)

Thin wrapper that calls `useBleListeners()` to register native event handlers. This is the entry point for **all incoming BLE data**.

**File:** [ListenToBleEngineProvider.tsx](../../src/providers/ListenToBleEngineProvider.tsx)

### 4. Connection & Write (`useBle`)

The foundational hook providing:

| Function | Purpose |
|---|---|
| `startScan(length?)` | Scan for nearby Wildlife Watcher devices |
| `stopScan()` | Stop an active discovery scan |
| `connectDevice(peripheral)` | Connect, discover services, enable notifications, negotiate MTU |
| `disconnectDevice(peripheral)` | Clean disconnect |
| `writeRaw(peripheral, command)` | Send raw ASCII string to device (no queue, no parsing) |

**Scan lifecycle:**
`startScan()` always calls `BleManager.stopScan()` before starting a new scan. This eliminates a race condition where the native `BleManagerStopScan` event could lag behind, leaving the Redux `isScanning` flag stale and silently blocking subsequent scan cycles. The function does **not** gate on `isScanning` state — the stop-before-start pattern is unconditionally safe.

**Connection sequence on Android:**
1. `BleManager.stopScan()` (always, even if no scan is active)
2. 500ms GATT cleanup delay (prevents race with previous `removePeripheral`)
3. `BleManager.connect()`
4. `BleManager.retrieveServices()` → find Nordic UART (NUS) service
5. `BleManager.startNotification()` — enable CCCD **before** MTU negotiation
6. `requestConnectionPriority(HIGH)` — reduce connection interval (~11-15ms)
7. `requestMTU(512)` — maximize packet size for image transfers
8. `BleManager.readRSSI()` — read signal strength

**Connection sequence on iOS:**
1. `BleManager.stopScan()` (always)
2. `BleManager.connect()`
3. `BleManager.retrieveServices()` → find Nordic UART (NUS) service
4. `BleManager.startNotification()` — enable CCCD

> [!NOTE]
> iOS handles MTU negotiation automatically at the Core Bluetooth level (typically 185–512 bytes depending on the iOS version and peripheral). `requestConnectionPriority` and `requestMTU` are **Android-only** APIs and are skipped on iOS.

**File:** [useBle.ts](../../src/hooks/useBle.ts)

---

### 4a. Scanning & Discovery

Two scan consumers exist in the app. Both share the **same scan loop** via `useScanLoop`, which cycles 3-second scan bursts with a 300ms inter-burst delay.

#### Shared Scan Loop (`useScanLoop`)

Centralized hook that eliminates duplicate scan orchestration code:

| Feature | Implementation |
|---|---|
| **Burst cycling** | 3-second scans via `startScan(3)`, 300ms gap between bursts |
| **Active flag** | Consumer passes `active: boolean` — loop starts/stops reactively |
| **Scan lock** | `scanLockRef` prevents double-start races (500ms cooldown) |
| **Cache flush** | `flushBleCache()` clears Redux + Android native BLE cache |

**`flushBleCache()` sequence:**
1. Dispatch `clearDiscoveredDevices()` — removes all non-connected devices from Redux
2. (Android) `getDiscoveredPeripherals()` → `removePeripheral()` on each cached, non-connected device
3. Only peripherals still in the native cache are removed — devices already cleared during disconnect are skipped to avoid redundant GATT cleanup

> [!WARNING]
> The `flushBleCache` callback must **not** depend on `devices` state. Including it causes cascading re-renders and stale closures. The `dispatch(clearDiscoveredDevices())` is sufficient — the native cache check is independent.

**File:** [useScanLoop.ts](../../src/hooks/useScanLoop.ts)

#### Device Discovery Scanner (`useDeviceDiscovery`)

Used by the main **DeviceDiscoveryScreen** for deployment workflows:

| Feature | Implementation |
|---|---|
| **Session-based** | User presses "Search" → 60-second countdown session |
| **Scan loop** | `useScanLoop({ active: isActuallyFocused && isReady && scanSessionActive && !isEngineerConsoleActive })` |
| **Cache flush on start** | `flushBleCache()` + `autoConnect.resetAll()` |
| **Auto-connect** | Strongest-signal device auto-connected via `useAutoConnectStateMachine` |
| **Signal tracking** | Devices marked `signalLost: true` when not found in scan results |
| **Stop on blur** | Session **stops entirely** when screen loses focus, drawer opens, or tab changes — user must press "Search" again |

**Session start sequence:**
1. Reset auto-connect state machine — all devices return to `DISCOVERED` state
2. `flushBleCache()` — clears stale Redux devices and native BLE cache
3. Start 60-second countdown timer
4. `useScanLoop` begins burst cycling

**Session stop triggers (any of):**
- 60-second timer expires
- Screen loses focus (`isFocused` → `false`)
- Drawer opens (`isDrawerOpen` → `true`)
- Tab changes (`isActiveTab` → `false`)
- User cancels

**File:** [useDeviceDiscovery.ts](../../src/screens/Devices/hooks/useDeviceDiscovery.ts)

#### Engineer Console Scanner (`useEngineerConnect`)

Used by the **Engineer Console** for quick device access:

| Feature | Implementation |
|---|---|
| **Dialog-driven** | `beginScan()` opens the search dialog |
| **Scan loop** | `useScanLoop({ active: dialogState === 'scanning' && !isConnectingRef.current })` |
| **Cache flush on start** | `flushBleCache()` called in `beginScan()` |
| **Auto-connect first device** | Immediately connects to the strongest signal device |
| **No session timeout** | Scans until a device is found or the dialog is dismissed |

> [!IMPORTANT]
> Both scan consumers call `flushBleCache()` before starting. This ensures stale Redux devices and native BLE cache entries from prior sessions don't interfere with discovery.

**File:** [useEngineerConnect.ts](../../src/hooks/useEngineerConnect.ts)

#### Auto-Connect State Machine (`useAutoConnectStateMachine`)

Manages per-device auto-connect eligibility to prevent reconnect loops:

```
DISCOVERED → ROUTING_PENDING → ACCEPTED
                              → REJECTED → IGNORED_FOR_SESSION
Any → DISCOVERED  (on screen re-focus / resetAll)
```

Only `DISCOVERED` devices are eligible for auto-connect. Once a device transitions to `IGNORED_FOR_SESSION` (via dialog dismiss or explicit disconnect), it stays ignored until the user navigates away and back.

**File:** [useAutoConnectStateMachine.ts](../../src/screens/Devices/hooks/useAutoConnectStateMachine.ts)

---

### 5. Rx Router (`rxRouter`)

The first function to touch raw incoming bytes from BLE notifications. Performs binary detection, text sanitisation, and event routing:

```
if value[0] == 0x06 or (value[0] == 0x80 && value[1] == 0x06):
    → bleEventBus.emitEvent({ type: 'BINARY_PACKET', ... })
    → return early (skip ALL string processing)
else:
    → emit RAW_RX (unsanitised, for Engineer Console)
    → sanitise: strip cmd> prompt, normalise \r\n\0, trim
    → reject empty lines
    → classify device signals (Sleep, Wake, CONFIG_ERROR)
    → emit TEXT_LINE (sanitised, for command pipeline)
```

**Input Sanitisation:** Every text line is aggressively cleaned before reaching command listeners. This prevents `cmd>` prompt echoes and trailing whitespace from triggering false regex matches in the command pipeline. Pure hex lines (e.g. motion detection grid data) are intentionally passed through as `TEXT_LINE` events — `useMotionDetectionStream` depends on them for the 16×16 grid display.

**File:** [rxRouter.ts](../../src/ble/protocol/rxRouter.ts)

---

### 6. BLE Listeners (`useBleListeners`)

Registers four native event handlers via `BleManagerEmitter`:

| Event | Handler |
|---|---|
| `BleManagerDiscoverPeripheral` | Add device to Redux store |
| `BleManagerStopScan` | Mark scan complete, reconcile lost devices (see guard below) |
| `BleManagerDisconnectPeripheral` | Emit `DEVICE_SIGNAL(DISCONNECT)`, clear buffers, await `removePeripheral` (Android), update Redux |
| `BleManagerDidUpdateValueForCharacteristic` | Route to `rxRouter` |

**`BleManagerStopScan` guard — `isEngineerConsoleActive`:**

The `scanStoppedEvent` handler calls `BleManager.getDiscoveredPeripherals()` to reconcile which devices are still advertising. Devices NOT in the native cache are marked `signalLost: true`. However, on Android, `removePeripheral()` (called during disconnect) clears the device from the native cache. This causes a **signalLost flip-flop**: the device is discovered → marked `signalLost: false` → scan stops → not in native cache → `signalLost: true` → filtered out of auto-connect → repeat.

When `isEngineerConsoleActive` is `true`, the `notFoundAnymore` cleanup is **skipped entirely**. The Engineer Console's auto-connect watches Redux state directly (updated by `BleManagerDiscoverPeripheral`) and doesn't need the native cache reconciliation.

> [!NOTE]
> The disconnect handler emits the `DISCONNECT` signal **first**, before clearing buffers or updating Redux. This ensures `commandQueue` and `runCommand` reject in-flight commands immediately.

**File:** [useBleListeners.tsx](../../src/hooks/useBleListeners.tsx)

---

### 7. BLE Transport Controller (`bleTransport`)

Unified transport authority — owns the command queue, exclusive transport lock, and device signal handling. Ensures only one command is in-flight at a time.

**Lifecycle of a command:**

```mermaid
stateDiagram-v2
    [*] --> Queued: bleTransport.enqueue(context)
    Queued --> Running: processQueue()
    Running --> Listening: subscribe to bleEventBus.textLine
    Listening --> Collecting: successMatcher(line) → true
    Collecting --> Complete: isComplete() → true
    Complete --> Resolved: parser() returns T
    Listening --> Failed: failureMatcher(line) → true
    Listening --> Timeout: timeoutMs elapsed
    Timeout --> Retry: retryPolicy.maxRetries > 0
    Retry --> Running: re-send command
    Timeout --> Rejected: no retries left

    Resolved --> [*]
    Failed --> [*]
    Rejected --> [*]
```

**Transport states:** `IDLE` → `RUNNING` → `PAUSED_SLEEP` / `PAUSED_BUSY` (driven by device signals)

**Key features:**
- **No echo dependency:** Unlike the legacy manager, there is no echo-waiting phase. The command matches against `successMatcher` / `failureMatcher` directly.
- **Retry with policy:** Each command defines its own `retryPolicy` (max retries and optional delay). `DEVICE_DISCONNECTED` and `CONFIG_ERROR` are non-retryable.
- **Queue state broadcasting:** Emits `QUEUE_STATE_CHANGED` events so UI can show busy/idle state.
- **Disconnect fail-fast:** On `DEVICE_SIGNAL(DISCONNECT)`, calls `clearAll()` — rejecting every queued and active command instantly instead of letting each time out.
- **CONFIG_ERROR pass-through:** On `CONFIG_ERROR`, the queue does NOT pause (that would deadlock). The command pipeline rejects the active command immediately.
- **Built-in transport lock:** `acquireLock()` / `releaseLock()` for exclusive operations (file transfer, firmware flash). The queue rejects non-holder commands while locked.
- **Post-completion drain:** 10ms inter-command buffer (`POST_COMPLETION_DRAIN_WINDOW_MS`) allows trailing response characters to flush before the next command's listener attaches.

**Files:** [bleTransportController.ts](../../src/ble/protocol/bleTransportController.ts), [runCommandPipeline.ts](../../src/ble/protocol/runCommandPipeline.ts)

---

### 8. Message Classifier (`messageClassifier.ts`)

> [!IMPORTANT]
> **Scope restriction:** `messageClassifier.ts` is retained exclusively for **UI presentation**. It categorizes raw log lines for display in the deployment monitoring UI (color-coding errors, filtering noise like `Sleep`/`Wake`). It has **no authority** over protocol logic. All command matching is handled by `commandRegistry`.

| UI Role | Example | Action |
|---|---|---|
| Error highlighting | `AI NACK`, `I2C error` | Red text in monitoring log |
| Response display | `Battery = 3305mV 100%` | Standard log entry |
| Noise suppression | `Sleep`, `Wake` | Silently discarded from UI |
| Metric translation | `OpParam 19 = 5` | Displayed as "5 stored images" |

**File:** [messageClassifier.ts](../../src/ble/messageClassifier.ts)

---

### 9. BLE Session (`createBleSession` / `useBleSession`)

Provides a deterministic execution API for deployment workflows:

```typescript
const session = useBleSession(bleDevice)

// Execute a single command with typed result
const battery = await session.execute(commandRegistry.battery)

// Execute a command with parameters
const gpsSet = await session.execute(() => commandRegistry.setgps(gpsString))
```

**Guard:** `execute()` checks `peripheral.connected` before enqueuing. If the device is disconnected, it rejects immediately with `DEVICE_DISCONNECTED` — preventing dead commands from entering the queue.

**File:** [createBleSession.ts](../../src/ble/session/createBleSession.ts)

---

### DFU (Device Firmware Update)

The app supports over-the-air firmware updates using the **Nordic DFU** protocol via `@getquip/expo-nordic-dfu`. Both **BLE (nRF)** and **Himax AI processor** firmware can be updated.

```mermaid
sequenceDiagram
    participant UI as StartMonitoringScreen
    participant Sess as useBleSession
    participant FW as Firmware (Device)
    participant Scan as BleManager.scan
    participant Boot as DfuTarg (Bootloader)
    participant DFU as DfuService

    UI->>Sess: execute(commandRegistry.dfu)
    Sess->>FW: "dfu" command
    FW-->>Sess: "Device will enter DFU mode after disconnecting."
    UI->>Sess: disconnectDevice()
    Note over FW: Device reboots into bootloader mode
    Note over UI: Wait ~5s for reboot

    UI->>Scan: scanForBootloader(10s)
    Scan-->>Boot: Discovers "WW500_DFU" or "DfuTarg"
    Boot-->>UI: bootloaderAddress

    UI->>DFU: startDFU(bootloaderAddress, firmwareUri)
    DFU-->>UI: onProgress(0%...100%)
    Note over Boot: Bootloader flashes new firmware

    Note over FW: Device reboots with new firmware
    UI->>Scan: scanForOriginalDevice(deviceId)
    Scan-->>UI: Device rediscovered
    UI->>Sess: reconnect + verify version
```

> [!IMPORTANT]
> During DFU, the device disconnects and re-advertises under a different name (`WW500_DFU` / `DfuTarg`). The app suppresses "Connection Lost" alerts via `setDfuStatus(true)` dispatched to the device's Redux state. The `WWBleDisconnectedBanner` component checks `dfuInProgress` and renders nothing when it is `true`. The flag is cleared via `setDfuStatus(false)` when the update completes or fails.

**Files:** [DfuService.ts](../../src/services/DfuService.ts), [DfuScreen.tsx](../../src/screens/Devices/DfuScreen.tsx)

---

### 10. Transport Layer (`transport.ts`)

Handles all BLE write operations. Two functions:

| Function | Purpose | BLE Mode |
|---|---|---|
| `writeToDevice()` | String commands (ASCII) | `writeWithoutResponse()` |
| `writeBinaryToDevice()` | Raw binary packets (file transfer) | `write()` or `writeWithoutResponse()` |

**`writeToDevice()`:**
1. Sanitizes trailing newlines/CRs
2. Converts string to byte array
3. Calls `BleManager.writeWithoutResponse()` with a 5-second timeout
4. Service/characteristic discovery with fallback logic

**`writeBinaryToDevice()`:**
1. Accepts `Uint8Array` directly — no string encoding
2. Supports dual mode via `withResponse` flag:
   - `true` → `BleManager.write()` (reliable, for FILE_START/END)
   - `false` → `BleManager.writeWithoutResponse()` (fast, for FILE_DATA)
3. Used exclusively by the file transfer pipeline

**File:** [transport.ts](../../src/ble/transport.ts)

---

### 11. Image Reassembler (`ImageReassembler`)

Reconstructs JPEG images from multiple BLE packets.

**Packet protocol (3-byte header):**

```
byte[0] = 0x06              // AI_PROCESSOR_MSG_RX_BINARY marker
byte[1] = packetNum          // 1-based, incrementing, wraps 255→1
byte[2] = payloadLength      // declared payload length (always < 255)
byte[3..] = payload          // actual JPEG image data
```

**Features:**
- **Header validation:** Verifies marker byte (0x06), extracts and validates payload length against actual packet size
- **Sequence tracking:** Monitors packet numbers and detects gaps (lost packets) and duplicates
- **Completion:** Finalizes when `totalBytesReceived >= totalExpectedBytes`
- **Watchdog:** 3-second inter-packet timeout triggers `finalizePartial()`
- **Force finalize:** Firmware sends `"Finished sending X bytes."` — `useCapturePreview` catches this and emits `force_finalize`
- **Integrity checks on finalize:** Validates JPEG magic bytes (`0xFF 0xD8`), rejects images below 90% completeness
- **Storage:** Converts binary buffer to base64, writes via `FileSystem.writeAsStringAsync()`

> [!CAUTION]
> Must import from `'expo-file-system/legacy'` (not `'expo-file-system'`). The new v19 API does not export `cacheDirectory`/`documentDirectory` as top-level properties.

**File:** [ImageReassembler.ts](../../src/utils/ImageReassembler.ts)

---

### 12. Capture Preview (`useCapturePreview`)

Orchestrates the full capture-preview flow:

1. **Pre-flight Check:** `getops` to verify `CAMERA_ENABLED` (OP 10 = 1) and `TEST_MODE_BITS` (OP 18 = 0). Fixes either if needed (e.g. stale skip-file bit from a prior MD test).
2. **Single Image Capture:** Send `AI capture 1 500` (500ms interval allows AE settling)
3. **Start Download:** Send `AI txfile .` → Firmware announces byte count
4. **Receive:** `ImageReassembler` processes binary packets via `bleEventBus.binaryPacket`
5. **Completion:** Normal or `force_finalize` fallback
6. **Timeout:** 20-second safety timeout triggers `force_finalize`

> [!NOTE]
> The pre-flight `getops` check ensures capture works correctly even if `TEST_BIT_SKIP_FILE_CREATION` (OP 18, bit 3) is still set from a prior motion detection test. Without it, the firmware captures but skips JPEG file creation, and the `txfile` download times out.

**File:** [useCapturePreview.ts](../../src/hooks/useCapturePreview.ts)

---

### 13. Device Initialization (`useBleInitialization`)

Standard post-connection procedure:

1. Wait 1.5s for device stabilization
2. `selftest` → parse error bits → report hardware warnings
3. `setutc` → synchronize device clock to phone UTC

> [!NOTE]
> `setutc` already returns the confirmed time in its response. A separate `getutc` verification is **not** needed.

**File:** [useBleInitialization.ts](../../src/hooks/useBleInitialization.ts)

---

### 14. BLE Heartbeat (`useBleHeartbeat`)

Prevents device disconnection due to the firmware's 60-second BLE inactivity timeout. Implemented as a **pure inactivity timer** — any incoming BLE event resets a 58-second countdown.

**Mounted in:** `ListenToBleEngineProvider` — active whenever any device is connected.

**File:** [useBleHeartbeat.ts](../../src/hooks/useBleHeartbeat.ts)

---

## Debugging

### Engineer Console

The **Engineer Console** (`EngineerConsoleScreen.tsx`) is a **pure terminal** — a passive teletype that sends raw bytes via `writeRaw()` and displays responses via `bleEventBus` subscriptions.

**What the Engineer Console does:**
- Type any text command and see raw hex TX/RX and text responses
- View the Command Reference Modal (filtered to `type === 'command'` only)
- Verify regex patterns match expected firmware output

**What the Engineer Console does NOT do:**
- ❌ Execute workflow actions (DFU, capture, GPS, motion detection)
- ❌ Import or use `useCapturePreview`, `useGPSLocation`, or `firmwareUpdateHelper`
- ❌ Parse or interpret command responses beyond display

> [!WARNING]
> Workflow actions (DFU, capture, GPS set, motion detection test) belong in the **Deployment flow** (`useStartDeployment`, `useBleSession`), not in the console. This separation ensures the console cannot accidentally corrupt deployment state.

### Common Issues

| Problem | Likely Cause | Fix |
|---|---|---|
| Command timeout | `successMatcher` regex doesn't match response | Check regex in `commandRegistry.ts`. Adjust `timeoutMs`. |
| `AI NACK` | AI processor was sleeping | Device auto-wakes. Check logs for retry attempts. |
| Image glitched (shifted/gray) | Firmware buffer overflow | Check for `BLE out: Failed to send` in firmware logs. Ensure `ConnectionPriority.High` succeeded. |
| Image not saved | `expo-file-system` wrong import | Must use `'expo-file-system/legacy'` import path. |
| Silent BLE failures | `ListenToBleEngineProvider` missing | Verify it exists in the `App.tsx` provider tree. |
| No events received | `rxRouter` not classifying | Check `rxRouter.ts` for hex-to-text conversion errors. |
| Can't reconnect after disconnect | Stale `isDeviceReconnecting` guard or Android GATT cleanup race | See Disconnect Resilience section below. |
| 3-6s stall on disconnect | `commandQueue` and `runCommand` lack disconnect awareness | Ensure `DISCONNECT` signal is emitting correctly. Check `deviceSignals.ts`. |

---

## Disconnect Resilience

Unexpected BLE disconnects (user navigation, device DPD, signal loss) can leave multiple pipeline layers in an inconsistent state. The pipeline now handles disconnects with a **fail-fast** strategy at every layer.

> [!IMPORTANT]
> The `DISCONNECT` signal is emitted as the **first action** in the disconnect event handler — before buffer cleanup, `removePeripheral`, or Redux updates. This ensures all in-flight and queued commands are rejected instantly.

### Disconnect Signal Flow

```
Native BleManagerDisconnectPeripheral
  → bleEventBus.emitEvent(DEVICE_SIGNAL, DISCONNECT)    ← fail-fast cascade
    → commandQueue.handleDeviceSignal() → clearAll()    ← rejects all queued commands
    → runCommand.handleDeviceSignal() → idempotentReject ← kills in-flight command
  → rxRouter.clearBuffer()                              ← clears RX buffers
  → BleManager.removePeripheral() (Android, awaited)    ← GATT cache cleanup
  → dispatch(deviceDisconnect())                        ← Redux state update
```

### Current Guardrails (All Implemented)

| Layer | Guardrail | File |
|---|---|---|
| Disconnect Signal | `DEVICE_SIGNAL(DISCONNECT)` emitted first in disconnect handler | `useBleListeners.tsx` |
| Transport Controller | `clearAll()` on `DISCONNECT` — rejects all pending commands instantly | `bleTransportController.ts` |
| Command Pipeline | Subscribes to `DISCONNECT` → `idempotentReject('DEVICE_DISCONNECTED')` | `runCommandPipeline.ts` |
| Retry Pipeline | `DEVICE_DISCONNECTED` and `CONFIG_ERROR` are non-retryable — skip retry loop | `runCommandPipeline.ts` |
| Session | `execute()` checks `peripheral.connected` before enqueue | `createBleSession.ts` |
| Transport | `writeToDevice` returns early if `!peripheral.connected` | `transport.ts:17` |
| Transport | `writeBinaryToDevice` throws `'Device disconnected'` | `transport.ts:85` |
| Rx Router | `rxRouter.clearBuffer()` called on disconnect event | `useBleListeners.tsx` |
| Native (Android) | `removePeripheral` awaited to ensure GATT cleanup | `useBleListeners.tsx` |
| Connect | 500ms Android GATT delay before `BleManager.connect()` | `useBle.ts` |
| Connect | Stale `isDeviceReconnecting` guard auto-cleared | `useBle.ts` |
| File Transfer | Native disconnect listener → immediate reject | `runFileTransferPipeline.ts` |

### Android-Specific Behavior

Android's BLE stack requires explicit cache cleanup after disconnect. Without it:

1. `removePeripheral()` clears the GATT cache but takes ~200-500ms to complete
2. If `connect()` is called before cleanup finishes → `"Disconnect called before connect callback invoked"`
3. The 500ms delay in `connectDevice` provides a safe margin for GATT release

iOS handles this automatically at the Core Bluetooth level.

---

## File Structure

```
src/
├── ble/
│   ├── types.ts                    # UI command definitions (CommandNames, COMMANDS)
│   ├── commandManager.ts           # ⛔ DEAD — trap file, throws on import
│   ├── transport.ts                # Raw BLE write + binary write + service discovery
│   ├── messageClassifier.ts        # UI-only log categorization (NOT protocol logic)
│   ├── emitters.ts                 # Legacy EventEmitter3 instances (retained for ImageReassembler)
│   ├── protocol/                   # Event-driven command engine
│   │   ├── eventBus.ts             # BleEventBus — central event dispatcher
│   │   ├── rxRouter.ts             # Binary/text demux + input sanitisation
│   │   ├── commandRegistry.ts      # Typed command factories with frozen schema
│   │   ├── bleTransportController.ts # Unified transport FSM: queue + lock + signal handling
│   │   ├── runCommandPipeline.ts   # Single-command executor + retry logic
│   │   ├── protocolConstants.ts    # Timing constants (POST_COMPLETION_DRAIN=10ms, etc.)
│   │   ├── deviceSignals.ts        # Sleep/Wake/Busy/ConfigError/Disconnect signal types
│   │   ├── textStreamScope.ts      # Scoped text line listener (auto-cleanup)
│   │   ├── fileTransfer/           # BLE file transfer to SD card
│   │   │   ├── runFileTransferPipeline.ts  # Core ACK state machine
│   │   │   ├── fileTransferPackets.ts      # Binary packet builders
│   │   │   ├── fileTransferTypes.ts        # Types, error codes, retry policies
│   │   │   ├── ackMatcher.ts               # Strict ACK validation
│   │   │   ├── crc16ccitt.ts               # CRC-16/CCITT-FALSE
│   │   │   ├── filenameValidator.ts        # 8.3 format validation
│   │   │   └── __tests__/                  # 62 unit tests
│   │   └── __tests__/              # Protocol unit tests
│   ├── session/                    # Deterministic workflow API
│   │   ├── createBleSession.ts     # Session factory for deployment workflows
│   │   └── __tests__/              # Session unit tests
│   ├── workflows/                  # Reusable BLE workflow functions
│   └── __tests__/                  # Legacy tests (skipped)
├── hooks/
│   ├── useBle.ts                   # Core: scan, connect, writeRaw
│   ├── useBleListeners.tsx         # Native event handlers → rxRouter (+ signalLost guard)
│   ├── useBleSession.ts            # React hook wrapping createBleSession
│   ├── useBleInitialization.ts     # Post-connect: selftest + time sync
│   ├── useBleHeartbeat.ts          # 58s inactivity keep-alive
│   ├── useCapturePreview.ts        # Image capture flow
│   ├── useDeviceSettings.ts        # CONFIG.TXT parameter management
│   ├── useDeploymentConfiguration.ts # Deployment config (bulk getop + conditional writes)
│   ├── useEngineerConnect.ts       # Engineer Console scan + auto-connect dialog
│   ├── useScanLoop.ts              # Shared 3s burst scan loop + BLE cache flush
│   └── useSetupBLELibrary.ts       # BleManager.start() lifecycle
├── screens/Devices/hooks/
│   ├── useDeviceDiscovery.ts       # Main scanner: session timer + auto-connect routing
│   ├── useAutoConnectStateMachine.ts # Per-device auto-connect eligibility
│   └── useMotionDetectionStream.ts # MD test lifecycle: direct md write + frame history
├── providers/
│   ├── BleEngineProvider.tsx        # React Context for useBle
│   └── ListenToBleEngineProvider.tsx  # Listener registration
├── redux/slices/
│   ├── bleLibrarySlice.ts          # Library init state
│   ├── devicesSlice.ts             # Device state (clearDiscoveredDevices, signalLost)
│   └── scanningSlice.ts            # isScanning, isEngineerConsoleActive
└── utils/
    └── ImageReassembler.ts         # Binary → JPEG reconstruction
```

---

## Development Workflow

### Adding a New Command

1. **Define in `commandRegistry.ts`:**
   ```typescript
   myCmd: createSingleLineCommand<number>(
     'myCmd',
     (value?: string) => `my-command ${value || ''}`,
     /MyValue is (\d+)/,
     (match) => parseInt(match[1], 10),
     { timeoutMs: 5000, idempotent: true }
   ),
   ```

2. **Use via session in a deployment hook:**
   ```typescript
   const session = useBleSession(bleDevice)
   const value = await session.execute(commandRegistry.myCmd)
   ```

3. **Or test via Engineer Console:**
   Type `my-command 42` directly — `writeRaw()` sends it, response appears in console log.

### Creating a Multi-Step Workflow

Use `runCommandPipeline` for atomic sequences:

```typescript
import { runCommandPipeline } from '../ble/protocol/runCommandPipeline'

const results = await runCommandPipeline(peripheral, [
  commandRegistry.setdid(deploymentId),
  commandRegistry.setgps(gpsString),
  commandRegistry.setop({ index: 5, value: numPictures }),
  commandRegistry.setutc(),
])
// If any step fails, the pipeline throws immediately
```

---

## Maintenance Rules

- **Adding commands**: Always start in `commandRegistry.ts` — define the factory, then use it via session.
- **UI command definitions**: `types.ts` (`COMMANDS` object) is used only for the Engineer Console's Command Reference Modal.
- **Protocol logic**: Check `protocol/` directory first. Never modify `commandManager.ts`.
- **Message classifier**: Only for monitoring UI display. Never use it for command matching.
- **Performance**: Never log binary image data. Process binary packets before any string operations.
- **Testing**: Use `protocol/__tests__/` for command tests. Use Engineer Console for manual verification.

---

*Last Updated: May 16, 2026 — Updated rxRouter to pass hex lines through for MD grid, DFU disconnect suppression via Redux, capture preview getops pre-flight*

---

## Connection Ownership

**The PARENT screen owns the BLE lifecycle. Child screens MUST NOT disconnect.**

This is an architectural invariant. Violating it causes the connect-disconnect
loops reported in field testing (CGP, April 2026).

### Ownership Map

| Screen                      | Role   | Can Connect | Can Disconnect |
|-----------------------------|--------|-------------|----------------|
| DeviceDiscoveryScreen       | Owner  | ✅          | ✅             |
| StartMonitoringScreen       | Owner  | ✅          | ✅             |
| StopMonitoringScreen        | Owner  | ✅          | ✅             |
| EngineerConsoleScreen       | Child  | ❌          | ❌             |
| HimaxFirmwareUpdateScreen   | Child  | ❌          | ❌             |
| CameraSettingsTestScreen    | Child  | ❌          | ❌             |
| StandaloneMotionDetection   | Child  | ❌          | ❌             |
| AdvancedSettingsSection      | Child  | ❌          | ❌             |

### Child Screen Rules

1. **Observe** device state via Redux (`useAppSelector(state => state.devices[id])`)
2. **Execute** commands via `session.execute(commandRegistry.xxx)`
3. **NEVER** call `disconnectDevice()` or `session.disconnect()`
4. **On back-navigation:** just `goBack()` — the parent screen handles cleanup

### Owner Screen Rules

1. Owner screens intercept `beforeRemove` to disconnect cleanly
2. Owner screens show confirmation alerts before disconnecting mid-operation
3. Owner screens transition to Home after disconnecting
