import { AuthError, AuthResponse as SupabaseAuthResponse, Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { AuthResponse, LoginRequest, RegisterRequest } from '../redux/api/auth/types';
import { getDatabaseService } from './offline/DatabaseService';

/**
 * Supabase Authentication Service
 *
 * This service provides authentication functionality using Supabase Auth
 * and integrates with the existing Redux auth slice structure.
 */

/**
 * Sync user's organisations to local SQLite database
 * This ensures foreign key constraints are satisfied for offline operations
 */
const syncOrganisationsToLocal = async (organisations: { id: string; name: string }[]) => {
  try {
    const dbService = getDatabaseService();
    await dbService.initializeDatabase();

    for (const org of organisations) {
      // Check if organisation already exists
      const existingOrg = await dbService.getOrganisationById(org.id);

      if (!existingOrg) {
        // Insert organisation with default settings
        await dbService.insertOrganisation({
          id: org.id,
          name: org.name,
          settings: {
            timezone: 'UTC',
            currency: 'USD'
          }
        });
        console.log(`✅ Synced organisation to local database: ${org.name}`);
      }
    }
  } catch (error) {
    console.error('⚠️ Failed to sync organisations to local database:', error);
    // Don't throw - this is non-critical for login, but log the error
  }
};

/**
 * Fetch user's organisations and role information from database
 * This queries the user_organisations table to get all organisations the user belongs to
 */
const fetchUserOrganisations = async (userId: string) => {
  try {
    // Step 1: Get user_organisations (simple link table)
    const { data: userOrgs, error: userOrgsError } = await supabase
      .from('user_organisations')
      .select('organisation_id')
      .eq('user_id', userId);

    if (userOrgsError) {
      console.error('Error fetching user_organisations:', userOrgsError);
      return { organisations: [], role: 'project_member' as const, organisationId: null };
    }

    if (!userOrgs || userOrgs.length === 0) {
      console.warn('No organisations found for user:', userId);
      return { organisations: [], role: 'project_member' as const, organisationId: null };
    }

    // Step 2: Get organisation details
    const orgIds = userOrgs.map(uo => uo.organisation_id);
    const { data: orgs, error: orgsError } = await supabase
      .from('organisations')
      .select('id, name, slug')
      .in('id', orgIds);

    if (orgsError) {
      console.error('Error fetching organisations:', orgsError);
      return { organisations: [], role: 'project_member' as const, organisationId: null };
    }

    // Step 3: Get user roles for each organisation
    // user_roles has: user_id, role, scope_type, scope_id
    // For org-level roles: scope_type='organisation', scope_id=org_id
    // For system-level roles: scope_type='system', scope_id=null (ww_admin)
    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('role, scope_type, scope_id')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (rolesError) {
      console.error('Error fetching user_roles:', rolesError);
      return { organisations: [], role: 'project_member' as const, organisationId: null };
    }

    // Step 4: Combine the data
    const organisations = userOrgs.map(uo => {
      const org = orgs?.find(o => o.id === uo.organisation_id);

      // Find role for this organisation (organisation-scoped or system-wide)
      const orgRole = userRoles?.find(
        r => r.scope_type === 'organisation' && r.scope_id === uo.organisation_id
      );
      const systemRole = userRoles?.find(r => r.scope_type === 'system');

      // System ww_admin role takes precedence over org-specific roles
      const role = systemRole?.role || orgRole?.role || 'project_member';

      return {
        id: org?.id || '',
        name: org?.name || '',
        role: role as 'ww_admin' | 'project_admin' | 'project_member',
      };
    });

    // Get highest privilege role (ww_admin > project_admin > project_member)
    const allRoles = organisations.map(o => o.role);
    const role = allRoles.includes('ww_admin')
      ? 'ww_admin'
      : allRoles.includes('project_admin')
      ? 'project_admin'
      : 'project_member';

    // Get default organisation (first one for now)
    const organisationId = userOrgs[0].organisation_id;

    console.log('✅ Fetched user organisations:', { organisations, role, organisationId });

    // Sync organisations to local database (non-blocking)
    syncOrganisationsToLocal(organisations).catch(err => {
      console.warn('⚠️ Organisation sync failed (non-blocking):', err);
    });

    return { organisations, role, organisationId };
  } catch (error) {
    console.error('Exception fetching user organisations:', error);
    return { organisations: [], role: 'project_member' as const, organisationId: null };
  }
};

// Transform Supabase User to match existing app AuthResponse format
// Now includes organisation data from database
const transformSupabaseUser = async (user: User, session: Session): Promise<AuthResponse> => {
  // Fetch user's organisations from database
  const { organisations, role, organisationId } = await fetchUserOrganisations(user.id);

  return {
    jwt: session.access_token,
    user: {
      id: user.id, // Keep UUID as string
      username: user.user_metadata?.username || user.email?.split('@')[0] || '',
      email: user.email || '',
      confirmed: user.email_confirmed_at !== null,
      blocked: false, // Supabase doesn't have blocked status
      createdAt: user.created_at,
      updatedAt: user.updated_at || user.created_at,
      role, // User's highest privilege role
      organisation_id: organisationId, // Default organisation
      organisations, // All organisations user belongs to
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

    return await transformSupabaseUser(data.user, data.session);
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
          organization: credentials.organization,
        },
        emailRedirectTo: 'wildlifewatcher://auth/callback',
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
          id: data.user.id, // Keep UUID as string
          username: credentials.username,
          email: credentials.email,
          confirmed: false,
          blocked: false,
          createdAt: data.user.created_at,
          updatedAt: data.user.updated_at || data.user.created_at,
        },
      };
      
      // Add a special flag to indicate this is pending confirmation
      pendingAuthResponse.isPendingConfirmation = true;
      return pendingAuthResponse;
    }

    return await transformSupabaseUser(data.user, data.session);
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
        const authResponse = await transformSupabaseUser(session.user, session);
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
      redirectTo: 'wildlifewatcher://auth/reset-password',
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
 * Update user password (requires active session)
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
 * Reset password using token from email
 * @param token - Can be either token_hash (from email query param) or access_token (from URL fragment)
 * @param newPassword - The new password to set
 * @param refreshToken - Optional refresh token from URL fragment
 */
export const updatePasswordWithToken = async (
  token: string,
  newPassword: string,
  refreshToken?: string
): Promise<void> => {
  try {
    // If we have both access_token and refresh_token from URL fragment,
    // set the session directly (Supabase already validated via redirect)
    if (refreshToken) {
      console.log('Setting session from access_token and refresh_token');
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: token,
        refresh_token: refreshToken,
      });

      if (sessionError) {
        throw new Error(sessionError.message);
      }
    } else {
      // Legacy path: verify OTP token_hash from email
      console.log('Verifying OTP with token_hash');
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: 'recovery',
      });

      if (verifyError) {
        throw new Error(verifyError.message);
      }
    }

    // Now update the password with the established session
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      throw new Error(updateError.message);
    }

    console.log('Password updated successfully');
  } catch (error) {
    console.error('Update password with token error:', error);
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