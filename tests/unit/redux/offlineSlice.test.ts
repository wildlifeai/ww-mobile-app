// Redux Offline Slice Unit Tests
// Task 11.6: Testing offline state management integration

import { configureStore } from '@reduxjs/toolkit';
import offlineReducer, {
  setNetworkStatus,
  setSyncStatus,
  addPendingOperation,
  removePendingOperation,
  addConflict,
  removeConflict,
  resetOfflineState,
  selectNetworkStatus,
  selectSyncStatus,
  selectPendingOperationsCount,
  selectHasUnresolvedConflicts,
  selectHasOfflineData,
} from '../../../src/redux/slices/offlineSlice';
import { NetworkStatus, SyncStatus, OfflineOperation, ConflictResolution } from '../../../src/types/offline';

describe('Offline Redux Slice', () => {
  let store: any;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        offline: offlineReducer,
      },
    });
  });

  describe('Initial State', () => {
    test('should have correct initial state', () => {
      const state = store.getState().offline;
      
      expect(state.networkStatus).toEqual({
        isConnected: false,
        type: 'none'
      });
      
      expect(state.syncStatus).toEqual({
        is_syncing: false,
        pending_operations_count: 0,
        failed_operations_count: 0,
        sync_progress: 0,
        sync_errors: []
      });
      
      expect(state.pendingOperations).toEqual([]);
      expect(state.unresolvedConflicts).toEqual([]);
    });
  });

  describe('Network Status Actions', () => {
    test('should set network status to connected', () => {
      const networkStatus: NetworkStatus = {
        isConnected: true,
        type: 'wifi',
      };

      store.dispatch(setNetworkStatus(networkStatus));
      
      const state = store.getState().offline;
      expect(state.networkStatus).toEqual(networkStatus);
    });

    test('should set network status to disconnected', () => {
      const networkStatus: NetworkStatus = {
        isConnected: false,
        type: 'none',
      };

      store.dispatch(setNetworkStatus(networkStatus));
      
      const state = store.getState().offline;
      expect(state.networkStatus).toEqual(networkStatus);
    });
  });

  describe('Sync Status Actions', () => {
    test('should set sync status to syncing', () => {
      const syncStatus: SyncStatus = {
        is_syncing: true,
        pending_operations_count: 5,
        failed_operations_count: 0,
        sync_progress: 0.5,
        sync_errors: []
      };

      store.dispatch(setSyncStatus(syncStatus));
      
      const state = store.getState().offline;
      expect(state.syncStatus).toEqual(syncStatus);
    });

    test('should set sync status to completed', () => {
      const syncStatus: SyncStatus = {
        is_syncing: false,
        pending_operations_count: 0,
        failed_operations_count: 2,
        sync_progress: 1.0,
        sync_errors: ['Error 1', 'Error 2']
      };

      store.dispatch(setSyncStatus(syncStatus));
      
      const state = store.getState().offline;
      expect(state.syncStatus).toEqual(syncStatus);
    });
  });

  describe('Pending Operations Actions', () => {
    test('should add pending operation', () => {
      const operation: OfflineOperation = {
        id: 'op-1',
        operation_type: 'CREATE_PROJECT',
        table_name: 'projects',
        data: { name: 'Test Project' },
        timestamp: new Date(),
        user_id: 'user-1',
        organisation_id: 'org-1',
        status: 'pending'
      };

      store.dispatch(addPendingOperation(operation));
      
      const state = store.getState().offline;
      expect(state.pendingOperations).toHaveLength(1);
      expect(state.pendingOperations[0]).toEqual(operation);
    });

    test('should add multiple pending operations', () => {
      const operation1: OfflineOperation = {
        id: 'op-1',
        operation_type: 'CREATE_PROJECT',
        table_name: 'projects',
        data: { name: 'Project 1' },
        timestamp: new Date(),
        user_id: 'user-1',
        organisation_id: 'org-1',
        status: 'pending'
      };

      const operation2: OfflineOperation = {
        id: 'op-2',
        operation_type: 'UPDATE_DEPLOYMENT',
        table_name: 'deployments',
        data: { status: 'active' },
        timestamp: new Date(),
        user_id: 'user-1',
        organisation_id: 'org-1',
        status: 'pending'
      };

      store.dispatch(addPendingOperation(operation1));
      store.dispatch(addPendingOperation(operation2));
      
      const state = store.getState().offline;
      expect(state.pendingOperations).toHaveLength(2);
      expect(state.pendingOperations[0]).toEqual(operation1);
      expect(state.pendingOperations[1]).toEqual(operation2);
    });

    test('should remove pending operation by id', () => {
      const operation: OfflineOperation = {
        id: 'op-1',
        operation_type: 'CREATE_PROJECT',
        table_name: 'projects',
        data: { name: 'Test Project' },
        timestamp: new Date(),
        user_id: 'user-1',
        organisation_id: 'org-1',
        status: 'pending'
      };

      store.dispatch(addPendingOperation(operation));
      store.dispatch(removePendingOperation('op-1'));
      
      const state = store.getState().offline;
      expect(state.pendingOperations).toHaveLength(0);
    });
  });

  describe('Conflict Management Actions', () => {
    test('should add unresolved conflict', () => {
      const conflict: ConflictResolution = {
        id: 'conflict-1',
        operation_id: 'op-1',
        table_name: 'projects',
        local_version: { name: 'Local Project' },
        server_version: { name: 'Server Project' },
        conflict_type: 'data_conflict',
        detected_at: new Date(),
        needs_user_resolution: true
      };

      store.dispatch(addConflict(conflict));
      
      const state = store.getState().offline;
      expect(state.unresolvedConflicts).toHaveLength(1);
      expect(state.unresolvedConflicts[0]).toEqual(conflict);
    });

    test('should remove unresolved conflict by id', () => {
      const conflict: ConflictResolution = {
        id: 'conflict-1',
        operation_id: 'op-1',
        table_name: 'projects',
        local_version: { name: 'Local Project' },
        server_version: { name: 'Server Project' },
        conflict_type: 'data_conflict',
        detected_at: new Date(),
        needs_user_resolution: true
      };

      store.dispatch(addConflict(conflict));
      store.dispatch(removeConflict('conflict-1'));
      
      const state = store.getState().offline;
      expect(state.unresolvedConflicts).toHaveLength(0);
    });
  });

  describe('Clear Data Action', () => {
    test('should clear all offline data', () => {
      const operation: OfflineOperation = {
        id: 'op-1',
        operation_type: 'CREATE_PROJECT',
        table_name: 'projects',
        data: { name: 'Test Project' },
        timestamp: new Date(),
        user_id: 'user-1',
        organisation_id: 'org-1',
        status: 'pending'
      };

      const conflict: ConflictResolution = {
        id: 'conflict-1',
        operation_id: 'op-1',
        table_name: 'projects',
        local_version: { name: 'Local' },
        server_version: { name: 'Server' },
        conflict_type: 'data_conflict',
        detected_at: new Date(),
        needs_user_resolution: true
      };

      store.dispatch(addPendingOperation(operation));
      store.dispatch(addConflict(conflict));
      store.dispatch(resetOfflineState());
      
      const state = store.getState().offline;
      expect(state.pendingOperations).toHaveLength(0);
      expect(state.unresolvedConflicts).toHaveLength(0);
    });
  });

  describe('Selectors', () => {
    beforeEach(() => {
      // Set up test state
      const networkStatus: NetworkStatus = {
        isConnected: true,
        type: 'wifi',
      };

      const syncStatus: SyncStatus = {
        is_syncing: false,
        pending_operations_count: 1,
        failed_operations_count: 1,
        sync_progress: 1.0,
        sync_errors: ['Test error']
      };

      const operation: OfflineOperation = {
        id: 'op-1',
        operation_type: 'CREATE_PROJECT',
        table_name: 'projects',
        data: { name: 'Test' },
        timestamp: new Date(),
        user_id: 'user-1',
        organisation_id: 'org-1',
        status: 'pending'
      };

      const conflict: ConflictResolution = {
        id: 'conflict-1',
        operation_id: 'op-1',
        table_name: 'projects',
        local_version: { name: 'Local' },
        server_version: { name: 'Server' },
        conflict_type: 'data_conflict',
        detected_at: new Date(),
        needs_user_resolution: true
      };

      store.dispatch(setNetworkStatus(networkStatus));
      store.dispatch(setSyncStatus(syncStatus));
      store.dispatch(addPendingOperation(operation));
      store.dispatch(addConflict(conflict));
    });

    test('should select network status', () => {
      const state = store.getState();
      const networkStatus = selectNetworkStatus(state);
      
      expect(networkStatus.isConnected).toBe(true);
      expect(networkStatus.type).toBe('wifi');
    });

    test('should select sync status', () => {
      const state = store.getState();
      const syncStatus = selectSyncStatus(state);
      
      expect(syncStatus.is_syncing).toBe(false);
      expect(syncStatus.sync_progress).toBe(1.0);
      expect(syncStatus.failed_operations_count).toBe(1);
    });

    test('should select pending operations count', () => {
      const state = store.getState();
      const count = selectPendingOperationsCount(state);
      
      expect(count).toBe(1);
    });

    test('should select has unresolved conflicts', () => {
      const state = store.getState();
      const hasConflicts = selectHasUnresolvedConflicts(state);
      
      expect(hasConflicts).toBe(true);
    });

    test('should select has offline data', () => {
      const state = store.getState();
      const hasData = selectHasOfflineData(state);
      
      expect(hasData).toBe(true);
    });

    test('should return false for has offline data when no data exists', () => {
      store.dispatch(resetOfflineState());
      
      const state = store.getState();
      const hasData = selectHasOfflineData(state);
      
      expect(hasData).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    test('should handle removing non-existent pending operation', () => {
      store.dispatch(removePendingOperation('non-existent'));
      
      const state = store.getState().offline;
      expect(state.pendingOperations).toHaveLength(0);
    });

    test('should handle removing non-existent conflict', () => {
      store.dispatch(removeConflict('non-existent'));
      
      const state = store.getState().offline;
      expect(state.unresolvedConflicts).toHaveLength(0);
    });

    test('should handle adding duplicate operation IDs', () => {
      const operation1: OfflineOperation = {
        id: 'op-1',
        operation_type: 'CREATE_PROJECT',
        table_name: 'projects',
        data: { name: 'First' },
        timestamp: new Date('2024-01-01T00:00:00Z'),
        user_id: 'user-1',
        organisation_id: 'org-1',
        status: 'pending'
      };

      const operation2: OfflineOperation = {
        id: 'op-1',
        operation_type: 'CREATE_PROJECT', 
        table_name: 'projects',
        data: { name: 'Second' },
        timestamp: new Date('2024-01-02T00:00:00Z'),
        user_id: 'user-1',
        organisation_id: 'org-1',
        status: 'pending'
      };

      store.dispatch(addPendingOperation(operation1));
      store.dispatch(addPendingOperation(operation2));
      
      const state = store.getState().offline;
      // Implementation adds both operations (doesn't replace)
      expect(state.pendingOperations).toHaveLength(2);
      expect(state.pendingOperations[0].data.name).toBe('First');
      expect(state.pendingOperations[1].data.name).toBe('Second');
    });
  });
});