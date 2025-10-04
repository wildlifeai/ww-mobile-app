/**
 * ProjectService - Project management service layer
 *
 * Phase 1 (Mock Implementation):
 * - Provides shell CRUD methods with mock data
 * - Establishes service patterns and interfaces
 * - Prepares for Phase 2 Supabase integration
 *
 * Phase 2 TODO:
 * - Replace mock data with real Supabase queries
 * - Add offline queue integration via OfflineService
 * - Implement optimistic updates
 * - Add conflict resolution
 */

import { supabase } from './supabase';
import type {
  Project,
  ProjectWithDetails,
  ProjectMemberWithProfile,
  CreateProjectInput,
  LoRaWANDeviceStatus
} from '../types/project';

class ProjectService {
  private readonly TABLE_NAME = 'projects';

  /**
   * Get all projects for current user's organisation
   * @param organisationId - Current user's organisation ID
   * @returns Projects with computed summary data
   */
  async getUserProjects(organisationId: string): Promise<ProjectWithDetails[]> {
    // MOCK IMPLEMENTATION - Replace in Phase 2
    return this.mockProjects.filter(p => p.organisation_id === organisationId);
  }

  /**
   * Get single project by ID with full details
   */
  async getProjectById(projectId: string): Promise<ProjectWithDetails | null> {
    // MOCK IMPLEMENTATION
    return this.mockProjects.find(p => p.id === projectId) || null;
  }

  /**
   * Create new project (online and offline support)
   */
  async createProject(input: CreateProjectInput): Promise<Project> {
    // MOCK IMPLEMENTATION - Phase 2 will add:
    // 1. Offline queue integration
    // 2. Real Supabase insert
    // 3. Optimistic updates
    const currentUserId = await this.getCurrentUserId();

    const newProject: Project = {
      id: this.generateUUID(),
      ...input,
      owner_id: currentUserId,
      created_by: currentUserId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      privacy_level: input.privacy_level || 'public',
      project_image: null,
      end_date: null,
      is_private: input.privacy_level === 'private',
      is_baited: input.is_baited || false,
      is_monitoring_marked_individual: input.is_monitoring_marked_individual || false,
      sampling_design: input.sampling_design || null,
      website: input.website || null,
    };

    // Add to mock data
    this.mockProjects.push(newProject);

    return newProject;
  }

