import { PayloadAction, createSlice } from "@reduxjs/toolkit";

// Types for WW Admin functionality (REQUIRED by spec v1.4.6 - MVP)
export interface Organisation {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  status: 'active' | 'suspended' | 'archived';
  subscription_plan: 'free' | 'basic' | 'premium' | 'enterprise';
  max_projects: number;
  max_users: number;
  current_projects: number;
  current_users: number;
}

export interface UserProvisioning {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: 'ww_admin' | 'project_admin' | 'project_member';
  organisation_id?: string;
  status: 'pending' | 'active' | 'suspended' | 'archived';
  created_at: string;
  updated_at: string;
  invited_by: string;
  last_login?: string;
}

export interface SystemConfiguration {
  max_file_size_mb: number;
  allowed_file_types: string[];
  session_timeout_hours: number;
  max_concurrent_sessions: number;
  email_notifications: boolean;
  system_maintenance_mode: boolean;
  lorawan_webhook_url?: string;
  backup_retention_days: number;
}

export interface SystemMetrics {
  total_organisations: number;
  total_users: number;
  total_projects: number;
  total_deployments: number;
  active_deployments: number;
  total_observations: number;
  storage_usage_gb: number;
  monthly_api_calls: number;
  last_updated: string;
}

interface WWAdminState {
  // Organisation Management
  organisations: Organisation[];
  currentOrganisation?: Organisation;
  
  // User Provisioning (MVP requirement per spec line 73)
  users: UserProvisioning[];
  pendingInvitations: UserProvisioning[];
  
  // System Configuration
  systemConfig: SystemConfiguration;
  
  // System Metrics and Monitoring
  systemMetrics: SystemMetrics;
  
  // State management
  loading: boolean;
  error?: string;
  
  // Permission tracking for WW Admin features
  adminPermissions: {
    canManageOrganisations: boolean;
    canProvisionUsers: boolean;
    canModifySystemConfig: boolean;
    canViewSystemMetrics: boolean;
    canAccessAllData: boolean;
  };
}

const initialSystemConfig: SystemConfiguration = {
  max_file_size_mb: 100,
  allowed_file_types: ['.jpg', '.jpeg', '.png', '.mp4', '.mov', '.csv'],
  session_timeout_hours: 24,
  max_concurrent_sessions: 3,
  email_notifications: true,
  system_maintenance_mode: false,
  backup_retention_days: 30,
};

const initialSystemMetrics: SystemMetrics = {
  total_organisations: 0,
  total_users: 0,
  total_projects: 0,
  total_deployments: 0,
  active_deployments: 0,
  total_observations: 0,
  storage_usage_gb: 0,
  monthly_api_calls: 0,
  last_updated: new Date().toISOString(),
};

const initialState: WWAdminState = {
  organisations: [],
  users: [],
  pendingInvitations: [],
  systemConfig: initialSystemConfig,
  systemMetrics: initialSystemMetrics,
  loading: false,
  adminPermissions: {
    canManageOrganisations: false,
    canProvisionUsers: false,
    canModifySystemConfig: false,
    canViewSystemMetrics: false,
    canAccessAllData: false,
  },
};

// Helper function to validate WW Admin permissions
const validateWWAdminPermission = (currentUser: any): boolean => {
  return currentUser?.role === 'ww_admin';
};

// Helper function to validate organisation data
const validateOrganisation = (organisation: Organisation): string | null => {
  if (!organisation.id) return 'Organisation ID is required';
  if (!organisation.name || organisation.name.trim() === '') return 'Organisation name is required';
  if (organisation.max_projects < 0) return 'Max projects must be non-negative';
  if (organisation.max_users < 0) return 'Max users must be non-negative';
  return null;
};

// Helper function to validate user provisioning data
const validateUserProvisioning = (user: UserProvisioning): string | null => {
  if (!user.id) return 'User ID is required';
  if (!user.email || !/\S+@\S+\.\S+/.test(user.email)) return 'Valid email is required';
  if (!['ww_admin', 'project_admin', 'project_member'].includes(user.role)) {
    return 'Invalid user role';
  }
  return null;
};

