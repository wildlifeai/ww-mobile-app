import { createListenerMiddleware, PayloadAction } from '@reduxjs/toolkit';
import { OfflineService } from '../../services/offline/OfflineService';
import { SyncService } from '../../services/offline/SyncService';
import { WWAdminOfflineService } from '../../services/offline/WWAdminOfflineService';
import {
  setNetworkStatus,
  setSyncStatus,
  setPendingOperations,
  addPendingOperation,
  setUnresolvedConflicts,
  setServicesInitialized,
  setOfflineError,
  enableOptimisticMode,
  disableOptimisticMode
} from '../slices/offlineSlice';
import { User, OfflineOperation } from '../../types/offline';

// Service instances (will be initialized on first use)
let offlineService: OfflineService | null = null;
let syncService: SyncService | null = null;
let wwAdminService: WWAdminOfflineService | null = null;

// Create listener middleware for offline functionality
export const offlineMiddleware = createListenerMiddleware();

/**
 * Initialize offline services
 */
async function initializeServices(): Promise<void> {
  if (!offlineService) {
    offlineService = new OfflineService();
    await offlineService.initialize();
  }
  
  if (!syncService) {
    syncService = new SyncService();
    await syncService.initialize();
  }
  
  if (!wwAdminService) {
    wwAdminService = new WWAdminOfflineService();
    await wwAdminService.initialize();
  }
}

/**
 * Get services (initialize if needed)
 */
async function getServices() {
  if (!offlineService || !syncService || !wwAdminService) {
    await initializeServices();
  }
  return { offlineService: offlineService!, syncService: syncService!, wwAdminService: wwAdminService! };
}

// Listen for network status changes and trigger sync
offlineMiddleware.startListening({
  actionCreator: setNetworkStatus,
  effect: async (action, listenerApi) => {
    const { networkStatus } = action.payload;
    const state = listenerApi.getState() as any;
    const currentUser = state.authentication?.user as User | undefined;

    if (networkStatus.isConnected && currentUser) {
      try {
        const { syncService } = await getServices();
        
        // Start sync process
        const syncStatus = await syncService.startSync(currentUser);
        listenerApi.dispatch(setSyncStatus(syncStatus));

        // Get updated operations and conflicts
        const pendingOps = await syncService.getService?.().getOperationsForSync(currentUser) || [];
        const conflicts = syncService.getUnresolvedConflicts();
        
        listenerApi.dispatch(setPendingOperations(pendingOps));
        listenerApi.dispatch(setUnresolvedConflicts(conflicts));

      } catch (error) {
        console.error('Failed to sync on network change:', error);
        listenerApi.dispatch(setOfflineError(`Sync failed: ${error.message}`));
      }
    }
  }
});

// Listen for application start and initialize services
offlineMiddleware.startListening({
  predicate: (action) => action.type === 'app/initialize',
  effect: async (action, listenerApi) => {
    try {
      await initializeServices();
      listenerApi.dispatch(setServicesInitialized(true));
      
      // Get initial network status
      const { offlineService } = await getServices();
      const networkStatus = offlineService.getNetworkStatus();
      listenerApi.dispatch(setNetworkStatus(networkStatus));

    } catch (error) {
      console.error('Failed to initialize offline services:', error);
      listenerApi.dispatch(setOfflineError(`Initialization failed: ${error.message}`));
    }
  }
});

// Listen for user login and load user-specific offline data
offlineMiddleware.startListening({
  predicate: (action) => action.type === 'authentication/loginSuccess',
  effect: async (action, listenerApi) => {
    const user = (action as PayloadAction<{ user: User }>).payload.user;
    
    try {
      const { offlineService } = await getServices();
      
      // Load user's pending operations
      const pendingOps = await offlineService.getOperationsForSync(user);
      listenerApi.dispatch(setPendingOperations(pendingOps));

    } catch (error) {
      console.error('Failed to load user offline data:', error);
      listenerApi.dispatch(setOfflineError(`Failed to load offline data: ${error.message}`));
    }
  }
});

