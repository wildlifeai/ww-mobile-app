/**
 * @jest-environment node
 */

import { configureStore } from '@reduxjs/toolkit';
import wwAdminReducer, {
  wwAdminSlice,
  initializeWWAdmin,
  setVisibleProjects,
  setCurrentOrganisation,
  navigateToWebPortal,
  setWebPortalUrl,
  setAdminPermissions,
  setLoading,
  setError,
  clearError,
  selectVisibleProjects,
  selectCurrentOrganisation,
  selectWebPortalUrl,
  selectWWAdminPermissions,
  selectWWAdminLoading,
  selectWWAdminError,
  selectProjectsByOrganisation,
  selectPrivateProjects,
  selectPublicProjects,
  Project,
  Organisation
} from '../../../src/redux/slices/wwAdminSlice';

/**
 * WWAdminSlice Test Suite - WW Admin Scope Alignment
 *
 * UPDATED ARCHITECTURE: Read-only project visibility + web portal navigation
 *
 * Tests focus on:
 * - WW Admin permission initialization and validation
 * - Cross-organisation project visibility (read-only)
 * - Web portal URL management and navigation
 * - Permission-based state management
 * - Redux selectors for project filtering
 *
 * REMOVED from MVP (Web Portal Exclusive):
 * - User management operations (moved to web portal)
 * - Role assignment operations (web portal only)
 * - System configuration management (web portal only)
 * - Bulk operations (web portal only)
 */
