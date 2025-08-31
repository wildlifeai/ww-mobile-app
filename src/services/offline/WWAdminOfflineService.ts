import { DatabaseService } from './DatabaseService';
import { OfflineService } from './OfflineService';
import { 
  User, 
  Organisation, 
  OfflineOperation, 
  LoRaWANStatus,
  UserRole 
} from '../../types/offline';

/**
 * WWAdminOfflineService - WW Admin offline capabilities for user provisioning and cross-organisation management
 * 
 * MVP REQUIREMENT: WW Admin user provisioning offline access per spec line 73
 * 
 * Features:
 * - Offline user management across organisations
 * - Role assignment capabilities (ww_admin, project_admin, project_member)
 * - System configuration offline access
 * - Model management offline sync (species, brands, models)
 * - Global admin data synchronization with organisation isolation
 * - LoRaWAN device configuration offline sync for admin users
 * - Cross-organisation analytics and reporting offline access
 * - Bulk user operations offline queue (invite, role changes, deactivation)
 */
export class WWAdminOfflineService {
  private databaseService: DatabaseService;
  private offlineService: OfflineService;
  
  // Cache for cross-organisation data
  private organisationsCache: Map<string, Organisation> = new Map();
  private usersCache: Map<string, User[]> = new Map(); // Org ID -> Users
  private systemConfigCache: Map<string, any> = new Map();

  constructor() {
    this.databaseService = new DatabaseService();
    this.offlineService = new OfflineService();
  }

  /**
   * Initialize WW Admin offline service
   */
  async initialize(): Promise<void> {
    await this.databaseService.initializeDatabase();
    await this.offlineService.initialize();
    
    // Load cached data
    await this.loadOrganisationsCache();
    await this.loadSystemConfigCache();
  }

  /**
   * Provision user across organisations (MVP requirement)
   */
  async provisionUser(adminUser: User, targetUser: Partial<User>, targetOrganisationId: string): Promise<void> {
    if (!this.validateWWAdminAccess(adminUser)) {
      throw new Error('Unauthorized: Only WW Admins can provision users across organisations');
    }

    const provisionOperation: OfflineOperation = {
      id: `provision-user-${Date.now()}`,
      type: 'CREATE_USER',
      data: {
        user: targetUser,
        organisation_id: targetOrganisationId,
        provisioned_by: adminUser.id,
        provision_type: 'cross_organisation'
      },
      user_id: adminUser.id,
      organisation_id: targetOrganisationId,
      timestamp: new Date(),
      retry_count: 0
    };

    // Queue for sync when online
    await this.offlineService.queueOperation(provisionOperation);

    // Cache locally for immediate access
    await this.cacheUserLocally(targetUser as User, targetOrganisationId);
  }

  /**
   * Assign role to user across organisations
   */
  async assignUserRole(adminUser: User, targetUserId: string, newRole: UserRole, organisationId: string): Promise<void> {
    if (!this.validateWWAdminAccess(adminUser)) {
      throw new Error('Unauthorized: Only WW Admins can assign roles across organisations');
    }

    const roleAssignOperation: OfflineOperation = {
      id: `assign-role-${targetUserId}-${Date.now()}`,
      type: 'UPDATE_USER',
      data: {
        user_id: targetUserId,
        role: newRole,
        organisation_id: organisationId,
        assigned_by: adminUser.id
      },
      user_id: adminUser.id,
      organisation_id: organisationId,
      timestamp: new Date(),
      retry_count: 0
    };

    await this.offlineService.queueOperation(roleAssignOperation);

    // Update local cache
    await this.updateUserRoleCache(targetUserId, newRole, organisationId);
  }

  /**
   * Get all organisations for cross-organisation management
   */
  async getAllOrganisations(adminUser: User): Promise<Organisation[]> {
    if (!this.validateWWAdminAccess(adminUser)) {
      throw new Error('Unauthorized: Only WW Admins can access all organisations');
    }

    // Return cached organisations
    return Array.from(this.organisationsCache.values());
  }

