# Cross-repo contracts, never change unilaterally

#### File: .agents/skills/references/cross-repo-contracts.md
#### Author: Claude, with Victor Anton
#### 19 September 2026

The app is one of four repos around one device. These interfaces are shared, and changing one
side silently breaks the other.

| Contract | Here | Counterpart |
|---|---|---|
| **OP parameter indices** | `OP_PARAMETER` in `src/hooks/useDeviceSettings.ts` | `OP_PARAMETERS_E` in Seeed `ww500_md/fatfs_task.h`; mirrored again in ww-hardware `aiProcessor.h`. Diffed on every PR touching the enum by `scripts/check-op-indices.js`, advisory |
| **BLE command strings** | `src/ble/protocol/commandRegistry.ts` | Seeed `CLI-commands.c` and `CLI-FATFS-commands.c`; relay in ww-hardware. Every builder has a golden row in `__tests__/commandRegistry.golden.test.ts` pinning the exact bytes sent and one reply accepted; add a command, add a row, or the suite fails |
| **`ftx` file-transfer wire format** | `src/ble/protocol/fileTransfer/` | ww-hardware `fileTx.c` against Seeed `fileRx.c` |
| **Database schema** | `src/database/schema.ts` (generated) | **owned by** `wildlife-watcher-backend`, schema changes start there |
| **Backend schema directory names** | `SCHEMA_MAP` in `scripts/sync-db-schema.js` | `ww-backend/supabase/schemas/public/*`, where the `aaa_`, `xxx_`, `yyy_` and `zzz_` prefixes encode apply order |
| **AI model and firmware filenames** | `deploymentPipeline.ts`, `useFirmwareUpdate.ts` | Seeed `xip_manager.c` parser |
| **`AE light check` line format** | `src/ble/protocol/lightCheck.ts` | Seeed `ww500_md/lightSensor.c`, two wordings selected by `AE_DECISION_GAIN_BASED` at compile time. Only the `-> DARK\|BRIGHT` verdict is required; every other field is optional and each label is matched in both its spelled-out and abbreviated form. The app's measurement is built from the `HM0360 AE regs` block, never from this line |
| **Self-test bit numbers** | `SelfTestBit` in `src/utils/deviceSelfTest.ts` | Seeed `ww500_md/selfTest.h`. Bits 0 to 7 nRF, 8 to 15 Himax |
| **Apple team ID** | `eas.json`, `submit.production.ios.appleTeamId` | ww-website `frontend/public/.well-known/apple-app-site-association`, where the `appID` is `<TeamID>.<BundleID>`. iOS silently refuses to associate the domain if it does not match the installed app |
| **Store identifiers** | `eas.json`, `ascAppId` | EAS credential records, **not** a value to type from memory. See [traps.md](traps.md) |

## The `AI ` prefix rule

Commands prefixed `AI ` are forwarded by the nRF52 to the Himax; unprefixed ones are handled
by the nRF itself. The consequence that has caught people: `reset` reboots the nRF *after
disconnect*, while `AI reset` reboots only the Himax and **leaves the BLE link up**. The
firmware-update flow needs `AI reset`.
