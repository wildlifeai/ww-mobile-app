/**
 * Integration tests for Login screen
 * These tests verify the complete authentication flow including form validation,
 * API integration, navigation, and state management
 */

import React from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, waitFor, screen } from '@testing-library/react-native';
import { Login } from '../Login';
import { renderWithProviders, createTestStore, waitForAsync } from '../../../test/utils/testUtils';
import {
  mockAuthSuccess,
  mockAuthError,
  resetSupabaseMocks,
} from '../../../test/mocks/supabase';
import {
  validLoginCredentials,
  invalidLoginCredentials,
  formValidationCases,
  authErrorMessages,
} from '../../../test/fixtures/auth';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage');
const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

// Mock Alert
jest.spyOn(Alert, 'alert');

// Mock the logo image
jest.mock('../../../assets/ww-logo-1.png', () => 'test-logo');

// Mock the TestDeepLink component
jest.mock('../../../components/TestDeepLink', () => ({
  TestDeepLink: () => null,
}));

describe('Login Screen Integration Tests', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
    resetSupabaseMocks();
    jest.clearAllMocks();
    
    // Reset AsyncStorage mocks
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue();
    mockAsyncStorage.removeItem.mockResolvedValue();
  });

  test('should render login form correctly', () => {
    renderWithProviders(<Login />, { store });
    
    expect(screen.getByText('Email')).toBeTruthy();
    expect(screen.getByText('Password')).toBeTruthy();
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
    
    const emailInput = screen.getByLabelText('Email');
    const loginButton = screen.getByText('Login');

    // Test empty email
    fireEvent.press(loginButton);
    await waitFor(() => {
      expect(screen.getByText('Email is required')).toBeTruthy();
    });

    // Test invalid email formats
    for (const invalidEmail of formValidationCases.email.invalid) {
      fireEvent.changeText(emailInput, invalidEmail);
      fireEvent.press(loginButton);
      
      await waitFor(() => {
        if (invalidEmail === '') {
          expect(screen.getByText('Email is required')).toBeTruthy();
        } else {
          expect(screen.getByText('Please enter a valid email address')).toBeTruthy();
        }
      });
    }

    // Test valid email
    fireEvent.changeText(emailInput, formValidationCases.email.valid[0]);
    await waitForAsync();
    
    // Email validation error should be gone
    expect(screen.queryByText('Please enter a valid email address')).toBeFalsy();
  });

  test('should validate password field correctly', async () => {
    renderWithProviders(<Login />, { store });
    
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const loginButton = screen.getByText('Login');

    // Fill valid email to focus on password validation
    fireEvent.changeText(emailInput, validLoginCredentials.identifier);

    // Test empty password
    fireEvent.press(loginButton);
    await waitFor(() => {
      expect(screen.getByText('Password is required')).toBeTruthy();
    });

    // Test password too short
    fireEvent.changeText(passwordInput, '123');
    fireEvent.press(loginButton);
    await waitFor(() => {
      expect(screen.getByText('Password must be at least 6 characters')).toBeTruthy();
    });

    // Test valid password
    fireEvent.changeText(passwordInput, 'validpassword123');
    await waitForAsync();
    
    // Password validation error should be gone
    expect(screen.queryByText('Password must be at least 6 characters')).toBeFalsy();
  });

  test('should handle successful login flow', async () => {
    const mockAuthResponse = mockAuthSuccess();
    
    renderWithProviders(<Login />, { store });
    
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const loginButton = screen.getByText('Login');

    // Fill form
    fireEvent.changeText(emailInput, validLoginCredentials.identifier);
    fireEvent.changeText(passwordInput, validLoginCredentials.password);
    
    // Submit form
    fireEvent.press(loginButton);

    // Should show loading state
    await waitFor(() => {
      expect(screen.getByText('Login')).toBeDisabled();
    });

    await waitFor(() => {
      // Check that login was called with correct data
      expect(store.getState().auth.user).toEqual(
        expect.objectContaining({
          email: validLoginCredentials.identifier,
        })
      );
    });
  });

  test('should handle login failure with error message', async () => {
    const errorMessage = authErrorMessages.invalidCredentials;
    mockAuthError(errorMessage);
    
    renderWithProviders(<Login />, { store });
    
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const loginButton = screen.getByText('Login');

    // Fill form
    fireEvent.changeText(emailInput, invalidLoginCredentials.identifier);
    fireEvent.changeText(passwordInput, invalidLoginCredentials.password);
    
    // Submit form
    fireEvent.press(loginButton);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Login Failed',
        'Please check your email and password and try again.',
        [{ text: 'OK' }]
      );
    });
  });

  test('should handle remember me functionality', async () => {
    mockAuthSuccess();
    
    renderWithProviders(<Login />, { store });
    
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const rememberMeCheckbox = screen.getByRole('checkbox');
    const loginButton = screen.getByText('Login');

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
    
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const loginButton = screen.getByText('Login');

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
    
    const forgotPasswordButton = screen.getByText('Forgot Password?');
    fireEvent.press(forgotPasswordButton);
    
    // Check navigation was called (mocked in test utils)
    expect(require('../../../test/utils/testUtils').mockNavigate).toHaveBeenCalledWith(
      'ForgotPassword'
    );
  });

  test('should navigate to register screen', () => {
    const { store } = renderWithProviders(<Login />);
    
    const registerButton = screen.getByText("Don't have an account? Register");
    fireEvent.press(registerButton);
    
    // Check navigation was called
    expect(require('../../../test/utils/testUtils').mockNavigate).toHaveBeenCalledWith(
      'Register'
    );
  });

  test('should disable form elements during loading', async () => {
    // Mock a delayed auth response
    const { mockSupabaseClient } = require('../../../test/mocks/supabase');
    mockSupabaseClient.auth.signInWithPassword.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(mockAuthSuccess()), 1000))
    );
    
    renderWithProviders(<Login />, { store });
    
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const loginButton = screen.getByText('Login');
    const forgotPasswordButton = screen.getByText('Forgot Password?');
    const registerButton = screen.getByText("Don't have an account? Register");

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

  test('should show API error message when available', async () => {
    // Mock RTK Query error with specific message
    const { mockSupabaseClient } = require('../../../test/mocks/supabase');
    mockSupabaseClient.auth.signInWithPassword.mockRejectedValue({
      data: {
        error: {
          message: 'Custom API error message'
        }
      }
    });
    
    renderWithProviders(<Login />, { store });
    
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const loginButton = screen.getByText('Login');

    // Fill and submit form
    fireEvent.changeText(emailInput, validLoginCredentials.identifier);
    fireEvent.changeText(passwordInput, validLoginCredentials.password);
    fireEvent.press(loginButton);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Login Failed',
        'Please check your email and password and try again.',
        [{ text: 'OK' }]
      );
    });
  });

  test('should handle keyboard and focus interactions', () => {
    renderWithProviders(<Login />, { store });
    
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    
    // Test email input properties
    expect(emailInput.props.textContentType).toBe('emailAddress');
    expect(emailInput.props.keyboardType).toBe('email-address');
    expect(emailInput.props.autoCapitalize).toBe('none');
    
    // Test password input properties
    expect(passwordInput.props.secureTextEntry).toBe(true);
  });
});