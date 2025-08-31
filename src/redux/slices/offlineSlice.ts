import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { 
  SyncStatus, 
  NetworkStatus, 
  ConflictResolution, 
  OfflineOperation 
} from '../../types/offline';

// State interface for offline functionality
export interface OfflineState {
  // Network status
  networkStatus: NetworkStatus;
  
  // Sync status and progress
  syncStatus: SyncStatus;
  
  // Offline indicators
  isOfflineMode: boolean;
  hasOfflineData: boolean;
  
  // Pending operations queue
  pendingOperations: OfflineOperation[];
  
  // Conflict resolution
  unresolvedConflicts: ConflictResolution[];
  
  // UI state
  showOfflineIndicator: boolean;
  showSyncProgress: boolean;
  
  // Error handling
  lastError?: string;
  
  // Service initialization
  servicesInitialized: boolean;
}

// Initial state
const initialState: OfflineState = {
  networkStatus: {
    isConnected: false,
    type: 'none'
  },
  syncStatus: {
    is_syncing: false,
    pending_operations_count: 0,
    failed_operations_count: 0,
    sync_progress: 0,
    sync_errors: []
  },
  isOfflineMode: true,
  hasOfflineData: false,
  pendingOperations: [],
  unresolvedConflicts: [],
  showOfflineIndicator: true,
  showSyncProgress: false,
  servicesInitialized: false
};

// Offline slice
const offlineSlice = createSlice({
  name: 'offline',
  initialState,
  reducers: {
    // Network status management
    setNetworkStatus: (state, action: PayloadAction<NetworkStatus>) => {
      const wasOffline = !state.networkStatus.isConnected;
      state.networkStatus = action.payload;
      state.isOfflineMode = !action.payload.isConnected;
      
      // Show sync progress when coming online
      if (wasOffline && action.payload.isConnected && state.pendingOperations.length > 0) {
        state.showSyncProgress = true;
      }
      
      // Update offline indicator visibility
      state.showOfflineIndicator = !action.payload.isConnected;
    },

    // Sync status management
    setSyncStatus: (state, action: PayloadAction<SyncStatus>) => {
      state.syncStatus = action.payload;
      state.showSyncProgress = action.payload.is_syncing;
      
      // Hide sync progress when complete
      if (!action.payload.is_syncing && action.payload.sync_progress === 1.0) {
        state.showSyncProgress = false;
      }
    },

    updateSyncProgress: (state, action: PayloadAction<number>) => {
      state.syncStatus.sync_progress = action.payload;
    },

    // Offline operations management
    setPendingOperations: (state, action: PayloadAction<OfflineOperation[]>) => {
      state.pendingOperations = action.payload;
      state.hasOfflineData = action.payload.length > 0;
      state.syncStatus.pending_operations_count = action.payload.length;
    },

    addPendingOperation: (state, action: PayloadAction<OfflineOperation>) => {
      state.pendingOperations.push(action.payload);
      state.hasOfflineData = true;
      state.syncStatus.pending_operations_count = state.pendingOperations.length;
    },

    removePendingOperation: (state, action: PayloadAction<string>) => {
      state.pendingOperations = state.pendingOperations.filter(op => op.id !== action.payload);
      state.hasOfflineData = state.pendingOperations.length > 0;
      state.syncStatus.pending_operations_count = state.pendingOperations.length;
    },

    // Conflict resolution management
    setUnresolvedConflicts: (state, action: PayloadAction<ConflictResolution[]>) => {
      state.unresolvedConflicts = action.payload;
    },

    addConflict: (state, action: PayloadAction<ConflictResolution>) => {
      state.unresolvedConflicts.push(action.payload);
    },

    removeConflict: (state, action: PayloadAction<string>) => {
      state.unresolvedConflicts = state.unresolvedConflicts.filter(
        conflict => conflict.id !== action.payload
      );
    },

    resolveConflict: (state, action: PayloadAction<{
      id: string;
      resolution: 'server_wins' | 'local_wins' | 'merge';
    }>) => {
      const conflict = state.unresolvedConflicts.find(c => c.id === action.payload.id);
      if (conflict) {
        conflict.resolution_strategy = action.payload.resolution;
        conflict.needs_user_resolution = false;
        conflict.resolved_at = new Date();
      }
    },

    // UI state management
    setOfflineIndicatorVisibility: (state, action: PayloadAction<boolean>) => {
      state.showOfflineIndicator = action.payload;
    },

    setSyncProgressVisibility: (state, action: PayloadAction<boolean>) => {
      state.showSyncProgress = action.payload;
    },

    // Error handling
    setOfflineError: (state, action: PayloadAction<string>) => {
      state.lastError = action.payload;
      state.syncStatus.sync_errors = [...(state.syncStatus.sync_errors || []), action.payload];
    },

    clearOfflineError: (state) => {
      state.lastError = undefined;
    },

    clearSyncErrors: (state) => {
      state.syncStatus.sync_errors = [];
    },

    // Service initialization
    setServicesInitialized: (state, action: PayloadAction<boolean>) => {
      state.servicesInitialized = action.payload;
    },

    // Optimistic UI updates
    enableOptimisticMode: (state) => {
      state.isOfflineMode = false; // Temporarily show as online for optimistic updates
    },

    disableOptimisticMode: (state) => {
      state.isOfflineMode = !state.networkStatus.isConnected;
    },

    // Reset offline state
    resetOfflineState: (state) => {
      Object.assign(state, initialState);
    }
  }
});

