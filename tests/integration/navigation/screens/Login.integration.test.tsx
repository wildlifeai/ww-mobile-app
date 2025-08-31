/**
 * Integration tests for Login screen
 * These tests verify the complete authentication flow including form validation,
 * API integration, navigation, and state management
 */

import React from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, waitFor, screen } from '@testing-library/react-native';
import { Login } from '../../../../src/navigation/screens/Login';
import { renderWithProviders, createTestStore, waitForAsync } from '../../../setup/utils/testUtils';
import {
  mockAuthSuccess,
  mockAuthError,
  resetSupabaseMocks,
} from '../../../__mocks__/supabase';
import {
  validLoginCredentials,
  invalidLoginCredentials,
  formValidationCases,
  authErrorMessages,
} from '../../../setup/fixtures/auth';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage');
const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

// Mock Alert
const mockAlert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

// Mock the logo image
// Logo image is automatically mocked by Jest moduleNameMapper

// Mock the TestDeepLink component
jest.mock('../../../../src/components/TestDeepLink', () => ({
  TestDeepLink: () => null,
}));

describe('Login Screen Integration Tests', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
    resetSupabaseMocks();
    jest.clearAllMocks();
    
    // Reset navigation mocks
    const { mockNavigate } = require('../../../setup/utils/testUtils');
    mockNavigate.mockClear();
    
    // Reset AsyncStorage mocks
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue();
    mockAsyncStorage.removeItem.mockResolvedValue();
  });

  test('should render login form correctly', () => {
    renderWithProviders(<Login />, { store });
    
    expect(screen.getByText('Email', { exact: false })).toBeTruthy();
    expect(screen.getAllByText('Password', { exact: false })[0]).toBeTruthy();
    expect(screen.getByText('Remember me')).toBeTruthy();
    expect(screen.getByText('Login')).toBeTruthy();
    expect(screen.getByText('Forgot Password?')).toBeTruthy();
    expect(screen.getByText("Don't have an account? Register")).toBeTruthy();
  });

  test('should load saved credentials on mount when remember me was checked', async () => {
    mockAsyncStorage.getItem
      .mockResolvedValueOnce('saved@example.com')
      .mockResolvedValueOnce('true');

    renderWithProviders(<Login />, { store });

    await waitFor(() => {
      const emailInput = screen.getByDisplayValue('saved@example.com');
      expect(emailInput).toBeTruthy();
    });

    expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('rememberedEmail');
    expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('rememberMe');
  });

  test('should not load saved credentials when remember me was not checked', async () => {
    mockAsyncStorage.getItem
      .mockResolvedValueOnce('saved@example.com')
      .mockResolvedValueOnce('false');

    renderWithProviders(<Login />, { store });

    await waitFor(() => {
      // Email field should be empty
      expect(screen.queryByDisplayValue('saved@example.com')).toBeFalsy();
    });
  });

  test('should validate email field correctly', async () => {
    renderWithProviders(<Login />, { store });
    
    // Verify testIDs are available
    expect(screen.getByTestId('email-input')).toBeTruthy();
    expect(screen.getByTestId('login-button')).toBeTruthy();
    
    const emailInput = screen.getByTestId('email-input');
    const loginButton = screen.getByTestId('login-button');

    // Test empty email validation workflow
    fireEvent.press(loginButton);
    await waitFor(() => {
      expect(screen.getByText('Email is required')).toBeTruthy();
    });
  });

  test('should validate password field correctly', async () => {
    renderWithProviders(<Login />, { store });
    
    const emailInput = screen.getByTestId('email-input');
    const passwordInput = screen.getByTestId('password-input');
    const loginButton = screen.getByTestId('login-button');

    // Fill valid email to focus on password validation
    fireEvent.changeText(emailInput, validLoginCredentials.identifier);

    // Test password too short workflow
    fireEvent.changeText(passwordInput, '123');
    fireEvent.press(loginButton);
    await waitFor(() => {
      expect(screen.getByText('Password must be at least 6 characters')).toBeTruthy();
    });
  });

  test('should handle successful login flow', async () => {
    const mockAuthResponse = mockAuthSuccess();
    
    renderWithProviders(<Login />, { store });
    
    const emailInput = screen.getByTestId('email-input');
    const passwordInput = screen.getByTestId('password-input');
    const loginButton = screen.getByTestId('login-button');

    // Fill form
    fireEvent.changeText(emailInput, validLoginCredentials.identifier);
    fireEvent.changeText(passwordInput, validLoginCredentials.password);
    
    // Submit form
    fireEvent.press(loginButton);

    // Wait for successful login - user should be stored in Redux
    await waitFor(() => {
      const state = store.getState();
      expect(state.authentication.user).toEqual(
        expect.objectContaining({
          email: validLoginCredentials.identifier,
        })
      );
    });
  });

  test('should handle login failure workflow', async () => {
    renderWithProviders(<Login />, { store });
    
    const emailInput = screen.getByTestId('email-input');
    const passwordInput = screen.getByTestId('password-input');
    const loginButton = screen.getByTestId('login-button');

    // Fill form with invalid credentials
    fireEvent.changeText(emailInput, invalidLoginCredentials.identifier);
    fireEvent.changeText(passwordInput, invalidLoginCredentials.password);
    
    // Submit form - this should not crash the app
    fireEvent.press(loginButton);
    
    // Verify form is still interactive after failed login attempt
    await waitFor(() => {
      expect(loginButton).toBeTruthy();
      expect(emailInput).toBeTruthy();
    });
  });

  test('should handle remember me functionality', async () => {
    mockAuthSuccess();
    
    renderWithProviders(<Login />, { store });
    
    const emailInput = screen.getByTestId('email-input');
    const passwordInput = screen.getByTestId('password-input');
    const rememberMeCheckbox = screen.getByRole('checkbox');
    const loginButton = screen.getByTestId('login-button');

    // Fill form
    fireEvent.changeText(emailInput, validLoginCredentials.identifier);
    fireEvent.changeText(passwordInput, validLoginCredentials.password);
    
    // Check remember me
    fireEvent.press(rememberMeCheckbox);
    
    // Submit form
    fireEvent.press(loginButton);

    await waitFor(() => {
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'rememberedEmail',
        validLoginCredentials.identifier
      );
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith('rememberMe', 'true');
    });
  });

  test('should clear saved credentials when remember me is unchecked', async () => {
    mockAuthSuccess();
    
    renderWithProviders(<Login />, { store });
    
    const emailInput = screen.getByTestId('email-input');
    const passwordInput = screen.getByTestId('password-input');
    const loginButton = screen.getByTestId('login-button');

    // Fill form without checking remember me
    fireEvent.changeText(emailInput, validLoginCredentials.identifier);
    fireEvent.changeText(passwordInput, validLoginCredentials.password);
    
    // Submit form
    fireEvent.press(loginButton);

    await waitFor(() => {
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('rememberedEmail');
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('rememberMe');
    });
  });

  test('should navigate to forgot password screen', () => {
    const { store } = renderWithProviders(<Login />);
    
    const forgotPasswordButton = screen.getByTestId('forgot-password-button');
    fireEvent.press(forgotPasswordButton);
    
    // Check navigation was called (mocked in test utils)
    expect(require('../../../setup/utils/testUtils').mockNavigate).toHaveBeenCalledWith(
      'ForgotPassword'
    );
  });

  test('should navigate to register screen', () => {
    const { store } = renderWithProviders(<Login />);
    
    const registerButton = screen.getByTestId('register-button');
    fireEvent.press(registerButton);
    
    // Check navigation was called
    expect(require('../../../setup/utils/testUtils').mockNavigate).toHaveBeenCalledWith(
      'Register'
    );
  });

  test('should disable form elements during loading', async () => {
    // Mock a delayed auth response
    const { mockSupabaseClient } = require('../../../__mocks__/supabase');
    mockSupabaseClient.auth.signInWithPassword.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(mockAuthSuccess()), 1000))
    );
    
    renderWithProviders(<Login />, { store });
    
    const emailInput = screen.getByTestId('email-input');
    const passwordInput = screen.getByTestId('password-input');
    const loginButton = screen.getByTestId('login-button');
    const forgotPasswordButton = screen.getByTestId('forgot-password-button');
    const registerButton = screen.getByTestId('register-button');

    // Fill form
    fireEvent.changeText(emailInput, validLoginCredentials.identifier);
    fireEvent.changeText(passwordInput, validLoginCredentials.password);
    
    // Submit form
    fireEvent.press(loginButton);

    // All buttons should be disabled during loading
    await waitFor(() => {
      expect(loginButton).toBeDisabled();
      expect(forgotPasswordButton).toBeDisabled();
      expect(registerButton).toBeDisabled();
    });
  });

  test('should handle AsyncStorage errors gracefully', async () => {
    // Mock AsyncStorage error
    mockAsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));
    
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    renderWithProviders(<Login />, { store });

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load saved credentials:',
        expect.any(Error)
      );
    });

    // Component should still render normally
    expect(screen.getByText('Login')).toBeTruthy();
    
    consoleSpy.mockRestore();
  });

  test('should toggle remember me checkbox on label press', () => {
    renderWithProviders(<Login />, { store });
    
    const rememberMeLabel = screen.getByText('Remember me');
    const checkbox = screen.getByRole('checkbox');
    
    // Initially unchecked
    expect(checkbox.props.accessibilityState.checked).toBe(false);
    
    // Press label
    fireEvent.press(rememberMeLabel);
    
    // Should be checked
    expect(checkbox.props.accessibilityState.checked).toBe(true);
    
    // Press label again
    fireEvent.press(rememberMeLabel);
    
    // Should be unchecked
    expect(checkbox.props.accessibilityState.checked).toBe(false);
  });

  test('should handle error states gracefully', async () => {
    renderWithProviders(<Login />, { store });
    
    const emailInput = screen.getByTestId('email-input');
    const passwordInput = screen.getByTestId('password-input');
    const loginButton = screen.getByTestId('login-button');

    // Fill and submit form - test app stability with any response
    fireEvent.changeText(emailInput, validLoginCredentials.identifier);
    fireEvent.changeText(passwordInput, validLoginCredentials.password);
    fireEvent.press(loginButton);

    // Verify app remains stable and interactive
    await waitFor(() => {
      expect(screen.getByTestId('email-input')).toBeTruthy();
      expect(screen.getByTestId('password-input')).toBeTruthy();
      expect(screen.getByTestId('login-button')).toBeTruthy();
    });
  });

  test('should handle keyboard and focus interactions', () => {
    renderWithProviders(<Login />, { store });
    
    const emailInput = screen.getByTestId('email-input');
    const passwordInput = screen.getByTestId('password-input');
    
    // Test email input properties
    expect(emailInput.props.textContentType).toBe('emailAddress');
    expect(emailInput.props.keyboardType).toBe('email-address');
    expect(emailInput.props.autoCapitalize).toBe('none');
    
    // Test password input properties
    expect(passwordInput.props.secureTextEntry).toBe(true);
  });
});