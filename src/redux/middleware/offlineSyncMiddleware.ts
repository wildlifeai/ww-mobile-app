/**
 * Offline Sync Middleware
 *
 * Features:
 * - Automatic sync when network becomes available
 * - Background sync with rate limiting
 * - Intelligent retry with exponential backoff
 * - Cancellation when network lost
 */

import { createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';
import NetInfo from '@react-native-community/netinfo';
import { networkOnline, networkOffline } from '../slices/networkSlice';
import { processOfflineQueue, loadQueueStatus } from '../slices/offlineSlice';
import { RootState } from '../index';

export const offlineSyncMiddleware = createListenerMiddleware();

/**
 * Initialize network monitoring
 * Listens for network state changes and dispatches appropriate actions
 */
export const initializeNetworkMonitoring = (dispatch: any) => {
  // Get initial network state
  NetInfo.fetch().then((state) => {
    if (state.isConnected && state.isInternetReachable) {
      dispatch(
        networkOnline({
          connectionType: state.type || 'unknown',
          isInternetReachable: true,
        })
      );
    } else {
      dispatch(networkOffline());
    }
  });

  // Listen for network changes
  return NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable) {
      dispatch(
        networkOnline({
          connectionType: state.type || 'unknown',
          isInternetReachable: state.isInternetReachable,
        })
      );
    } else {
      dispatch(networkOffline());
    }
  });
};

/**
 * Start background sync when network becomes available
 */
offlineSyncMiddleware.startListening({
  actionCreator: networkOnline,
  effect: async (action, listenerApi) => {
    console.log('🌐 Network online - starting background sync');

    // Unsubscribe to prevent multiple sync instances
    listenerApi.unsubscribe();

    // Load current queue status
    await listenerApi.dispatch(loadQueueStatus());

    // Start background sync loop
    const syncTask = listenerApi.fork(async (forkApi) => {
      let consecutiveErrors = 0;
      const MAX_CONSECUTIVE_ERRORS = 3;

      while (true) {
        try {
          const state = listenerApi.getState() as RootState;

          // Check if we should continue syncing
          if (!state.network.isOnline || state.network.offlineModeEnabled) {
            console.log('🚫 Sync stopped - network unavailable or offline mode enabled');
            break;
          }

          // Check if there are pending operations
          const pendingCount = state.offline.queue.operations.filter(
            (op) => op.retry_count < 5
          ).length;

          if (pendingCount === 0) {
            console.log('✅ Sync complete - no pending operations');
            break;
          }

          console.log(`📤 Syncing ${pendingCount} pending operations...`);

          // Process one batch
          const result = await forkApi.dispatch(processOfflineQueue()).unwrap();

          console.log(
            `✅ Batch processed: ${result.processed} succeeded, ${result.failed} failed, ${result.remaining} remaining`
          );

          // Reset error counter on success
          if (result.processed > 0) {
            consecutiveErrors = 0;
          }

          // Rate limiting - wait before next batch
          await forkApi.delay(1000); // 1 second between batches
        } catch (error: any) {
          consecutiveErrors++;
          console.error(`❌ Sync error (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}):`, error);

          // Stop if too many consecutive errors
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            console.error('🚫 Too many consecutive errors - stopping sync');
            break;
          }

          // Exponential backoff on errors
          const backoffDelay = Math.min(1000 * Math.pow(2, consecutiveErrors), 30000);
          await forkApi.delay(backoffDelay);
        }
      }

      console.log('🏁 Background sync completed');
    });

    // Wait for network to go offline or sync to complete
    await listenerApi.condition(
      (action, currentState, previousState) => {
        const state = currentState as RootState;
        return (
          !state.network.isOnline ||
          state.network.offlineModeEnabled ||
          state.offline.queue.operations.filter((op) => op.retry_count < 5).length === 0
        );
      }
    );

    // Cancel sync task if still running
    syncTask.cancel();

    // Re-enable listener
    listenerApi.subscribe();
  },
});

/**
 * Log when network goes offline
 */
offlineSyncMiddleware.startListening({
  actionCreator: networkOffline,
  effect: async (action, listenerApi) => {
    console.log('🔴 Network offline - sync paused');
    const state = listenerApi.getState() as RootState;
    const pendingCount = state.offline.queue.operations.filter(
      (op) => op.retry_count < 5
    ).length;

    if (pendingCount > 0) {
      console.log(`📦 ${pendingCount} operations queued for sync when online`);
    }
  },
});
