/**
 * useOfflineSync Hook
 *
 * Provides offline sync functionality for components
 * Handles queuing operations and monitoring sync status
 */

import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../redux';
import {
  queueOfflineOperation,
  processOfflineQueue,
  selectQueueOperations,
  selectIsProcessing,
  selectQueueStats,
  selectPendingCount,
  OPERATION_PRIORITY,
} from '../redux/slices/offlineSlice';
import {
  selectOverallSyncStatus,
  selectQueueStatus,
  selectEntitySyncStatus,
} from '../redux/slices/syncSlice';
import { selectIsOnline, selectCanSync } from '../redux/slices/networkSlice';
import { OfflineOperationType } from '../types/offline';

export const useOfflineSync = () => {
  const dispatch = useAppDispatch();

  // Network state
  const isOnline = useAppSelector(selectIsOnline);
  const canSync = useAppSelector(selectCanSync);

  // Sync state
  const overallSyncStatus = useAppSelector(selectOverallSyncStatus);
  const queueStatus = useAppSelector(selectQueueStatus);
  const queueStats = useAppSelector(selectQueueStats);
  const pendingCount = useAppSelector(selectPendingCount);
  const isProcessing = useAppSelector(selectIsProcessing);

  /**
   * Queue an offline operation
   */
  const queueOperation = useCallback(
    async (params: {
      type: OfflineOperationType;
      entityType: string;
      entityId: string;
      data: any;
      userId: string;
      organisationId: string;
      priority?: number;
    }) => {
      const result = await dispatch(queueOfflineOperation(params));
      return result;
    },
    [dispatch]
  );

  /**
   * Manually trigger sync
   */
  const triggerSync = useCallback(async () => {
    if (!canSync) {
      throw new Error('Cannot sync: network unavailable or offline mode enabled');
    }
    const result = await dispatch(processOfflineQueue());
    return result;
  }, [dispatch, canSync]);

  /**
   * Get sync status for a specific entity
   */
  const getEntitySyncStatus = useCallback(
    (entityType: 'projects' | 'deployments' | 'devices' | 'organisations', entityId: string) => {
      return selectEntitySyncStatus(
        { sync: { entities: { [entityType]: {} } } } as any,
        entityType,
        entityId
      );
    },
    []
  );

  return {
    // Network state
    isOnline,
    canSync,

    // Sync state
    syncStatus: overallSyncStatus,
    queueStatus,
    queueStats,
    pendingCount,
    isProcessing,

    // Actions
    queueOperation,
    triggerSync,
    getEntitySyncStatus,

    // Priority constants
    PRIORITY: OPERATION_PRIORITY,
  };
};

export default useOfflineSync;