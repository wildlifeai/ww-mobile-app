import { DatabaseService } from './DatabaseService';
import { OfflineService } from './OfflineService';
import {
  User,
  Organisation
} from '../../types/offline';

// Import types from wwAdminSlice for consistency
import { Project } from '../../redux/slices/wwAdminSlice';

/**
 * WWAdminOfflineService - WW Admin offline capabilities for web-portal exclusive architecture
 *
 * MVP ARCHITECTURE: Read-only project visibility + web portal navigation
 *
 * Features:
 * - Cross-organisation project visibility (read-only)
 * - Organisation data caching for offline viewing
 * - Web portal URL management
 * - Project data synchronization for admin overview
 *
 * Removed from MVP (Web Portal Exclusive):
 * - User management operations (moved to web portal)
 * - Role assignment operations (web portal only)
 * - System configuration management (web portal only)
 * - Bulk operations (web portal only)
 */
export class WWAdminOfflineService {
  private databaseService: DatabaseService;
  private offlineService: OfflineService;

  // Cache for read-only cross-organisation data
  private organisationsCache: Map<string, Organisation> = new Map();
  private projectsCache: Map<string, Project[]> = new Map(); // Org ID -> Projects
  private webPortalUrl: string = 'https://admin.wildlifewatcher.com';

  constructor() {
    this.databaseService = new DatabaseService();
    this.offlineService = new OfflineService();
    this.webPortalUrl = process.env.EXPO_PUBLIC_WW_ADMIN_PORTAL_URL || 'https://admin.wildlifewatcher.com';
  }

  /**
   * Initialize WW Admin offline service
   */
  async initialize(): Promise<void> {
    await this.databaseService.initializeDatabase();
    await this.offlineService.initialize();

    // Load cached data for read-only access
    await this.loadOrganisationsCache();
    await this.loadProjectsCache();
  }

  /**
   * Get all organisations for cross-organisation project visibility
   */
  async getAllOrganisations(adminUser: User): Promise<Organisation[]> {
    if (!this.validateWWAdminAccess(adminUser)) {
      throw new Error('Unauthorized: Only WW Admins can access cross-organisation data');
    }

    // Return cached organisations for read-only access
    return Array.from(this.organisationsCache.values());
  }

  /**
   * Get projects by organisation for read-only visibility
   */
  async getProjectsByOrganisation(adminUser: User, organisationId: string): Promise<Project[]> {
    if (!this.validateWWAdminAccess(adminUser)) {
      throw new Error('Unauthorized: Only WW Admins can access cross-organisation projects');
    }

    // Check cache first
    if (this.projectsCache.has(organisationId)) {
      return this.projectsCache.get(organisationId)!;
    }

    // Load from database if not in cache
    const projects = await this.loadProjectsFromDatabase(organisationId);
    this.projectsCache.set(organisationId, projects);
    return projects;
  }

  /**
   * Get all projects across organisations for admin overview
   */
  async getAllProjects(adminUser: User): Promise<Project[]> {
    if (!this.validateWWAdminAccess(adminUser)) {
      throw new Error('Unauthorized: Only WW Admins can access all projects');
    }

    const allProjects: Project[] = [];
    for (const projects of this.projectsCache.values()) {
      allProjects.push(...projects);
    }
    return allProjects;
  }

  /**
   * Navigate to web portal for user management
   */
  getWebPortalUrl(): string {
    return this.webPortalUrl;
  }

  /**
   * Set web portal URL configuration
   */
  setWebPortalUrl(url: string): void {
    this.webPortalUrl = url;
  }

  /**
   * Get cached project statistics for admin overview
   */
  async getProjectStatistics(adminUser: User): Promise<{
    total_organisations: number;
    total_projects: number;
    projects_by_status: Record<string, number>;
    recent_projects: Project[];
  }> {
    if (!this.validateWWAdminAccess(adminUser)) {
      throw new Error('Unauthorized: Only WW Admins can access project statistics');
    }

    const allProjects = await this.getAllProjects(adminUser);

    // Calculate statistics from cached data
    const statistics = {
      total_organisations: this.organisationsCache.size,
      total_projects: allProjects.length,
      projects_by_status: {} as Record<string, number>,
      recent_projects: allProjects
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10)
    };

    // Count projects by status (using is_private as example status)
    statistics.projects_by_status = {
      public: allProjects.filter(p => !p.is_private).length,
      private: allProjects.filter(p => p.is_private).length
    };

    return statistics;
  }

  /**
   * Refresh project data for a specific organisation
   */
  async refreshOrganisationProjects(adminUser: User, organisationId: string): Promise<void> {
    if (!this.validateWWAdminAccess(adminUser)) {
      throw new Error('Unauthorized: Only WW Admins can refresh organisation data');
    }

    // Clear cache and reload
    this.projectsCache.delete(organisationId);
    await this.getProjectsByOrganisation(adminUser, organisationId);
  }

  /**
   * Clear all cached data and refresh
   */
  async refreshAllData(adminUser: User): Promise<void> {
    if (!this.validateWWAdminAccess(adminUser)) {
      throw new Error('Unauthorized: Only WW Admins can refresh data');
    }

    // Clear all caches
    this.organisationsCache.clear();
    this.projectsCache.clear();

    // Reload fresh data
    await this.loadOrganisationsCache();
    await this.loadProjectsCache();
  }

  /**
   * Validate WW Admin access
   */
  private validateWWAdminAccess(user: User): boolean {
    return user.role === 'ww_admin';
  }

  /**
   * Load organisations cache from database
   */
  private async loadOrganisationsCache(): Promise<void> {
    try {
      // TODO: Load from database - placeholder implementation
      // const orgs = await this.databaseService.getAllOrganisations();
      // for (const org of orgs) {
      //   this.organisationsCache.set(org.id, org);
      // }
      console.log('Loading organisations cache for read-only access...');
    } catch (error) {
      console.error('Failed to load organisations cache:', error);
    }
  }

  /**
   * Load projects cache from database
   */
  private async loadProjectsCache(): Promise<void> {
    try {
      // TODO: Load from database - placeholder implementation
      // for (const orgId of this.organisationsCache.keys()) {
      //   const projects = await this.databaseService.getProjectsByOrganisation(orgId);
      //   this.projectsCache.set(orgId, projects);
      // }
      console.log('Loading projects cache for read-only access...');
    } catch (error) {
      console.error('Failed to load projects cache:', error);
    }
  }

  /**
   * Load projects from database for specific organisation
   */
  private async loadProjectsFromDatabase(organisationId: string): Promise<Project[]> {
    try {
      // TODO: Implement actual database query
      console.log(`Loading projects for organisation ${organisationId} from database`);
      return [];
    } catch (error) {
      console.error('Failed to load projects from database:', error);
      return [];
    }
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    this.organisationsCache.clear();
    this.projectsCache.clear();
    await this.offlineService.destroy();
  }
}