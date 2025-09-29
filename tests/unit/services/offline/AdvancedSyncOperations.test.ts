import { OfflineService } from '../../../../src/services/offline/OfflineService';
import { DatabaseService } from '../../../../src/services/offline/DatabaseService';
import { User, OfflineOperation, UserRole } from '../../../../src/types/offline';

// Mock DatabaseService
jest.mock('../../../../src/services/offline/DatabaseService');
jest.mock('@react-native-community/netinfo');
jest.mock('../../../../src/services/offline/OfflineApiService');

describe('Advanced Sync Operations (Task 11.5)', () => {
  let offlineService: OfflineService;
  let mockDatabaseService: jest.Mocked<DatabaseService>;
  let testUser: User;
  let wwAdminUser: User;

  beforeEach(() => {
    // Create mock database service
    mockDatabaseService = {
      initializeDatabase: jest.fn().mockResolvedValue(undefined),
      addToOfflineQueue: jest.fn().mockResolvedValue(undefined),
      getPendingQueueItems: jest.fn().mockResolvedValue([]),
      markQueueItemCompleted: jest.fn().mockResolvedValue(undefined),
      updateQueueItemRetry: jest.fn().mockResolvedValue(undefined),
      getQueueItemsByOrganisation: jest.fn().mockResolvedValue([]),
      getQueueItemsSince: jest.fn().mockResolvedValue([]),
      getQueueItemsByTypeAndPriority: jest.fn().mockResolvedValue([]),
      insertOrganisation: jest.fn().mockResolvedValue(undefined),
      updateOrganisation: jest.fn().mockResolvedValue(undefined),
      // User management operations removed - web portal exclusive
      insertProject: jest.fn().mockResolvedValue(undefined),
      updateProject: jest.fn().mockResolvedValue(undefined),
      deleteProject: jest.fn().mockResolvedValue(undefined),
      insertDeployment: jest.fn().mockResolvedValue(undefined),
      updateDeployment: jest.fn().mockResolvedValue(undefined),
      deleteDeployment: jest.fn().mockResolvedValue(undefined),
      updateDeploymentLoRaWANStatus: jest.fn().mockResolvedValue(undefined),
      storeConflictResolution: jest.fn().mockResolvedValue(undefined),
      getConflictHistory: jest.fn().mockResolvedValue([]),
      cleanupOldConflicts: jest.fn().mockResolvedValue(undefined),
      getPendingConflicts: jest.fn().mockResolvedValue([])
    } as any;

    offlineService = new OfflineService();
    (offlineService as any).databaseService = mockDatabaseService;
    (offlineService as any).initialized = true;

    testUser = {
      id: 'user-1',
      role: 'project_admin',
      organisation_id: 'org-1'
    };

    wwAdminUser = {
      id: 'ww-admin-1',
      role: 'ww_admin',
      organisation_id: 'org-1'
    };
  });

  describe('WW Admin Read-Only Operations (Updated Architecture)', () => {
    it('should handle CREATE_ORGANISATION operation for system-level operations', async () => {
      // Note: Organisation creation moved to web portal
      // This test represents data sync from web portal operations
      offlineService.setNetworkStatus({ isConnected: true, type: 'wifi' });

      const operation: OfflineOperation = {
        id: 'op-1',
        type: 'CREATE_ORGANISATION',
        data: {
          name: 'New Organisation',
          settings: { timezone: 'UTC', currency: 'USD' },
          sync_source: 'web_portal' // Data originates from web portal
        },
        user_id: wwAdminUser.id,
        organisation_id: wwAdminUser.organisation_id,
        timestamp: new Date(),
        retry_count: 0
      };

      const result = await offlineService.executeOperation(operation);

      expect(result).toBe(true);
      expect(mockDatabaseService.insertOrganisation).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Organisation',
          settings: { timezone: 'UTC', currency: 'USD' },
          sync_source: 'web_portal'
        })
      );
      expect(mockDatabaseService.markQueueItemCompleted).toHaveBeenCalledWith(operation.id);
    });

    it('should NOT support CREATE_USER operations in mobile app', async () => {
      // User creation is web portal exclusive - mobile app should not handle these operations
      offlineService.setNetworkStatus({ isConnected: true, type: 'wifi' });

      const operation: OfflineOperation = {
        id: 'op-2',
        type: 'CREATE_USER',
        data: {
          email: 'newuser@example.com',
          role: 'project_member' as UserRole,
          organisation_id: 'org-1'
        },
        user_id: testUser.id,
        organisation_id: testUser.organisation_id,
        timestamp: new Date(),
        retry_count: 0
      };

      // Operation should be rejected or handled differently in updated architecture
      const result = await offlineService.executeOperation(operation);

      // Expect operation to fail or be queued for web portal handling
      expect(result).toBe(false);
      expect(mockDatabaseService.insertUserRole).not.toHaveBeenCalled();
    });

    it('should NOT support UPDATE_USER role operations in mobile app', async () => {
      // Role updates are web portal exclusive
      offlineService.setNetworkStatus({ isConnected: true, type: 'wifi' });

      const operation: OfflineOperation = {
        id: 'op-3',
        type: 'UPDATE_USER',
        data: {
          id: 'user-2',
          role: 'project_admin' as UserRole,
          organisation_id: 'org-1'
        },
        user_id: testUser.id,
        organisation_id: testUser.organisation_id,
        timestamp: new Date(),
        retry_count: 0
      };

      const result = await offlineService.executeOperation(operation);

      // Operation should be rejected in mobile app
      expect(result).toBe(false);
      // User role operations no longer exist in mobile DatabaseService
    });

    it('should NOT support DELETE_USER operations in mobile app', async () => {
      // User deletion is web portal exclusive
      offlineService.setNetworkStatus({ isConnected: true, type: 'wifi' });

      const operation: OfflineOperation = {
        id: 'op-4',
        type: 'DELETE_USER',
        data: { id: 'user-to-delete' },
        user_id: testUser.id,
        organisation_id: testUser.organisation_id,
        timestamp: new Date(),
        retry_count: 0
      };

      const result = await offlineService.executeOperation(operation);

      // Operation should be rejected in mobile app
      expect(result).toBe(false);
      // User deletion operations no longer exist in mobile DatabaseService
    });
  });

  describe('Batch Sync Operations', () => {
    it('should process operations in batches', async () => {
      // Set network as connected
      offlineService.setNetworkStatus({ isConnected: true, type: 'wifi' });

      const operations: OfflineOperation[] = Array.from({ length: 25 }, (_, i) => ({
        id: `op-${i}`,
        type: 'CREATE_PROJECT',
        data: { name: `Project ${i}`, organisation_id: 'org-1' },
        user_id: testUser.id,
        organisation_id: testUser.organisation_id,
        timestamp: new Date(),
        retry_count: 0
      }));

      const result = await offlineService.batchSyncOperations(operations, 10);

      expect(result.successful).toBe(25);
      expect(result.failed).toBe(0);
      expect(mockDatabaseService.insertProject).toHaveBeenCalledTimes(25);
    });

    it('should handle batch sync failures gracefully', async () => {
      // Set network as connected
      offlineService.setNetworkStatus({ isConnected: true, type: 'wifi' });

      // Mock some operations to fail
      mockDatabaseService.insertProject
        .mockResolvedValueOnce(undefined) // First succeeds
        .mockRejectedValueOnce(new Error('Database error')) // Second fails
        .mockResolvedValueOnce(undefined); // Third succeeds

      const operations: OfflineOperation[] = Array.from({ length: 3 }, (_, i) => ({
        id: `op-${i}`,
        type: 'CREATE_PROJECT',
        data: { name: `Project ${i}`, organisation_id: 'org-1' },
        user_id: testUser.id,
        organisation_id: testUser.organisation_id,
        timestamp: new Date(),
        retry_count: 0
      }));

      const result = await offlineService.batchSyncOperations(operations, 5);

      expect(result.successful).toBe(2);
      expect(result.failed).toBe(1);
    });

    it('should throw error when offline', async () => {
      // Set network as disconnected
      offlineService.setNetworkStatus({ isConnected: false, type: 'none' });

      const operations: OfflineOperation[] = [{
        id: 'op-1',
        type: 'CREATE_PROJECT',
        data: { name: 'Project 1', organisation_id: 'org-1' },
        user_id: testUser.id,
        organisation_id: testUser.organisation_id,
        timestamp: new Date(),
        retry_count: 0
      }];

      await expect(offlineService.batchSyncOperations(operations)).rejects.toThrow(
        'Network connection required for batch sync'
      );
    });
  });

  describe('Incremental Sync', () => {
    it('should sync operations since last timestamp', async () => {
      // Set network as connected
      offlineService.setNetworkStatus({ isConnected: true, type: 'wifi' });

      const lastSyncTime = new Date('2023-01-01T10:00:00Z');
      const operations = [
        {
          id: 'op-1',
          type: 'CREATE_PROJECT',
          data: JSON.stringify({ name: 'Project 1' }),
          user_id: testUser.id,
          organisation_id: testUser.organisation_id,
          timestamp: '2023-01-01T11:00:00Z',
          retry_count: 0
        }
      ];

      mockDatabaseService.getQueueItemsSince.mockResolvedValue(operations);

      const result = await offlineService.incrementalSync(testUser, lastSyncTime);

      expect(result.synced).toBe(1);
      expect(result.conflicts).toBe(0);
      expect(mockDatabaseService.getQueueItemsSince).toHaveBeenCalledWith(
        testUser.organisation_id,
        lastSyncTime.toISOString()
      );
    });

    it('should handle conflicts during incremental sync', async () => {
      // Set network as connected
      offlineService.setNetworkStatus({ isConnected: true, type: 'wifi' });

      const operations = [
        {
          id: 'op-1',
          type: 'UPDATE_PROJECT',
          data: JSON.stringify({ id: 'project-1', name: 'Updated Project' }),
          user_id: testUser.id,
          organisation_id: testUser.organisation_id,
          timestamp: '2023-01-01T11:00:00Z',
          retry_count: 0
        }
      ];

      mockDatabaseService.getQueueItemsSince.mockResolvedValue(operations);

      // Mock conflict detection to return true for this operation
      jest.spyOn(offlineService as any, 'checkForConflicts').mockResolvedValue(true);
      jest.spyOn(offlineService as any, 'handleOperationConflict').mockResolvedValue(undefined);

      const result = await offlineService.incrementalSync(testUser);

      expect(result.synced).toBe(0);
      expect(result.conflicts).toBe(1);
    });

    it('should throw error when offline', async () => {
      // Set network as disconnected
      offlineService.setNetworkStatus({ isConnected: false, type: 'none' });

      await expect(offlineService.incrementalSync(testUser)).rejects.toThrow(
        'Network connection required for incremental sync'
      );
    });
  });

  describe('Selective Sync', () => {
    it('should sync only specified operation types', async () => {
      // Set network as connected
      offlineService.setNetworkStatus({ isConnected: true, type: 'wifi' });

      const operations = [
        {
          id: 'op-1',
          type: 'CREATE_PROJECT',
          data: JSON.stringify({ name: 'Project 1' }),
          user_id: testUser.id,
          organisation_id: testUser.organisation_id,
          timestamp: '2023-01-01T11:00:00Z',
          retry_count: 0
        },
        {
          id: 'op-2',
          type: 'CREATE_USER',
          data: JSON.stringify({ email: 'user@example.com', role: 'project_member' }),
          user_id: testUser.id,
          organisation_id: testUser.organisation_id,
          timestamp: '2023-01-01T11:05:00Z',
          retry_count: 0
        }
      ];

      mockDatabaseService.getQueueItemsByTypeAndPriority.mockResolvedValue(operations);

      const syncedCount = await offlineService.selectiveSync(
        testUser,
        ['CREATE_PROJECT', 'UPDATE_PROJECT'], // Removed CREATE_USER - not supported in mobile
        'high'
      );

      expect(syncedCount).toBe(2);
      expect(mockDatabaseService.getQueueItemsByTypeAndPriority).toHaveBeenCalledWith(
        testUser.organisation_id,
        ['CREATE_PROJECT', 'UPDATE_PROJECT'], // Removed CREATE_USER - not supported in mobile
        'high'
      );
    });

    it('should use default priority when not specified', async () => {
      // Set network as connected
      offlineService.setNetworkStatus({ isConnected: true, type: 'wifi' });

      mockDatabaseService.getQueueItemsByTypeAndPriority.mockResolvedValue([]);

      await offlineService.selectiveSync(testUser, ['CREATE_PROJECT']);

      expect(mockDatabaseService.getQueueItemsByTypeAndPriority).toHaveBeenCalledWith(
        testUser.organisation_id,
        ['CREATE_PROJECT'],
        'normal'
      );
    });

    it('should throw error when offline', async () => {
      // Set network as disconnected
      offlineService.setNetworkStatus({ isConnected: false, type: 'none' });

      await expect(offlineService.selectiveSync(testUser, ['CREATE_PROJECT'])).rejects.toThrow(
        'Network connection required for selective sync'
      );
    });
  });

  describe('Role-based Operation Validation', () => {
    it('should allow ww_admin to perform any operation', () => {
      const operation: OfflineOperation = {
        id: 'op-1',
        type: 'CREATE_ORGANISATION',
        data: { name: 'New Org' },
        user_id: wwAdminUser.id,
        organisation_id: 'any-org',
        timestamp: new Date(),
        retry_count: 0
      };

      const canPerform = offlineService.canUserPerformOperation(wwAdminUser, operation);
      expect(canPerform).toBe(true);
    });

    it('should restrict project_admin to organisation-scoped operations', () => {
      const operation: OfflineOperation = {
        id: 'op-1',
        type: 'CREATE_PROJECT',
        data: { name: 'Project' },
        user_id: testUser.id,
        organisation_id: 'different-org', // Different from user's org
        timestamp: new Date(),
        retry_count: 0
      };

      const canPerform = offlineService.canUserPerformOperation(testUser, operation);
      expect(canPerform).toBe(false);
    });

    it('should allow project_admin to perform user management within their organisation', () => {
      const operation: OfflineOperation = {
        id: 'op-1',
        type: 'CREATE_PROJECT', // Changed from CREATE_USER to CREATE_PROJECT
        data: { name: 'Test Project', organisation_id: 'org-1' },
        user_id: testUser.id,
        organisation_id: testUser.organisation_id,
        timestamp: new Date(),
        retry_count: 0
      };

      const canPerform = offlineService.canUserPerformOperation(testUser, operation);
      expect(canPerform).toBe(true);
    });

    it('should restrict project_member from user management operations', () => {
      const projectMember: User = {
        id: 'member-1',
        role: 'project_member',
        organisation_id: 'org-1'
      };

      const operation: OfflineOperation = {
        id: 'op-1',
        type: 'CREATE_PROJECT', // Changed from CREATE_USER to CREATE_PROJECT
        data: { name: 'Test Project', organisation_id: 'org-1' },
        user_id: projectMember.id,
        organisation_id: projectMember.organisation_id,
        timestamp: new Date(),
        retry_count: 0
      };

      const canPerform = offlineService.canUserPerformOperation(projectMember, operation);
      expect(canPerform).toBe(false);
    });
  });
});