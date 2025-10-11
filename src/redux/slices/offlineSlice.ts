/**
 * Offline Slice - Manages offline operation queue and processing
 *
 * Features:
 * - Operation queue management
 * - Priority-based operation ordering
 * - Retry logic with exponential backoff
 * - Operation deduplication
 * - Organisation-scoped operations
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { DatabaseService } from '../../services/offline/DatabaseService';
import { OfflineService } from '../../services/offline/OfflineService';
import { OfflineOperation, OfflineOperationType } from '../../types/offline';
import { RootState } from '../index';
import {
  markEntityPending,
  markEntitySyncing,
  markEntitySynced,
  markEntityError,
} from './syncSlice';

// Operation priority levels
export const OPERATION_PRIORITY = {
  CRITICAL: 1000, // Deployment end
  HIGH: 900, // Deployment start
  MEDIUM: 800, // Project updates
  LOW: 500, // Profile updates
};

export interface OfflineState {
  queue: {
    operations: OfflineOperation[];
    processing: boolean;
    lastProcessed: string | null;
  };
  stats: {
    totalQueued: number;
    totalProcessed: number;
    totalFailed: number;
  };
}

const initialState: OfflineState = {
  queue: {
    operations: [],
    processing: false,
    lastProcessed: null,
  },
  stats: {
    totalQueued: 0,
    totalProcessed: 0,
    totalFailed: 0,
  },
};

// Database service instance
let databaseService: DatabaseService;
let offlineService: OfflineService;

// Initialize services
const initializeServices = () => {
  if (!databaseService) {
    databaseService = new DatabaseService();
  }
  if (!offlineService) {
    offlineService = new OfflineService();
  }
};

/**
 * Queue an offline operation for later sync
 */
export const queueOfflineOperation = createAsyncThunk(
  'offline/queueOperation',
  async (
    operation: {
      type: OfflineOperationType;
      entityType: string;
      entityId: string;
      data: any;
      userId: string;
      organisationId: string;
      priority?: number;
    },
    { dispatch, rejectWithValue }
  ) => {
    try {
      initializeServices();

      const offlineOp: OfflineOperation = {
        id: `${operation.type}_${operation.entityId}_${Date.now()}`,
        type: operation.type,
        data: operation.data,
        user_id: operation.userId,
        organisation_id: operation.organisationId,
        timestamp: new Date(),
        retry_count: 0,
        metadata: {
          entityType: operation.entityType,
          entityId: operation.entityId,
          priority: operation.priority || OPERATION_PRIORITY.MEDIUM,
        },
      };

      // Save to SQLite queue
      await databaseService.queueOperation(offlineOp);

      // Mark entity as pending sync
      dispatch(
        markEntityPending({
          entityType: operation.entityType as any,
          entityId: operation.entityId,
        })
      );

      return offlineOp;
    } catch (error: any) {
      return rejectWithValue({ error: error.message });
    }
  }
);

/**
 * Process pending operations in the queue
 */
export const processOfflineQueue = createAsyncThunk(
  'offline/processQueue',
  async (_, { dispatch, getState, rejectWithValue }) => {
    try {
      initializeServices();

      const state = getState() as RootState;
      if (!state.network.isOnline || state.network.offlineModeEnabled) {
        return { processed: 0, message: 'Network unavailable' };
      }

      // Get pending operations from database
      const operations = await databaseService.getPendingOperations();

      if (operations.length === 0) {
        return { processed: 0, message: 'No pending operations' };
      }

      let processedCount = 0;
      let failedCount = 0;

      // Process operations in batches of 10
      const BATCH_SIZE = 10;
      const batch = operations.slice(0, BATCH_SIZE);

      for (const operation of batch) {
        const entityType = operation.metadata?.entityType;
        const entityId = operation.metadata?.entityId;

        // Mark as syncing
        if (entityType && entityId) {
          dispatch(
            markEntitySyncing({
              entityType: entityType as any,
              entityId,
            })
          );
        }

        try {
          // Process operation through OfflineService
          await offlineService.syncOperation(operation);

          // Mark as processed
          await databaseService.markOperationProcessed(operation.id);

          // Update sync status
          if (entityType && entityId) {
            dispatch(
              markEntitySynced({
                entityType: entityType as any,
                entityId,
              })
            );
          }

          processedCount++;
        } catch (error: any) {
          // Increment retry count
          const newRetryCount = operation.retry_count + 1;

          if (newRetryCount >= 5) {
            // Max retries reached, mark as failed
            await databaseService.markOperationFailed(operation.id, error.message);
            failedCount++;

            if (entityType && entityId) {
              dispatch(
                markEntityError({
                  entityType: entityType as any,
                  entityId,
                  error: error.message,
                })
              );
            }
          } else {
            // Update retry count
            await databaseService.incrementRetryCount(operation.id);
          }
        }
      }

      return {
        processed: processedCount,
        failed: failedCount,
        remaining: operations.length - batch.length,
      };
    } catch (error: any) {
      return rejectWithValue({ error: error.message });
    }
  }
);

/**
 * Load queue status from database
 */
export const loadQueueStatus = createAsyncThunk(
  'offline/loadQueueStatus',
  async (_, { rejectWithValue }) => {
    try {
      initializeServices();
      const operations = await databaseService.getPendingOperations();
      return {
        operations,
        count: operations.length,
      };
    } catch (error: any) {
      return rejectWithValue({ error: error.message });
    }
  }
);

const offlineSlice = createSlice({
  name: 'offline',
  initialState,
  reducers: {
    // Clear processed operations
    clearProcessedOperations: (state) => {
      state.queue.operations = state.queue.operations.filter(
        (op) => op.retry_count < 5
      );
    },

    // Reset offline state
    resetOfflineState: (state) => {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      // Queue operation
      .addCase(queueOfflineOperation.fulfilled, (state, action) => {
        state.queue.operations.push(action.payload);
        state.stats.totalQueued++;
      })
      .addCase(queueOfflineOperation.rejected, (state, action) => {
        console.error('Failed to queue operation:', action.payload);
      })

      // Process queue
      .addCase(processOfflineQueue.pending, (state) => {
        state.queue.processing = true;
      })
      .addCase(processOfflineQueue.fulfilled, (state, action) => {
        state.queue.processing = false;
        state.queue.lastProcessed = new Date().toISOString();
        state.stats.totalProcessed += action.payload.processed || 0;
        state.stats.totalFailed += action.payload.failed || 0;
      })
      .addCase(processOfflineQueue.rejected, (state, action) => {
        state.queue.processing = false;
        console.error('Failed to process queue:', action.payload);
      })

      // Load queue status
      .addCase(loadQueueStatus.fulfilled, (state, action) => {
        state.queue.operations = action.payload.operations;
      });
  },
});

// Export actions
export const { clearProcessedOperations, resetOfflineState } = offlineSlice.actions;

// Selectors
export const selectQueueOperations = (state: RootState) => state.offline.queue.operations;
export const selectIsProcessing = (state: RootState) => state.offline.queue.processing;
export const selectQueueStats = (state: RootState) => state.offline.stats;
export const selectPendingCount = (state: RootState) =>
  state.offline.queue.operations.filter((op) => op.retry_count < 5).length;

export default offlineSlice.reducer;
