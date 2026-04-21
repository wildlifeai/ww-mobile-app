# BLE Connection Ownership

## Rule

**The PARENT screen owns the BLE lifecycle. Child screens MUST NOT disconnect.**

This is an architectural invariant. Violating it causes the connect-disconnect
loops reported in field testing (CGP, April 2026).

## Ownership Map

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

## Child Screen Rules

1. **Observe** device state via Redux (`useAppSelector(state => state.devices[id])`)
2. **Execute** commands via `session.execute(commandRegistry.xxx)`
3. **NEVER** call `disconnectDevice()` or `session.disconnect()`
4. **On back-navigation:** just `goBack()` — the parent screen handles cleanup

## Owner Screen Rules

1. Owner screens intercept `beforeRemove` to disconnect cleanly
2. Owner screens show confirmation alerts before disconnecting mid-operation
3. Owner screens transition to Home after disconnecting

## Transport Lock

During long-running commands (e.g. `aifirmware`), the protocol layer acquires
an exclusive transport lock. While held:

- `commandQueue.enqueue()` rejects new commands
- Heartbeats are automatically paused
- No screen-level code is needed — the pipeline manages everything

See `src/ble/protocol/transportLock.ts` and `runCommandPipeline.ts`.
