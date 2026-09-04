# Connecting sends thirteen commands and writes to the device where six reads would do, and the live monitor polls the image count twice a minute

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

## Scope: the whole connect sequence

Added 4 September after the run, when the question became "do we need all sixteen?". This
is the list from today's log in the order sent, with the verdict for each.

| # | Command | Sent by | Verdict |
|---|---|---|---|
| 1 | `selftest` | BLE init | Drop. Runs before the Himax is awake, so the app masks bits 8 to 15 and keeps only battery, LoRaWAN and reset flags. All of those come again in the post-wake broadcast |
| 2 | `setutc` | BLE init | Keep. EXIF timestamps depend on it |
| 3 | `battery` | pre-deployment checks | Keep. Feeds the warning and the deployment record. BLE processor only, no wake |
| 4 | `AI info` | pre-deployment checks | Keep. The one necessary wake, and the only source of SD total and free space |
| 5 | `selftest` | pre-deployment checks | Drop. The Himax broadcasts `Error bits = 0x....` after every wake; today it arrived 60 ms after "Wake", before the app asked. Parse the broadcast instead |
| 6 | `AI getop -1` | pre-deployment reset | Keep, for the screen's snapshot |
| 7 | `AI setop 0 1` | pre-deployment reset | Move. Seeds the sequence counter on a fresh card, by design, but it belongs with the Start reset |
| 8 | `AI setop 26 1` | pre-deployment reset | Move. Enabling day and night switching before the user has chosen anything contradicts "connecting never writes to the device" in the BLE guide |
| 9 | `ver` | pre-deployment checks | Keep |
| 10 | `AI ver` | pre-deployment checks | Keep |
| 11 to 13 | `ver`, `AI info`, `AI ver` | firmware-status hook | Drop, the duplicate above |

The count in the device-flows guide reaches sixteen by adding one `setop` per drifted
parameter and a second `getop -1` and `setutc`; today those were the two setops in rows 7 and
8, and the second `getop -1` and `setutc` belong to Start Monitoring.

Target: six commands (`setutc`, `battery`, `AI info`, `AI getop -1`, `ver`, `AI ver`), one
Himax wake instead of two, no writes, and about three seconds instead of seven.

**The reset stays, it moves.** Connecting must not write, but every deployment must start
from a known state: nothing may leak from the previous deployment or from an Engineer
Console session (test-mode bits, extended inactivity timeout, flash overrides, motion
intervals). That guarantee is the Start Monitoring pipeline's `resetOps`, which already runs
unconditionally before `configureDevice`, diffs every op in `FACTORY_DEFAULTS` against the
device, and skips only the model (synced a step earlier), identity (set a step later) and the
lifetime counters in `RESET_PRESERVED_OPS`. Removing the connect-time reset changes nothing
about what a deployment starts with; it only stops the app writing to a device the user has
not yet decided to deploy. Two conditions for the change:

- the Start reset must fail loudly, not "continue with configuration", when a write is
  refused, since it is now the only reset;
- the post-wake `Error bits` broadcast must feed the same warning path the second `selftest`
  feeds today, or the SD-card and camera warnings on the screen go dark.

## Verification of the fix

Fix on branch `fix/connect-sequence-268`, commit 592e5ff0,
[PR #270](https://github.com/wildlifeai/ww-mobile-app/pull/270). Bench run the same
afternoon, log in [`fix268_bench.txt`](../fix268_bench.txt).

1. Dirtied the device from the Engineer Console: `AI setop 18 8` and `AI setop 8 5000`
   (`[02:29`, `[02:45`).
2. Scanner connect (`[03:25` to `[03:27`): `selftest`, `setutc`, `battery`, `AI info`,
   `ver`, `AI ver`. The app logged `Post-wake self-test from broadcast: 0x0000`; no
   `selftest` after the wake, no `setop`, no second round. 2.1 s from first command to last
   reply. The Himax slept five seconds after `AI ver`, so op8 = 5000 was still in force: the
   connect wrote nothing.
3. Start Monitoring (`[04:12`): `[ResetDefaults] 2 OPs need writing, model loaded: true`,
   then `setop 8 1000` and `setop 18 0`, model preserved, then the usual configure.
4. Monitoring: `AI getop 19` at the 5 s mark and once per minute. The pair at `[05:19` and
   `[05:27` is the command manager's 8 s timeout retry after the first landed during a
   motion wake, not a second poll instance.
5. Stop Monitoring unchanged.

Left over, not worth widening the change: `configureDevice` diffs against the pre-reset
snapshot, so `setop 8 1000` went out twice, once from the reset and once from configure
(`[04:12.649` and `[04:15.417`). One redundant write per deployment start.

## Evidence

| What | Where |
|---|---|
| Connect, both rounds | [`flow_bench.txt`](../flow_bench.txt), `[00:28` to `[00:37` |
| Monitor polls at 04:52, 05:52, 06:52 | same file |
| Verification run against the fix | [`fix268_bench.txt`](../fix268_bench.txt) |
