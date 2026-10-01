# Testing Guide

> **Related**: [00-GETTING-STARTED.md](../onboarding/00-GETTING-STARTED.md) (project overview), [React-Doctor-Guide.md](React-Doctor-Guide.md) (health-score CI check).

## Overview

| Type | Tool | Location | Command |
|------|------|----------|---------|
| Unit | Jest + RNTL | `src/**/__tests__/*.test.ts` | `npm test` |
| Integration/BDD | Jest + custom helpers | `tests/integration/**/*.bdd.test.tsx` | `npm test -- bdd` |
| E2E | Maestro | `tests/maestro/smoke/` required in CI, the flows in `tests/maestro/config.yaml` on the `full-e2e` label | `npm run test:maestro:smoke`, `npm run test:maestro` |

## Running Tests

```bash
npm test                    # All Jest tests (unit + integration)
npm test -- --watch         # Watch mode
npm test -- --coverage      # Coverage report
npm test -- Login.test.tsx  # Single file
npm run test:maestro:smoke  # the one E2E flow CI requires (requires device)
npm run test:maestro        # every E2E flow (requires device and -e E2E_TEST_EMAIL/-e E2E_TEST_PASSWORD)
npm run lint                # ESLint
npm run type-check          # TypeScript
```

---

## Mocking Strategy

### AsyncStorage

Avoid the global mock for identity-sensitive checks. Define a local mock:

```typescript
const mockAsyncStorage = {
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
}
jest.mock("@react-native-async-storage/async-storage", () => mockAsyncStorage)

// Assertion
expect(mockAsyncStorage.setItem).toHaveBeenCalledWith("key", "value")
```

A global singleton mock is also available at `tests/__mocks__/@react-native-async-storage/async-storage.js` (exposed as `global.mockAsyncStorage`).

### Supabase

```typescript
import { resetSupabaseMocks } from '../../tests/__mocks__/supabase'

beforeEach(() => {
  resetSupabaseMocks()
  jest.clearAllMocks()
})
```

Mock setup: `tests/__mocks__/supabase.ts`

### RTK Query Hooks

```typescript
const { useLoginMutation } = require("../src/redux/api/auth")
useLoginMutation.mockReturnValue([
  jest.fn().mockReturnValue({
    unwrap: jest.fn().mockResolvedValue(mockResponse)
  }),
  { isLoading: false, error: null }
])
```

### WatermelonDB

Use `LokiJSAdapter` for in-memory testing:

```typescript
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs'

const adapter = new LokiJSAdapter({ schema, useWebWorker: false })
export const testDatabase = new Database({ adapter, modelClasses: [...] })
```

---

## BDD Pattern

```typescript
test("User Story: Login", async () => {
  await createUserStory("Successful Login")
    .as("a user")
    .iWant("to log in")
    .soThat("I can access my account")
    .scenario("Valid credentials")
    .given("I am on the login screen", AuthActions.userIsOnLoginScreen)
    .when("I enter credentials", AuthActions.userEntersCredentials)
    .then("I should be logged in", AuthActions.userIsLoggedIn)
    .executeAll()
})
```

Helpers: `tests/setup/helpers/bdd.ts`

---

## Maestro E2E Testing

