/**
 * ProjectService - Project management service layer
 *
 * Phase 2 (Real Supabase Integration):
 * - Real Supabase queries with RLS enforcement
 * - Offline queue integration via OfflineService
 * - Organisation-scoped operations
 * - Backend API integration (Task 12)
 */

import { supabase } from './supabase';
import { OfflineService } from './offline/OfflineService';
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
   * Uses projects_with_stats view for computed fields
   * RLS automatically filters by user's organisation membership
   *
   * Note: Using type assertion until views are added to Supabase types
   */
  async getUserProjects(): Promise<ProjectWithDetails[]> {
    const { data, error } = await (supabase as any)
      .from('projects_with_stats')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch projects:', error);
      throw new Error(`Failed to fetch projects: ${error.message}`);
    }

    return (data || []) as ProjectWithDetails[];
  }

  /**
   * Get single project by ID with full details
   *
   * Note: Using type assertion until views are added to Supabase types
   */
  async getProjectById(projectId: string): Promise<ProjectWithDetails | null> {
    const { data, error } = await (supabase as any)
      .from('projects_with_stats')
      .select('*')
      .eq('id', projectId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return null;
      }
      console.error('Failed to fetch project:', error);
      throw new Error(`Failed to fetch project: ${error.message}`);
    }

    return data as ProjectWithDetails | null;
  }

  /**
   * Create new project (online and offline support)
   * Integrates with offline queue for resilient operations
   */
  async createProject(input: CreateProjectInput, offline: boolean = false): Promise<Project> {
    const currentUserId = await this.getCurrentUserId();

    // If offline, queue operation and return temporary project
    if (offline) {
      const tempProject: Project = {
        id: this.generateUUID(),
        name: input.name,
        description: input.description || null,
        organisation_id: input.organisation_id,
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

      // Queue for offline sync
      const offlineService = new OfflineService();
      await offlineService.queueOperation({
        id: `create-project-${tempProject.id}`,
        type: 'CREATE_PROJECT',
        data: tempProject,
        user_id: currentUserId,
        organisation_id: input.organisation_id,
        timestamp: new Date(),
        retry_count: 0,
      });

      return tempProject;
    }

    // Online: Direct Supabase insert
    const { data, error } = await supabase
      .from('projects')
      .insert({
        name: input.name,
        description: input.description,
        organisation_id: input.organisation_id,
        owner_id: currentUserId,
        privacy_level: input.privacy_level || 'public',
        is_baited: input.is_baited || false,
        is_monitoring_marked_individual: input.is_monitoring_marked_individual || false,
        sampling_design: input.sampling_design || null,
        website: input.website || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create project:', error);
      throw new Error(`Failed to create project: ${error.message}`);
    }

    return data;
  }

  /**
   * Update existing project
   */
  async updateProject(projectId: string, updates: Partial<Project>, offline: boolean = false): Promise<Project> {
    // If offline, queue operation
    if (offline) {
      const currentUserId = await this.getCurrentUserId();
      const offlineService = new OfflineService();

      await offlineService.queueOperation({
        id: `update-project-${projectId}`,
        type: 'UPDATE_PROJECT',
        data: { id: projectId, ...updates },
        user_id: currentUserId,
        organisation_id: updates.organisation_id || '',
        timestamp: new Date(),
        retry_count: 0,
      });

      // Return optimistic update
      return { id: projectId, ...updates } as Project;
    }

    // Online: Direct Supabase update
    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', projectId)
      .select()
      .single();

    if (error) {
      console.error('Failed to update project:', error);
      throw new Error(`Failed to update project: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete project (soft delete)
   */
  async deleteProject(projectId: string, offline: boolean = false): Promise<void> {
    // If offline, queue operation
    if (offline) {
      const currentUserId = await this.getCurrentUserId();
      const offlineService = new OfflineService();

      await offlineService.queueOperation({
        id: `delete-project-${projectId}`,
        type: 'DELETE_PROJECT',
        data: { id: projectId },
        user_id: currentUserId,
        organisation_id: '',
        timestamp: new Date(),
        retry_count: 0,
      });

      return;
    }

    // Online: Direct Supabase soft delete
    const { error } = await supabase
      .from('projects')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', projectId);

    if (error) {
      console.error('Failed to delete project:', error);
      throw new Error(`Failed to delete project: ${error.message}`);
    }
  }

  /**
   * Get project members with user profiles
   * Uses RPC function from backend for optimized query
   *
   * Note: Using type assertion until RPC functions are added to Supabase types
   */
  async getProjectMembers(projectId: string): Promise<ProjectMemberWithProfile[]> {
    const { data, error } = await (supabase as any)
      .rpc('get_project_members', { p_project_id: projectId });

    if (error) {
      console.error('Failed to fetch project members:', error);
      throw new Error(`Failed to fetch project members: ${error.message}`);
    }

    // Transform RPC result to match interface
    const members = Array.isArray(data) ? data : [];
    return members.map((member: any) => ({
      project_id: projectId,
      user_id: member.user_id,
      role_id: member.role_id,
      created_at: member.added_at,
      updated_at: member.added_at,
      deleted_at: null,
      user_profile: {
        name: member.user_name,
      },
      role: {
        value: member.role_value,
        description: member.role_value === 'project_admin' ? 'Project Administrator' : 'Project Member',
      },
    }));
  }

  /**
   * Add member to project
   * Uses RPC function for org validation and idempotent insert
   *
   * Note: Using type assertion until RPC functions are added to Supabase types
   */
  async addProjectMember(projectId: string, userId: string, roleId: number): Promise<void> {
    const { error } = await (supabase as any).rpc('add_project_member', {
      p_project_id: projectId,
      p_user_id: userId,
      p_role_id: roleId,
    });

    if (error) {
      console.error('Failed to add project member:', error);

      // Check for org validation error
      if (error.message.includes('same organisation')) {
        throw new Error('User must belong to the same organisation as the project');
      }

      throw new Error(`Failed to add project member: ${error.message}`);
    }
  }

  /**
   * Remove member from project (soft delete)
   * Uses RPC function for consistent soft delete behavior
   *
   * Note: Using type assertion until RPC functions are added to Supabase types
   */
  async removeProjectMember(projectId: string, userId: string): Promise<void> {
    const { error } = await (supabase as any).rpc('remove_project_member', {
      p_project_id: projectId,
      p_user_id: userId,
    });

    if (error) {
      console.error('Failed to remove project member:', error);
      throw new Error(`Failed to remove project member: ${error.message}`);
    }
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

}

export default new ProjectService();
