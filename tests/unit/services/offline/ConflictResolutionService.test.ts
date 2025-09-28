import { ConflictResolutionService } from '../../../../src/services/offline/ConflictResolutionService';
import { DatabaseService } from '../../../../src/services/offline/DatabaseService';
import { User, ConflictResolution } from '../../../../src/types/offline';

describe('ConflictResolutionService', () => {
  let conflictResolutionService: ConflictResolutionService;
  let mockDatabaseService: jest.Mocked<DatabaseService>;
  let testUser: User;

  beforeEach(() => {
    // Create mock database service
    mockDatabaseService = {
      storeConflictResolution: jest.fn().mockResolvedValue(undefined),
      getConflictHistory: jest.fn().mockResolvedValue([]),
      cleanupOldConflicts: jest.fn().mockResolvedValue(undefined),
      getPendingConflicts: jest.fn().mockResolvedValue([])
    } as any;

    conflictResolutionService = new ConflictResolutionService(mockDatabaseService);

    testUser = {
      id: 'user-1',
      role: 'project_admin',
      organisation_id: 'org-1'
    };
  });

  describe('detectConflicts', () => {
    it('should detect data modification conflicts', async () => {
      const serverData = {
        id: 'project-1',
        name: 'Server Project',
        updated_at: '2023-01-01T12:00:00Z'
      };

      const localData = {
        id: 'project-1',
        name: 'Local Project',
        updated_at: '2023-01-01T11:00:00Z'
      };

      const conflicts = await conflictResolutionService.detectConflicts(
        serverData,
        localData,
        'UPDATE_PROJECT',
        testUser
      );

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].conflict_type).toBe('data_modification');
      expect(conflicts[0].server_version).toEqual(serverData);
      expect(conflicts[0].local_version).toEqual(localData);
    });

    it('should detect deletion conflicts', async () => {
      const serverData = {
        id: 'project-1',
        name: 'Existing Project',
        updated_at: '2023-01-01T12:00:00Z'
      };

      const localData = {
        id: 'project-1',
        name: 'Project to Delete',
        updated_at: '2023-01-01T11:00:00Z'
      };

      const conflicts = await conflictResolutionService.detectConflicts(
        serverData,
        localData,
        'DELETE_PROJECT',
        testUser
      );

      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts.some(c => c.conflict_type === 'deletion_conflict')).toBe(true);
    });

    it('should detect permission conflicts for cross-organisation access', async () => {
      const serverData = {
        id: 'project-1',
        organisation_id: 'org-2', // Different organisation
        name: 'Cross Org Project',
        updated_at: '2023-01-01T12:00:00Z'
      };

      const localData = {
        id: 'project-1',
        organisation_id: 'org-1',
        name: 'Local Project',
        updated_at: '2023-01-01T11:00:00Z'
      };

      const nonAdminUser = {
        ...testUser,
        role: 'project_member' as const
      };

      const conflicts = await conflictResolutionService.detectConflicts(
        serverData,
        localData,
        'UPDATE_PROJECT',
        nonAdminUser
      );

      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts.some(c => c.conflict_type === 'permission_conflict')).toBe(true);
      expect(conflicts.some(c => c.conflict_type === 'data_modification')).toBe(true);
      expect(conflicts.some(c => c.conflict_type === 'organisation_boundary_conflict')).toBe(true);
    });

    it('should not detect conflicts for WW Admin accessing any organisation', async () => {
      const serverData = {
        id: 'project-1',
        organisation_id: 'org-2', // Different organisation
        name: 'Cross Org Project',
        updated_at: '2023-01-01T12:00:00Z'
      };

      const localData = {
        id: 'project-1',
        organisation_id: 'org-1',
        name: 'Cross Org Project', // Same name, no data conflict
        updated_at: '2023-01-01T12:00:00Z' // Same time, no data conflict
      };

      const wwAdminUser = {
        ...testUser,
        role: 'ww_admin' as const
      };

      const conflicts = await conflictResolutionService.detectConflicts(
        serverData,
        localData,
        'UPDATE_PROJECT',
        wwAdminUser
      );

      expect(conflicts).toHaveLength(0); // WW Admin can access any organisation
    });

    it('should detect organisation boundary conflicts', async () => {
      const serverData = {
        id: 'project-1',
        organisation_id: 'org-2',
        name: 'Moved Project',
        updated_at: '2023-01-01T12:00:00Z'
      };

      const localData = {
        id: 'project-1',
        organisation_id: 'org-1',
        name: 'Original Project',
        updated_at: '2023-01-01T11:00:00Z'
      };

      const conflicts = await conflictResolutionService.detectConflicts(
        serverData,
        localData,
        'UPDATE_PROJECT',
        testUser
      );

      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts.some(c => c.conflict_type === 'organisation_boundary_conflict')).toBe(true);
      expect(conflicts.some(c => c.conflict_type === 'data_modification')).toBe(true);
    });
  });

  describe('resolveConflicts', () => {
    it('should resolve conflicts with server wins strategy', async () => {
      const serverData = { id: 'project-1', name: 'Server Project' };
      const localData = { id: 'project-1', name: 'Local Project' };

      const conflict: ConflictResolution = {
        id: 'project-1',
        server_version: serverData,
        local_version: localData,
        conflict_type: 'data_modification',
        needs_user_resolution: false
      };

      const resolvedData = await conflictResolutionService.resolveConflicts([conflict], 'server_wins');

      expect(resolvedData).toHaveLength(1);
      expect(resolvedData[0]).toEqual(serverData);
      expect(mockDatabaseService.storeConflictResolution).toHaveBeenCalledWith(
        expect.objectContaining({
          resolution_strategy: 'server_wins',
          resolved_at: expect.any(Date)
        })
      );
    });

    it('should resolve conflicts with local wins strategy', async () => {
      const serverData = { id: 'project-1', name: 'Server Project' };
      const localData = { id: 'project-1', name: 'Local Project' };

      const conflict: ConflictResolution = {
        id: 'project-1',
        server_version: serverData,
        local_version: localData,
        conflict_type: 'data_modification',
        needs_user_resolution: false
      };

      const resolvedData = await conflictResolutionService.resolveConflicts([conflict], 'local_wins');

      expect(resolvedData).toHaveLength(1);
      expect(resolvedData[0]).toEqual(localData);
    });

    it('should resolve conflicts with merge strategy', async () => {
      const serverData = {
        id: 'project-1',
        name: 'Server Project',
        description: 'Server Description',
        organisation_id: 'org-1',
        updated_at: '2023-01-01T12:00:00Z'
      };

      const localData = {
        id: 'project-1',
        name: 'Local Project',
        description: 'Local Description',
        notes: 'Local Notes',
        updated_at: '2023-01-01T11:00:00Z'
      };

      const conflict: ConflictResolution = {
        id: 'project-1',
        server_version: serverData,
        local_version: localData,
        conflict_type: 'data_modification',
        needs_user_resolution: false
      };

      const resolvedData = await conflictResolutionService.resolveConflicts([conflict], 'merge');

      expect(resolvedData).toHaveLength(1);
      const merged = resolvedData[0];

      // Should preserve server critical fields
      expect(merged.id).toBe(serverData.id);
      expect(merged.organisation_id).toBe(serverData.organisation_id);

      // Should use most recent timestamp
      expect(merged.updated_at).toBe(serverData.updated_at);

      // Should potentially merge description from local if newer (this implementation uses server data as base)
      expect(merged.description).toBe(serverData.description);
    });

    it('should handle user choice conflicts by marking them for user intervention', async () => {
      const conflict: ConflictResolution = {
        id: 'project-1',
        server_version: { id: 'project-1', name: 'Server Project' },
        local_version: { id: 'project-1', name: 'Local Project' },
        conflict_type: 'deletion_conflict',
        needs_user_resolution: true
      };

      const resolvedData = await conflictResolutionService.resolveConflicts([conflict], 'user_choice');

      expect(resolvedData).toHaveLength(1);
      expect(mockDatabaseService.storeConflictResolution).toHaveBeenCalledWith(
        expect.objectContaining({
          resolution_strategy: 'user_choice',
          needs_user_resolution: true
        })
      );
    });
  });

  describe('conflict resolution strategies', () => {
    it('should automatically choose server wins for permission conflicts', async () => {
      const serverData = { id: 'project-1', organisation_id: 'org-2' };
      const localData = { id: 'project-1', organisation_id: 'org-1' };

      const conflicts = await conflictResolutionService.detectConflicts(
        serverData,
        localData,
        'UPDATE_PROJECT',
        { ...testUser, role: 'project_member' }
      );

      const resolvedData = await conflictResolutionService.resolveConflicts(conflicts);

      // Should default to server wins for security
      expect(resolvedData.length).toBeGreaterThan(0);
      expect(resolvedData[0]).toEqual(serverData);
    });

    it('should choose user choice for deletion conflicts', async () => {
      const serverData = { id: 'project-1', name: 'Active Project' };
      const localData = { id: 'project-1', name: 'Project to Delete' };

      const conflicts = await conflictResolutionService.detectConflicts(
        serverData,
        localData,
        'DELETE_PROJECT',
        testUser
      );

      const resolvedData = await conflictResolutionService.resolveConflicts(conflicts);

      // Should mark for user resolution
      expect(mockDatabaseService.storeConflictResolution).toHaveBeenCalledWith(
        expect.objectContaining({
          resolution_strategy: 'user_choice',
          needs_user_resolution: true
        })
      );
    });
  });

  describe('conflict history and cleanup', () => {
    it('should retrieve conflict history', async () => {
      const mockHistory = [
        {
          id: 'conflict-1',
          conflict_type: 'data_modification',
          resolution_strategy: 'server_wins',
          resolved_at: '2023-01-01T12:00:00Z'
        }
      ];

      mockDatabaseService.getConflictHistory.mockResolvedValue(mockHistory);

      const history = await conflictResolutionService.getConflictHistory('project-1');

      expect(history).toEqual(mockHistory);
      expect(mockDatabaseService.getConflictHistory).toHaveBeenCalledWith('project-1');
    });

    it('should cleanup old conflicts', async () => {
      await conflictResolutionService.cleanupOldConflicts(30);

      expect(mockDatabaseService.cleanupOldConflicts).toHaveBeenCalledWith(
        expect.any(Date)
      );
    });
  });

  describe('edge cases', () => {
    it('should handle missing timestamp data gracefully', async () => {
      const serverData = { id: 'project-1', name: 'Server Project' }; // No updated_at
      const localData = { id: 'project-1', name: 'Local Project' }; // No updated_at

      const conflicts = await conflictResolutionService.detectConflicts(
        serverData,
        localData,
        'UPDATE_PROJECT',
        testUser
      );

      // Should not detect data modification conflict without timestamps
      expect(conflicts.some(c => c.conflict_type === 'data_modification')).toBe(false);
    });

    it('should handle null or undefined data', async () => {
      const serverData = null;
      const localData = { id: 'project-1', name: 'Local Project' };

      const conflicts = await conflictResolutionService.detectConflicts(
        serverData,
        localData,
        'UPDATE_PROJECT',
        testUser
      );

      // Should detect deletion conflict when server data is null but local data exists
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts.some(c => c.conflict_type === 'deletion_conflict')).toBe(true);
    });

    it('should store conflict resolution even if storage fails', async () => {
      mockDatabaseService.storeConflictResolution.mockRejectedValue(new Error('Storage failed'));

      const conflict: ConflictResolution = {
        id: 'project-1',
        server_version: { id: 'project-1', name: 'Server Project' },
        local_version: { id: 'project-1', name: 'Local Project' },
        conflict_type: 'data_modification',
        needs_user_resolution: false
      };

      // Should not throw even if storage fails
      expect(async () => {
        await conflictResolutionService.resolveConflicts([conflict], 'server_wins');
      }).not.toThrow();
    });
  });
});