// Listen for optimistic UI operations
offlineMiddleware.startListening({
  predicate: (action) => {
    // Listen for any Redux action that should trigger optimistic updates
    const optimisticActions = [
      'projects/createProject',
      'deployments/createDeployment',
      'deployments/updateDeployment'
    ];
    return optimisticActions.includes(action.type);
  },
  effect: async (action, listenerApi) => {
    const state = listenerApi.getState() as any;
    const isOffline = !state.offline.networkStatus.isConnected;
    const currentUser = state.authentication?.user as User;

    if (isOffline && currentUser) {
      try {
        // Enable optimistic mode temporarily
        listenerApi.dispatch(enableOptimisticMode());

        // Create offline operation from action
        const operation: OfflineOperation = {
          id: `${action.type}-${Date.now()}`,
          type: mapActionToOperationType(action.type),
          data: (action as PayloadAction<any>).payload,
          user_id: currentUser.id,
          organisation_id: currentUser.organisation_id,
          timestamp: new Date(),
          retry_count: 0
        };

        const { offlineService } = await getServices();
        await offlineService.queueOperation(operation);
        
        // Add to Redux state
        listenerApi.dispatch(addPendingOperation(operation));

        // Disable optimistic mode after a delay
        setTimeout(() => {
          listenerApi.dispatch(disableOptimisticMode());
        }, 1000);

      } catch (error) {
        console.error('Failed to queue optimistic operation:', error);
        listenerApi.dispatch(setOfflineError(`Failed to queue operation: ${error.message}`));
        listenerApi.dispatch(disableOptimisticMode());
      }
    }
  }
});

// Listen for manual sync requests
offlineMiddleware.startListening({
  actionCreator: { type: 'offline/triggerManualSync' } as any,
  effect: async (action, listenerApi) => {
    const state = listenerApi.getState() as any;
    const currentUser = state.authentication?.user as User;
    const isOnline = state.offline.networkStatus.isConnected;

    if (!isOnline) {
      listenerApi.dispatch(setOfflineError('Cannot sync while offline'));
      return;
    }

    if (!currentUser) {
      listenerApi.dispatch(setOfflineError('User not authenticated'));
      return;
    }

    try {
      const { syncService } = await getServices();
      const syncStatus = await syncService.startSync(currentUser);
      listenerApi.dispatch(setSyncStatus(syncStatus));

      // Update operations and conflicts after sync
      const pendingOps = await syncService.getService?.().getOperationsForSync(currentUser) || [];
      const conflicts = syncService.getUnresolvedConflicts();
      
      listenerApi.dispatch(setPendingOperations(pendingOps));
      listenerApi.dispatch(setUnresolvedConflicts(conflicts));

    } catch (error) {
      console.error('Manual sync failed:', error);
      listenerApi.dispatch(setOfflineError(`Manual sync failed: ${error.message}`));
    }
  }
});

// Listen for conflict resolution
offlineMiddleware.startListening({
  predicate: (action) => action.type === 'offline/resolveConflict',
  effect: async (action, listenerApi) => {
    const { conflictId, resolution } = (action as PayloadAction<{
      conflictId: string;
      resolution: 'server_wins' | 'local_wins' | 'merge';
    }>).payload;

    try {
      // TODO: Implement actual conflict resolution with services
      console.log(`Resolving conflict ${conflictId} with strategy: ${resolution}`);
      
      // For now, just remove from state
      // In full implementation, this would apply the resolution and sync
      
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
      listenerApi.dispatch(setOfflineError(`Failed to resolve conflict: ${error.message}`));
    }
  }
});

/**
 * Map Redux action types to offline operation types
 */
function mapActionToOperationType(actionType: string): any {
  const mapping: Record<string, any> = {
    'projects/createProject': 'CREATE_PROJECT',
    'projects/updateProject': 'UPDATE_PROJECT',
    'projects/deleteProject': 'DELETE_PROJECT',
    'deployments/createDeployment': 'CREATE_DEPLOYMENT',
    'deployments/updateDeployment': 'UPDATE_DEPLOYMENT',
    'deployments/deleteDeployment': 'DELETE_DEPLOYMENT'
  };

  return mapping[actionType] || 'UPDATE_PROJECT'; // Default fallback
}

/**
 * Cleanup services
 */
export async function cleanupOfflineServices(): Promise<void> {
  if (offlineService) {
    await offlineService.destroy();
    offlineService = null;
  }
  if (syncService) {
    await syncService.destroy();
    syncService = null;
  }
  if (wwAdminService) {
    await wwAdminService.destroy();
    wwAdminService = null;
  }
}

// Export service getters for direct access (when needed)
export const getOfflineService = async (): Promise<OfflineService> => {
  const { offlineService } = await getServices();
  return offlineService;
};

export const getSyncService = async (): Promise<SyncService> => {
  const { syncService } = await getServices();
  return syncService;
};

export const getWWAdminService = async (): Promise<WWAdminOfflineService> => {
  const { wwAdminService } = await getServices();
  return wwAdminService;
};