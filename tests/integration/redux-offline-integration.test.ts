/**
 * Redux-Offline Integration Tests
 * End-to-end tests for Redux store with offline functionality
 */

import { configureStore } from '@reduxjs/toolkit';
import syncReducer, { markEntityPending, markEntitySynced } from '../../src/store/slices/syncSlice';
import networkReducer, { networkOnline, networkOffline } from '../../src/store/slices/networkSlice';
import offlineReducer, { queueOfflineOperation } from '../../src/store/slices/offlineSlice';

// Mock dependencies
jest.mock('@react-native-community/netinfo');
jest.mock('../../src/services/offline/DatabaseService');
jest.mock('../../src/services/offline/OfflineService');

describe('Redux-Offline Integration', () => {
  let store: any;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        sync: syncReducer,
        network: networkReducer,
        offline: offlineReducer,
      },
    });
  });

  describe('Complete Offline Flow', () => {
    it('should handle complete offline to online sync flow', async () => {
      // 1. Start offline
      store.dispatch(networkOffline());
      expect(store.getState().network.isOnline).toBe(false);

      // 2. Queue operation while offline
      const operation = {
        type: 'CREATE_PROJECT' as const,
        entityType: 'projects',
        entityId: 'project-1',
        data: { name: 'Test Project' },
        userId: 'user-1',
        organisationId: 'org-1',
        priority: 800,
      };

      await store.dispatch(queueOfflineOperation(operation));

      // 3. Verify operation queued
      const state1 = store.getState();
      expect(state1.offline.stats.totalQueued).toBe(1);
      expect(state1.sync.entities.projects['project-1'].status).toBe('pending');

      // 4. Go online
      store.dispatch(
        networkOnline({
          connectionType: 'wifi',
          isInternetReachable: true,
        })
      );

      expect(store.getState().network.isOnline).toBe(true);

      // 5. Mark as synced (simulating successful sync)
      store.dispatch(
        markEntitySynced({
          entityType: 'projects',
          entityId: 'project-1',
        })
      );

      // 6. Verify final state
      const finalState = store.getState();
      expect(finalState.sync.entities.projects['project-1'].status).toBe('synced');
      expect(finalState.sync.overall).toBe('synced');
    });

    it('should handle multiple entities with different sync states', () => {
      // Queue multiple operations
      store.dispatch(
        markEntityPending({ entityType: 'projects', entityId: 'project-1' })
      );
      store.dispatch(
        markEntityPending({ entityType: 'projects', entityId: 'project-2' })
      );
      store.dispatch(
        markEntityPending({ entityType: 'deployments', entityId: 'deploy-1' })
      );

      let state = store.getState();
      expect(state.sync.queue.pending).toBe(3);

      // Sync first project
      store.dispatch(
        markEntitySynced({ entityType: 'projects', entityId: 'project-1' })
      );

      state = store.getState();
      expect(state.sync.queue.pending).toBe(2);
      expect(state.sync.entities.projects['project-1'].status).toBe('synced');
      expect(state.sync.entities.projects['project-2'].status).toBe('pending');

      // Sync deployment
      store.dispatch(
        markEntitySynced({ entityType: 'deployments', entityId: 'deploy-1' })
      );

      state = store.getState();
      expect(state.sync.queue.pending).toBe(1);

      // Sync last project
      store.dispatch(
        markEntitySynced({ entityType: 'projects', entityId: 'project-2' })
      );

      state = store.getState();
      expect(state.sync.queue.pending).toBe(0);
      expect(state.sync.overall).toBe('synced');
    });
  });

  describe('Network State Management', () => {
    it('should track network state changes', () => {
      // Start offline
      store.dispatch(networkOffline());
      expect(store.getState().network.isOnline).toBe(false);

      // Go online with wifi
      store.dispatch(
        networkOnline({
          connectionType: 'wifi',
          isInternetReachable: true,
        })
      );

      let state = store.getState();
      expect(state.network.isOnline).toBe(true);
      expect(state.network.connectionType).toBe('wifi');
      expect(state.network.lastOnline).toBeTruthy();

      // Go back offline
      store.dispatch(networkOffline());

      state = store.getState();
      expect(state.network.isOnline).toBe(false);
      expect(state.network.connectionType).toBe('none');
    });
  });

  describe('Sync Status Tracking', () => {
    it('should track overall sync status correctly', () => {
      expect(store.getState().sync.overall).toBe('synced');

      // Add pending operation
      store.dispatch(
        markEntityPending({ entityType: 'projects', entityId: 'project-1' })
      );
      expect(store.getState().sync.overall).toBe('pending');

      // Mark as synced
      store.dispatch(
        markEntitySynced({ entityType: 'projects', entityId: 'project-1' })
      );
      expect(store.getState().sync.overall).toBe('synced');
    });

    it('should track last sync timestamp', () => {
      expect(store.getState().sync.lastSync).toBeNull();

      store.dispatch(
        markEntityPending({ entityType: 'projects', entityId: 'project-1' })
      );
      store.dispatch(
        markEntitySynced({ entityType: 'projects', entityId: 'project-1' })
      );

      expect(store.getState().sync.lastSync).toBeTruthy();
    });
  });
});