  /**
   * Get users by organisation for admin management
   */
  async getUsersByOrganisation(adminUser: User, organisationId: string): Promise<User[]> {
    if (!this.validateWWAdminAccess(adminUser)) {
      throw new Error('Unauthorized: Only WW Admins can access cross-organisation users');
    }

    // Check cache first
    if (this.usersCache.has(organisationId)) {
      return this.usersCache.get(organisationId)!;
    }

    // Load from database if not in cache
    const users = await this.loadUsersFromDatabase(organisationId);
    this.usersCache.set(organisationId, users);
    return users;
  }

  /**
   * Bulk user operations for efficient management
   */
  async bulkUserOperations(adminUser: User, operations: Array<{
    type: 'invite' | 'role_change' | 'deactivate' | 'reactivate';
    userId?: string;
    organisationId: string;
    data: any;
  }>): Promise<void> {
    if (!this.validateWWAdminAccess(adminUser)) {
      throw new Error('Unauthorized: Only WW Admins can perform bulk user operations');
    }

    for (const operation of operations) {
      const bulkOperation: OfflineOperation = {
        id: `bulk-${operation.type}-${Date.now()}-${Math.random()}`,
        type: this.mapBulkOperationType(operation.type),
        data: {
          ...operation.data,
          bulk_operation: true,
          operation_type: operation.type,
          target_user_id: operation.userId,
          performed_by: adminUser.id
        },
        user_id: adminUser.id,
        organisation_id: operation.organisationId,
        timestamp: new Date(),
        retry_count: 0
      };

      await this.offlineService.queueOperation(bulkOperation);
    }
  }

  /**
   * Configure LoRaWAN devices offline for admin users
   */
  async configureLoRaWANDevice(adminUser: User, deviceId: string, config: {
    organisation_id: string;
    device_settings: any;
    webhook_config?: any;
  }): Promise<void> {
    if (!this.validateWWAdminAccess(adminUser)) {
      throw new Error('Unauthorized: Only WW Admins can configure LoRaWAN devices globally');
    }

    const configOperation: OfflineOperation = {
      id: `lorawan-config-${deviceId}-${Date.now()}`,
      type: 'UPDATE_DEVICE_LORAWAN_STATUS',
      data: {
        device_id: deviceId,
        configuration: config.device_settings,
        webhook_config: config.webhook_config,
        configured_by: adminUser.id,
        configuration_type: 'admin_global'
      },
      user_id: adminUser.id,
      organisation_id: config.organisation_id,
      timestamp: new Date(),
      retry_count: 0
    };

    await this.offlineService.queueOperation(configOperation);
  }

  /**
   * Access cross-organisation analytics offline
   */
  async getCrossOrganisationAnalytics(adminUser: User): Promise<{
    total_organisations: number;
    total_users: number;
    total_projects: number;
    total_deployments: number;
    device_status_summary: Record<string, number>;
    role_distribution: Record<UserRole, number>;
  }> {
    if (!this.validateWWAdminAccess(adminUser)) {
      throw new Error('Unauthorized: Only WW Admins can access cross-organisation analytics');
    }

    // Calculate analytics from cached data
    const analytics = {
      total_organisations: this.organisationsCache.size,
      total_users: 0,
      total_projects: 0,
      total_deployments: 0,
      device_status_summary: {} as Record<string, number>,
      role_distribution: {
        ww_admin: 0,
        project_admin: 0,
        project_member: 0
      } as Record<UserRole, number>
    };

    // Aggregate user statistics
    for (const users of this.usersCache.values()) {
      analytics.total_users += users.length;
      for (const user of users) {
        analytics.role_distribution[user.role]++;
      }
    }

    // Get project and deployment counts from database
    for (const orgId of this.organisationsCache.keys()) {
      const projects = await this.databaseService.getProjectsByOrganisation(orgId);
      const deployments = await this.databaseService.getDeploymentsByOrganisation(orgId);
      
      analytics.total_projects += projects.length;
      analytics.total_deployments += deployments.length;
    }

    return analytics;
  }

