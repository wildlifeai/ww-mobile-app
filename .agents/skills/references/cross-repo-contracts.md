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
| **BLE firmware floor for the transfer window** | `MIN_BLE_FIRMWARE_FOR_TRANSFER` in `src/ble/protocol/fileTransfer/bleFirmwareFloor.ts`, read from the `ver` string | ww-hardware `fileTx.c`: the 16-slot relay FIFO (`FILETX_FIFO_SLOTS`) and the ack every 4th packet (`FILETX_ACK_EVERY`) that first shipped in 0.30.47. The window of 12 depends on both, so a change to either moves the floor or the window (#289) |
| **Database schema** | `src/database/schema.ts` (generated) | **owned by** `wildlife-watcher-backend`, schema changes start there |
| **`push_changes` reply** | `uploadOutbox` in `src/services/SupabaseSyncService.ts` reads `{processed, conflicts: [{id, reason: 'not_applied'}]}` | ww-backend `supabase/schemas/public/functions/99_push_changes.sql`. The app read a `conflict_details` key that never existed until #287 |
| **Member and invitation RPCs** | `fetchMembersFromCloud` (`UserRoleService.ts`) caches `get_project_members` rows `{id, name, email, role, granted_at, granted_by}`; `InvitationService.sendInvitation` calls `send_project_invitation(p_project_id, p_invitee_email, p_role)`; `updateProjectMemberRole` and `removeProjectMember` call `update_project_member_role(p_project_id, p_user_id, p_new_role, p_updated_by)` and `remove_project_member(p_project_id, p_user_id, p_removed_by)` and map their SQLSTATEs in `describeMemberChangeError` | ww-backend `functions/34_update_project_member_role.sql`, `35_remove_project_member.sql`, `36_get_project_members.sql` and `38_invitation_functions.sql`. `name` is one string, firstname and surname joined, and null when either is. `p_updated_by` and `p_removed_by` must be the signed-in user (`42501` otherwise); `23514`, and `22023` with its message, are the last admin, not a member and same role. Success is `{success: true, ...}` |
| **Creator role on a new project** | `ProjectService.createProject` writes a local `project_admin` row for the creator, so role checks work offline | ww-backend `supabase/schemas/public/triggers/02_project_admin_trigger.sql`, `handle_new_project`. If the trigger's role or scope changes, change the local mirror with it |
| **Project settings the deployment writes** | Column to op value in `utils/projectFlash.ts` (op13, op34 to op36) and `utils/projectBurst.ts` (op5, op6, whose ranges mirror the CHECK constraints, and op8 = op6 + 1000 when op5 is above 1, because Seeed's `config_file.md` requires op6 below op8 and the firmware sleeps mid-burst otherwise, Seeed #208); pulled by hand in `SupabaseSyncService.syncProjects`, pushed from `ProjectService.mapModelToType` | ww-backend `projects` columns and `push_changes`, which also names its columns by hand and keeps the stored value for a missing or null burst or flash key on update. The burst has no control in the app and goes out on a project insert only, never an update; the website owns it (ww-website #180) |
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
