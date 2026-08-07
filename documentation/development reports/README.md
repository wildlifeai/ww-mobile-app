# Development reports

Working records of how the app got here: review threads, proposals, bench evidence, and
the discussion between developers. Same convention as the `development reports/` folders
in Seeed_Grove_Vision_AI_Module_V2, ww-website, ww-backend and ww-hardware.

Two rules keep this simple:

1. **Docs are the record; GitHub issues are the tracker.** Anything still *open* when a
   discussion pauses — a bug found, a decision not yet made, a follow-up — is filed as a
   GitHub issue (they land on the
   [project board](https://github.com/orgs/wildlifeai/projects/3) automatically). A
   document is never the only place an open item lives.
2. **Every thread README starts with Status / Outcome / Open items.** The Outcome section
   is the short summary a future developer reads instead of the thread — what was agreed
   and why. Open items are issue links, nothing else.

Starting a thread: make a dated folder `YYYY-MM_short-topic/`, add a README with the
three headers, drop the working files beside it. Append as it evolves — these are the
audit trail, don't rewrite them.

Closing a thread (the only ritual — checklist also sits in each README):

- [ ] Outcome written (short; the "why" for future developers)
- [ ] every remaining open item filed as an issue and linked under Open items
- [ ] affected topic docs updated (`documentation/resources/*.md`, `documentation/onboarding/*.md`)

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

Related, outside this folder: [`DOCUMENTATION-AUDIT.md`](../DOCUMENTATION-AUDIT.md) — the
Jul 2026 audit of the whole `documentation/` tree, its remediation status, and the gaps
still open.
