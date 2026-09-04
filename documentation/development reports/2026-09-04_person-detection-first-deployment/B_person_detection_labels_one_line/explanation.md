# The Person Detection (96x96) labels file has one label for a two-class model, so the person class is written to EXIF as an empty string

#### File: explanation.md
#### Author: Claude (Fable 5.1), with Victor Anton at the bench
#### 4 September 2026

Labels: `review-finding`, data, website, firmware.

## 1. What is the problem

The model the app delivered to the card was `20V1.TFL` from storage path
`b0000000-0000-0000-0000-000000000001/Person Detection (96x96)-custom-1.0.0/`. Its labels
file `20V1.TXT` is 7 bytes and contains the single word `unknown` with no newline. The model
has two outputs. The firmware said so at load:

```
There are 2 classes (1)
WARNING: Number of classes and labels unmatched
```

and then classified every frame as either `'unknown'` or `''`:

```
Class 'unknown': 30.1% (raw: -108)
Class '': 70.0% (raw: 108)
Sending 9 bytes: Header 4, payload 3, checksum 2 'NN+'
Score 108/128 (Threshold 18)
```

Class 1, the empty one, is the person class: it scored 87 to 108 out of 128 with a person in
frame and negative without. Detection works. The EXIF `UserComment` and the class tags on
every photo from this deployment name the detected class as an empty string, so the website
cannot map the prediction to a taxon or to "person".

## 2. How to reproduce

1. Deploy any project whose model is "Person Detection (96x96)" custom 1.0.0.
2. Watch the Himax console at `loadmodel`: the warning above.
3. Read the labels file the app downloaded, on a debug build:

```bash
adb shell run-as com.wildlife.wildlifewatcher.expo cat files/aimodels/labels_b24428cc-e7a2-46f1-9e75-715144ae0043.TXT
```

## 3. Where in the code

- The labels file is data in the `ai-models` storage bucket at the path above; the app only
  copies it ([`deploymentPipeline.ts:204-217`](../../../../src/ble/workflows/deploymentPipeline.ts#L204-L217)).
- The firmware detects the mismatch but carries on: `cvapp.cpp:616-620` in
  Seeed_Grove_Vision_AI_Module_V2 (`ae_review` e8b7feb5).
- The website's model upload owns the file's contents; the label lifecycle is in
  `documentation/resources/embedded-model-lifecycle.md` in ww-website.

## 4. Suggested fix

Two parts. Replace the labels file for this model version with two lines in class order
(class 0 background or "no person", class 1 "person"), and re-run the deployment so the app
transfers the new file (the sync only transfers files missing from the card, so delete
`20V1.TXT` from `/MANIFEST/` first or use a fresh card).

Then stop it recurring: the website upload should refuse a labels list whose length differs
from the model's output tensor, and the firmware could refuse to load a model whose label
count does not match rather than warn and continue with empty names.

## Evidence

| What | Where |
|---|---|
| Download and transfer of `20V1.TXT`, 7 bytes | [`flow_bench.txt`](../flow_bench.txt), `[01:39` to `[02:27` |
| Firmware warning at load | same file, `[02:48.606]` |
| `NN+` with the empty class name | same file, `[05:39` to `[06:04` |
