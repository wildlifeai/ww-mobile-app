import { LoginRequest, RegisterRequest, AuthResponse } from '../../redux/api/auth/types';

// Login test data
export const validLoginCredentials: LoginRequest = {
  identifier: 'test@example.com',
  password: 'password123',
};

export const invalidLoginCredentials: LoginRequest = {
  identifier: 'invalid@example.com',
  password: 'wrongpassword',
};

export const emptyLoginCredentials: LoginRequest = {
  identifier: '',
  password: '',
};

// Registration test data
export const validRegisterCredentials: RegisterRequest = {
  username: 'testuser',
  email: 'test@example.com',
  password: 'password123',
  organization: 'Test Organization',
};

export const invalidRegisterCredentials: RegisterRequest = {
  username: '',
  email: 'invalid-email',
  password: '123', // Too short
  organization: '',
};

export const existingUserRegisterCredentials: RegisterRequest = {
  username: 'existinguser',
  email: 'existing@example.com',
  password: 'password123',
  organization: 'Test Organization',
};

// Auth response test data
export const mockAuthResponse: AuthResponse = {
  jwt: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-token',
  user: {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    confirmed: true,
    blocked: false,
    createdAt: '2023-01-01T00:00:00.000Z',
    updatedAt: '2023-01-01T00:00:00.000Z',
  },
};

export const unconfirmedAuthResponse: AuthResponse = {
  jwt: '',
  user: {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    confirmed: false,
    blocked: false,
    createdAt: '2023-01-01T00:00:00.000Z',
    updatedAt: '2023-01-01T00:00:00.000Z',
  },
};

export const pendingConfirmationAuthResponse: AuthResponse & { isPendingConfirmation?: boolean } = {
  ...unconfirmedAuthResponse,
  isPendingConfirmation: true,
};

// Deep link test data
export const mockDeepLinks = {
  passwordReset: 'wildlifewatcher://auth/reset-password?token_hash=test-token&type=recovery',
  passwordResetInvalid: 'wildlifewatcher://auth/reset-password?token_hash=&type=invalid',
  emailConfirmation: 'wildlifewatcher://auth/callback?token_hash=test-token&type=signup',
  emailConfirmationInvalid: 'wildlifewatcher://auth/callback?token_hash=&type=invalid',
  generalCallback: 'wildlifewatcher://auth/callback',
  invalidUrl: 'wildlifewatcher://invalid/path',
};

// Form validation test data
export const formValidationCases = {
  email: {
    valid: [
      'test@example.com',
      'user.name@domain.co.uk',
      'test123@test-domain.org',
    ],
    invalid: [
      '',
      'invalid-email',
      '@domain.com',
      'test@',
      'test@domain',
      'test.domain.com',
    ],
  },
  password: {
    valid: [
      'password123',
      'StrongP@ss1',
      'MySecurePassword2023!',
    ],
    invalid: [
      '',
      '123',
      'short',
      'password',
    ],
  },
  username: {
    valid: [
      'testuser',
      'user123',
      'test_user',
      'TestUser',
    ],
    invalid: [
      '',
      'a',
      'ab',
      'user with spaces',
      'user@domain',
    ],
  },
  organization: {
    valid: [
      'Test Organization',
      'Wildlife Research Institute',
      'University of Example',
    ],
    invalid: [
      '',
      'a',
      'ab',
    ],
  },
};

// Error message test data
export const authErrorMessages = {
  invalidCredentials: 'Invalid login credentials',
  userNotFound: 'User not found',
  emailAlreadyExists: 'Email already registered',
  usernameAlreadyExists: 'Username already taken',
  passwordTooWeak: 'Password should be at least 6 characters',
  emailNotConfirmed: 'Email not confirmed',
  networkError: 'Network request failed',
  serverError: 'Internal server error',
  validationError: 'Validation failed',
  tokenExpired: 'Token has expired',
  tokenInvalid: 'Invalid token',
};