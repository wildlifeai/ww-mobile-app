# A user who signs in after another user sees no projects, because the sync watermarks are global

#### File: explanation.md
#### Author: Claude (Fable 5.1), with Victor Anton at the bench
#### 4 September 2026

Labels: `review-finding`, app, sync.

## 1. What is the problem

`tama@ww.org` signed in on a phone that had previously synced as another user. The Projects
tab was empty and the Scanner showed the "No Projects" dialog, while the website listed the
same user's projects. The dev instance held the right roles; the phone never asked for them.

The role and project pulls are incremental. Each keeps a "last pulled at" watermark and asks
Supabase only for rows updated after it. The watermark is one key for the whole app, not one
per user, and sign-out does not clear it. Tama's seeded roles were created before the previous
user's last sync, so the query `user_roles where updated_at > <watermark>` returned nothing,
the local `user_roles` table never gained a row for tama, and the project query, which is
built from that table, found no project-scoped role.

The fresh-launch log on 4 September at 11:58 shows the mechanism directly:

```
👥 Syncing user roles since 2026-08-09T21:49:51.806Z
✅ No new user role changes
📂 Syncing projects since 2026-09-03T23:41:52.332Z
📥 Received 1 project updates
```

After a local database reset (Dev Build Info, "Reset Database (Full)") and a restart, the same
user got:

```
📥 Received 7 user role updates
📥 Received 1 project updates
✅ Total accessible projects (Roles + Created): 4
```

## 2. How to reproduce

1. On a dev build, sign in as any seed user and let the first sync finish.
2. Sign out. Sign in as a second seed user whose roles were granted before step 1.
3. Open the Projects tab. It is empty, and the log says "No new user role changes".
4. Dev Build Info, Reset Database (Full), force-close, reopen, sign in as the second user.
   The roles and projects arrive.

## 3. Where in the code

- Incremental role pull keyed on one global watermark:
  [`SupabaseSyncService.ts:768-791`](../../../../src/services/SupabaseSyncService.ts#L768-L791),
  key `USER_ROLES_LAST_PULLED_AT`. Same shape for projects at
  [`SupabaseSyncService.ts:906-938`](../../../../src/services/SupabaseSyncService.ts#L906-L938).
- Sign-out only calls Supabase `signOut`, nothing local is cleared:
  [`auth.ts:358-368`](../../../../src/services/auth.ts#L358-L368).
- The only path that clears the watermarks is the "zombie timestamp" integrity check at
  startup, [`SupabaseSyncService.ts:35-51`](../../../../src/services/SupabaseSyncService.ts#L35-L51),
  which is why the dev reset plus restart works.
- The local project query depends entirely on the local `user_roles` table:
  [`ProjectService.ts:114-203`](../../../../src/services/ProjectService.ts#L114-L203).

## 4. Suggested fix

Either clear all sync state and the local tables on sign-out (the app is offline-first, so
this also removes the previous user's data from the phone), or key every watermark by user id
so a new user's first sync starts from zero. The first is simpler and also closes a privacy
gap: today the previous user's deployments stay on the device after sign-out.

Until then the workaround is the dev reset above, which only a dev build exposes.

## Evidence

| What | Where |
|---|---|
| Fresh launch, watermark and empty pull | [`flow_bench.txt`](../flow_bench.txt), lines from `[00:00` (the app leg is the `app` column) |
| Post-reset pull with 7 roles and 4 projects | app log 12:15:02 on 4 September, quoted above (captured before the bench logger started) |
