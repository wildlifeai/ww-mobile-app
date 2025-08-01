import { AuthError, AuthResponse as SupabaseAuthResponse, Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { AuthResponse, LoginRequest, RegisterRequest } from '../redux/api/auth/types';

/**
 * Supabase Authentication Service
 * 
 * This service provides authentication functionality using Supabase Auth
 * and integrates with the existing Redux auth slice structure.
 */

// Transform Supabase User to match existing app AuthResponse format
const transformSupabaseUser = (user: User, session: Session): AuthResponse => {
  return {
    jwt: session.access_token,
    user: {
      id: parseInt(user.id) || 0, // Supabase uses UUID, existing app expects number
      username: user.user_metadata?.username || user.email?.split('@')[0] || '',
      email: user.email || '',
      confirmed: user.email_confirmed_at !== null,
      blocked: false, // Supabase doesn't have blocked status
      createdAt: user.created_at,
      updatedAt: user.updated_at || user.created_at,
    },
  };
};

/**
 * Login with email and password
 */
export const login = async (credentials: LoginRequest): Promise<AuthResponse> => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: credentials.identifier, // Assume identifier is email
      password: credentials.password,
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data.user || !data.session) {
      throw new Error('Login failed: No user or session data returned');
    }

    return transformSupabaseUser(data.user, data.session);
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

/**
 * Register new user
 */
export const register = async (credentials: RegisterRequest): Promise<AuthResponse> => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email: credentials.email,
      password: credentials.password,
      options: {
        data: {
          username: credentials.username,
        },
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data.user) {
      throw new Error('Registration failed: No user data returned');
    }

    // If no session, user needs to confirm email first
    if (!data.session) {
      console.log('Registration successful - email confirmation required');
      // Don't throw an error - this is a success case that requires email confirmation
      // Instead, return a special response indicating email confirmation is needed
      const pendingAuthResponse: AuthResponse = {
        jwt: '', // No JWT until confirmed
        user: {
          id: parseInt(data.user.id.replace(/-/g, '').slice(0, 8), 16) || 0, // Convert UUID to number-like ID
          username: credentials.username,
          email: credentials.email,
          confirmed: false,
          blocked: false,
          createdAt: data.user.created_at,
          updatedAt: data.user.updated_at || data.user.created_at,
        },
      };
      
      // Add a special flag to indicate this is pending confirmation
      (pendingAuthResponse as any).isPendingConfirmation = true;
      return pendingAuthResponse;
    }

    return transformSupabaseUser(data.user, data.session);
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
};

/**
 * Logout current user
 */
export const logout = async (): Promise<void> => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    console.error('Logout error:', error);
    throw error;
  }
};

/**
 * Get current session
 */
export const getCurrentSession = async (): Promise<AuthResponse | null> => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Get session error:', error);
      return null;
    }

    if (!session || !session.user) {
      return null;
    }

    return transformSupabaseUser(session.user, session);
  } catch (error) {
    console.error('Get current session error:', error);
    return null;
  }
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = async (): Promise<boolean> => {
  const session = await getCurrentSession();
  return session !== null;
};

/**
 * Refresh current session
 */
export const refreshSession = async (): Promise<AuthResponse | null> => {
  try {
    const { data: { session }, error } = await supabase.auth.refreshSession();
    
    if (error) {
      console.error('Refresh session error:', error);
      return null;
    }

    if (!session || !session.user) {
      return null;
    }

    return transformSupabaseUser(session.user, session);
  } catch (error) {
    console.error('Refresh session error:', error);
    return null;
  }
};

/**
 * Setup auth state change listener
 * This function returns an unsubscribe function
 */
export const setupAuthListener = (
  onAuthStateChange: (authResponse: AuthResponse | null) => void
): (() => void) => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.email);
      
      if (session && session.user) {
        const authResponse = transformSupabaseUser(session.user, session);
        onAuthStateChange(authResponse);
      } else {
        onAuthStateChange(null);
      }
    }
  );

  // Return unsubscribe function
  return () => {
    subscription.unsubscribe();
  };
};

/**
 * Password reset functionality
 */
export const resetPassword = async (email: string): Promise<void> => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'wildlifewatcher://reset-password',
    });

    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    console.error('Reset password error:', error);
    throw error;
  }
};

/**
 * Update user password
 */
export const updatePassword = async (newPassword: string): Promise<void> => {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    console.error('Update password error:', error);
    throw error;
  }
};

/**
 * Get current user
 */
export const getCurrentUser = async (): Promise<User | null> => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('Get user error:', error);
      return null;
    }

    return user;
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
};