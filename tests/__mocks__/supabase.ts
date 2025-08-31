/**
 * Mock implementation for Supabase client and authentication
 */

import { User, Session, AuthError } from '@supabase/supabase-js';

// Mock user object
export const mockUser: User = {
  id: '12345678-1234-1234-1234-123456789012',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'test@wildlifeai.org',
  email_confirmed_at: '2023-01-01T00:00:00Z',
  phone: '',
  confirmed_at: '2023-01-01T00:00:00Z',
  last_sign_in_at: '2023-01-01T00:00:00Z',
  app_metadata: {},
  user_metadata: {
    firstName: 'Test',
    lastName: 'User',
    role: 'project_member',
    organisation_id: 'org-1',
  },
  identities: [],
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-01T00:00:00Z',
};

// Mock session object
export const mockSession: Session = {
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_in: 3600,
  expires_at: Date.now() / 1000 + 3600,
  token_type: 'bearer',
  user: mockUser,
};

// Mock authentication responses
let mockAuthResponse = {
  data: { user: mockUser, session: mockSession },
  error: null,
};

let mockSignOutResponse = {
  error: null,
};

// Mock Supabase client
export const mockSupabaseClient = {
  auth: {
    signInWithPassword: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
    getSession: jest.fn(),
    getUser: jest.fn(),
    refreshSession: jest.fn(),
    resetPasswordForEmail: jest.fn(),
    updateUser: jest.fn(),
    verifyOtp: jest.fn(),
    onAuthStateChange: jest.fn(() => ({
      data: { subscription: { unsubscribe: jest.fn() } },
    })),
  },
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => Promise.resolve({ data: [], error: null })),
      neq: jest.fn(() => Promise.resolve({ data: [], error: null })),
      gt: jest.fn(() => Promise.resolve({ data: [], error: null })),
      gte: jest.fn(() => Promise.resolve({ data: [], error: null })),
      lt: jest.fn(() => Promise.resolve({ data: [], error: null })),
      lte: jest.fn(() => Promise.resolve({ data: [], error: null })),
      like: jest.fn(() => Promise.resolve({ data: [], error: null })),
      ilike: jest.fn(() => Promise.resolve({ data: [], error: null })),
      is: jest.fn(() => Promise.resolve({ data: [], error: null })),
      in: jest.fn(() => Promise.resolve({ data: [], error: null })),
      contains: jest.fn(() => Promise.resolve({ data: [], error: null })),
      containedBy: jest.fn(() => Promise.resolve({ data: [], error: null })),
      rangeGt: jest.fn(() => Promise.resolve({ data: [], error: null })),
      rangeGte: jest.fn(() => Promise.resolve({ data: [], error: null })),
      rangeLt: jest.fn(() => Promise.resolve({ data: [], error: null })),
      rangeLte: jest.fn(() => Promise.resolve({ data: [], error: null })),
      rangeAdjacent: jest.fn(() => Promise.resolve({ data: [], error: null })),
      overlaps: jest.fn(() => Promise.resolve({ data: [], error: null })),
      textSearch: jest.fn(() => Promise.resolve({ data: [], error: null })),
      match: jest.fn(() => Promise.resolve({ data: [], error: null })),
      not: jest.fn(() => Promise.resolve({ data: [], error: null })),
      or: jest.fn(() => Promise.resolve({ data: [], error: null })),
      filter: jest.fn(() => Promise.resolve({ data: [], error: null })),
      order: jest.fn(() => Promise.resolve({ data: [], error: null })),
      limit: jest.fn(() => Promise.resolve({ data: [], error: null })),
      range: jest.fn(() => Promise.resolve({ data: [], error: null })),
      single: jest.fn(() => Promise.resolve({ data: null, error: null })),
      maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
    })),
    insert: jest.fn(() => Promise.resolve({ data: [], error: null })),
    upsert: jest.fn(() => Promise.resolve({ data: [], error: null })),
    update: jest.fn(() => Promise.resolve({ data: [], error: null })),
    delete: jest.fn(() => Promise.resolve({ data: [], error: null })),
  })),
  channel: jest.fn(() => ({
    on: jest.fn(() => ({ subscribe: jest.fn() })),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
  })),
  removeChannel: jest.fn(),
};

// Helper functions to control mock responses
export const mockAuthSuccess = (customUser?: Partial<User>, customSession?: Partial<Session>) => {
  const user = customUser ? { ...mockUser, ...customUser } : mockUser;
  const session = customSession ? { ...mockSession, ...customSession, user } : { ...mockSession, user };
  
  const response = {
    data: { user, session },
    error: null,
  };
  
  // Configure the mock functions to return the success response
  mockSupabaseClient.auth.signInWithPassword.mockResolvedValue(response);
  mockSupabaseClient.auth.signUp.mockResolvedValue(response);
  mockSupabaseClient.auth.getSession.mockResolvedValue({ data: { session }, error: null });
  mockSupabaseClient.auth.getUser.mockResolvedValue({ data: { user }, error: null });
  mockSupabaseClient.auth.refreshSession.mockResolvedValue({ data: { session }, error: null });
  mockSupabaseClient.auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
  mockSupabaseClient.auth.updateUser.mockResolvedValue({ data: { user }, error: null });
  mockSupabaseClient.auth.verifyOtp.mockResolvedValue({ data: { user, session }, error: null });
};

export const mockAuthError = (message = 'Authentication failed') => {
  const error: AuthError = {
    name: 'AuthError',
    message,
    status: 400,
    code: 'auth_error',
    __isAuthError: true,
  };
  
  const response = {
    data: { user: null as any, session: null as any },
    error,
  };
  
  // Configure the mock functions to return the error response
  mockSupabaseClient.auth.signInWithPassword.mockResolvedValue(response);
  mockSupabaseClient.auth.signUp.mockResolvedValue(response);
};

export const mockAuthSignOut = () => {
  const response = { error: null };
  mockSupabaseClient.auth.signOut.mockResolvedValue(response);
};

export const mockAuthSignOutError = (message = 'Sign out failed') => {
  const error: AuthError = {
    name: 'AuthError',
    message,
    status: 400,
    code: 'auth_error', 
    __isAuthError: true,
  };
  
  const response = { error };
  mockSupabaseClient.auth.signOut.mockResolvedValue(response);
};

// Reset all mocks to default state
export const resetSupabaseMocks = () => {
  // Clear all mocks first
  Object.values(mockSupabaseClient.auth).forEach(mockFn => {
    if (jest.isMockFunction(mockFn)) {
      mockFn.mockClear();
    }
  });
  
  // Set up default success responses
  mockAuthSuccess();
  mockAuthSignOut();
};

// Export the mock for Jest
export default mockSupabaseClient;