/**
 * @jest-environment node
 */

// Mock dependencies first
jest.mock('../../../../src/services/offline/DatabaseService');
jest.mock('../../../../src/services/offline/OfflineService');

import { WWAdminOfflineService } from '../../../../src/services/offline/WWAdminOfflineService';
import { DatabaseService } from '../../../../src/services/offline/DatabaseService';
import { OfflineService } from '../../../../src/services/offline/OfflineService';
import { User, UserRole, Organisation, OfflineOperation } from '../../../../src/types/offline';

describe('WWAdminOfflineService', () => {
  let wwAdminService: WWAdminOfflineService;
  let mockDatabaseService: jest.Mocked<DatabaseService>;
  let mockOfflineService: jest.Mocked<OfflineService>;

  const mockWWAdmin: User = {
    id: 'admin-1',
    role: 'ww_admin',
    organisation_id: 'org-1'
  };

  const mockProjectAdmin: User = {
    id: 'admin-2',
    role: 'project_admin',
    organisation_id: 'org-1'
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Mock DatabaseService
    mockDatabaseService = {
      initializeDatabase: jest.fn().mockResolvedValue(undefined),
      getProjectsByOrganisation: jest.fn().mockResolvedValue([]),
      getDeploymentsByOrganisation: jest.fn().mockResolvedValue([])
    } as any;

    // Mock OfflineService
    mockOfflineService = {
      initialize: jest.fn().mockResolvedValue(undefined),
      queueOperation: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn().mockResolvedValue(undefined)
    } as any;

    (DatabaseService as jest.Mock).mockImplementation(() => mockDatabaseService);
    (OfflineService as jest.Mock).mockImplementation(() => mockOfflineService);

    wwAdminService = new WWAdminOfflineService();
    await wwAdminService.initialize();
  });

  afterEach(async () => {
    await wwAdminService.destroy();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      expect(mockDatabaseService.initializeDatabase).toHaveBeenCalled();
      expect(mockOfflineService.initialize).toHaveBeenCalled();
    });
  });

  describe('User Provisioning (MVP Requirement)', () => {
    it('should allow WW Admin to provision user across organisations', async () => {
      const targetUser: Partial<User> = {
        id: 'new-user-1',
        role: 'project_admin',
        organisation_id: 'org-2'
      };

      await wwAdminService.provisionUser(mockWWAdmin, targetUser, 'org-2');

      expect(mockOfflineService.queueOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'CREATE_USER',
          data: expect.objectContaining({
            user: targetUser,
            organisation_id: 'org-2',
            provisioned_by: mockWWAdmin.id,
            provision_type: 'cross_organisation'
          }),
          organisation_id: 'org-2'
        })
      );
    });

    it('should deny non-WW Admin users from provisioning', async () => {
      const targetUser: Partial<User> = {
        id: 'new-user-2',
        role: 'project_member'
      };

      await expect(wwAdminService.provisionUser(mockProjectAdmin, targetUser, 'org-2'))
        .rejects.toThrow('Unauthorized: Only WW Admins can provision users across organisations');

      expect(mockOfflineService.queueOperation).not.toHaveBeenCalled();
    });
  });

  describe('Role Assignment', () => {
    it('should allow WW Admin to assign roles across organisations', async () => {
      await wwAdminService.assignUserRole(mockWWAdmin, 'user-123', 'project_admin', 'org-2');

      expect(mockOfflineService.queueOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'UPDATE_USER',
          data: expect.objectContaining({
            user_id: 'user-123',
            role: 'project_admin',
            organisation_id: 'org-2',
            assigned_by: mockWWAdmin.id
          })
        })
      );
    });

    it('should deny non-WW Admin role assignments', async () => {
      await expect(wwAdminService.assignUserRole(mockProjectAdmin, 'user-123', 'project_admin', 'org-2'))
        .rejects.toThrow('Unauthorized: Only WW Admins can assign roles across organisations');
    });
  });

  describe('Cross-Organisation Management', () => {
    it('should allow WW Admin to get all organisations', async () => {
      const organisations = await wwAdminService.getAllOrganisations(mockWWAdmin);
      
      expect(organisations).toEqual(expect.any(Array));
      // Note: Empty array expected as cache starts empty in tests
    });

    it('should deny non-WW Admin access to all organisations', async () => {
      await expect(wwAdminService.getAllOrganisations(mockProjectAdmin))
        .rejects.toThrow('Unauthorized: Only WW Admins can access all organisations');
    });

    it('should allow WW Admin to get users by organisation', async () => {
      const users = await wwAdminService.getUsersByOrganisation(mockWWAdmin, 'org-2');
      
      expect(users).toEqual(expect.any(Array));
    });

    it('should deny non-WW Admin access to cross-organisation users', async () => {
      await expect(wwAdminService.getUsersByOrganisation(mockProjectAdmin, 'org-2'))
        .rejects.toThrow('Unauthorized: Only WW Admins can access cross-organisation users');
    });
  });

  describe('Bulk User Operations', () => {
    it('should allow WW Admin to perform bulk user operations', async () => {
      const operations = [
        {
          type: 'invite' as const,
          organisationId: 'org-2',
          data: { email: 'user@example.com', role: 'project_member' }
        },
        {
          type: 'role_change' as const,
          userId: 'user-456',
          organisationId: 'org-2',
          data: { new_role: 'project_admin' }
        }
      ];

      await wwAdminService.bulkUserOperations(mockWWAdmin, operations);

      expect(mockOfflineService.queueOperation).toHaveBeenCalledTimes(2);
      expect(mockOfflineService.queueOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'CREATE_USER',
          data: expect.objectContaining({
            bulk_operation: true,
            operation_type: 'invite'
          })
        })
      );
    });

    it('should deny non-WW Admin bulk operations', async () => {
      const operations = [
        {
          type: 'invite' as const,
          organisationId: 'org-2',
          data: { email: 'user@example.com' }
        }
      ];

      await expect(wwAdminService.bulkUserOperations(mockProjectAdmin, operations))
        .rejects.toThrow('Unauthorized: Only WW Admins can perform bulk user operations');
    });
  });

  describe('LoRaWAN Device Configuration', () => {
    it('should allow WW Admin to configure LoRaWAN devices', async () => {
      const config = {
        organisation_id: 'org-2',
        device_settings: {
          transmission_interval: 300,
          power_level: 14
        },
        webhook_config: {
          url: 'https://api.example.com/webhook',
          auth_token: 'secure-token'
        }
      };

      await wwAdminService.configureLoRaWANDevice(mockWWAdmin, 'device-123', config);

      expect(mockOfflineService.queueOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'UPDATE_DEVICE_LORAWAN_STATUS',
          data: expect.objectContaining({
            device_id: 'device-123',
            configuration: config.device_settings,
            webhook_config: config.webhook_config,
            configured_by: mockWWAdmin.id,
            configuration_type: 'admin_global'
          })
        })
      );
    });

    it('should deny non-WW Admin LoRaWAN configuration', async () => {
      const config = {
        organisation_id: 'org-2',
        device_settings: {}
      };

      await expect(wwAdminService.configureLoRaWANDevice(mockProjectAdmin, 'device-123', config))
        .rejects.toThrow('Unauthorized: Only WW Admins can configure LoRaWAN devices globally');
    });
  });

  describe('Cross-Organisation Analytics', () => {
    it('should provide analytics for WW Admin', async () => {
      // Mock some data
      mockDatabaseService.getProjectsByOrganisation.mockResolvedValue([
        { id: 'proj-1', name: 'Project 1' } as any,
        { id: 'proj-2', name: 'Project 2' } as any
      ]);
      
      mockDatabaseService.getDeploymentsByOrganisation.mockResolvedValue([
        { id: 'deploy-1', name: 'Deployment 1' } as any
      ]);

      const analytics = await wwAdminService.getCrossOrganisationAnalytics(mockWWAdmin);

      expect(analytics).toEqual({
        total_organisations: 0, // Cache starts empty
        total_users: 0,
        total_projects: 0,
        total_deployments: 0,
        device_status_summary: {},
        role_distribution: {
          ww_admin: 0,
          project_admin: 0,
          project_member: 0
        }
      });
    });

    it('should deny non-WW Admin analytics access', async () => {
      await expect(wwAdminService.getCrossOrganisationAnalytics(mockProjectAdmin))
        .rejects.toThrow('Unauthorized: Only WW Admins can access cross-organisation analytics');
    });
  });

  describe('System Configuration Management', () => {
    it('should allow WW Admin to update system configuration', async () => {
      await wwAdminService.updateSystemConfiguration(mockWWAdmin, 'max_deployments_per_project', 50);

      expect(mockOfflineService.queueOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'UPDATE_ORGANISATION',
          data: expect.objectContaining({
            config_key: 'max_deployments_per_project',
            config_value: 50,
            config_type: 'system_global',
            updated_by: mockWWAdmin.id
          }),
          organisation_id: 'system'
        })
      );
    });

    it('should allow WW Admin to get system configuration', async () => {
      // First set a config
      await wwAdminService.updateSystemConfiguration(mockWWAdmin, 'test_key', 'test_value');
      
      const config = await wwAdminService.getSystemConfiguration(mockWWAdmin, 'test_key');
      expect(config).toBe('test_value');
    });

    it('should deny non-WW Admin system configuration access', async () => {
      await expect(wwAdminService.updateSystemConfiguration(mockProjectAdmin, 'key', 'value'))
        .rejects.toThrow('Unauthorized: Only WW Admins can modify system configuration');

      await expect(wwAdminService.getSystemConfiguration(mockProjectAdmin))
        .rejects.toThrow('Unauthorized: Only WW Admins can access system configuration');
    });
  });

  describe('Model Management', () => {
    it('should allow WW Admin to sync model data', async () => {
      await wwAdminService.syncModelData(mockWWAdmin, 'species');

      expect(mockOfflineService.queueOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'CREATE_ORGANISATION',
          data: expect.objectContaining({
            model_type: 'species',
            sync_type: 'full_refresh',
            requested_by: mockWWAdmin.id
          }),
          organisation_id: 'system'
        })
      );
    });

    it('should sync different model types', async () => {
      const modelTypes: Array<'species' | 'brands' | 'device_models'> = ['species', 'brands', 'device_models'];

      for (const modelType of modelTypes) {
        await wwAdminService.syncModelData(mockWWAdmin, modelType);
      }

      expect(mockOfflineService.queueOperation).toHaveBeenCalledTimes(3);
    });

    it('should deny non-WW Admin model sync', async () => {
      await expect(wwAdminService.syncModelData(mockProjectAdmin, 'species'))
        .rejects.toThrow('Unauthorized: Only WW Admins can sync model data');
    });
  });

  describe('Service Cleanup', () => {
    it('should cleanup resources on destroy', async () => {
      await wwAdminService.destroy();

      expect(mockOfflineService.destroy).toHaveBeenCalled();
    });
  });
});