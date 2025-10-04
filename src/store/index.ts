/**
 * Redux Store Configuration
 * Configures the Redux store with offline-first middleware and state persistence
 */

import { configureStore, createListenerMiddleware } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';

// Import slices
import syncReducer from './slices/syncSlice';
import offlineReducer from './slices/offlineSlice';
import networkReducer from './slices/networkSlice';

// Import API slices
import { projectsApi } from './api/projectsApi';

// Import middleware
import { offlineSyncMiddleware } from './middleware/offlineSyncMiddleware';

// Import OfflineApiService for cache invalidation setup
import { OfflineApiService } from '../services/offline/OfflineApiService';

/**
 * Configure Redux store with offline-first architecture
 */
export const store = configureStore({
  reducer: {
    sync: syncReducer,
    offline: offlineReducer,
    network: networkReducer,
    // RTK Query API slices
    [projectsApi.reducerPath]: projectsApi.reducer,
    // Future slices:
    // auth: authReducer,
    // deployments: deploymentsReducer,
    // devices: devicesReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types for Date objects in offline operations
        ignoredActions: ['offline/queueOperation', 'offline/processQueue'],
        // Ignore these field paths in state
        ignoredPaths: ['offline.queue.operations'],
      },
    })
    .concat(projectsApi.middleware)
    .prepend(offlineSyncMiddleware.middleware),
});

// Setup cache invalidation callback for OfflineApiService
// This allows background sync operations to invalidate RTK Query cache
OfflineApiService.setCacheInvalidator((tags) => {
  store.dispatch(projectsApi.util.invalidateTags(tags));
});

// Export types for TypeScript
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Export typed hooks for use throughout the app
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;