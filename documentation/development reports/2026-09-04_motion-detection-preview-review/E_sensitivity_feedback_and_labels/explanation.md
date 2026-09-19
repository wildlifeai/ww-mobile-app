# The motion test hides a refused `AI md`, maps the sensitivity row id straight to a level, and labels the grid as if it were the test's own motion

#### File: explanation.md
#### Author: Claude (Fable 5.1), with Victor Anton
#### 4 September 2026

Labels: `review-finding`, app, cleanup.

## 1. What is the problem

Three small things that together make the test say more than it knows.

- **A refused sensitivity is silent.** `AI md <level>` fails on the RP3 build (finding A).
  The hook catches the failure and logs "md command failed (non-critical)"; the card keeps
  showing the Low, Med, High selector as if it took effect. The user tunes a setting that
  does nothing and reads the grid as evidence for it.
- **The deployment card passes a database id as the level.** `DeploymentMotionDetectionSection`
  sends `project.activity_detection_sensitivity_id ?? 3` as the sensitivity. The seed's rows
  happen to be 1, 2, 3 in the order low, medium, high, so it works today, and defaults to
  High when a project has none while the seed calls Medium the default. The level should come
  from the reference row's value, not its id.
- **The grid is labelled "Live: Motion Detection Grid".** What it shows is the HM0360's
  frame-to-frame detector sampled at each main-camera frame, with frame 1 always empty; it is
  not motion between the frames the user asked for, and at intervals under a second the
  firmware cannot keep up (finding C). The label, the "up to 10fps" note and the 0.3 s minimum
  all describe the app, not the device.

## 2. How to reproduce

1. On the RP3 slot, run the test at High and at Low with the same hand wave: identical grids,
   no message.
2. Read the log: "md command failed (non-critical)".

## 3. Where in the code

- `md` failure swallowed: [`useMotionDetectionStream.ts:366-371`](../../../../src/screens/Devices/hooks/useMotionDetectionStream.ts#L366-L371)
- Id used as level: [`DeploymentMotionDetectionSection.tsx:61-70`](../../../../src/screens/Deployments/components/DeploymentMotionDetectionSection.tsx#L61-L70)
- Labels and limits: [`MotionDetectionSection.tsx:13-15`](../../../../src/screens/Devices/components/MotionDetectionSection.tsx#L13-L15)
  and `:347-352`

## 4. Suggested fix

Surface the refusal: when `AI md` is not acknowledged, show "Sensitivity is not adjustable on
this camera build" in the card and disable the selector for the run. Resolve the level from
`ReferenceDataService.getActivitySensitivity()` by value, defaulting to medium. Rename the
grid to what it is ("HM0360 motion detector, sampled per frame") and raise the minimum
interval to what the firmware sustains until finding C lands.

## Evidence

| What | Where |
|---|---|
| Code references above | |
