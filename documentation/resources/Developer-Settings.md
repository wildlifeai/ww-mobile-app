# Developer settings, build info and the first-run tutorial

#### File: documentation/resources/Developer-Settings.md
#### Author: Claude (Opus 5), with Victor Anton
#### 19 September 2026

Two developer surfaces ship inside the app, and neither was documented until now. This page
says what each one shows, which buttons change local state, and how to reach them. It also
covers the first-run tutorial, because the question people actually ask about it is a
developer question: how do I get it back, and how do I skip it.

Closes the two gaps carried over from the July 2026 documentation audit, filed as #275 and
#276.

## The two screens

| Screen | Route | How you reach it |
|---|---|---|
| Developer Settings | `DeveloperSettings` | Settings, then Developer Options, then Developer Settings. The whole section is wrapped in `__DEV__`, so it is invisible in a release build |
| Dev Build Info | `DevBuildInfo` | The side navigation drawer |

Both are registered in `src/navigation/index.tsx` alongside the ordinary screens. The gate is
on the entry point, not on the route, so a release build still has the routes compiled in.

## Developer Settings: the environment switcher

This screen exists to point the app at a different Supabase instance without a rebuild.

**It only works in a development build.** `canSwitchEnvironment()` reads
`expoConfig.extra.isDevelopment`, so in production and preview builds the screen renders a
short "not available" message instead of the switcher. That is deliberate: a tester must not
be able to move a production app onto the dev database.

What happens when you switch:

1. You pick an environment and the screen offers to test the connection first. The test is a
   plain `fetch` against that environment's REST endpoint, so it proves the URL and key are
   live, nothing more.
2. Apply asks for confirmation, writes the choice to AsyncStorage under `@supabase_environment`,
   then recreates the Supabase client in place.
3. The stored choice outlives a restart. Clearing it, through `resetToDefault()`, puts the app
   back on the default for its build type, and that reset is allowed in every build.

The banner at the top always names the environment currently in use, which is worth reading
before you trust anything the app shows you about data.

## Dev Build Info: what it reports

Six sections, all read-only except the database tools:

| Section | What it shows |
|---|---|
| Build Information | Build type, bundle identifier, app version, readable version |
| Expo Information | Expo SDK version, Expo client, Metro bundler |
| Platform Information | Platform, platform version, React Native version |
| Native Modules | How many native modules are linked, and the list |
| Database Dev Tools | The active adapter and Supabase instance, plus the two actions below |
| Migration Status | Whether the migration, the EAS build and the native modules are in the expected state |

## The two database actions, and what they destroy

Both live in Database Dev Tools, both ask for confirmation, and both call
`database.unsafeResetDatabase()` underneath. In WatermelonDB terms they are the same
operation: Clear is an alias of Reset.

**Everything in the local database goes**, including anything in the outbox that has not
synced. Data that reached Supabase comes back on the next sync; data that did not is gone.
The app asks you to restart afterwards, and it means it: the running session still holds
handles to what was just deleted.

This is the tool that fixed the stale sync watermarks after a user switch on 4 September 2026
(#267). Nobody knew it was there, which is why this page exists.

## The first-run tutorial

The carousel is the `Tutorial` route, and what gates it is `pendingTutorial` in the auth
slice.

**There is no "seen" flag on disk.** The flag is transient state, set to true by
`triggerTutorial()` at exactly two call sites, the login screen and the register screen, both
after an explicit sign-in. It is set false by `completeTutorial()` and by the auth reducers
that run on sign-out and on session restore. So:

- Signing in by hand shows the tutorial.
- A restored session does not, because nothing set the flag.
- Reinstalling is not needed to see it again, and clearing storage is not how you get it back.

While the flag is true the navigator renders the tutorial *instead of* the app, which is why it
reads as a gate. The same screen is also registered inside the main stack, so Settings, then
App Tutorial, opens it any time as an ordinary screen, and dismissing it returns you where you
were.

To skip it in a development build, sign in once and let it complete, or open it from Settings
so it never gates. End-to-end tests press `tutorial-skip-button`; the next control is
`tutorial-next-button`.

## Related

- [03-DATA-AND-SYNC.md](../onboarding/03-DATA-AND-SYNC.md) for what the local database holds
  and how the outbox syncs
- [01-TECHNOLOGY-STACK.md](../onboarding/01-TECHNOLOGY-STACK.md) for the route table
- [Testing-Guide.md](Testing-Guide.md) for the end-to-end assertions against the tutorial
