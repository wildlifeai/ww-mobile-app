# Testing Guide

This documentation captures the comprehensive testing strategy for the Wildlife Watcher app, including BDD patterns, mocking strategies, and best practices.

## Test Types

1.  **BDD Integration Tests** (`tests/integration/**/*.bdd.test.tsx`)
    *   Focus: User stories, screen navigation, and full feature flows.
    *   Tools: `Given-When-Then` pattern, Redux integration, custom helpers.
2.  **Integration Tests** (`tests/integration/**/*.test.ts`)
    *   Focus: Service logic, backend interaction (Supabase), and data integrity.
3.  **Unit Tests** (`src/**/*.test.ts`)
    *   Focus: Isolated functions, hooks, and utility logic.

## Running Tests

### Run All Tests
```bash
npm test
```

### Run BDD Tests Only
```bash
npm test -- bdd
```

### Run Specific Test File
```bash
npm test -- Login.bdd.test.tsx
```

## BDD Testing Pattern

We use a `Given-When-Then` pattern helper to write readable acceptance tests.

### Example
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
*Helpers location:* `tests/setup/helpers/bdd.ts`

## Mocking Strategy

### 1. AsyncStorage
**Critical**: Avoid relying on the global mock for identity-sensitive checks (like `toHaveBeenCalledWith`).
*   **Recommended**: Define a local mock object in your test file and pass it to `jest.mock`.

```typescript
// Login.bdd.test.tsx
const mockAsyncStorage = {
    setItem: jest.fn(() => Promise.resolve()),
    getItem: jest.fn(() => Promise.resolve(null)),
    // ...other methods
}
jest.mock("@react-native-async-storage/async-storage", () => mockAsyncStorage)

// Assertion
expect(mockAsyncStorage.setItem).toHaveBeenCalledWith("key", "value")
```

#### Global Singleton Mock
A manual mock is also available at `tests/__mocks__/@react-native-async-storage/async-storage.js`. It exposes a singleton instance as `global.mockAsyncStorage` which can be used to check calls made by the implementation if you don't need a custom local mock.

```typescript
// Any test
const mockAS = (global as any).mockAsyncStorage
expect(mockAS.setItem).toHaveBeenCalledWith("rememberedEmail", "test@example.com")
```

### 2. Supabase
Supabase is mocked globally but can be overridden or reset per test.
*   **Reset Mocks**: `resetSupabaseMocks()` in `beforeEach`.
*   **Mock Setup**: `tests/__mocks__/supabase.ts`.

### 3. Redux & RTK Query
For UI tests involving API calls, mock the specific hook rather than the entire network layer if you want to control loading states closely.

```typescript
// Mocking specific RTK Query hook
const { useLoginMutation } = require("../src/redux/api/auth")
useLoginMutation.mockReturnValue([
    jest.fn().mockReturnValue({ unwrap: jest.fn().mockResolvedValue(mockResponse) }),
    { isLoading: false, error: null }
])
```

## Best Practices

*   **Async Assertions**: Always use `waitFor` when asserting UI changes that happen after a promise (e.g., Redux state updates).
*   **TestIDs**: Use `testID` props on components for robust selection (`screen.getByTestId`).
*   **Error Handling**: If a test involves a feature that might fail silently (like AsyncStorage), ensure the implementation code handles errors gracefully (e.g., `try/catch`) to avoid crashing the test runner.
*   **State Reset**: Always clear mocks and reset the store in `beforeEach`.
