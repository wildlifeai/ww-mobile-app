# Motion detection sensitivity (op17, `AI md`) is compiled out of the RP3 build, so Low, Medium and High are the same thresholds on the colour camera

#### File: explanation.md
#### Author: Claude (Fable 5.1), with Victor Anton
#### 4 September 2026

Labels: `review-finding`, firmware, cross-repo contract.

## 1. What is the problem

The HM0360 does the motion detection on both camera builds. Its sensitivity is a set of
threshold registers (MD_TH_STR_L/H, MD_LIGHT_COEF, MD_IIR_PARAMETER) with three tables, low,
medium and high, in `cisdp_sensor_set_md_sensitivity()`. That function lives in the HM0360
sensor driver and is called from two places only, both under `#ifdef USE_HM0360`: the `md`
console command and the sensor-init step at every wake, which applies op17.

The RP3 build defines `USE_RP3` and `USE_HM0360_MD`, not `USE_HM0360`. Its HM0360 is
initialised from a fixed register file and `hm0360_md_prepare()` sets the mode and interval
but never a threshold. So on a device running the colour camera:

- `AI md <n>` from the app's motion test is "Unrecognised" and the hook swallows it as
  non-critical;
- op17 written by Start Monitoring (`setop 17 1`) is stored in CONFIG.TXT and never applied;
- the project's Low, Medium and High sensitivity setting, which the website and the app
  present as a deployment choice, has no effect while the device is on the day camera, which
  is every daylight hour of an auto-switching deployment.

The contract in the app's `OP_PARAMETER` table and in `Operational_Parameters.md` says op17
is "Motion Detection Sensitivity: 0 = off, 1 = low, 2 = medium, 3 = high" with no build
condition.

## 2. How to reproduce

Bench-verified on 4 September at 13:30 on the RP3 slot: `AI md 2` from the Engineer Console
came back "Unrecognised", and the Himax console shows the same reply to the app's own `md 1`
and `md 3` during every motion test that afternoon
([`md_preview_bench.txt`](../md_preview_bench.txt), `[00:47.8`, `[01:51.6`, `[08:12.6`,
`[10:19.1`, `[17:06.5`). The check is two commands on a device running the RP3 slot:

1. Engineer Console, `AI md 2`. Expected on the HM0360 build: "MD sensitivity set to 2".
   On the RP3 build: "Unrecognised".
2. `AI setop 17 3`, let the device sleep and wake, and compare the HM0360 threshold
   registers or the block counts against `AI setop 17 1` under the same waving hand. No
   difference is the symptom.

## 3. Where in the code

Seeed_Grove_Vision_AI_Module_V2, `dev` da79fcb9 (paths under
`EPII_CM55M_APP_S/app/ww_projects/ww500_md/`):

- `ww500_md.mk:216-233`: the per-camera defines; RP3 gets `USE_RP3` and `USE_HM0360_MD`.
- `CLI-commands.c:2233-2236`: `#if defined(USE_HM0360)` around the `md` command, with the
  TODO "if we need this command while using RP camera then we need to move
  cisdp_sensor_set_md_sensitivity()".
- `image_task.c:1908` and `:1943`: the wake-time apply of op17, both under `#ifdef USE_HM0360`.
- `cis_sensor/cis_hm0360/cisdp_sensor.c:163-220` and `:768`: the three register tables and
  the setter.
- `hm0360_md.c:181-207` and `:757-795`: the RP3 build's HM0360 init and prepare, with no
  sensitivity step.

App side: `useMotionDetectionStream.ts:366-371` treats a failed `md` as non-critical;
`useDeploymentConfiguration.ts:104` and `:123` write op17.

## 4. Suggested fix

Move `cisdp_sensor_set_md_sensitivity()` and its tables out of the HM0360 sensor driver into
`hm0360_md.c`, which both builds compile, and call it from `hm0360_md_prepare()` with op17
before `hm0360_md_setMode()`. Lift the `#if defined(USE_HM0360)` on the `md` command to
`USE_HM0360 || USE_HM0360_MD`. Both builds must be built and the threshold registers read
back on each.

Until then the app should say so rather than pretend: finding E.

## Evidence

| What | Where |
|---|---|
| The defines and the three `#ifdef` sites | file and line references above, at da79fcb9 |
| A deployment on the RP3 slot writing op17 with no effect | [`flow_bench.txt`](https://github.com/wildlifeai/ww-mobile-app/blob/e3b989e9a937f44c5034ffde8d03d69276a80c84/documentation/development%20reports/2026-09-04_person-detection-first-deployment/flow_bench.txt), `[02:30` (`setop 18 2` and the configure sequence; op17 was already 1) |
