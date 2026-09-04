# Development reports

Working records of how the app got here: review threads, proposals, bench evidence, and
the discussion between developers. Same convention as `_Documentation/development reports/`
in [Seeed_Grove_Vision_AI_Module_V2](https://github.com/wildlifeai/Seeed_Grove_Vision_AI_Module_V2),
which is the reference implementation, and the matching folders in ww-website, ww-backend
and ww-hardware.

We follow three rules:

1. **Docs are the record; GitHub issues are the tracker.** Outstanding tasks should be
   filed and tracked as GitHub issues (they land on the
   [project board](https://github.com/orgs/wildlifeai/projects/3) automatically). A
   document is never the only place a task lives. File one in 30 seconds with the
   [review-finding template](../../.github/ISSUE_TEMPLATE/review-finding.md).
2. **Every thread README has at least Status, Outcome and Open items.** The Status can be
   open or closed. The Outcome summarises what was agreed and why. Open items are links to
   GitHub issues.
3. **This folder records how the work happened, not how the code works.** Threads are the
   audit trail — what we tried, what we found, what we decided and why. How the app
   behaves belongs in [`../onboarding/`](../onboarding/) and
   [`../resources/`](../resources/). Nobody should have to read a thread to find out how
   something behaves now.

**Starting a thread:** make a folder named `YYYY-MM-DD_short-description/`, dated the day
the work began, add a README with the three headers, drop the working files beside it.
Append as it evolves, don't rewrite them.

**When creating new documents:** add these lines towards the top of each markdown file so
a reader can place it without digging through git history:

1. Filename (the name of the markdown file)
2. Author (e.g. a person or AI)
3. Date (preferably day as well as month and year)

Example:

```
# Sliding window file transfer — firmware engineering guide

#### File: sliding_window_file_transfer.md
#### Author: Claude (Opus 5), reviewed by Victor Anton
#### April 2026
```

**To close a thread ensure:**

- [ ] **Outcome is written.** It should summarise for future developers what the result of
      this thread was.
- [ ] **Linked documentation.** Every conversation and relevant file is linked and easy to
      find.
- [ ] **Open items.** Every follow-up or remaining work is captured and linked as a GitHub
      issue.
- [ ] **Durable docs updated.** Anything a future developer needs to know about how the
      code works now lives in `documentation/onboarding/` or `documentation/resources/`,
      not only here.

> [!NOTE]
> The reports below predate this convention: they are single files rather than dated
> thread folders, and their status is recorded here instead of in a thread README. Leave
> them as they are — they are the audit trail. New threads follow the folder convention.

## Threads

| Thread | Status |
|---|---|
| [fast_file_transfer_proposal.md](fast_file_transfer_proposal.md) (2026-07-08) | **Partly superseded.** Phases 0–2 shipped; Phase 3 (credit streaming) also shipped despite being labelled future. Its Phase-1 per-transfer `requestConnectionPriority` was **reverted** — see the caution at the top. Kept for the bottleneck analysis, which is still the best record of *why* the design is what it is. |
| [empty_sd_update_architecture.md](empty_sd_update_architecture.md) (2026-07-10) | **Current**, with corrections. The shipped Himax flow is now documented against the code in [Himax-Firmware-Update.md](../resources/Himax-Firmware-Update.md). §4 QA matrix and §5 firmware asks remain open. |
| [sliding_window_file_transfer.md](sliding_window_file_transfer.md) (2026-04-29) | **Superseded.** The window=2 design was never shipped; transport is credit streaming (`windowSize ?? 12`). Retained for the `ftx err 7` root-cause analysis, which drove real firmware fixes. |
| [sliding_window_file_transfer_spec.md](sliding_window_file_transfer_spec.md) (2026-04-28) | **Superseded — never implemented as specified.** Do not build from it; its `FILE_START` field order is also reversed relative to the wire format. Historical context only. |

A July 2026 audit of the whole `documentation/` tree (`DOCUMENTATION-AUDIT.md`, removed in
September 2026 once its remediation had shipped in v0.0.62) is in the git history. Its last
open gaps are tracked as issues #275 (developer settings), #276 (tutorial carousel) and #277
(`DeviceReconnectProvider`).
