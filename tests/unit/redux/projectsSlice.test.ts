/**
 * TDD Tests for Projects Redux Slice with Organisation Integration
 * Following Task 10.2 specifications from TaskMaster
 */

import { configureStore } from '@reduxjs/toolkit';
import projectsReducer, {
  createProject,
  updateProject,
  deleteProject,
  setProjects,
  setCurrentProject,
  addProjectMember,
  removeProjectMember,
  updateProjectMember
} from '../../../src/redux/slices/projectsSlice';

// Define test types for project management
export interface ProjectMember {
  id: string;
  user_id: string;
  role: 'project_admin' | 'project_member';
  email: string;
  first_name?: string;
  last_name?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  organisation_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  status: 'active' | 'archived' | 'completed';
  members: ProjectMember[];
  deployments_count: number;
}

// Mock store setup
const createMockStore = () => configureStore({
  reducer: {
    projects: projectsReducer,
    authentication: (state = { 
      user: { 
        id: 'user-1', 
        role: 'project_admin', 
        organisation_id: 'org-1' 
      }, 
      currentOrganisation: { id: 'org-1', name: 'Test Org', role: 'project_admin' }
    }) => state
  }
});

describe('Projects Redux Slice - TDD Tests', () => {
  let store: ReturnType<typeof createMockStore>;

  beforeEach(() => {
    store = createMockStore();
  });

  describe('Organisation-Scoped Project Management (Requirement: spec database schema lines 891-940)', () => {
    test('should handle project creation within organisation scope', () => {
      const newProject: Project = {
        id: 'project-1',
        name: 'Wildlife Camera Survey',
        description: 'Monitoring wildlife in forest area',
        organisation_id: 'org-1',
        created_by: 'user-1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        status: 'active',
        members: [
          {
            id: 'member-1',
            user_id: 'user-1',
            role: 'project_admin',
            email: 'admin@org1.com',
            first_name: 'John',
            last_name: 'Doe'
          }
        ],
        deployments_count: 0
      };

      store.dispatch(createProject(newProject));
      const state = store.getState().projects;

      expect(state.projects).toHaveLength(1);
      expect(state.projects[0].id).toBe('project-1');
      expect(state.projects[0].organisation_id).toBe('org-1');
      expect(state.projects[0].members).toHaveLength(1);
      expect(state.projects[0].members[0].role).toBe('project_admin');
    });

    test('should prevent cross-organisation project access', () => {
      const unauthorizedProject: Project = {
        id: 'project-2',
        name: 'Unauthorized Project',
        description: 'Should not be accessible',
        organisation_id: 'org-2', // Different organisation
        created_by: 'user-2',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        status: 'active',
        members: [],
        deployments_count: 0
      };

      store.dispatch(createProject(unauthorizedProject));
      const state = store.getState().projects;

      // Should not add project from different organisation
      expect(state.projects).toHaveLength(0);
      expect(state.error).toBeDefined();
      expect(state.error).toContain('organisation');
    });

    test('should filter projects by current organisation', () => {
      const projects: Project[] = [
        {
          id: 'project-1',
          name: 'Org 1 Project',
          organisation_id: 'org-1',
          created_by: 'user-1',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          status: 'active',
          members: [],
          deployments_count: 0
        },
        {
          id: 'project-2', 
          name: 'Org 2 Project',
          organisation_id: 'org-2', // Different organisation
          created_by: 'user-2',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          status: 'active',
          members: [],
          deployments_count: 0
        }
      ];

      store.dispatch(setProjects(projects));
      const state = store.getState().projects;

      // Should only include projects from current organisation
      expect(state.projects).toHaveLength(1);
      expect(state.projects[0].organisation_id).toBe('org-1');
    });
  });

  describe('Multi-Organisation User Support (Requirement)', () => {
    test('should handle project access when switching organisations', () => {
      const project1: Project = {
        id: 'project-1',
        name: 'Primary Org Project', 
        organisation_id: 'org-1',
        created_by: 'user-1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        status: 'active',
        members: [],
        deployments_count: 0
      };

      const project2: Project = {
        id: 'project-2',
        name: 'Secondary Org Project',
        organisation_id: 'org-2', 
        created_by: 'user-1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        status: 'active',
        members: [],
        deployments_count: 0
      };

      // Add projects to different organisations
      store.dispatch(setProjects([project1, project2]));
      let state = store.getState().projects;
      
      // Initially should only see org-1 projects
      expect(state.projects).toHaveLength(1);
      expect(state.projects[0].organisation_id).toBe('org-1');

      // Simulate organisation switch (this would be handled by auth slice)
      // The projects slice should clear and reload for new organisation
      store.dispatch(setProjects([project2]));
      state = store.getState().projects;
      
      expect(state.projects).toHaveLength(1);
      expect(state.projects[0].organisation_id).toBe('org-2');
    });

    test('should handle user role changes affecting project permissions', () => {
      const project: Project = {
        id: 'project-1',
        name: 'Test Project',
        organisation_id: 'org-1',
        created_by: 'user-2',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        status: 'active',
        members: [
          {
            id: 'member-1',
            user_id: 'user-1',
            role: 'project_member', // User is member, not admin
            email: 'member@org1.com'
          }
        ],
        deployments_count: 0
      };

      store.dispatch(createProject(project));
      
      // Try to update project (should fail for project_member)
      store.dispatch(updateProject({
        id: 'project-1',
        updates: { name: 'Updated Name' }
      }));
      
      const state = store.getState().projects;
      
      // Should not allow update if user doesn't have permissions
      expect(state.projects[0].name).toBe('Test Project'); // Not updated
      expect(state.error).toBeDefined();
    });
  });

  describe('Project CRUD Operations', () => {
    test('should handle project updates with proper permissions', () => {
      const project: Project = {
        id: 'project-1',
        name: 'Original Name',
        organisation_id: 'org-1',
        created_by: 'user-1', // Current user is creator
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        status: 'active',
        members: [],
        deployments_count: 0
      };

      store.dispatch(createProject(project));
      store.dispatch(updateProject({
        id: 'project-1',
        updates: { 
          name: 'Updated Name',
          description: 'Updated description' 
        }
      }));

      const state = store.getState().projects;
      
      expect(state.projects[0].name).toBe('Updated Name');
      expect(state.projects[0].description).toBe('Updated description');
      expect(state.error).toBeUndefined();
    });

    test('should handle project deletion with proper permissions', () => {
      const project: Project = {
        id: 'project-1',
        name: 'To Be Deleted',
        organisation_id: 'org-1',
        created_by: 'user-1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        status: 'active',
        members: [],
        deployments_count: 0
      };

      store.dispatch(createProject(project));
      expect(store.getState().projects.projects).toHaveLength(1);

      store.dispatch(deleteProject('project-1'));
      const state = store.getState().projects;

      expect(state.projects).toHaveLength(0);
      expect(state.error).toBeUndefined();
    });
  });

  describe('Project Member Management', () => {
    test('should handle adding project members', () => {
      const project: Project = {
        id: 'project-1',
        name: 'Team Project',
        organisation_id: 'org-1',
        created_by: 'user-1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        status: 'active',
        members: [],
        deployments_count: 0
      };

      const newMember: ProjectMember = {
        id: 'member-1',
        user_id: 'user-2',
        role: 'project_member',
        email: 'newmember@org1.com',
        first_name: 'Jane',
        last_name: 'Smith'
      };

      store.dispatch(createProject(project));
      store.dispatch(addProjectMember({
        projectId: 'project-1',
        member: newMember
      }));

      const state = store.getState().projects;
      
      expect(state.projects[0].members).toHaveLength(1);
      expect(state.projects[0].members[0].user_id).toBe('user-2');
      expect(state.projects[0].members[0].role).toBe('project_member');
    });

    test('should handle removing project members', () => {
      const project: Project = {
        id: 'project-1',
        name: 'Team Project',
        organisation_id: 'org-1',
        created_by: 'user-1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        status: 'active',
        members: [
          {
            id: 'member-1',
            user_id: 'user-2',
            role: 'project_member',
            email: 'member@org1.com'
          }
        ],
        deployments_count: 0
      };

      store.dispatch(createProject(project));
      store.dispatch(removeProjectMember({
        projectId: 'project-1',
        memberId: 'member-1'
      }));

      const state = store.getState().projects;
      
      expect(state.projects[0].members).toHaveLength(0);
    });

    test('should handle updating project member roles', () => {
      const project: Project = {
        id: 'project-1',
        name: 'Team Project',
        organisation_id: 'org-1',
        created_by: 'user-1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        status: 'active',
        members: [
          {
            id: 'member-1',
            user_id: 'user-2',
            role: 'project_member',
            email: 'member@org1.com'
          }
        ],
        deployments_count: 0
      };

      store.dispatch(createProject(project));
      store.dispatch(updateProjectMember({
        projectId: 'project-1',
        memberId: 'member-1',
        updates: { role: 'project_admin' }
      }));

      const state = store.getState().projects;
      
      expect(state.projects[0].members[0].role).toBe('project_admin');
    });
  });

  describe('Loading States and Error Handling', () => {
    test('should handle loading states during async operations', () => {
      // This test will be implemented when async actions are added
      expect(true).toBe(true); // Placeholder
    });

    test('should handle validation errors', () => {
      const invalidProject = {
        id: '',
        name: '', // Invalid empty name
        organisation_id: 'org-1',
        created_by: 'user-1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        status: 'active',
        members: [],
        deployments_count: 0
      } as Project;

      store.dispatch(createProject(invalidProject));
      const state = store.getState().projects;

      expect(state.projects).toHaveLength(0);
      expect(state.error).toBeDefined();
      expect(state.error).toContain('name');
    });
  });
});