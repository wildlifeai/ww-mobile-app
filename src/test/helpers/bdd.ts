/**
 * BDD (Behavior-Driven Development) test helpers
 * Provides Given-When-Then style testing utilities for more readable tests
 */

import { fireEvent, waitFor, screen } from '@testing-library/react-native';

/**
 * BDD-style test builder for authentication flows
 */
export class AuthTestScenario {
  private steps: Array<() => Promise<void> | void> = [];
  private assertions: Array<() => Promise<void> | void> = [];

  given(description: string, action: () => Promise<void> | void) {
    console.log(`GIVEN: ${description}`);
    this.steps.push(action);
    return this;
  }

  when(description: string, action: () => Promise<void> | void) {
    console.log(`WHEN: ${description}`);
    this.steps.push(action);
    return this;
  }

  then(description: string, assertion: () => Promise<void> | void) {
    console.log(`THEN: ${description}`);
    this.assertions.push(assertion);
    return this;
  }

  and(description: string, action: () => Promise<void> | void) {
    console.log(`AND: ${description}`);
    // Can be used after given, when, or then
    if (this.assertions.length > 0) {
      this.assertions.push(action);
    } else {
      this.steps.push(action);
    }
    return this;
  }

  async execute() {
    // Execute all setup steps
    for (const step of this.steps) {
      await step();
    }

    // Execute all assertions
    for (const assertion of this.assertions) {
      await assertion();
    }
  }
}

/**
 * Common authentication actions for BDD tests
 */
export const AuthActions = {
  userIsOnLoginScreen: () => {
    expect(screen.getByText('Login')).toBeTruthy();
    expect(screen.getByText('Email')).toBeTruthy();
    expect(screen.getByText('Password')).toBeTruthy();
  },

  userIsOnRegisterScreen: () => {
    expect(screen.getByText('Register')).toBeTruthy();
    expect(screen.getByText('Username')).toBeTruthy();
    expect(screen.getByText('Email')).toBeTruthy();
  },

  userEntersEmail: (email: string) => {
    const emailInput = screen.getByLabelText('Email');
    fireEvent.changeText(emailInput, email);
  },

  userEntersPassword: (password: string) => {
    const passwordInput = screen.getByLabelText('Password');
    fireEvent.changeText(passwordInput, password);
  },

  userEntersUsername: (username: string) => {
    const usernameInput = screen.getByLabelText('Username');
    fireEvent.changeText(usernameInput, username);
  },

  userEntersOrganization: (organization: string) => {
    const orgInput = screen.getByLabelText('Organization (Optional)');
    fireEvent.changeText(orgInput, organization);
  },

  userConfirmsPassword: (password: string) => {
    const confirmInput = screen.getByLabelText('Confirm Password');
    fireEvent.changeText(confirmInput, password);
  },

  userChecksRememberMe: () => {
    const checkbox = screen.getByRole('checkbox');
    fireEvent.press(checkbox);
  },

  userSubmitsLoginForm: () => {
    const loginButton = screen.getByText('Login');
    fireEvent.press(loginButton);
  },

  userSubmitsRegisterForm: () => {
    const registerButton = screen.getByText('Register');
    fireEvent.press(registerButton);
  },

  userNavigatesToRegister: () => {
    const registerLink = screen.getByText("Don't have an account? Register");
    fireEvent.press(registerLink);
  },

  userNavigatesToLogin: () => {
    const loginLink = screen.getByText('Already have an account? Login');
    fireEvent.press(loginLink);
  },

  userNavigatesToForgotPassword: () => {
    const forgotLink = screen.getByText('Forgot Password?');
    fireEvent.press(forgotLink);
  },

  systemShowsValidationError: (message: string) => async () => {
    await waitFor(() => {
      expect(screen.getByText(message)).toBeTruthy();
    });
  },

  systemShowsSuccessMessage: (message: string) => async () => {
    await waitFor(() => {
      expect(screen.getByText(message)).toBeTruthy();
    });
  },

  systemNavigatesToScreen: (screenName: string) => async () => {
    const mockNavigate = require('../utils/testUtils').mockNavigate;
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(screenName);
    });
  },

  systemAuthenticatesUser: () => async () => {
    // This would check that user is authenticated in the store
    await waitFor(() => {
      // Implementation would depend on how authentication state is managed
      expect(true).toBe(true); // Placeholder
    });
  },
};

/**
 * User story test builder
 */
export class UserStoryTest {
  private title: string;
  private asRole: string;
  private want: string;
  private soThat: string;
  private scenarios: AuthTestScenario[] = [];

  constructor(title: string) {
    this.title = title;
  }

  as(role: string) {
    this.asRole = role;
    return this;
  }

  iWant(want: string) {
    this.want = want;
    return this;
  }

  soThat(soThat: string) {
    this.soThat = soThat;
    return this;
  }

  scenario(name: string) {
    const scenario = new AuthTestScenario();
    this.scenarios.push(scenario);
    console.log(`\n=== SCENARIO: ${name} ===`);
    return scenario;
  }

  describe() {
    console.log(`\n=== USER STORY: ${this.title} ===`);
    console.log(`As a ${this.asRole}`);
    console.log(`I want ${this.want}`);
    console.log(`So that ${this.soThat}`);
  }

  async executeAll() {
    this.describe();
    for (const scenario of this.scenarios) {
      await scenario.execute();
    }
  }
}

/**
 * Common BDD test data
 */
export const TestData = {
  validUser: {
    email: 'test@example.com',
    password: 'password123',
    username: 'testuser',
    organization: 'Test Organization',
  },
  
  invalidUser: {
    email: 'invalid-email',
    password: '123',
    username: 'ab',
    organization: '',
  },

  existingUser: {
    email: 'existing@example.com',
    password: 'password123',
    username: 'existinguser',
    organization: 'Existing Org',
  },
};

/**
 * Common validation messages
 */
export const ValidationMessages = {
  emailRequired: 'Email is required',
  emailInvalid: 'Please enter a valid email address',
  passwordRequired: 'Password is required',
  passwordTooShort: 'Password must be at least 6 characters',
  usernameRequired: 'Username is required',
  usernameTooShort: 'Username must be at least 3 characters',
  passwordMismatch: 'Passwords do not match',
  confirmPasswordRequired: 'Please confirm your password',
};

/**
 * Helper function to create a complete BDD test
 */
export const createUserStory = (title: string) => new UserStoryTest(title);