export const wwAdminSlice = createSlice({
  name: "wwAdmin",
  initialState,
  reducers: {
    // Initialize WW Admin permissions
    initializeWWAdmin: (state, action: PayloadAction<any>) => {
      const currentUser = action.payload;
      
      if (validateWWAdminPermission(currentUser)) {
        state.adminPermissions = {
          canManageOrganisations: true,
          canProvisionUsers: true,
          canModifySystemConfig: true,
          canViewSystemMetrics: true,
          canAccessAllData: true,
        };
        state.error = undefined;
      } else {
        state.adminPermissions = {
          canManageOrganisations: false,
          canProvisionUsers: false,
          canModifySystemConfig: false,
          canViewSystemMetrics: false,
          canAccessAllData: false,
        };
        state.error = 'Insufficient permissions for WW Admin features';
      }
    },
    
    // Organisation Management
    setOrganisations: (state, action: PayloadAction<Organisation[]>) => {
      if (!state.adminPermissions.canManageOrganisations) {
        state.error = 'Insufficient permissions to view organisations';
        return;
      }
      
      state.organisations = action.payload;
      state.loading = false;
      state.error = undefined;
    },
    
    createOrganisation: (state, action: PayloadAction<Organisation>) => {
      if (!state.adminPermissions.canManageOrganisations) {
        state.error = 'Insufficient permissions to create organisation';
        return;
      }
      
      const organisation = action.payload;
      const validationError = validateOrganisation(organisation);
      
      if (validationError) {
        state.error = validationError;
        return;
      }
      
      state.organisations.push(organisation);
      state.error = undefined;
    },
    
    updateOrganisation: (state, action: PayloadAction<{
      id: string,
      updates: Partial<Organisation>
    }>) => {
      if (!state.adminPermissions.canManageOrganisations) {
        state.error = 'Insufficient permissions to update organisation';
        return;
      }
      
      const { id, updates } = action.payload;
      const orgIndex = state.organisations.findIndex(org => org.id === id);
      
      if (orgIndex === -1) {
        state.error = 'Organisation not found';
        return;
      }
      
      const updatedOrg = {
        ...state.organisations[orgIndex],
        ...updates,
        updated_at: new Date().toISOString()
      };
      
      const validationError = validateOrganisation(updatedOrg);
      if (validationError) {
        state.error = validationError;
        return;
      }
      
      state.organisations[orgIndex] = updatedOrg;
      
      if (state.currentOrganisation?.id === id) {
        state.currentOrganisation = updatedOrg;
      }
      
      state.error = undefined;
    },
    
    deleteOrganisation: (state, action: PayloadAction<string>) => {
      if (!state.adminPermissions.canManageOrganisations) {
        state.error = 'Insufficient permissions to delete organisation';
        return;
      }
      
      const orgId = action.payload;
      state.organisations = state.organisations.filter(org => org.id !== orgId);
      
      if (state.currentOrganisation?.id === orgId) {
        state.currentOrganisation = undefined;
      }
      
      state.error = undefined;
    },
    
    setCurrentOrganisation: (state, action: PayloadAction<string>) => {
      const orgId = action.payload;
      const organisation = state.organisations.find(org => org.id === orgId);
      
      if (organisation) {
        state.currentOrganisation = organisation;
        state.error = undefined;
      } else {
        state.error = 'Organisation not found';
      }
    },
    
    // User Provisioning (REQUIRED by spec line 73 - MVP feature)
    setUsers: (state, action: PayloadAction<UserProvisioning[]>) => {
      if (!state.adminPermissions.canProvisionUsers) {
        state.error = 'Insufficient permissions to view users';
        return;
      }
      
      state.users = action.payload;
      state.pendingInvitations = action.payload.filter(user => user.status === 'pending');
      state.loading = false;
      state.error = undefined;
    },
    
    inviteUser: (state, action: PayloadAction<UserProvisioning>) => {
      if (!state.adminPermissions.canProvisionUsers) {
        state.error = 'Insufficient permissions to invite users';
        return;
      }
      
      const user = action.payload;
      const validationError = validateUserProvisioning(user);
      
      if (validationError) {
        state.error = validationError;
        return;
      }
      
      // Check if user already exists
      const existingUser = state.users.find(u => u.email === user.email);
      if (existingUser) {
        state.error = 'User with this email already exists';
        return;
      }
      
      const newUser = {
        ...user,
        status: 'pending' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      state.users.push(newUser);
      state.pendingInvitations.push(newUser);
      state.error = undefined;
    },
    
    updateUserProvisioning: (state, action: PayloadAction<{
      id: string,
      updates: Partial<UserProvisioning>
    }>) => {
      if (!state.adminPermissions.canProvisionUsers) {
        state.error = 'Insufficient permissions to update users';
        return;
      }
      
      const { id, updates } = action.payload;
      const userIndex = state.users.findIndex(user => user.id === id);
      
      if (userIndex === -1) {
        state.error = 'User not found';
        return;
      }
      
      const updatedUser = {
        ...state.users[userIndex],
        ...updates,
        updated_at: new Date().toISOString()
      };
      
      const validationError = validateUserProvisioning(updatedUser);
      if (validationError) {
        state.error = validationError;
        return;
      }
      
      state.users[userIndex] = updatedUser;
      
      // Update pending invitations
      state.pendingInvitations = state.users.filter(user => user.status === 'pending');
      
      state.error = undefined;
    },
    
    revokeUserAccess: (state, action: PayloadAction<string>) => {
      if (!state.adminPermissions.canProvisionUsers) {
        state.error = 'Insufficient permissions to revoke user access';
        return;
      }
      
      const userId = action.payload;
      const userIndex = state.users.findIndex(user => user.id === userId);
      
      if (userIndex !== -1) {
        state.users[userIndex] = {
          ...state.users[userIndex],
          status: 'suspended',
          updated_at: new Date().toISOString()
        };
      }
      
      state.pendingInvitations = state.users.filter(user => user.status === 'pending');
      state.error = undefined;
    },
    
    // System Configuration
    updateSystemConfig: (state, action: PayloadAction<Partial<SystemConfiguration>>) => {
      if (!state.adminPermissions.canModifySystemConfig) {
        state.error = 'Insufficient permissions to modify system configuration';
        return;
      }
      
      state.systemConfig = {
        ...state.systemConfig,
        ...action.payload
      };
      
      state.error = undefined;
    },
    
    // System Metrics and Monitoring
    updateSystemMetrics: (state, action: PayloadAction<SystemMetrics>) => {
      if (!state.adminPermissions.canViewSystemMetrics) {
        state.error = 'Insufficient permissions to view system metrics';
        return;
      }
      
      state.systemMetrics = {
        ...action.payload,
        last_updated: new Date().toISOString()
      };
      
      state.error = undefined;
    },
    
    // Bulk Operations for Cross-Organisation Management
    bulkUpdateOrganisationStatus: (state, action: PayloadAction<{
      organisationIds: string[],
      status: Organisation['status']
    }>) => {
      if (!state.adminPermissions.canManageOrganisations) {
        state.error = 'Insufficient permissions for bulk operations';
        return;
      }
      
      const { organisationIds, status } = action.payload;
      
      state.organisations = state.organisations.map(org => 
        organisationIds.includes(org.id) 
          ? { ...org, status, updated_at: new Date().toISOString() }
          : org
      );
      
      state.error = undefined;
    },
    
    bulkUpdateUserStatus: (state, action: PayloadAction<{
      userIds: string[],
      status: UserProvisioning['status']
    }>) => {
      if (!state.adminPermissions.canProvisionUsers) {
        state.error = 'Insufficient permissions for bulk user operations';
        return;
      }
      
      const { userIds, status } = action.payload;
      
      state.users = state.users.map(user =>
        userIds.includes(user.id)
          ? { ...user, status, updated_at: new Date().toISOString() }
          : user
      );
      
      state.pendingInvitations = state.users.filter(user => user.status === 'pending');
      state.error = undefined;
    },
    
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    
    setError: (state, action: PayloadAction<string | undefined>) => {
      state.error = action.payload;
      state.loading = false;
    },
    
    clearError: (state) => {
      state.error = undefined;
    }
  },
});

export const {
  initializeWWAdmin,
  setOrganisations,
  createOrganisation,
  updateOrganisation,
  deleteOrganisation,
  setCurrentOrganisation,
  setUsers,
  inviteUser,
  updateUserProvisioning,
  revokeUserAccess,
  updateSystemConfig,
  updateSystemMetrics,
  bulkUpdateOrganisationStatus,
  bulkUpdateUserStatus,
  setLoading,
  setError,
  clearError
} = wwAdminSlice.actions;

// Selectors for WW Admin functionality
export const selectOrganisations = (state: { wwAdmin: WWAdminState }) => 
  state.wwAdmin.organisations;

export const selectCurrentOrganisation = (state: { wwAdmin: WWAdminState }) => 
  state.wwAdmin.currentOrganisation;

export const selectUsers = (state: { wwAdmin: WWAdminState }) => 
  state.wwAdmin.users;

export const selectPendingInvitations = (state: { wwAdmin: WWAdminState }) => 
  state.wwAdmin.pendingInvitations;

export const selectSystemConfig = (state: { wwAdmin: WWAdminState }) => 
  state.wwAdmin.systemConfig;

export const selectSystemMetrics = (state: { wwAdmin: WWAdminState }) => 
  state.wwAdmin.systemMetrics;

export const selectWWAdminPermissions = (state: { wwAdmin: WWAdminState }) => 
  state.wwAdmin.adminPermissions;

export const selectWWAdminLoading = (state: { wwAdmin: WWAdminState }) => 
  state.wwAdmin.loading;

export const selectWWAdminError = (state: { wwAdmin: WWAdminState }) => 
  state.wwAdmin.error;

// Advanced selectors for WW Admin insights
export const selectActiveOrganisations = (state: { wwAdmin: WWAdminState }) =>
  state.wwAdmin.organisations.filter(org => org.status === 'active');

export const selectOrganisationsByPlan = (plan: Organisation['subscription_plan']) =>
  (state: { wwAdmin: WWAdminState }) =>
    state.wwAdmin.organisations.filter(org => org.subscription_plan === plan);

export const selectUsersByRole = (role: UserProvisioning['role']) =>
  (state: { wwAdmin: WWAdminState }) =>
    state.wwAdmin.users.filter(user => user.role === role);

export const selectUsersByOrganisation = (organisationId: string) =>
  (state: { wwAdmin: WWAdminState }) =>
    state.wwAdmin.users.filter(user => user.organisation_id === organisationId);

export const selectSuspendedUsers = (state: { wwAdmin: WWAdminState }) =>
  state.wwAdmin.users.filter(user => user.status === 'suspended');

export default wwAdminSlice.reducer;