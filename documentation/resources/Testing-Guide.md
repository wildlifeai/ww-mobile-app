# Testing Guide

> **Related**: [Maestro-E2E-Testing-Guide.md](Maestro-E2E-Testing-Guide.md) (E2E tests), [00-GETTING-STARTED.md](../onboarding/00-GETTING-STARTED.md) (project overview).

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

## Best Practices

- **Async assertions**: Always use `waitFor` for UI changes after promises
- **TestIDs**: Use `testID` props for robust selection
- **State reset**: Clear mocks and reset store in `beforeEach`
- **Error handling**: Test both success and failure paths

## Known Issues

- **BLE Command Manager Tests**: `src/ble/__tests__/commandManager.test.ts` is skipped (`.skip.ts`) due to Jest worker crashes from unhandled promise rejections. Needs refactor.

---

**Last Updated**: 2026-02-19