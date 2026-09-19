# Writing tooling in `scripts/`

#### File: .agents/skills/references/tooling.md
#### Author: Claude, with Victor Anton
#### 19 September 2026

These scripts run on Windows, macOS and CI. Every bug found in them so far has been at the
shell boundary, and none of them reproduced in a Linux container.

- **Merge stderr to read diagnostics, never into a payload you compare.** `java -version`
  writes to **stderr**; `adb devices` writes to stdout. A helper that captures only stdout
  reports "java not on PATH" for a perfectly good JDK, so use `cmd 2>&1` when you want a tool's
  messages. But when stdout *is* the data you parse or diff, keep stderr separate:
  `check-types-cloud.ps1` merged `supabase gen types` stderr into the "fresh types" and the npm
  banner corrupted every comparison. On Windows PowerShell also beware `Out-File` and `>`,
  which write a byte order mark and CRLF. Strip the mark and normalise line endings before
  comparing generated files, or byte-identical content reads as "out of sync". Both were fixed
  in #292.
- **Always time out external commands.** The first `adb devices` after a reboot starts a daemon
  that inherits your stdout pipe and never closes it, so an untimed `execSync` hangs forever
  even though `adb devices` itself exited. Warm it with `adb start-server` first.
- **Exit codes lie.** Check output content, not just the exit status. The Supabase CLI case is
  in [traps.md](traps.md).
- **A green check is a claim too, so confirm it actually compared something.** On 5 September
  2026 `schema:validate:live:cloud-dev` was reporting `✅ PASSED (with warnings)` while parsing
  **zero** tables out of the Supabase types, because its brace-matching regex could not cope
  with a real generated file. Every table was reported missing, as a warning, so nothing
  failed. Layer 4 of the documented anti-drift defence had been reading green while checking
  nothing. When a tool passes, read the counts it prints, such as `Found 43 tables`, not the
  tick. The same run proved the point twice over: the checker could not execute at all on
  Windows, a BOM-less `.ps1` with emoji read as ANSI by PowerShell 5.1, and its environment
  label named staging while it validated dev.
- **Ground-truth a difference before calling it a bug.** That same validator's first honest run
  reported 83 "errors". Of those, 76 were audit columns the app defines on tables that
  genuinely lack them upstream, and 3 were legacy columns already labelled `// Legacy fields`
  in `models/Deployment.ts`. Query the live database for the real column list rather than
  reasoning from the generated types, and check whether the code still uses the field, before
  proposing a fix.
- **Absence of a tool is not proof your check works.** The JDK bug survived a container test
  because, with no JDK present, the wrong code path produced the right answer. If a check can
  only pass or fail for the same reason, it has not been tested.
- Prefer `npm run <guard>` over ad-hoc verification. `version:check` and `docs:validate` exist
  so drift fails loudly in CI.