  /**
   * Update existing project
   */
  async updateProject(projectId: string, updates: Partial<Project>): Promise<Project> {
    // MOCK IMPLEMENTATION
    const projectIndex = this.mockProjects.findIndex(p => p.id === projectId);

    if (projectIndex === -1) {
      throw new Error(`Project ${projectId} not found`);
    }

    const updatedProject = {
      ...this.mockProjects[projectIndex],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    this.mockProjects[projectIndex] = updatedProject;

    return updatedProject;
  }

  /**
   * Delete project (soft delete)
   */
  async deleteProject(projectId: string): Promise<void> {
    // MOCK IMPLEMENTATION - Soft delete
    const projectIndex = this.mockProjects.findIndex(p => p.id === projectId);

    if (projectIndex === -1) {
      throw new Error(`Project ${projectId} not found`);
    }

    this.mockProjects[projectIndex] = {
      ...this.mockProjects[projectIndex],
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  /**
   * Get project members with user profiles
   */
  async getProjectMembers(projectId: string): Promise<ProjectMemberWithProfile[]> {
    // MOCK IMPLEMENTATION
    return this.mockMembers.filter(m => m.project_id === projectId);
  }

  /**
   * Add member to project
   */
  async addProjectMember(projectId: string, userId: string, roleId: number): Promise<void> {
    // MOCK IMPLEMENTATION - Phase 2 adds:
    // 1. Verify user in same org
    // 2. Check permissions
    // 3. Insert to project_members table
    const newMember: ProjectMemberWithProfile = {
      project_id: projectId,
      user_id: userId,
      role_id: roleId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      user_profile: {
        name: 'Mock User'
      },
      role: {
        value: 'project_member',
        description: 'Project Member'
      }
    };

    this.mockMembers.push(newMember);
  }

  /**
   * Remove member from project
   */
  async removeProjectMember(projectId: string, userId: string): Promise<void> {
    // MOCK IMPLEMENTATION - Soft delete
    const memberIndex = this.mockMembers.findIndex(
      m => m.project_id === projectId && m.user_id === userId
    );

    if (memberIndex === -1) {
      throw new Error(`Member not found in project ${projectId}`);
    }

    this.mockMembers[memberIndex] = {
      ...this.mockMembers[memberIndex],
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  // PRIVATE HELPER METHODS

  /**
   * Get current user ID from Supabase auth session
   */
  private async getCurrentUserId(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id || 'mock-user-id';
  }

  /**
   * Generate UUID (mock implementation)
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // MOCK DATA (remove in Phase 2)
  private mockProjects: ProjectWithDetails[] = [
    {
      id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'Wildlife Survey 2025',
      description: 'Annual wildlife population survey in national parks',
      organisation_id: 'org-1',
      owner_id: 'user-1',
      created_by: 'user-1',
      privacy_level: 'public',
      is_private: false,
      is_baited: false,
      is_monitoring_marked_individual: false,
      sampling_design: 'Random grid sampling with 500m spacing',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
      deleted_at: null,
      project_image: null,
      website: 'https://wildlifesurvey2025.example.com',
      end_date: '2025-12-31T23:59:59Z',
      member_count: 5,
      deployment_count: 12,
      lorawan_device_count: 8,
      battery_level: 85,
      sd_card_usage: 42,
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440002',
      name: 'Tiger Monitoring Project',
      description: 'Long-term monitoring of tiger populations',
      organisation_id: 'org-1',
      owner_id: 'user-2',
      created_by: 'user-2',
      privacy_level: 'private',
      is_private: true,
      is_baited: true,
      is_monitoring_marked_individual: true,
      sampling_design: 'Targeted monitoring of known territories',
      created_at: '2024-06-15T00:00:00Z',
      updated_at: '2025-01-15T00:00:00Z',
      deleted_at: null,
      project_image: null,
      website: null,
      end_date: null,
      member_count: 3,
      deployment_count: 8,
      lorawan_device_count: 6,
      battery_level: 72,
      sd_card_usage: 68,
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440003',
      name: 'Bird Migration Study',
      description: 'Tracking migratory bird patterns through camera traps',
      organisation_id: 'org-1',
      owner_id: 'user-1',
      created_by: 'user-1',
      privacy_level: 'internal',
      is_private: false,
      is_baited: false,
      is_monitoring_marked_individual: false,
      sampling_design: 'Linear transect sampling along migration routes',
      created_at: '2024-09-01T00:00:00Z',
      updated_at: '2025-01-10T00:00:00Z',
      deleted_at: null,
      project_image: null,
      website: null,
      end_date: '2025-05-31T23:59:59Z',
      member_count: 7,
      deployment_count: 15,
      lorawan_device_count: 12,
      battery_level: 91,
      sd_card_usage: 35,
    }
  ];

  private mockMembers: ProjectMemberWithProfile[] = [
    {
      project_id: '550e8400-e29b-41d4-a716-446655440001',
      user_id: 'user-1',
      role_id: 3,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
      deleted_at: null,
      user_profile: {
        name: 'John Smith'
      },
      role: {
        value: 'project_admin',
        description: 'Project Administrator'
      }
    },
    {
      project_id: '550e8400-e29b-41d4-a716-446655440001',
      user_id: 'user-2',
      role_id: 4,
      created_at: '2025-01-02T00:00:00Z',
      updated_at: '2025-01-02T00:00:00Z',
      deleted_at: null,
      user_profile: {
        name: 'Sarah Johnson'
      },
      role: {
        value: 'project_member',
        description: 'Project Member'
      }
    }
  ];
}

export default new ProjectService();
