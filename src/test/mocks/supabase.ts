import { AuthError, User, Session, AuthResponse as SupabaseAuthResponse } from '@supabase/supabase-js';

// Mock user data
export const mockUser: User = {
  id: 'test-user-uuid',
  app_metadata: {},
  user_metadata: {
    username: 'testuser',
    organization: 'Test Org',
  },
  aud: 'authenticated',
  confirmation_sent_at: '2023-01-01T00:00:00Z',
  recovery_sent_at: '2023-01-01T00:00:00Z',
  email_change_sent_at: '2023-01-01T00:00:00Z',
  new_email: null,
  new_phone: null,
  invited_at: null,
  action_link: null,
  email: 'test@example.com',
  phone: null,
  created_at: '2023-01-01T00:00:00Z',
  confirmed_at: '2023-01-01T00:00:00Z',
  email_confirmed_at: '2023-01-01T00:00:00Z',
  phone_confirmed_at: null,
  last_sign_in_at: '2023-01-01T00:00:00Z',
  role: 'authenticated',
  updated_at: '2023-01-01T00:00:00Z',
  identities: [],
  is_anonymous: false,
};

export const mockSession: Session = {
  access_token: 'mock-access-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Date.now() / 1000 + 3600,
  refresh_token: 'mock-refresh-token',
  user: mockUser,
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
    onAuthStateChange: jest.fn(() => ({
      data: { subscription: { unsubscribe: jest.fn() } }
    })),
    resetPasswordForEmail: jest.fn(),
    updateUser: jest.fn(),
    verifyOtp: jest.fn(),
  },
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(),
        limit: jest.fn(),
        order: jest.fn(),
      })),
      limit: jest.fn(),
      order: jest.fn(),
    })),
    insert: jest.fn(() => ({
      select: jest.fn(),
      single: jest.fn(),
    })),
    update: jest.fn(() => ({
      eq: jest.fn(() => ({
        select: jest.fn(),
        single: jest.fn(),
      })),
    })),
    delete: jest.fn(() => ({
      eq: jest.fn(),
    })),
    upsert: jest.fn(() => ({
      select: jest.fn(),
      single: jest.fn(),
    })),
  })),
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn(),
      download: jest.fn(),
      list: jest.fn(),
      remove: jest.fn(),
      createSignedUrl: jest.fn(),
    })),
  },
  realtime: {
    channel: jest.fn(() => ({
      on: jest.fn(() => ({
        subscribe: jest.fn(),
      })),
      unsubscribe: jest.fn(),
    })),
  },
};

// Auth response creators
export const createSuccessfulAuthResponse = (userOverrides = {}): SupabaseAuthResponse => ({
  data: {
    user: { ...mockUser, ...userOverrides },
    session: mockSession,
  },
  error: null,
});

export const createErrorAuthResponse = (message: string): SupabaseAuthResponse => ({
  data: {
    user: null,
    session: null,
  },
  error: new AuthError(message),
});

// Mock Supabase module
jest.mock('../../services/supabase', () => ({
  supabase: mockSupabaseClient,
}));

// Helper functions for tests
export const mockAuthSuccess = (userOverrides = {}) => {
  const response = createSuccessfulAuthResponse(userOverrides);
  mockSupabaseClient.auth.signInWithPassword.mockResolvedValue(response);
  mockSupabaseClient.auth.signUp.mockResolvedValue(response);
  mockSupabaseClient.auth.getSession.mockResolvedValue(response);
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: response.data.user },
    error: null,
  });
  return response;
};

export const mockAuthError = (message: string) => {
  const response = createErrorAuthResponse(message);
  mockSupabaseClient.auth.signInWithPassword.mockResolvedValue(response);
  mockSupabaseClient.auth.signUp.mockResolvedValue(response);
  mockSupabaseClient.auth.getSession.mockResolvedValue(response);
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: null },
    error: response.error,
  });
  return response;
};

export const mockAuthSignOut = () => {
  mockSupabaseClient.auth.signOut.mockResolvedValue({ error: null });
};

export const mockAuthSignOutError = (message: string) => {
  mockSupabaseClient.auth.signOut.mockResolvedValue({
    error: new AuthError(message),
  });
};

export const resetSupabaseMocks = () => {
  Object.values(mockSupabaseClient.auth).forEach(method => {
    if (jest.isMockFunction(method)) {
      method.mockClear();
    }
  });
};