// Action creators
export const {
  setNetworkStatus,
  setSyncStatus,
  updateSyncProgress,
  setPendingOperations,
  addPendingOperation,
  removePendingOperation,
  setUnresolvedConflicts,
  addConflict,
  removeConflict,
  resolveConflict,
  setOfflineIndicatorVisibility,
  setSyncProgressVisibility,
  setOfflineError,
  clearOfflineError,
  clearSyncErrors,
  setServicesInitialized,
  enableOptimisticMode,
  disableOptimisticMode,
  resetOfflineState
} = offlineSlice.actions;

// Selectors for easy access to offline state
export const selectNetworkStatus = (state: { offline: OfflineState }) => 
  state.offline.networkStatus;

export const selectIsOnline = (state: { offline: OfflineState }) => 
  state.offline.networkStatus.isConnected;

export const selectIsOffline = (state: { offline: OfflineState }) => 
  state.offline.isOfflineMode;

export const selectSyncStatus = (state: { offline: OfflineState }) => 
  state.offline.syncStatus;

export const selectIsSyncing = (state: { offline: OfflineState }) => 
  state.offline.syncStatus.is_syncing;

export const selectSyncProgress = (state: { offline: OfflineState }) => 
  state.offline.syncStatus.sync_progress;

export const selectPendingOperationsCount = (state: { offline: OfflineState }) => 
  state.offline.syncStatus.pending_operations_count;

export const selectHasOfflineData = (state: { offline: OfflineState }) => 
  state.offline.hasOfflineData;

export const selectPendingOperations = (state: { offline: OfflineState }) => 
  state.offline.pendingOperations;

export const selectUnresolvedConflicts = (state: { offline: OfflineState }) => 
  state.offline.unresolvedConflicts;

export const selectHasUnresolvedConflicts = (state: { offline: OfflineState }) => 
  state.offline.unresolvedConflicts.length > 0;

export const selectShowOfflineIndicator = (state: { offline: OfflineState }) => 
  state.offline.showOfflineIndicator;

export const selectShowSyncProgress = (state: { offline: OfflineState }) => 
  state.offline.showSyncProgress;

export const selectOfflineError = (state: { offline: OfflineState }) => 
  state.offline.lastError;

export const selectSyncErrors = (state: { offline: OfflineState }) => 
  state.offline.syncStatus.sync_errors;

export const selectServicesInitialized = (state: { offline: OfflineState }) => 
  state.offline.servicesInitialized;

// Organization-specific selectors
export const selectPendingOperationsByOrg = (organisationId: string) =>
  (state: { offline: OfflineState }) =>
    state.offline.pendingOperations.filter(op => op.organisation_id === organisationId);

export const selectConflictsByOrg = (organisationId: string) =>
  (state: { offline: OfflineState }) =>
    state.offline.unresolvedConflicts.filter(conflict => {
      const localVersion = conflict.local_version;
      return localVersion?.organisation_id === organisationId;
    });

// User role-based selectors
export const selectCanUserSync = (userRole: string) =>
  (state: { offline: OfflineState }) => {
    // All users can sync their own data
    return state.offline.servicesInitialized && state.offline.networkStatus.isConnected;
  };

export const selectUserOperations = (userId: string) =>
  (state: { offline: OfflineState }) =>
    state.offline.pendingOperations.filter(op => op.user_id === userId);

export default offlineSlice.reducer;