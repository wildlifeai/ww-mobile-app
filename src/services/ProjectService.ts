/**
 * ProjectService - Project management service layer
 *
 * Phase 3 (Offline-First Integration with Task 11):
 * - DatabaseService integration for local-first architecture
 * - OfflineService for queue management and sync
 * - Organisation-scoped operations
 * - Background sync when network is available
 * - RLS enforcement via Supabase backend
 */

import { supabase } from './supabase';
import { DatabaseService } from './offline/DatabaseService';
import { OfflineService } from './offline/OfflineService';
import type {
  Project,
  ProjectWithDetails,
  ProjectMemberWithProfile,
  CreateProjectInput,
  LoRaWANDeviceStatus
} from '../types/project';
import type { DatabaseProject } from './offline/DatabaseService';

class ProjectService {
  private readonly TABLE_NAME = 'projects';
  private db: DatabaseService;
  private offlineService: OfflineService;

  constructor() {
    this.db = new DatabaseService();
    this.offlineService = new OfflineService();
  }

  /**
   * Initialize database and offline service
   * Must be called before using the service
   */
  async initialize(): Promise<void> {
    await this.db.initializeDatabase();
    await this.offlineService.initialize();
  }

  /**
   * Get all projects for current user's organisation
   * OFFLINE-FIRST: Reads from local database, triggers background sync
   * RLS automatically filters by user's organisation membership during sync
   *
   * Phase 3 Integration:
   * 1. Always read from local SQLite database
   * 2. Trigger background sync if online
   * 3. Return local data immediately for instant UI
   *
   * @param organisationId - Current organisation ID from Redux state
   */
  async getUserProjects(organisationId: string): Promise<ProjectWithDetails[]> {
    try {
      console.log('📂 Reading projects from local database for org:', organisationId);

      // STEP 1: Read from local database (ALWAYS, even offline)
      const localProjects = await this.db.getProjectsByOrganisation(organisationId);

      console.log(`✅ Found ${localProjects.length} projects in local database`);

      // STEP 2: Trigger background sync if online (don't wait for it)
      this.backgroundSyncProjects(organisationId).catch(error => {
        console.warn('⚠️ Background sync failed (non-blocking):', error);
      });

      // STEP 3: Convert DatabaseProject to ProjectWithDetails
      return localProjects.map(this.mapDatabaseProjectToDetails);

    } catch (error) {
      console.error('❌ Failed to fetch projects from local database:', error);
      throw new Error(`Failed to fetch projects: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Background sync: Fetch from Supabase and update local database
   * Non-blocking, runs in background
   */
  private async backgroundSyncProjects(organisationId: string): Promise<void> {
    // Check if we're online
    const networkStatus = this.offlineService.getNetworkStatus();
    if (!networkStatus.isConnected) {
      console.log('📡 Offline - skipping background sync');
      return;
    }

    console.log('🔄 Starting background sync for projects...');

    try {
      // Fetch from Supabase (RLS filters by user's org)
      const { data: viewData, error: viewError } = await (supabase as any)
        .from('projects_with_stats')
        .select('*')
        .order('created_at', { ascending: false });

      if (!viewError && viewData) {
        console.log(`🔄 Synced ${viewData.length} projects from Supabase`);

        // Update local database
        for (const project of viewData) {
          const dbProject: DatabaseProject = {
            id: project.id,
            organisation_id: project.organisation_id,
            name: project.name,
            description: project.description || '',
            status: project.deleted_at ? 'inactive' : 'active',
            members: [], // TODO: Sync members separately
          };

          try {
            // Try to update first, if not found insert
            await this.db.updateProject(project.id, dbProject);
          } catch (updateError) {
            // If update fails (project doesn't exist), insert it
            await this.db.insertProject(dbProject);
          }
        }

        console.log('✅ Background sync complete');
      } else {
        console.warn('⚠️ Background sync failed:', viewError);
      }
    } catch (error) {
      console.error('❌ Background sync error:', error);
      // Don't throw - background sync failures are non-blocking
    }
  }

  /**
   * Get single project by ID with full details
   * OFFLINE-FIRST: Reads from local database, triggers background sync
   *
   * Phase 4 Fix (Bug #7): Changed to read from local SQLite database instead of
   * direct Supabase query. This ensures projects work offline even if not viewed online first.
   */
  async getProjectById(projectId: string): Promise<ProjectWithDetails | null> {
    try {
      console.log('📂 Reading project from local database:', projectId);

      // STEP 1: Read from local database (ALWAYS, even offline)
      const localProject = await this.db.getProjectById(projectId);

      if (!localProject) {
        console.log('❌ Project not found in local database:', projectId);
        return null;
      }

      console.log('✅ Found project in local database:', localProject.name);

      // STEP 2: Trigger background sync if online (don't wait for it)
      this.backgroundSyncSingleProject(projectId).catch(error => {
        console.warn('⚠️ Background sync failed (non-blocking):', error);
      });

      // STEP 3: Convert DatabaseProject to ProjectWithDetails
      return this.mapDatabaseProjectToDetails(localProject);

    } catch (error) {
      console.error('❌ Failed to fetch project from local database:', error);
      throw new Error(`Failed to fetch project: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Background sync: Fetch single project from Supabase and update local database
   * Non-blocking, runs in background
   */
  private async backgroundSyncSingleProject(projectId: string): Promise<void> {
    // Check if we're online
    const networkStatus = this.offlineService.getNetworkStatus();
    if (!networkStatus.isConnected) {
      console.log('📡 Offline - skipping background sync');
      return;
    }

    console.log('🔄 Starting background sync for project:', projectId);

    try {
      // Fetch from Supabase (RLS filters by user's org)
      const { data, error } = await (supabase as any)
        .from('projects_with_stats')
        .select('*')
        .eq('id', projectId)
        .single();

      if (!error && data) {
        console.log('🔄 Synced project from Supabase:', data.name);

        // Update local database
        const dbProject: DatabaseProject = {
          id: data.id,
          organisation_id: data.organisation_id,
          name: data.name,
          description: data.description || '',
          status: data.deleted_at ? 'inactive' : 'active',
          members: [], // TODO: Sync members separately
        };

        try {
          // Try to update first, if not found insert
          await this.db.updateProject(data.id, dbProject);
          console.log('✅ Project updated in local database');
        } catch (updateError) {
          // If update fails (project doesn't exist), insert it
          await this.db.insertProject(dbProject);
          console.log('✅ Project inserted into local database');
        }
      } else {
        console.warn('⚠️ Background sync failed:', error);
      }
    } catch (error) {
      console.error('❌ Background sync error:', error);
      // Don't throw - background sync failures are non-blocking
    }
  }

  /**
   * Create new project
   * OFFLINE-FIRST: Always saves locally first, then queues for sync
   * No more offline parameter - always works offline-first
   *
   * Phase 3 Integration:
   * 1. Save to local SQLite database immediately
   * 2. Queue sync operation for background processing
   * 3. Trigger immediate sync if online
   */
  async createProject(input: CreateProjectInput): Promise<Project> {
    const currentUserId = await this.getCurrentUserId();

    const newProject: Project = {
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

    try {
      console.log('💾 Saving project to local database:', newProject.id);

      // STEP 1: Save to local SQLite database
      const dbProject: DatabaseProject = {
        id: newProject.id,
        organisation_id: newProject.organisation_id,
        name: newProject.name,
        description: newProject.description || '',
        status: 'active',
        members: [], // Will be populated later
      };

      await this.db.insertProject(dbProject);
      console.log('✅ Project saved locally');

      // STEP 2: Queue sync operation
      console.log('📤 Queuing project for sync...');
      await this.offlineService.queueOperation({
        id: `create-project-${newProject.id}`,
        type: 'CREATE_PROJECT',
        data: newProject,
        user_id: currentUserId,
        organisation_id: input.organisation_id,
        timestamp: new Date(),
        retry_count: 0,
      });

      console.log('✅ Project queued for sync');

      // STEP 3: Trigger background sync if online (don't wait)
      this.backgroundSyncPendingOperations().catch(error => {
        console.warn('⚠️ Background sync failed (non-blocking):', error);
      });

      return newProject;
    } catch (error) {
      console.error('❌ Failed to create project:', error);
      throw new Error(`Failed to create project: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Update existing project
   * OFFLINE-FIRST: Updates local database first, then queues for sync
   */
  async updateProject(projectId: string, updates: Partial<Project>): Promise<Project> {
    try {
      const currentUserId = await this.getCurrentUserId();

      console.log('💾 Updating project in local database:', projectId);

      // STEP 1: Update local database
      const dbUpdates: Partial<DatabaseProject> = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.description !== undefined) dbUpdates.description = updates.description || '';
      if (updates.deleted_at !== undefined) dbUpdates.status = updates.deleted_at ? 'inactive' : 'active';

      await this.db.updateProject(projectId, dbUpdates);
      console.log('✅ Project updated locally');

      // STEP 2: Queue sync operation
      console.log('📤 Queuing project update for sync...');
      await this.offlineService.queueOperation({
        id: `update-project-${projectId}-${Date.now()}`,
        type: 'UPDATE_PROJECT',
        data: { id: projectId, ...updates },
        user_id: currentUserId,
        organisation_id: updates.organisation_id || '',
        timestamp: new Date(),
        retry_count: 0,
      });

      console.log('✅ Project update queued for sync');

      // STEP 3: Trigger background sync if online (don't wait)
      this.backgroundSyncPendingOperations().catch(error => {
        console.warn('⚠️ Background sync failed (non-blocking):', error);
      });

      // Return optimistic update
      return { id: projectId, ...updates } as Project;
    } catch (error) {
      console.error('❌ Failed to update project:', error);
      throw new Error(`Failed to update project: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Delete project (soft delete)
   * OFFLINE-FIRST: Deletes from local database first, then queues for sync
   */
  async deleteProject(projectId: string): Promise<void> {
    try {
      const currentUserId = await this.getCurrentUserId();

      console.log('💾 Deleting project from local database:', projectId);

      // STEP 1: Delete from local database
      await this.db.deleteProject(projectId);
      console.log('✅ Project deleted locally');

      // STEP 2: Queue sync operation
      console.log('📤 Queuing project deletion for sync...');
      await this.offlineService.queueOperation({
        id: `delete-project-${projectId}-${Date.now()}`,
        type: 'DELETE_PROJECT',
        data: { id: projectId },
        user_id: currentUserId,
        organisation_id: '', // Will be validated by backend RLS
        timestamp: new Date(),
        retry_count: 0,
      });

      console.log('✅ Project deletion queued for sync');

      // STEP 3: Trigger background sync if online (don't wait)
      this.backgroundSyncPendingOperations().catch(error => {
        console.warn('⚠️ Background sync failed (non-blocking):', error);
      });
    } catch (error) {
      console.error('❌ Failed to delete project:', error);
      throw new Error(`Failed to delete project: ${error instanceof Error ? error.message : String(error)}`);
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
   * Trigger background sync of pending operations
   * Non-blocking, runs in background
   */
  private async backgroundSyncPendingOperations(): Promise<void> {
    // Check if we're online
    const networkStatus = this.offlineService.getNetworkStatus();
    if (!networkStatus.isConnected) {
      console.log('📡 Offline - skipping background sync');
      return;
    }

    console.log('🔄 Starting background sync of pending operations...');

    try {
      await this.offlineService.syncPendingOperations();
      console.log('✅ Background sync complete');
    } catch (error) {
      console.error('❌ Background sync error:', error);
      // Don't throw - background sync failures are non-blocking
    }
  }

  /**
   * Map DatabaseProject to ProjectWithDetails
   */
  private mapDatabaseProjectToDetails = (dbProject: DatabaseProject): ProjectWithDetails => {
    return {
      id: dbProject.id,
      name: dbProject.name,
      description: dbProject.description || null,
      organisation_id: dbProject.organisation_id,
      owner_id: '', // Not stored in local DB
      created_by: '', // Not stored in local DB
      created_at: dbProject.created_at || new Date().toISOString(),
      updated_at: dbProject.updated_at || new Date().toISOString(),
      deleted_at: dbProject.status === 'inactive' ? new Date().toISOString() : null,
      privacy_level: 'public', // Not stored in local DB
      project_image: null,
      end_date: null,
      is_private: false,
      is_baited: false,
      is_monitoring_marked_individual: false,
      sampling_design: null,
      website: null,
      // Computed fields (will be populated during background sync)
      deployment_count: 0,
      device_count: 0,
      member_count: dbProject.members?.length || 0,
    };
  };

  /**
   * Generate UUID (RFC4122 compliant)
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