describe('wwAdminSlice - Read-Only + Web Portal Architecture', () => {
  let store: ReturnType<typeof configureStore>;

  const mockWWAdmin = {
    id: 'admin-1',
    role: 'ww_admin',
    organisation_id: 'org-1',
    email: 'admin@wildlifewatcher.com'
  };

  const mockProjectAdmin = {
    id: 'admin-2',
    role: 'project_admin',
    organisation_id: 'org-1',
    email: 'projectadmin@example.com'
  };

  const mockOrganisation: Organisation = {
    id: 'org-1',
    name: 'Test Organisation',
    description: 'Test organisation for WW Admin',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  };

  const mockProjects: Project[] = [
    {
      id: 'proj-1',
      name: 'Project Alpha',
      description: 'First test project',
      owner_id: 'user-1',
      organisation_id: 'org-1',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      is_private: false,
      member_count: 5,
      deployment_count: 3
    },
    {
      id: 'proj-2',
      name: 'Project Beta',
      description: 'Second test project (private)',
      owner_id: 'user-2',
      organisation_id: 'org-2',
      created_at: '2024-01-02T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
      is_private: true,
      member_count: 2,
      deployment_count: 1
    },
    {
      id: 'proj-3',
      name: 'Project Gamma',
      description: 'Third test project (public)',
      owner_id: 'user-3',
      organisation_id: 'org-1',
      created_at: '2024-01-03T00:00:00Z',
      updated_at: '2024-01-03T00:00:00Z',
      is_private: false,
      member_count: 8,
      deployment_count: 5
    }
  ];

  beforeEach(() => {
    store = configureStore({
      reducer: {
        wwAdmin: wwAdminReducer
      }
    });
  });

  describe('Initial State', () => {
    it('should return the initial state', () => {
      const state = store.getState().wwAdmin;

      expect(state).toEqual({
        visibleProjects: [],
        webPortalUrl: expect.any(String), // Environment variable or default
        adminPermissions: {
          canViewAllProjects: false,
          canAccessWebPortal: false,
        },
        isLoading: false,
        error: null,
      });
    });

    it('should have a valid default web portal URL', () => {
      const state = store.getState().wwAdmin;

      expect(state.webPortalUrl).toBeDefined();
      expect(typeof state.webPortalUrl).toBe('string');
      expect(state.webPortalUrl.length).toBeGreaterThan(0);
    });
  });

  describe('WW Admin Permission Management', () => {
    it('should initialize WW Admin permissions for valid WW Admin user', () => {
      store.dispatch(initializeWWAdmin(mockWWAdmin));

      const state = store.getState().wwAdmin;

      expect(state.adminPermissions).toEqual({
        canViewAllProjects: true,
        canAccessWebPortal: true
      });
      expect(state.error).toBeNull();
    });

    it('should deny permissions for non-WW Admin user', () => {
      store.dispatch(initializeWWAdmin(mockProjectAdmin));

      const state = store.getState().wwAdmin;

      expect(state.adminPermissions).toEqual({
        canViewAllProjects: false,
        canAccessWebPortal: false
      });
      expect(state.error).toBe('Insufficient permissions for WW Admin features');
    });

    it('should handle undefined user gracefully', () => {
      store.dispatch(initializeWWAdmin(undefined));

      const state = store.getState().wwAdmin;

      expect(state.adminPermissions).toEqual({
        canViewAllProjects: false,
        canAccessWebPortal: false
      });
      expect(state.error).toBe('Insufficient permissions for WW Admin features');
    });

    it('should allow setting admin permissions directly', () => {
      const permissions = {
        canViewAllProjects: true,
        canAccessWebPortal: false
      };

      store.dispatch(setAdminPermissions(permissions));

      const state = store.getState().wwAdmin;

      expect(state.adminPermissions).toEqual(permissions);
    });
  });

  describe('Cross-Organisation Project Visibility (Read-Only)', () => {
    beforeEach(() => {
      // Initialize with WW Admin permissions first
      store.dispatch(initializeWWAdmin(mockWWAdmin));
    });

    it('should set visible projects for WW Admin user', () => {
      store.dispatch(setVisibleProjects(mockProjects));

      const state = store.getState().wwAdmin;

      expect(state.visibleProjects).toEqual(mockProjects);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should reject setting projects without proper permissions', () => {
      // Remove permissions first
      store.dispatch(setAdminPermissions({
        canViewAllProjects: false,
        canAccessWebPortal: false
      }));

      store.dispatch(setVisibleProjects(mockProjects));

      const state = store.getState().wwAdmin;

      expect(state.visibleProjects).toEqual([]);
      expect(state.error).toBe('Insufficient permissions to view all projects');
    });

    it('should set current organisation', () => {
      store.dispatch(setCurrentOrganisation(mockOrganisation));

      const state = store.getState().wwAdmin;

      expect(state.currentOrganisation).toEqual(mockOrganisation);
      expect(state.error).toBeNull();
    });
  });

  describe('Web Portal Integration', () => {
    beforeEach(() => {
      // Initialize with WW Admin permissions first
      store.dispatch(initializeWWAdmin(mockWWAdmin));
    });

    it('should handle navigation to web portal for authorized user', () => {
      store.dispatch(navigateToWebPortal());

      const state = store.getState().wwAdmin;

      expect(state.error).toBeNull();
      // Navigation action would be handled by middleware/thunk in real app
    });

    it('should reject web portal navigation without proper permissions', () => {
      // Remove permissions first
      store.dispatch(setAdminPermissions({
        canViewAllProjects: false,
        canAccessWebPortal: false
      }));

      store.dispatch(navigateToWebPortal());

      const state = store.getState().wwAdmin;

      expect(state.error).toBe('Insufficient permissions to access web portal');
    });

    it('should allow setting custom web portal URL', () => {
      const customUrl = 'https://custom-admin.wildlifewatcher.com';

      store.dispatch(setWebPortalUrl(customUrl));

      const state = store.getState().wwAdmin;

      expect(state.webPortalUrl).toBe(customUrl);
    });
  });

  describe('Loading and Error State Management', () => {
    it('should handle loading state', () => {
      store.dispatch(setLoading(true));

      const state = store.getState().wwAdmin;

      expect(state.isLoading).toBe(true);
    });

    it('should handle error state', () => {
      const errorMessage = 'Test error message';

      store.dispatch(setError(errorMessage));

      const state = store.getState().wwAdmin;

      expect(state.error).toBe(errorMessage);
      expect(state.isLoading).toBe(false);
    });

    it('should clear error state', () => {
      // Set error first
      store.dispatch(setError('Test error'));

      // Clear error
      store.dispatch(clearError());

      const state = store.getState().wwAdmin;

      expect(state.error).toBeNull();
    });

    it('should clear loading state when setting projects', () => {
      // Initialize with WW Admin permissions and set loading
      store.dispatch(initializeWWAdmin(mockWWAdmin));
      store.dispatch(setLoading(true));

      // Set projects should clear loading
      store.dispatch(setVisibleProjects(mockProjects));

      const state = store.getState().wwAdmin;

      expect(state.isLoading).toBe(false);
    });
  });

  describe('Selectors', () => {
    beforeEach(() => {
      // Setup test state
      store.dispatch(initializeWWAdmin(mockWWAdmin));
      store.dispatch(setVisibleProjects(mockProjects));
      store.dispatch(setCurrentOrganisation(mockOrganisation));
    });

    it('should select visible projects', () => {
      const state = store.getState();
      const visibleProjects = selectVisibleProjects(state);

      expect(visibleProjects).toEqual(mockProjects);
    });

    it('should select current organisation', () => {
      const state = store.getState();
      const currentOrg = selectCurrentOrganisation(state);

      expect(currentOrg).toEqual(mockOrganisation);
    });

    it('should select web portal URL', () => {
      const state = store.getState();
      const webPortalUrl = selectWebPortalUrl(state);

      expect(webPortalUrl).toBeDefined();
      expect(typeof webPortalUrl).toBe('string');
    });

    it('should select WW Admin permissions', () => {
      const state = store.getState();
      const permissions = selectWWAdminPermissions(state);

      expect(permissions).toEqual({
        canViewAllProjects: true,
        canAccessWebPortal: true
      });
    });

    it('should select loading state', () => {
      store.dispatch(setLoading(true));

      const state = store.getState();
      const isLoading = selectWWAdminLoading(state);

      expect(isLoading).toBe(true);
    });

    it('should select error state', () => {
      const errorMessage = 'Test error';
      store.dispatch(setError(errorMessage));

      const state = store.getState();
      const error = selectWWAdminError(state);

      expect(error).toBe(errorMessage);
    });
  });

  describe('Project Filtering Selectors', () => {
    beforeEach(() => {
      // Setup test state with projects
      store.dispatch(initializeWWAdmin(mockWWAdmin));
      store.dispatch(setVisibleProjects(mockProjects));
    });

    it('should select projects by organisation', () => {
      const state = store.getState();
      const org1Projects = selectProjectsByOrganisation('org-1')(state);

      expect(org1Projects).toHaveLength(2);
      expect(org1Projects.every(p => p.organisation_id === 'org-1')).toBe(true);
      expect(org1Projects.map(p => p.id)).toEqual(['proj-1', 'proj-3']);
    });

    it('should select private projects only', () => {
      const state = store.getState();
      const privateProjects = selectPrivateProjects(state);

      expect(privateProjects).toHaveLength(1);
      expect(privateProjects[0].id).toBe('proj-2');
      expect(privateProjects[0].is_private).toBe(true);
    });

    it('should select public projects only', () => {
      const state = store.getState();
      const publicProjects = selectPublicProjects(state);

      expect(publicProjects).toHaveLength(2);
      expect(publicProjects.map(p => p.id)).toEqual(['proj-1', 'proj-3']);
      expect(publicProjects.every(p => p.is_private === false)).toBe(true);
    });

    it('should return empty array for non-existent organisation', () => {
      const state = store.getState();
      const nonExistentOrgProjects = selectProjectsByOrganisation('org-999')(state);

      expect(nonExistentOrgProjects).toEqual([]);
    });
  });

  describe('Integration with Service Layer', () => {
    it('should support data structures expected by WWAdminOfflineService', () => {
      const state = store.getState().wwAdmin;

      // Web portal URL should be accessible for service layer
      expect(typeof state.webPortalUrl).toBe('string');

      // Permission structure should match service validation
      expect(state.adminPermissions).toEqual(expect.objectContaining({
        canViewAllProjects: expect.any(Boolean),
        canAccessWebPortal: expect.any(Boolean)
      }));
    });

    it('should handle project data format expected from service layer', () => {
      store.dispatch(initializeWWAdmin(mockWWAdmin));
      store.dispatch(setVisibleProjects(mockProjects));

      const state = store.getState().wwAdmin;

      // Projects should match Project interface
      state.visibleProjects.forEach(project => {
        expect(project).toEqual(expect.objectContaining({
          id: expect.any(String),
          name: expect.any(String),
          organisation_id: expect.any(String),
          created_at: expect.any(String),
          updated_at: expect.any(String),
          is_private: expect.any(Boolean)
        }));
      });
    });
  });

  describe('Architectural Boundary Tests', () => {
    it('should NOT contain user management state or actions', () => {
      const actions = wwAdminSlice.actions;

      // Verify user management actions don't exist
      expect((actions as any).provisionUser).toBeUndefined();
      expect((actions as any).assignUserRole).toBeUndefined();
      expect((actions as any).bulkUserOperations).toBeUndefined();
      expect((actions as any).manageSystemConfig).toBeUndefined();
    });

    it('should only provide read-only actions for mobile app', () => {
      const actions = wwAdminSlice.actions;

      // Verify only read-only actions exist
      expect(actions.setVisibleProjects).toBeDefined();
      expect(actions.setCurrentOrganisation).toBeDefined();
      expect(actions.navigateToWebPortal).toBeDefined();
      expect(actions.setWebPortalUrl).toBeDefined();

      // Verify no write operations exist
      expect((actions as any).createProject).toBeUndefined();
      expect((actions as any).updateProject).toBeUndefined();
      expect((actions as any).deleteProject).toBeUndefined();
    });

    it('should redirect complex operations to web portal', () => {
      const state = store.getState().wwAdmin;

      // Web portal URL should be configured for complex operations
      expect(state.webPortalUrl).toBeDefined();
      expect(state.webPortalUrl).toMatch(/admin|portal/);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty projects array', () => {
      store.dispatch(initializeWWAdmin(mockWWAdmin));
      store.dispatch(setVisibleProjects([]));

      const state = store.getState();
      const visibleProjects = selectVisibleProjects(state);
      const privateProjects = selectPrivateProjects(state);
      const publicProjects = selectPublicProjects(state);

      expect(visibleProjects).toEqual([]);
      expect(privateProjects).toEqual([]);
      expect(publicProjects).toEqual([]);
    });

    it('should handle malformed project data gracefully', () => {
      store.dispatch(initializeWWAdmin(mockWWAdmin));

      const malformedProjects = [
        {
          id: 'proj-bad',
          name: 'Bad Project',
          // Missing required fields
        } as any
      ];

      // Should not throw error
      store.dispatch(setVisibleProjects(malformedProjects));

      const state = store.getState().wwAdmin;
      expect(state.visibleProjects).toEqual(malformedProjects);
    });

    it('should maintain state consistency during rapid updates', () => {
      store.dispatch(initializeWWAdmin(mockWWAdmin));

      // Rapid state updates
      store.dispatch(setLoading(true));
      store.dispatch(setVisibleProjects(mockProjects));
      store.dispatch(setCurrentOrganisation(mockOrganisation));
      store.dispatch(clearError());

      const state = store.getState().wwAdmin;

      expect(state.visibleProjects).toEqual(mockProjects);
      expect(state.currentOrganisation).toEqual(mockOrganisation);
      expect(state.isLoading).toBe(false); // Should be cleared by setVisibleProjects
      expect(state.error).toBeNull();
    });
  });
});