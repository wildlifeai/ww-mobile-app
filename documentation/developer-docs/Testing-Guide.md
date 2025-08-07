# Wildlife Watcher Testing Guide

This comprehensive testing guide covers unit testing, integration testing, and end-to-end testing for the Wildlife Watcher mobile application.

## Table of Contents

- [Overview](#overview)
- [Testing Architecture](#testing-architecture)
- [Setup and Installation](#setup-and-installation)
- [Unit Testing](#unit-testing)
- [Integration Testing](#integration-testing)
- [End-to-End Testing](#end-to-end-testing)
- [BDD Testing](#bdd-testing)
- [Test Organization](#test-organization)
- [Best Practices](#best-practices)
- [Common Patterns](#common-patterns)
- [Troubleshooting](#troubleshooting)

## Overview

The Wildlife Watcher app uses a multi-layered testing approach:

- **Unit Tests**: Test individual functions, components, and services in isolation
- **Integration Tests**: Test complete user flows and component interactions
- **End-to-End Tests**: Test the full application in a real device/simulator environment
- **BDD Tests**: Behavior-driven development tests written in Given-When-Then format

### Technology Stack

- **Jest**: JavaScript testing framework
- **React Native Testing Library**: Component testing utilities
- **Detox**: End-to-end testing framework
- **Custom BDD Helpers**: For readable user story testing

## Testing Architecture

```
src/
├── test/                           # Test utilities and configuration
│   ├── setupTests.ts              # Jest setup file
│   ├── utils/
│   │   └── testUtils.tsx          # Custom testing utilities
│   ├── mocks/
│   │   └── supabase.ts           # Supabase client mocks
│   ├── fixtures/
│   │   └── auth.ts               # Test data fixtures
│   └── helpers/
│       └── bdd.ts                # BDD testing helpers
├── services/__tests__/            # Unit tests for services
├── hooks/__tests__/               # Unit tests for custom hooks
├── components/__tests__/          # Unit tests for components
└── navigation/screens/__tests__/  # Integration tests for screens

e2e/                               # End-to-end tests
├── jest.config.js                # E2E Jest configuration
├── setup.js                      # E2E test setup
└── auth.test.js                  # E2E authentication tests

.detoxrc.js                       # Detox configuration
jest.config.js                    # Main Jest configuration
```

## Setup and Installation

### 1. Install Dependencies

The testing dependencies are already included in `package.json`. Run:

```bash
npm install
```

### 2. Key Dependencies

- `@testing-library/react-native`: Component testing utilities
- `@testing-library/jest-native`: Additional Jest matchers
- `jest-circus`: Test runner for Jest
- `detox`: End-to-end testing framework

## Unit Testing

Unit tests focus on testing individual functions and services in isolation.

### Service Testing

Test authentication services with mocked Supabase client:

```typescript
// src/services/__tests__/auth.test.ts
import { login } from '../auth';
import { mockAuthSuccess, mockAuthError } from '../../test/mocks/supabase';

describe('Authentication Service', () => {
  test('should login successfully with valid credentials', async () => {
    mockAuthSuccess();
    const result = await login({ identifier: 'test@example.com', password: 'password123' });
    expect(result.user.email).toBe('test@example.com');
  });
});
```

### Hook Testing

Test custom hooks with proper React testing utilities:

```typescript
// src/hooks/__tests__/useDeepLinking.test.ts
import { renderHook } from '@testing-library/react-native';
import { useDeepLinking } from '../useDeepLinking';

describe('useDeepLinking', () => {
  test('should handle password reset deep links', async () => {
    renderHook(() => useDeepLinking());
    // Test implementation
  });
});
```

### Running Unit Tests

```bash
# Run all unit tests
npm run test:unit

# Run with watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

## Integration Testing

Integration tests verify complete user flows and component interactions.

### Screen Testing

Test complete authentication flows including form validation, API calls, and navigation:

```typescript
// src/navigation/screens/__tests__/Login.integration.test.tsx
import { Login } from '../Login';
import { renderWithProviders, createTestStore } from '../../../test/utils/testUtils';

describe('Login Screen Integration', () => {
  test('should handle successful login flow', async () => {
    const store = createTestStore();
    mockAuthSuccess();
    
    renderWithProviders(<Login />, { store });
    
    // Fill form and submit
    fireEvent.changeText(screen.getByLabelText('Email'), 'test@example.com');
    fireEvent.changeText(screen.getByLabelText('Password'), 'password123');
    fireEvent.press(screen.getByText('Login'));
    
    // Verify authentication state
    await waitFor(() => {
      expect(store.getState().auth.user).not.toBeNull();
    });
  });
});
```

### Test Utilities

Use the custom `renderWithProviders` utility for consistent test setup:

```typescript
import { renderWithProviders, createTestStore } from '../../../test/utils/testUtils';

const store = createTestStore({
  auth: { isAuthenticated: true, user: mockUser }
});

renderWithProviders(<Component />, { 
  store,
  initialRoute: 'TestScreen',
  initialParams: { id: 1 }
});
```

### Running Integration Tests

```bash
# Run integration tests
npm run test:integration

# Run all tests
npm test
```

## End-to-End Testing

E2E tests use Detox to test the complete application in a real environment.

### Configuration

Detox is configured in `.detoxrc.js` with support for iOS and Android:

```javascript
module.exports = {
  configurations: {
    'ios.sim.debug': {
      device: 'simulator',
      app: 'ios.debug'
    },
    'android.emu.debug': {
      device: 'emulator',
      app: 'android.debug'
    }
  }
};
```

### Writing E2E Tests

```javascript
// e2e/auth.test.js
describe('Authentication Flow', () => {
  it('should login successfully', async () => {
    await element(by.label('Email')).typeText('test@example.com');
    await element(by.label('Password')).typeText('password123');
    await element(by.text('Login')).tap();
    
    await expect(element(by.text('Dashboard'))).toBeVisible();
  });
});
```

### Running E2E Tests

```bash
# Build the app for testing
npm run test:e2e:build

# Run E2E tests
npm run test:e2e

# Run on specific platform
npm run test:e2e:ios
npm run test:e2e:android
```

## BDD Testing

Behavior-Driven Development tests use Given-When-Then format for better readability.

### Using BDD Helpers

```typescript
// src/navigation/screens/__tests__/Login.bdd.test.tsx
import { createUserStory, AuthActions, TestData } from '../../../test/helpers/bdd';

test('User Story: Successful Login', async () => {
  await createUserStory('Successful User Login')
    .as('a wildlife researcher')
    .iWant('to log into the application')
    .soThat('I can access app features')
    .scenario('Valid credentials provided')
      .given('I am on the login screen', AuthActions.userIsOnLoginScreen)
      .when('I enter valid credentials', () => {
        AuthActions.userEntersEmail(TestData.validUser.email);
        AuthActions.userEntersPassword(TestData.validUser.password);
      })
      .and('I submit the form', AuthActions.userSubmitsLoginForm)
      .then('I should be authenticated', AuthActions.systemAuthenticatesUser())
    .executeAll();
});
```

### BDD Test Structure

- **User Story**: High-level description of functionality
- **Scenario**: Specific test case
- **Given**: Initial state/context
- **When**: User action or event
- **Then**: Expected outcome
- **And**: Additional steps or assertions

## Test Organization

### File Naming Conventions

- Unit tests: `*.test.ts` or `*.test.tsx`
- Integration tests: `*.integration.test.tsx`
- BDD tests: `*.bdd.test.tsx`
- E2E tests: `*.test.js` (in e2e/ directory)

### Directory Structure

- Keep tests close to the code they test
- Use `__tests__` directories for grouping related tests
- Separate utilities, mocks, and fixtures in `src/test/`

### Test Categories

Run specific test categories using npm scripts:

```bash
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:e2e          # End-to-end tests only
npm test                  # All Jest tests (unit + integration)
```

## Best Practices

### 1. Test Structure

- **Arrange**: Set up test data and environment
- **Act**: Execute the functionality being tested
- **Assert**: Verify the expected outcomes

### 2. Test Independence

- Each test should be independent and repeatable
- Use `beforeEach` to set up clean state
- Clean up after tests with proper mocking resets

### 3. Meaningful Test Names

```typescript
// Good
test('should show validation error when email is empty')

// Bad  
test('email validation')
```

### 4. Mock External Dependencies

- Mock Supabase client for consistent, fast tests
- Mock navigation to verify routing behavior
- Mock AsyncStorage for storage-related tests

### 5. Test Error Scenarios

- Test both success and failure paths
- Verify error handling and user feedback
- Test edge cases and boundary conditions

## Common Patterns

### 1. Testing Authentication Flows

```typescript
describe('Authentication', () => {
  beforeEach(() => {
    resetSupabaseMocks();
    jest.clearAllMocks();
  });

  test('successful login', async () => {
    mockAuthSuccess();
    // Test implementation
  });

  test('failed login', async () => {
    mockAuthError('Invalid credentials');
    // Test implementation
  });
});
```

### 2. Testing Form Validation

```typescript
test('should validate required fields', async () => {
  renderWithProviders(<LoginForm />);
  
  fireEvent.press(screen.getByText('Submit'));
  
  await waitFor(() => {
    expect(screen.getByText('Email is required')).toBeTruthy();
    expect(screen.getByText('Password is required')).toBeTruthy();
  });
});
```

### 3. Testing Navigation

```typescript
test('should navigate to register screen', () => {
  renderWithProviders(<Login />);
  
  fireEvent.press(screen.getByText('Register'));
  
  expect(mockNavigate).toHaveBeenCalledWith('Register');
});
```

### 4. Testing Async Operations

```typescript
test('should handle async data loading', async () => {
  mockApiCall.mockResolvedValue(mockData);
  
  renderWithProviders(<DataComponent />);
  
  await waitFor(() => {
    expect(screen.getByText('Data loaded')).toBeTruthy();
  });
});
```

## Troubleshooting

### Common Issues

#### 1. Tests Timing Out

```typescript
// Increase timeout for slow operations
test('slow operation', async () => {
  // Test implementation
}, 10000); // 10 second timeout
```

#### 2. Mock Not Working

```typescript
// Ensure mocks are reset between tests
beforeEach(() => {
  jest.clearAllMocks();
  resetSupabaseMocks();
});
```

#### 3. Navigation Mocks

```typescript
// Verify navigation mocks are properly set up
const mockNavigate = require('../../../test/utils/testUtils').mockNavigate;
expect(mockNavigate).toHaveBeenCalledWith('ScreenName');
```

#### 4. Async State Updates

```typescript
// Use waitFor for async state changes
await waitFor(() => {
  expect(screen.getByText('Updated')).toBeTruthy();
});
```

### Debugging Tests

- Use `console.log` statements for debugging
- Run single test files: `npm test -- Login.test.tsx`
- Use `--verbose` flag for detailed output
- Check mock implementations are correct

### Performance Tips

- Use `jest.useFakeTimers()` for timer-dependent tests
- Reset mocks only when necessary
- Group related tests in describe blocks
- Use `test.skip()` or `test.only()` during development

## Coverage Reports

Generate and view test coverage:

```bash
# Generate coverage report
npm run test:coverage

# View HTML report
open coverage/lcov-report/index.html
```

### Coverage Goals

- Aim for >80% line coverage for critical paths
- Focus on authentication, data services, and core user flows
- Don't sacrifice test quality for coverage percentage

## Continuous Integration

For CI/CD integration, use these commands:

```bash
# Run all tests with coverage
npm run test:coverage

# Run type checking
npm run type-check

# Run linting
npm run lint
```

## Testing Authentication System

The authentication system is comprehensively tested with:

- **Unit tests** for service functions (`src/services/__tests__/auth.test.ts`)
- **Hook tests** for deep linking (`src/hooks/__tests__/useDeepLinking.test.ts`)  
- **Integration tests** for Login/Register screens
- **BDD tests** for user story validation
- **E2E tests** for complete authentication flows

This ensures the authentication system is robust, reliable, and provides a good user experience.

## Next Steps

1. **Extend test coverage** to other app features (BLE, maps, projects)
2. **Add performance testing** for critical user flows  
3. **Implement visual regression testing** for UI consistency
4. **Set up automated testing** in CI/CD pipeline
5. **Add accessibility testing** for better inclusion

---

This testing infrastructure provides a solid foundation for maintaining code quality and preventing regressions as the Wildlife Watcher app continues to evolve.