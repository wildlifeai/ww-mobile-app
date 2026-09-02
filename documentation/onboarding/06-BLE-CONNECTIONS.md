# BLE Connections — Lifecycle, Gates, and Failure Signatures

How the app discovers, connects to, and releases WW500 devices — and the
sharp edges found on the bench (21 Jul 2026). Read alongside
[04-ENGINEER-CONSOLE.md](./04-ENGINEER-CONSOLE.md) and
[05-DEVICE-FLOWS.md](./05-DEVICE-FLOWS.md).

## Two scanners, one flag

| | Main scanner (Scanner tab) | Engineer Console connect dialog |
|---|---|---|
| Hook | `useDeviceDiscovery` + `useScanLoop` | `useEngineerConnect` + `useScanLoop` |
| Session | 15 s countdown (`idle → active → expired`), manual restart | continuous while dialog open |
| Auto-connect | yes — `useAutoConnectStateMachine` | no — user taps a device |

`isEngineerConsoleActive` (redux `scanningSlice`) **disables the main
scanner's scan loop and auto-connect** while the console's scanner runs.
It is set when the console dialog opens and MUST be released on every exit
path — it is cleared on successful navigation, explicit cancel, and (since
`fix/ble-connection-lifecycle`) hook unmount. A stuck flag is invisible in
the UI: the Scanner tab shows the searching animation but no scan bursts
ever run.

## Device-side facts that shape the app

- The WW500 advertises **on wake and for a limited window after the
  middle-button press** — not continuously. A sleeping device is silent.
- The device drops the link itself (`RX: Disconnecting`) after BLE
  inactivity, then sleeps. After ANY disconnect, assume it is asleep and
  NOT advertising until woken (button / motion / timer).
- iOS: `peripheral.id` is a phone-local CoreBluetooth UUID (never a MAC —
  Android's id IS the MAC). Pending iOS connects never time out on their
  own; every connect must carry an app-side timeout AND a cancel
  (`BleManager.disconnect`) — `connectDevice` does this (13 s).
- iOS silently drops write-without-response packets when its queue is full
  — every write path uses write-with-response on iOS (PRs #213/#219).

## Auto-connect trust rules (main scanner)

A device is only auto-connected when ALL hold:
1. Fresh advertisement **in this scan session** — `lastSeen` (stamped on
   every advert) ≥ session start. A just-disconnected device lingers in
   the cache but is asleep; connecting to it hangs (13 s) then alerts.
2. Not `signalLost`, not connected, not loading.
3. Auto-connect state machine allows it (`canAutoConnect`): failed
   connects transition to `IGNORED_FOR_SESSION` (manual tap or "Search
   Again" clears; `resetDevice` would loop — see PR #220).

## Cache flushing

`flushBleCache()` clears Redux devices and (Android) native-removes our
cached peripherals. **The native removal blocks the Android scanner for
10–60 s.** Callers racing a push-button advertising window pass
`{ skipNativeRemoval: true }` (the Engineer Console does): otherwise the
window expires before scanning starts, and discovery becomes
order-dependent — "advertise, then open console" found nothing while
"open console, then advertise" worked instantly.

## Failure signatures (bench-verified)

| Symptom | Cause | Status |
|---|---|---|
| "Pairing via Bluetooth…" forever with a UUID shown | pending iOS connect to a sleeping device + silent fall-through on failure | fixed (#220): timeout → alert → scanner |
| Engineer Console dies moments after a command (iOS) | keepalive writes silently dropped → device idle-disconnects | fixed (#219): write-with-response |
| Scanner tab "searches" forever, finds nothing | stuck `isEngineerConsoleActive` after leaving the console dialog | fixed: released on unmount |
| Advertise-then-scan finds nothing; scan-then-advertise works | native cache flush blocks the Android scanner past the advertising window | fixed: console skips native removal |
| Auto-connect to the device just disconnected from | stale cache entry trusted by auto-connect | fixed: `lastSeen` session gate |
| Firmware Status spinner forever (iOS) | silent no-op when device not connected; no deadline on the check | fixed: error + 30 s deadline + pull-to-refresh |
| Transfer dies mid-file (iOS), reason 0x8 | iOS stretches the conn interval; nRF fast-param request deferred and never retried | firmware fix: ww-hardware #30 (0.30.48) |

*Last updated: 21 Jul 2026*
