# Connecting sends ver, AI info and AI ver twice, and the live monitor polls the image count twice a minute, each wake costing a DPD cycle

#### File: explanation.md
#### Author: Claude (Fable 5.1), with Victor Anton at the bench
#### 4 September 2026

Labels: `review-finding`, app, ble.

## 1. What is the problem

Two places send the same command twice. Neither is a retry; both are two callers.

**On connect.** The pre-deployment checks send `ver`, `AI info` and `AI ver` and hand the
results to the Start Monitoring screen as its snapshot. One second later the screen sends all
three again:

```
[00:32.877] nrf   | BLE in: Received   3 bytes 'ver'
[00:33.187] nrf   | BLE in: Received   6 bytes 'AI ver'
[00:34.092] app   | [FirmwareStatus] Snapshot looks outdated — verifying against the live device
[00:34.427] nrf   | BLE in: Received   3 bytes 'ver'
[00:34.738] nrf   | BLE in: Received   7 bytes 'AI info'
[00:35.971] nrf   | BLE in: Received   6 bytes 'AI ver'
```

The firmware-status hook compares the snapshot with the latest firmware rows and, when the
snapshot "looks outdated", re-queries the device to be sure. A bench device running a local
build is never in the firmware table, so on the bench this branch runs on every connect. The
second `AI info` woke the Himax from the DPD it had just entered (`[00:34.361] Sleep`,
`[00:35.264] Wake`), so the device booted twice to answer one screen.

**While monitoring.** The image-count poll (`AI getop 19`) goes out twice, 0.7 s apart, every
60 s:

```
[04:52.427] app   | Written AI getop 19 to the device WILD-CNKW
[04:53.175] app   | Written AI getop 19 to the device WILD-CNKW
```

The monitor hook is instantiated twice on the same screen, once by the stats view and once by
the activity log, and each instance runs its own poll timer. Each poll wakes the Himax, which
is why the log shows a `Wake`, `Error bits` and `Sleep` around every minute mark with no
motion. The comment on the poll interval already notes that frequent polling wakes the AI
processor and resets the HM0360 motion detector.

## 2. How to reproduce

1. Connect from the Scanner with the bench logger running and count the `BLE in` lines on
   the nRF console: `ver`, `AI info`, `AI ver` appear twice each within three seconds.
2. Start monitoring and wait two minutes: `AI getop 19` twice at each minute mark.

## 3. Where in the code

- Pre-deployment checks send the three:
  [`useDevicePreDeploymentChecks.ts:186-217`](../../../../src/hooks/useDevicePreDeploymentChecks.ts#L186-L217).
- The escalation from snapshot to live query:
  [`useFirmwareStatus.ts:216-225`](../../../../src/screens/Devices/hooks/useFirmwareStatus.ts#L216-L225),
  and the live query itself at lines 120-135, which sends `AI info` purely as a wake.
- Two instances of the monitor hook:
  [`DeploymentMonitorView.tsx:42`](../../../../src/screens/Deployments/components/DeploymentMonitorView.tsx#L42)
  and [`LiveActivityLog.tsx:18`](../../../../src/screens/Deployments/components/LiveActivityLog.tsx#L18);
  the poll at [`useDeploymentMonitor.ts:49-84`](../../../../src/screens/Deployments/hooks/useDeploymentMonitor.ts#L49-L84).
- [05-DEVICE-FLOWS.md](../../../onboarding/05-DEVICE-FLOWS.md) already records the connect
  duplicate as "Currently issued twice each, which is redundant", and separately says the
  screen resolves versions "silently from initPayload rather than actively querying", which
  the log contradicts when the snapshot looks outdated.

## 4. Suggested fix

- Trust the snapshot on the Start Monitoring screen: it was read seconds earlier by the same
  connection. Keep the live re-check for the explicit pull-to-refresh and for the focus return
  after a firmware update, which the screen already handles separately. If a re-check must
  run, `AI ver` on its own wakes the Himax; the `AI info` before it is redundant.
- Hoist the monitor hook so one instance feeds both the stats view and the activity log, or
  keep the poll in one of them only. Consider dropping the poll altogether: the "Captured N
  images" broadcast arrives after every capture and the hook already listens to it.

## Evidence

| What | Where |
|---|---|
| Connect, both rounds | [`flow_bench.txt`](../flow_bench.txt), `[00:28` to `[00:37` |
| Monitor polls at 04:52, 05:52, 06:52 | same file |