[Maestro](https://maestro.mobile.dev/) runs declarative YAML flows against a real device or
emulator. The flows live in `tests/maestro/`.

**Install**: the Maestro CLI is not an npm package. `curl -Ls "https://get.maestro.mobile.dev" | bash`
is what CI runs; `./scripts/install-maestro-wsl2.sh` does the same on WSL2 with the JDK. The npm
package called `maestro` is an unrelated AWS Step Functions tool (`maestro-framework`). It sat in
`devDependencies` until October 2026, where it shadowed the real CLI on every `npm run test:maestro*`
and its shell postinstall aborted `npm install` on Windows.

**Requires**: Java 17+, `adb`, a connected Android device or emulator, and for every flow but the
smoke an account on the Supabase instance the build talks to (below).

### Quick Start

```bash
adb devices                   # 1. A device is connected
npm run test:maestro:smoke    # 2. What CI requires: install, launch, the login screen renders
npm run test:maestro -- -e E2E_TEST_EMAIL=... -e E2E_TEST_PASSWORD=...   # 3. Every flow
npm run test:maestro:auth -- -e E2E_TEST_EMAIL=... -e E2E_TEST_PASSWORD=...
maestro studio                # 4. Browse the live screen's ids and texts
```

The npm scripts pass `APP_ID=com.wildlife.wildlifewatcher.expo`, the package of a local debug
build. Against a release-type build (an EAS `preview`, `staging` or `e2e` APK) run `maestro test`
yourself with `-e APP_ID=com.wildlife.wildlifewatcher`.

### The account the flows use

Every flow but the smoke signs in as `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD`, passed with `-e`.
Cloud-dev is wiped and reseeded by every ww-backend dev deploy, so the account has to be one the
backend seed creates ([Role-Based Test Accounts](#role-based-test-accounts)) and may create
projects in its organisation. CI uses `tama@ww.org` (October 2026), an organisation manager of
General. The seed also gives Tama `organisation_member` there (ww-backend #248, app side #375),
so no flow asserts a role: a role assertion would test the seed, not the app. In CI the two values are the `E2E_TEST_EMAIL` and
`E2E_TEST_PASSWORD` secrets of the `development` GitHub environment. Never write the password
into a flow, a commit or an issue; `scripts/ci-maestro-output.sh` redacts it from the artifact,
because Maestro writes each `inputText`'s resolved text into its command log and the artifact of
a public repository is downloadable by anyone signed in to GitHub.

### What CI runs, and why

The `native-build-validation.yml` workflow builds the APK the flows run against **locally on the
runner** with `eas build --local`, from the `e2e` profile in `eas.json` on a pull request into
`dev` or a `workflow_dispatch`, and from `staging` on a pull request into `main`. Both are
release-type: the APK carries its JavaScript bundle and installs as
`com.wildlife.wildlifewatcher`. Until October 2026 the dev build was the `ci` profile, a
**development client**, which carries no bundle: with no Metro server on the runner every run
stopped at Expo's "Development servers" launcher (run 36836146016), so the required check only
proved that the native launcher opened. The `e2e` profile is `preview` with `buildType: apk`,
and reads `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` from the workflow's
`development` environment secrets, the names `src/config/environments.ts` reads.

The APK is cached by profile, Expo fingerprint and a hash of `package-lock.json`, `app.config.ts`,
`eas.json` and `patches/`, so a run that changes only flows or the workflow restores it instead
of building for 20 to 27 minutes. Caches are scoped per ref: the first dispatch on a branch
builds, later ones should not. Check the "Restore cached APK" step rather than assuming.

Two jobs run the flows on an API 33 x86_64 emulator with the Pixel 6 profile (the default AVD
is 320x640 at 160 dpi, where the drawer's version footer sat over its sign-out button, #379),
through `scripts/ci-maestro.sh`. That script also turns Bluetooth on, which the app insists on
before the login screen, and runs the offline scenario through `scripts/maestro-offline.sh`
after the other flows:

- `E2E Smoke`, **required**. One flow, [`smoke/app-startup.yaml`](../../tests/maestro/smoke/app-startup.yaml):
  install, launch, and the login screen's `email-input` and `login-button` render within 90 s.
  It asserts no more than that so that a required check never fails for an unverified id.
- `E2E Full`, advisory. Every flow [`config.yaml`](../../tests/maestro/config.yaml) lists, signed
  in as the E2E account, then the three offline phases. Runs on the `full-e2e` label or by hand
  (`gh workflow run native-build-validation.yml --ref <branch>`); never in the merge queue,
  which has no labels.

Both write a junit report and **fail if it holds no test cases**, because until 21 September
2026 the E2E job reported success on every run while Maestro ran nothing (run 35493842313: an
empty `~/.maestro/tests/` under a green tick). Both then print Maestro's output into the job log
(`scripts/ci-maestro-output.sh`): the report, a compact view of every screen hierarchy (resource
id, text, accessibility text, bounds), the tail of each command log, and the app's logcat. Read
the hierarchy there to find a real id before changing a selector; the `maestro-smoke` and
`maestro-full` artifacts hold the same files plus the screenshots.

### Existing Test Flows

| File | Proves | Status |
|------|--------|--------|
| `tests/maestro/smoke/app-startup.yaml` | The APK installs, launches, and the bundle renders the login screen. **The required check** | See the PR that landed it for the run |
| `tests/maestro/auth-workflow.yaml` | A wrong password is refused with "Login Failed"; the right one reaches the home screen and the project list; sign out returns to the login screen | Advisory, E2E Full |
| `tests/maestro/project-crud-workflow.yaml` | Create a project with a unique name, see it listed, rename it, archive it (the app's delete), see it gone | Advisory, E2E Full |
| `tests/maestro/offline/sign-in-online.yaml` | Phase 1 of the offline scenario: sign in online and reach the project list | Advisory, E2E Full, via `scripts/maestro-offline.sh` |
| `tests/maestro/offline/complete-offline-workflow.yaml` | Phase 2, in airplane mode: a cold start stays signed in (#310), shows the offline indicator, lists projects from the local database, and a project created offline is listed at once | Advisory, E2E Full, via the script |
| `tests/maestro/offline/database-operations.yaml` | Phase 3, back online: the indicator goes, the outbox pushes the offline project and a pull keeps it; then archives it | Advisory, E2E Full, via the script |
| `tests/maestro/subflows/*.yaml` | Subflows: sign in, open the New Project form, archive a project by name. Not flows | Run via `runFlow` only |

The status column names what each flow proves; which runs passed is in the development report
that landed them, [`2026-10-02_e2e-real-screens`](../development%20reports/2026-10-02_e2e-real-screens/README.md).

### npm Scripts

```json
{
  "test:maestro": "maestro test -e APP_ID=com.wildlife.wildlifewatcher.expo tests/maestro/",
  "test:maestro:smoke": "maestro test -e APP_ID=com.wildlife.wildlifewatcher.expo tests/maestro/smoke/",
  "test:maestro:full": "maestro test -e APP_ID=com.wildlife.wildlifewatcher.expo tests/maestro/",
  "test:maestro:auth": "maestro test -e APP_ID=com.wildlife.wildlifewatcher.expo tests/maestro/auth-workflow.yaml",
  "test:maestro:crud": "maestro test -e APP_ID=com.wildlife.wildlifewatcher.expo tests/maestro/project-crud-workflow.yaml",
  "test:maestro:offline": "bash scripts/maestro-offline.sh -e APP_ID=com.wildlife.wildlifewatcher.expo"
}
```

### Device Setup

**Option A: Direct Device (Simplest)**
```bash
adb devices   # Should show your device
npm run test:maestro:smoke
```

**Option B: Android Emulator**
```bash
emulator -list-avds
emulator -avd <name> &
adb devices
```

**Option C: WSL2 → Windows Emulator Bridge**
```bash
# 1. Start emulator on Windows (via Android Studio)
# 2. In WSL2:
export ADB_SERVER_SOCKET=tcp:$(cat /etc/resolv.conf | grep nameserver | awk '{print $2}'):5037
adb devices

# If connection fails, add firewall rule in Windows PowerShell (Admin):
# New-NetFirewallRule -DisplayName "ADB for WSL2" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5037
```

### Writing E2E Tests

- **Name the package as `appId: ${APP_ID}`**, never a fixed one. CI installs the release package,
  a local debug build the `.expo` one; a fixed `.expo` failed the release PR #366.
- **Select by `testID`, not text.** `grep -rn 'testID=' src` lists what exists; add one in `src/`
  when a screen has none. Text changes, ids do not, and a text match is exact.
  ```yaml
  - tapOn:
      id: "login-button"
  ```
- **Start from `subflows/sign-in.yaml`** (`launchApp` with `clearState` and every permission
  granted, sign in, skip the tutorial, wait for the bottom tabs). `AndroidPermissionsProvider`
  renders nothing else until Bluetooth and location are granted, and an explicit sign-in opens
  the tutorial before the home screen.
- **Wait, do not assert, after anything asynchronous.** `extendedWaitUntil` with a generous
  `timeout`: a cold start on a CI emulator takes tens of seconds, and the list screens wait on
  the first sync.
- **Create what you need with a unique name and archive it at the end**, as the CRUD flow does
  with `evalScript: ${output.projectName = 'E2E ' + Date.now()}`, so a failed run does not
  collide with the next one and cloud-dev stays clean until the next reseed.
- **A new top-level flow runs by itself; a new subfolder or subflow needs `config.yaml`.**
  Maestro ignores subfolders unless the config's `flows:` globs name them, and a subflow is any
  file no glob matches.
- **Maestro cannot shell out.** `runScript` runs JavaScript in Maestro's own sandbox with no
  `adb`, no `Android.shell`. Maestro has `setAirplaneMode`, but on Android it takes the
  Bluetooth radio down and this app stops at "Please enable Bluetooth" (taking `bluetooth` out
  of `airplane_mode_radios` did not help, run 36926971767). So the offline scenario is three
  flows that share one app state, and `scripts/maestro-offline.sh` switches airplane mode and
  turns Bluetooth back on with `adb` between them. Anything else outside the app belongs in a
  script around Maestro, the same way.
- **Scroll to a button near the bottom of a form** with `scrollUntilVisible` before tapping it;
  `hideKeyboard` after typing, or the keyboard covers it.

### Maestro Cloud (Optional)

100 free tests a month, useful for CI/CD without device setup:
```bash
maestro login
maestro cloud tests/maestro/auth-workflow.yaml
```

### E2E Troubleshooting

| Problem | Solution |
|---------|----------|
| `adb devices` empty | `adb kill-server && adb start-server`, check USB debugging |
| Maestro can't find device | Verify `adb devices` first; try `maestro test --device <id>` |
| `maestro: command not found` | `source ~/.bashrc` or reinstall via curl |
| Java version error | Install Java 17+: `sudo apt install -y openjdk-17-jdk` |
| "Element not found" | Read the hierarchy (`maestro studio`, or the CI log's compact view); `extendedWaitUntil` before `tapOn`; use a testID |
| Stuck on "Please enable Bluetooth" | The app refuses to run with the adapter off: `adb shell svc bluetooth enable`, which `scripts/ci-maestro.sh` does, and `scripts/maestro-offline.sh` again after switching airplane mode on |
| Login never happens | `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` not passed, or not a seeded user since the last cloud-dev reseed |
| Flaky tests | `launchApp` with `clearState: true`; disable animations |

---

## Testing offline by hand (Android)

The Maestro offline scenario (`npm run test:maestro:offline`) covers a cold start in airplane
mode, one offline write and its sync. Everything else offline is checked on a phone, with a
debug build over USB. Four things decide whether the test means anything:

1. **Airplane mode is not offline.** Android turns Wi-Fi back on near a remembered network. Turn
   off "Turn on Wi-Fi automatically", keep Bluetooth on for the camera, and confirm before every
   test: `adb shell ping -c 1 -W 2 8.8.8.8` must fail, and
   `adb shell dumpsys connectivity | grep "Active default network"` must say `none`.
2. **Metro keeps working offline** through `adb reverse tcp:8081 tcp:8081`. A USB drop clears
   it, so run it again after any reconnect.
3. **An expired sign-in** is simulated by setting the phone's clock two hours ahead, since access
   tokens last an hour. A cold start offline should reach the Scanner within seconds and log
   `Staying signed in offline` (#310).
4. **Put the clock back on automatic before going online.** With the clock ahead, every new token
   looks expired and the app refreshes in a loop.

Check the queue, not the screen: the app's WatermelonDB file is readable with
`adb exec-out run-as com.wildlife.wildlifewatcher.expo cat watermelon.db` (and
`watermelon.db-wal`), and `sync_outbox` holds every queued change with its status.

---

## CI/CD

The `quality-gate-validation.yml` GitHub Action runs on all PRs:
- TypeScript compilation (`npm run type-check`)
- ESLint (`npm run lint`)
- Tests with coverage (`npm test -- --coverage`)
- Console.log pollution check
- Type system size validation

The `react-doctor.yml` GitHub Action also runs on all PRs (informational):
- Scans for 60+ React / React Native best-practice rules
- Outputs a 0–100 health score in the job summary
- Can also be triggered manually from the **Actions** tab
- Config: `doctor.config.json` (suppresses React Native false positives)
- See [React-Doctor-Guide.md](React-Doctor-Guide.md) for details

---

## Role-Based Test Accounts

The backend seeds **17 pre-configured user accounts** across 4 organisations for development and testing. These accounts are available on the staging/dev Supabase instance and in local environments after seeding.

> [!IMPORTANT]
> **Credentials**: Usernames are listed in [`ww-backend/supabase/seeds/USER-CREDENTIALS-REFERENCE.md`](https://github.com/wildlifeai/wildlife-watcher-backend/blob/main/supabase/seeds/USER-CREDENTIALS-REFERENCE.md). The shared password is stored as a GitHub Secret (`SEED_USER_PASSWORD`) and is available to developers on request.

### Quick Login Reference

> [!NOTE]
> "Org Manager" below is the `organisation_manager` role at organisation scope. The project list, devices and deployments follow the backend's role rules (`services/roleAccess.ts`, #351): a manager sees every project of the organisation, `ww_admin` (system scope) sees everything, and the project roles cover their own project only. The permission matrix below predates those roles and has three columns.

| Role | User | Email | Organisation | Use For |
|------|------|-------|--------------|---------|
| **ww_admin** | Alice Smith | `alice@ww.org` | General | Platform-wide admin testing |
| **Org Manager** | Laura Admin | `laura@ww.org` | Wildlife Research | Org management, project creation |
| **Org Manager** | Apps Manager | `apps@wildlife.ai` | General | Cross-org manager testing |
| **Project Admin** | Nancy Admin | `nancy@ww.org` | Wildlife Research | Project-scoped admin (no org-level) |
| **Project Member** | Mark Member | `mark@ww.org` | Wildlife Research | Read-only project access |
| **Project Member** | Carol White | `carol@ww.org` | General | Cross-org project membership |
| **Unassigned** | Emma Davis | `emma@ww.org` | General | No projects — empty state testing |

> **Full list**: 17 users across General, Wildlife Research Institute, Conservation Society, and Park Rangers Network. See the backend reference doc for the complete table.

### Mobile App Permission Matrix

The mobile app maps backend roles to a client-side permission object via `calculatePermissions()` in [`authSlice.ts`](../../src/redux/slices/authSlice.ts). The following table shows what each role can do in the app:

| Capability | `ww_admin` | `project_admin` | `project_member` |
|------------|:----------:|:----------------:|:-----------------:|
| View projects | ✅ | ✅ | ✅ |
| Create projects | ✅ | ✅ | ❌ |
| Edit/delete projects | ✅ | ✅ | ❌ |
| Manage project members | ✅ | ✅ | ❌ (view only) |
| View deployments | ✅ | ✅ | ✅ |
| Start/stop deployments | ✅ | ✅ | ✅ |
| Manage devices | ✅ | ✅ | ❌ (view only) |
| Manage users | ✅ | ❌ | ❌ |
| Access all organisations | ✅ | ❌ | ❌ |

### Automated Testing with Test Accounts

These accounts enable automated validation of RBAC-gated features via Maestro E2E tests. Below are the key scenarios to validate:

#### 1. Multi-Tenant Isolation (Critical)

```yaml
# Login as Laura (Wildlife Research) → should NOT see Conservation Society projects
- launchApp: { clearState: true }
- inputText: { id: "email-input", text: "laura@ww.org" }
- inputText: { id: "password-input", text: "${SEED_USER_PASSWORD}" }
- tapOn: { id: "login-button" }
- assertVisible: "Tiger Tracking Program"
- assertNotVisible: "Marine Life Documentation"
```

**Test users**:
- `laura@ww.org` → sees only Wildlife Research projects
- `oliver@ww.org` → sees only Conservation Society projects
- `alice@ww.org` → sees all orgs she belongs to (ww_admin)

#### 2. Permission-Gated UI Elements

```yaml
# Login as Mark (project_member) → Create Project button should be hidden
- launchApp: { clearState: true }
- inputText: { id: "email-input", text: "mark@ww.org" }
# ... login ...
- assertNotVisible: { id: "create-project-button" }

# Login as Laura (org manager) → Create Project button should be visible
- launchApp: { clearState: true }
- inputText: { id: "email-input", text: "laura@ww.org" }
# ... login ...
- assertVisible: { id: "create-project-button" }
```

#### 3. Empty State Handling

```yaml
# Login as Emma (no project assignments) → should see empty project list
- launchApp: { clearState: true }
- inputText: { id: "email-input", text: "emma@ww.org" }
# ... login ...
- assertVisible: "No projects"
```

#### 4. Cross-Organisation Project Membership

```yaml
# Carol (General org) is assigned to Tiger Tracking (Wildlife Research org)
- launchApp: { clearState: true }
- inputText: { id: "email-input", text: "carol@ww.org" }
# ... login ...
- assertVisible: "Tiger Tracking Program"
- assertNotVisible: "Bird Migration Study"   # Not assigned
```

#### 5. Tutorial Gate (First Login)

After login, new users see the tutorial carousel before reaching the main app. Validate that `completeTutorial()` correctly transitions to the home screen:

```yaml
- launchApp: { clearState: true }
- inputText: { id: "email-input", text: "emma@ww.org" }
# ... login ...
- assertVisible: { id: "tutorial-skip-button" }
- tapOn: { id: "tutorial-skip-button" }
- assertVisible: { id: "bottom-tab-scanner" }    # Main app loaded
```

### Local Seeding

To use these accounts locally:

```bash
# 1. Reset the local Supabase database
cd ../ww-backend
supabase db reset

# 2. Run the seed script (requires SEED_USER_PASSWORD in .env.test)
bash scripts/seed-local.sh
```

> [!TIP]
> When writing new features that depend on user roles, always test with at least three accounts: `alice@ww.org` (admin), `laura@ww.org` (org manager), and `mark@ww.org` (member) to catch permission regressions.

---

## Best Practices

- **Type Imports**: Always import types from `src/types/index.ts` (the central export) instead of specific files like `database.types.ts`. This significantly reduces memory usage and Jest crash risks during test runs by avoiding parsing huge auto-generated backend schemas.
- **Async assertions**: Always use `waitFor` for UI changes after promises
- **TestIDs**: Use `testID` props for robust selection (Jest and Maestro)
- **State reset**: Clear mocks and reset store in `beforeEach`
- **Error handling**: Test both success and failure paths

## Known Issues

- **Legacy BLE Command Manager**: `src/ble/commandManager.ts` survives only as a trap file that throws on import. Its tests have been removed. Current BLE tests live in `src/ble/__tests__/` (messageClassifier, transport), `src/ble/protocol/__tests__/` (simulatedTransport) and `src/ble/protocol/fileTransfer/__tests__/` (ackMatcher, crc16ccitt, filenameValidator, fileTransferPackets). There is no `src/ble/session/__tests__/`.

---

**Last Updated**: 2026-05-18