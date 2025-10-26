/**
 * Unit tests for authentication service
 * These tests verify all authentication functions work correctly with mocked Supabase client
 */

import {
  login,
  register,
  logout,
  getCurrentSession,
  isAuthenticated,
  refreshSession,
  setupAuthListener,
  resetPassword,
  updatePassword,
  updatePasswordWithToken,
  getCurrentUser,
} from '../../../src/services/auth';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

import {
  mockSupabaseClient,
  mockAuthSuccess,
  mockAuthError,
  mockAuthSignOut,
  mockAuthSignOutError,
  resetSupabaseMocks,
  mockUser,
  mockSession,
} from '../../__mocks__/supabase';

import {
  validLoginCredentials,
  invalidLoginCredentials,
  validRegisterCredentials,
  invalidRegisterCredentials,
  authErrorMessages,
  pendingConfirmationAuthResponse
} from '../../setup/fixtures/auth';

// Clear mocks before each test
beforeEach(() => {
  resetSupabaseMocks();
  jest.clearAllMocks();
});

describe('Authentication Service', () => {
  describe('login', () => {
    test('should login successfully with valid credentials', async () => {
      mockAuthSuccess();
      
      const result = await login(validLoginCredentials);
      
      expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
        email: validLoginCredentials.identifier,
        password: validLoginCredentials.password,
      });
      
      expect(result).toMatchObject({
        jwt: expect.any(String),
        user: {
          id: expect.any(String),
          username: expect.any(String),
          email: validLoginCredentials.identifier,
          confirmed: true,
          blocked: false,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      });
    });

    test('should throw error with invalid credentials', async () => {
      const errorMessage = authErrorMessages.invalidCredentials;
      mockAuthError(errorMessage);
      
      await expect(login(invalidLoginCredentials)).rejects.toThrow(errorMessage);
      
      expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
        email: invalidLoginCredentials.identifier,
        password: invalidLoginCredentials.password,
      });
    });

    test('should throw error when no user data returned', async () => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: null,
      });
      
      await expect(login(validLoginCredentials)).rejects.toThrow(
        'Login failed: No user or session data returned'
      );
    });

    test('should handle network errors', async () => {
      const networkError = new Error(authErrorMessages.networkError);
      mockSupabaseClient.auth.signInWithPassword.mockRejectedValue(networkError);
      
      await expect(login(validLoginCredentials)).rejects.toThrow(authErrorMessages.networkError);
    });
  });

  describe('register', () => {
    test('should register successfully with valid credentials', async () => {
      mockAuthSuccess({ email: validRegisterCredentials.email });
      
      const result = await register(validRegisterCredentials);
      
      expect(mockSupabaseClient.auth.signUp).toHaveBeenCalledWith({
        email: validRegisterCredentials.email,
        password: validRegisterCredentials.password,
        options: {
          data: {
            username: validRegisterCredentials.username,
            organization: validRegisterCredentials.organization,
          },
          emailRedirectTo: 'wildlifewatcher://auth/callback',
        },
      });
      
      expect(result).toMatchObject({
        jwt: expect.any(String),
        user: {
          username: expect.any(String),
          email: validRegisterCredentials.email,
          confirmed: true,
        },
      });
    });

    test('should handle registration with email confirmation required', async () => {
      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: {
          user: mockUser,
          session: null, // No session means email confirmation required
        },
        error: null,
      });
      
      const result = await register(validRegisterCredentials);
      
      expect(result).toMatchObject({
        jwt: '',
        user: {
          username: validRegisterCredentials.username,
          email: validRegisterCredentials.email,
          confirmed: false,
        },
      });
      expect((result as any).isPendingConfirmation).toBe(true);
    });

    test('should throw error with invalid registration data', async () => {
      const errorMessage = authErrorMessages.validationError;
      mockAuthError(errorMessage);
      
      await expect(register(invalidRegisterCredentials)).rejects.toThrow(errorMessage);
    });

    test('should throw error when email already exists', async () => {
      const errorMessage = authErrorMessages.emailAlreadyExists;
      mockAuthError(errorMessage);
      
      await expect(register(validRegisterCredentials)).rejects.toThrow(errorMessage);
    });

    test('should throw error when no user data returned', async () => {
      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: null,
      });
      
      await expect(register(validRegisterCredentials)).rejects.toThrow(
        'Registration failed: No user data returned'
      );
    });
  });

  describe('logout', () => {
    test('should logout successfully', async () => {
      mockAuthSignOut();
      
      await expect(logout()).resolves.toBeUndefined();
      
      expect(mockSupabaseClient.auth.signOut).toHaveBeenCalledTimes(1);
    });

    test('should throw error when logout fails', async () => {
      const errorMessage = authErrorMessages.serverError;
      mockAuthSignOutError(errorMessage);
      
      await expect(logout()).rejects.toThrow(errorMessage);
    });
  });

  describe('getCurrentSession', () => {
    test('should return current session when user is authenticated', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });
      
      const result = await getCurrentSession();
      
      expect(result).toMatchObject({
        jwt: mockSession.access_token,
        user: {
          email: mockUser.email,
          username: expect.any(String),
        },
      });
    });

    test('should return null when no session exists', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });
      
      const result = await getCurrentSession();
      
      expect(result).toBeNull();
    });

    test('should return null when error occurs', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: new Error(authErrorMessages.serverError),
      });
      
      const result = await getCurrentSession();
      
      expect(result).toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    test('should return true when user is authenticated', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });
      
      const result = await isAuthenticated();
      
      expect(result).toBe(true);
    });

    test('should return false when user is not authenticated', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });
      
      const result = await isAuthenticated();
      
      expect(result).toBe(false);
    });
  });

  describe('refreshSession', () => {
    test('should refresh session successfully', async () => {
      mockSupabaseClient.auth.refreshSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });
      
      const result = await refreshSession();
      
      expect(result).toMatchObject({
        jwt: mockSession.access_token,
        user: {
          email: mockUser.email,
        },
      });
    });

    test('should return null when refresh fails', async () => {
      mockSupabaseClient.auth.refreshSession.mockResolvedValue({
        data: { session: null },
        error: new Error(authErrorMessages.tokenExpired),
      });
      
      const result = await refreshSession();
      
      expect(result).toBeNull();
    });
  });

  describe('setupAuthListener', () => {
    test('should set up auth state change listener', () => {
      const mockCallback = jest.fn();
      const mockUnsubscribe = jest.fn();
      
      mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: mockUnsubscribe } },
      });
      
      const unsubscribe = setupAuthListener(mockCallback);
      
      expect(mockSupabaseClient.auth.onAuthStateChange).toHaveBeenCalledWith(
        expect.any(Function)
      );
      
      expect(typeof unsubscribe).toBe('function');
      
      // Test unsubscribe
      unsubscribe();
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });

    test('should call callback with auth response when session exists', async () => {
      const mockCallback = jest.fn();
      let authStateChangeCallback: ((event: AuthChangeEvent, session: Session | null) => void) | undefined;

      mockSupabaseClient.auth.onAuthStateChange.mockImplementation((callback: (event: AuthChangeEvent, session: Session | null) => void) => {
        authStateChangeCallback = callback;
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      });
      
      setupAuthListener(mockCallback);
      
      // Simulate auth state change with session
      await authStateChangeCallback('SIGNED_IN', mockSession);
      
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          jwt: mockSession.access_token,
          user: expect.objectContaining({
            email: mockUser.email,
          }),
        })
      );
    });

    test('should call callback with null when no session', async () => {
      const mockCallback = jest.fn();
      let authStateChangeCallback: ((event: AuthChangeEvent, session: Session | null) => void) | undefined;

      mockSupabaseClient.auth.onAuthStateChange.mockImplementation((callback: (event: AuthChangeEvent, session: Session | null) => void) => {
        authStateChangeCallback = callback;
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      });
      
      setupAuthListener(mockCallback);
      
      // Simulate auth state change without session
      await authStateChangeCallback('SIGNED_OUT', null);
      
      expect(mockCallback).toHaveBeenCalledWith(null);
    });
  });

  describe('resetPassword', () => {
    test('should send password reset email successfully', async () => {
      mockSupabaseClient.auth.resetPasswordForEmail.mockResolvedValue({
        error: null,
      });
      
      await expect(resetPassword('test@example.com')).resolves.toBeUndefined();
      
      expect(mockSupabaseClient.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'test@example.com',
        { redirectTo: 'wildlifewatcher://auth/reset-password' }
      );
    });

    test('should throw error when reset password fails', async () => {
      const errorMessage = authErrorMessages.userNotFound;
      mockSupabaseClient.auth.resetPasswordForEmail.mockResolvedValue({
        error: new Error(errorMessage),
      });
      
      await expect(resetPassword('invalid@example.com')).rejects.toThrow(errorMessage);
    });
  });

  describe('updatePassword', () => {
    test('should update password successfully', async () => {
      mockSupabaseClient.auth.updateUser.mockResolvedValue({
        error: null,
      });
      
      await expect(updatePassword('newpassword123')).resolves.toBeUndefined();
      
      expect(mockSupabaseClient.auth.updateUser).toHaveBeenCalledWith({
        password: 'newpassword123',
      });
    });

    test('should throw error when update password fails', async () => {
      const errorMessage = authErrorMessages.passwordTooWeak;
      mockSupabaseClient.auth.updateUser.mockResolvedValue({
        error: new Error(errorMessage),
      });
      
      await expect(updatePassword('weak')).rejects.toThrow(errorMessage);
    });
  });

  describe('updatePasswordWithToken', () => {
    test('should update password with token successfully', async () => {
      mockSupabaseClient.auth.verifyOtp.mockResolvedValue({ error: null });
      mockSupabaseClient.auth.updateUser.mockResolvedValue({ error: null });
      
      await expect(updatePasswordWithToken('test-token', 'newpassword123'))
        .resolves.toBeUndefined();
      
      expect(mockSupabaseClient.auth.verifyOtp).toHaveBeenCalledWith({
        token_hash: 'test-token',
        type: 'recovery',
      });
      
      expect(mockSupabaseClient.auth.updateUser).toHaveBeenCalledWith({
        password: 'newpassword123',
      });
    });

    test('should throw error when token verification fails', async () => {
      const errorMessage = authErrorMessages.tokenInvalid;
      mockSupabaseClient.auth.verifyOtp.mockResolvedValue({
        error: new Error(errorMessage),
      });
      
      await expect(updatePasswordWithToken('invalid-token', 'newpassword123'))
        .rejects.toThrow(errorMessage);
    });

    test('should throw error when password update fails after token verification', async () => {
      mockSupabaseClient.auth.verifyOtp.mockResolvedValue({ error: null });
      
      const errorMessage = authErrorMessages.passwordTooWeak;
      mockSupabaseClient.auth.updateUser.mockResolvedValue({
        error: new Error(errorMessage),
      });
      
      await expect(updatePasswordWithToken('test-token', 'weak'))
        .rejects.toThrow(errorMessage);
    });
  });

  describe('getCurrentUser', () => {
    test('should return current user successfully', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });
      
      const result = await getCurrentUser();
      
      expect(result).toEqual(mockUser);
    });

    test('should return null when no user found', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });
      
      const result = await getCurrentUser();
      
      expect(result).toBeNull();
    });

    test('should return null when error occurs', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error(authErrorMessages.serverError),
      });
      
      const result = await getCurrentUser();
      
      expect(result).toBeNull();
    });
  });
});