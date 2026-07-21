# Testing Guide

> **Related**: [00-GETTING-STARTED.md](../onboarding/00-GETTING-STARTED.md) (project overview), [React-Doctor-Guide.md](React-Doctor-Guide.md) (health-score CI check).

## Overview

| Type | Tool | Location | Command |
|------|------|----------|---------|
| Unit | Jest + RNTL | `src/**/__tests__/*.test.ts` | `npm test` |
| Integration/BDD | Jest + custom helpers | `tests/integration/**/*.bdd.test.tsx` | `npm test -- bdd` |
| E2E | Maestro | `tests/maestro/*.yaml` | `npm run test:maestro` |

## Running Tests

```bash
npm test                    # All Jest tests (unit + integration)
npm test -- --watch         # Watch mode
npm test -- --coverage      # Coverage report
npm test -- Login.test.tsx  # Single file
npm run test:maestro        # E2E (requires device)
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
import { resetSupabaseMocks } from '../../test/mocks/supabase'

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

[Maestro](https://maestro.mobile.dev/) provides declarative YAML-based E2E testing against a real device or emulator.

**Version**: `maestro` v2.1.1 (devDependency)
**Requires**: Java 17+, ADB, connected Android device or emulator

### Quick Start

```bash
adb devices                 # 1. Verify device connected
npm run test:maestro        # 2. Run all E2E tests
npm run test:maestro:auth   # 3. Auth tests only
maestro test tests/maestro/auth-workflow.yaml  # 4. Single file
maestro studio tests/maestro/auth-workflow.yaml  # 5. Interactive debug
```

### Existing Test Flows

| File | Purpose | Status |
|------|---------|--------|
| `tests/maestro/auth-workflow.yaml` | RBAC login flows for all 3 roles + multi-org switching | ⚠️ Some assertions commented out |
| `tests/maestro/app-startup-debug.yaml` | Launch app + capture startup screenshot | ✅ Minimal |
| `tests/maestro/project-crud-workflow.yaml` | Create, read, update, delete project flow | ⚠️ Uses text selectors (fragile) |
| `tests/maestro/offline/complete-offline-workflow.yaml` | Full offline sync workflow | ✅ |
| `tests/maestro/offline/database-operations.yaml` | Offline database CRUD operations | ✅ |
| `tests/maestro/offline/setup-test-user.yaml` | Test user provisioning for offline tests | ✅ |

### npm Scripts

```json
{
  "test:maestro": "maestro test tests/maestro/",
  "test:maestro:auth": "maestro test tests/maestro/auth-workflow.yaml",
  "test:maestro:offline": "maestro test tests/maestro/offline/complete-offline-workflow.yaml"
}
```

### Device Setup

**Option A: Direct Device (Simplest)**
```bash
adb devices   # Should show your device
npm run test:maestro:auth
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

**Use testIDs (not text selectors):**
```yaml
# ❌ Fragile — breaks with text changes
- tapOn: "Login"

# ✅ Stable — tied to component testID prop
- tapOn:
    id: "login-button"
```

Add `testID` props in components:
```tsx
<TextInput testID="email-input" />
<Pressable testID="login-button" />
```

**Wait for elements:**
```yaml
- waitForVisible: "Submit"
- tapOn: "Submit"
```

**Clean state between tests:**
```yaml
- launchApp:
    clearState: true
```

**Environment variables:**
```bash
maestro test --env TEST_USER_EMAIL=admin@example.com tests/maestro/
```
```yaml
- inputText: ${TEST_USER_EMAIL}
```

### Maestro Installation

Maestro is already in `devDependencies`. For the CLI tool:

```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
```

Or use the project's WSL2 install script: `./scripts/install-maestro-wsl2.sh`

### Maestro Cloud (Optional)

100 free tests/month — useful for CI/CD without device setup:
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
| "Element not found" | Add `waitForVisible` before `tapOn`; use testID instead of text |
| Flaky tests | Use `launchApp: clearState: true`; disable animations |

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
- Config: `react-doctor.config.json` (suppresses React Native false positives)
- See [React-Doctor-Guide.md](React-Doctor-Guide.md) for details

---

## Role-Based Test Accounts

The backend seeds **17 pre-configured user accounts** across 4 organisations for development and testing. These accounts are available on the staging/dev Supabase instance and in local environments after seeding.

> [!IMPORTANT]
> **Credentials**: Usernames are listed in [`ww-backend/supabase/seeds/USER-CREDENTIALS-REFERENCE.md`](https://github.com/wildlifeai/wildlife-watcher-backend/blob/main/supabase/seeds/USER-CREDENTIALS-REFERENCE.md). The shared password is stored as a GitHub Secret (`SEED_USER_PASSWORD`) and is available to developers on request.

### Quick Login Reference

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

- **Legacy BLE Command Manager Tests**: `src/ble/__tests__/commandManager.test.ts` is skipped (`.skip.ts`). The legacy `BleCommandManager` has been fully replaced by the event-driven `protocol/` layer. New BLE tests are in `src/ble/protocol/__tests__/` and `src/ble/session/__tests__/`.

---

**Last Updated**: 2026-05-18