  /**
   * Manage system configuration offline
   */
  async updateSystemConfiguration(adminUser: User, configKey: string, configValue: any): Promise<void> {
    if (!this.validateWWAdminAccess(adminUser)) {
      throw new Error('Unauthorized: Only WW Admins can modify system configuration');
    }

    const configOperation: OfflineOperation = {
      id: `system-config-${configKey}-${Date.now()}`,
      type: 'UPDATE_ORGANISATION', // Using as system config update
      data: {
        config_key: configKey,
        config_value: configValue,
        config_type: 'system_global',
        updated_by: adminUser.id
      },
      user_id: adminUser.id,
      organisation_id: 'system', // Special org for system-wide config
      timestamp: new Date(),
      retry_count: 0
    };

    await this.offlineService.queueOperation(configOperation);
    
    // Update local cache
    this.systemConfigCache.set(configKey, configValue);
  }

  /**
   * Get system configuration
   */
  async getSystemConfiguration(adminUser: User, configKey?: string): Promise<any> {
    if (!this.validateWWAdminAccess(adminUser)) {
      throw new Error('Unauthorized: Only WW Admins can access system configuration');
    }

    if (configKey) {
      return this.systemConfigCache.get(configKey);
    }

    // Return all system configuration
    return Object.fromEntries(this.systemConfigCache);
  }

  /**
   * Model management offline sync (species, brands, models)
   */
  async syncModelData(adminUser: User, modelType: 'species' | 'brands' | 'device_models'): Promise<void> {
    if (!this.validateWWAdminAccess(adminUser)) {
      throw new Error('Unauthorized: Only WW Admins can sync model data');
    }

    const syncOperation: OfflineOperation = {
      id: `model-sync-${modelType}-${Date.now()}`,
      type: 'CREATE_ORGANISATION', // Using as model sync operation
      data: {
        model_type: modelType,
        sync_type: 'full_refresh',
        requested_by: adminUser.id
      },
      user_id: adminUser.id,
      organisation_id: 'system',
      timestamp: new Date(),
      retry_count: 0
    };

    await this.offlineService.queueOperation(syncOperation);
  }

  /**
   * Validate WW Admin access
   */
  private validateWWAdminAccess(user: User): boolean {
    return user.role === 'ww_admin';
  }

  /**
   * Map bulk operation type to offline operation type
   */
  private mapBulkOperationType(type: string): any {
    switch (type) {
      case 'invite':
        return 'CREATE_USER';
      case 'role_change':
      case 'deactivate':
      case 'reactivate':
        return 'UPDATE_USER';
      default:
        return 'UPDATE_USER';
    }
  }

  /**
   * Load organisations cache
   */
  private async loadOrganisationsCache(): Promise<void> {
    try {
      // TODO: Load from database - placeholder implementation
      // const orgs = await this.databaseService.getAllOrganisations();
      // for (const org of orgs) {
      //   this.organisationsCache.set(org.id, org);
      // }
      console.log('Loading organisations cache...');
    } catch (error) {
      console.error('Failed to load organisations cache:', error);
    }
  }

  /**
   * Load system config cache
   */
  private async loadSystemConfigCache(): Promise<void> {
    try {
      // TODO: Load from database - placeholder implementation
      console.log('Loading system config cache...');
    } catch (error) {
      console.error('Failed to load system config cache:', error);
    }
  }

  /**
   * Cache user locally
   */
  private async cacheUserLocally(user: User, organisationId: string): Promise<void> {
    if (!this.usersCache.has(organisationId)) {
      this.usersCache.set(organisationId, []);
    }
    
    const users = this.usersCache.get(organisationId)!;
    const existingIndex = users.findIndex(u => u.id === user.id);
    
    if (existingIndex >= 0) {
      users[existingIndex] = user;
    } else {
      users.push(user);
    }
  }

  /**
   * Update user role in cache
   */
  private async updateUserRoleCache(userId: string, newRole: UserRole, organisationId: string): Promise<void> {
    const users = this.usersCache.get(organisationId);
    if (users) {
      const userIndex = users.findIndex(u => u.id === userId);
      if (userIndex >= 0) {
        users[userIndex].role = newRole;
      }
    }
  }

  /**
   * Load users from database
   */
  private async loadUsersFromDatabase(organisationId: string): Promise<User[]> {
    try {
      // TODO: Implement actual database query
      console.log(`Loading users for organisation ${organisationId} from database`);
      return [];
    } catch (error) {
      console.error('Failed to load users from database:', error);
      return [];
    }
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    this.organisationsCache.clear();
    this.usersCache.clear();
    this.systemConfigCache.clear();
    await this.offlineService.destroy();
  }
}