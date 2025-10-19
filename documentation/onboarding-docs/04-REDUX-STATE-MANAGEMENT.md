# Redux State Management with Redux Toolkit

Comprehensive guide to Redux patterns used in Wildlife Watcher, with real examples from the codebase.

## Redux Toolkit Overview

**Why RTK**: Redux Toolkit simplifies Redux with less boilerplate, built-in best practices, and excellent TypeScript support.

**What we use**:
- `configureStore` - Store setup with good defaults
- `createSlice` - Combines actions + reducers
- `createAsyncThunk` - Async operations
- RTK Query - API integration with caching

## Store Configuration

**Location**: `src/redux/index.ts:25-76`

```typescript
const store = configureStore({
  reducer: {
    // RTK Query APIs
    [api.reducerPath]: api.reducer,
    [enhancedApi.reducerPath]: enhancedApi.reducer,
    [projectsApi.reducerPath]: projectsApi.reducer,

    // Feature slices
    devices: devicesReducer,
    authentication: authReducer,
    projects: projectsReducer,
    deployments: deploymentsReducer,
    offline: offlineReducer,
    sync: syncReducer,
    network: networkReducer,
    // ... more slices
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'offline/setNetworkStatus'],
        ignoredPaths: ['offline.pendingOperations.timestamp'],
      },
    })
    .concat(
      api.middleware,
      enhancedApi.middleware,
      projectsApi.middleware,
      offlineSyncMiddleware.middleware
    ),
})

// TypeScript types
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

// Typed hooks
export const useAppDispatch = () => useDispatch<AppDispatch>()
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector
```

**Key Points**:
- Each feature gets its own slice
- RTK Query APIs get their own reducers
- Middleware handles API calls and sync operations
- TypeScript types exported for use throughout app

## Creating a Slice

### Example: Offline Slice

**Location**: `src/redux/slices/offlineSlice.ts`

```typescript
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

const offlineSlice = createSlice({
  name: 'offline',
  initialState,
  reducers: {
    // Synchronous actions
    clearProcessedOperations: (state) => {
      state.queue.operations = state.queue.operations.filter(
        (op) => op.retry_count < 5
      );
    },

    resetOfflineState: (state) => {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    // Handle async thunk actions
    builder
      .addCase(queueOfflineOperation.fulfilled, (state, action) => {
        state.queue.operations.push(action.payload);
        state.stats.totalQueued++;
      })
      .addCase(processOfflineQueue.pending, (state) => {
        state.queue.processing = true;
      })
      .addCase(processOfflineQueue.fulfilled, (state, action) => {
        state.queue.processing = false;
        state.queue.lastProcessed = new Date().toISOString();
        state.stats.totalProcessed += action.payload.processed || 0;
      });
  },
});

// Export actions
export const { clearProcessedOperations, resetOfflineState } = offlineSlice.actions;

// Export reducer
export default offlineSlice.reducer;
```

**Anatomy**:
- `initialState` - Starting state shape
- `reducers` - Synchronous state updates
- `extraReducers` - Handle async thunk lifecycle (pending/fulfilled/rejected)
- Actions auto-generated from reducer names

## Async Thunks

### Basic Async Thunk

```typescript
export const queueOfflineOperation = createAsyncThunk(
  'offline/queueOperation',  // Action type prefix
  async (
    operation: {
      type: OfflineOperationType;
      entityType: string;
      entityId: string;
      data: any;
      userId: string;
      organisationId: string;
    },
    { dispatch, rejectWithValue }  // ThunkAPI
  ) => {
    try {
      // Perform async work
      const offlineOp: OfflineOperation = {
        id: `${operation.type}_${operation.entityId}_${Date.now()}`,
        type: operation.type,
        data: operation.data,
        // ... more fields
      };

      // Save to database
      await databaseService.queueOperation(offlineOp);

      // Dispatch other actions
      dispatch(markEntityPending({
        entityType: operation.entityType,
        entityId: operation.entityId,
      }));

      // Return value becomes action.payload
      return offlineOp;
    } catch (error: any) {
      // Error becomes action.error
      return rejectWithValue({ error: error.message });
    }
  }
);
```

**Thunk Lifecycle Actions**:
- `queueOfflineOperation.pending` - When thunk starts
- `queueOfflineOperation.fulfilled` - When thunk succeeds
- `queueOfflineOperation.rejected` - When thunk fails

### Using Thunks in Components

```typescript
import { useAppDispatch } from '../redux';
import { queueOfflineOperation, OPERATION_PRIORITY } from '../redux/slices/offlineSlice';

const MyComponent = () => {
  const dispatch = useAppDispatch();

  const handleCreateProject = async () => {
    // Dispatch async thunk
    const result = await dispatch(queueOfflineOperation({
      type: 'CREATE_PROJECT',
      entityType: 'project',
      entityId: newProject.id,
      data: newProject,
      userId: currentUser.id,
      organisationId: currentUser.organisationId,
      priority: OPERATION_PRIORITY.MEDIUM,
    }));

    // Check result
    if (queueOfflineOperation.fulfilled.match(result)) {
      console.log('Queued successfully:', result.payload);
    } else {
      console.error('Failed to queue:', result.error);
    }
  };
};
```

## Selectors

### Basic Selectors

```typescript
// src/redux/slices/offlineSlice.ts:293-297
export const selectQueueOperations = (state: RootState) => state.offline.queue.operations;
export const selectIsProcessing = (state: RootState) => state.offline.queue.processing;
export const selectQueueStats = (state: RootState) => state.offline.stats;
export const selectPendingCount = (state: RootState) =>
  state.offline.queue.operations.filter((op) => op.retry_count < 5).length;
```

### Using Selectors in Components

```typescript
import { useAppSelector } from '../redux';
import { selectQueueOperations, selectPendingCount } from '../redux/slices/offlineSlice';

const SyncStatusComponent = () => {
  const operations = useAppSelector(selectQueueOperations);
  const pendingCount = useAppSelector(selectPendingCount);
  const isProcessing = useAppSelector(state => state.offline.queue.processing);

  return (
    <View>
      <Text>Pending Operations: {pendingCount}</Text>
      {isProcessing && <ActivityIndicator />}
    </View>
  );
};
```

### Memoized Selectors (Reselect)

For expensive computations:

```typescript
import { createSelector } from '@reduxjs/toolkit';

// Input selectors
const selectProjects = (state: RootState) => state.projects.items;
const selectSearchTerm = (state: RootState) => state.projects.searchTerm;

// Memoized selector - only recomputes when inputs change
export const selectFilteredProjects = createSelector(
  [selectProjects, selectSearchTerm],
  (projects, searchTerm) => {
    if (!searchTerm) return projects;
    return projects.filter(p =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }
);
```

## RTK Query

### Defining an API

**Location**: `src/redux/api/index.ts`

```typescript
import { createApi } from "@reduxjs/toolkit/query/react"

export const api = createApi({
  reducerPath: "api",
  baseQuery: extendedBaseQuery,  // Custom base query with Supabase
  tagTypes: [
    "User",
    "Device",
    "Project",
    "Deployment",
  ],
  endpoints: () => ({}),  // Endpoints injected elsewhere
})
```

### Creating Endpoints

```typescript
// src/redux/api/projects/projectsEndpoints.ts (example)
import { api } from '../index';

export const projectsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getProjects: builder.query<Project[], void>({
      query: () => '/projects',
      providesTags: ['Project'],
    }),

    getProject: builder.query<Project, string>({
      query: (id) => `/projects/${id}`,
      providesTags: (result, error, id) => [{ type: 'Project', id }],
    }),

    createProject: builder.mutation<Project, ProjectCreate>({
      query: (project) => ({
        url: '/projects',
        method: 'POST',
        body: project,
      }),
      invalidatesTags: ['Project'],  // Refetch projects list
    }),

    updateProject: builder.mutation<Project, { id: string; data: ProjectUpdate }>({
      query: ({ id, data }) => ({
        url: `/projects/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Project', id }],
    }),
  }),
});

// Auto-generated hooks
export const {
  useGetProjectsQuery,
  useGetProjectQuery,
  useCreateProjectMutation,
  useUpdateProjectMutation,
} = projectsApi;
```

### Using RTK Query in Components

```typescript
import { useGetProjectsQuery, useCreateProjectMutation } from '../redux/api/projectsApi';

const ProjectsScreen = () => {
  // Query hook - auto-fetches and caches
  const { data: projects, isLoading, error, refetch } = useGetProjectsQuery();

  // Mutation hook
  const [createProject, { isLoading: isCreating }] = useCreateProjectMutation();

  const handleCreate = async () => {
    try {
      const newProject = await createProject({
        name: 'New Project',
        description: 'Test project',
      }).unwrap();  // unwrap() returns promise

      console.log('Created:', newProject);
    } catch (error) {
      console.error('Failed:', error);
    }
  };

  if (isLoading) return <ActivityIndicator />;
  if (error) return <Text>Error loading projects</Text>;

  return (
    <FlatList
      data={projects}
      onRefresh={refetch}
      refreshing={isLoading}
      renderItem={({ item }) => <ProjectCard project={item} />}
    />
  );
};
```

**Benefits**:
- Auto caching
- Automatic refetching
- Loading/error states built-in
- Optimistic updates support
- Request deduplication

## Middleware

### Custom Offline Sync Middleware

**Location**: `src/redux/middleware/offlineSyncMiddleware.ts`

```typescript
import { Middleware } from '@reduxjs/toolkit';

export const offlineSyncMiddleware: Middleware = (storeAPI) => (next) => (action) => {
  // Let action pass through first
  const result = next(action);

  // React to specific actions
  if (action.type === 'network/setOnline') {
    // Network came online - trigger sync
    storeAPI.dispatch(processOfflineQueue());
  }

  if (action.type.startsWith('offline/queueOperation')) {
    // Operation queued - check if we should sync
    const state = storeAPI.getState();
    if (state.network.isOnline && !state.offline.queue.processing) {
      storeAPI.dispatch(processOfflineQueue());
    }
  }

  return result;
};
```

**Usage in Store**:
```typescript
middleware: (getDefaultMiddleware) =>
  getDefaultMiddleware()
    .concat(offlineSyncMiddleware.middleware)
```

## Complete Example: Project Management Flow

### 1. Component Dispatches Action

```typescript
const ProjectCreateScreen = () => {
  const dispatch = useAppDispatch();
  const isOnline = useAppSelector(state => state.network.isOnline);

  const handleSubmit = async (projectData: ProjectCreate) => {
    if (isOnline) {
      // Try direct API call
      try {
        await dispatch(createProjectApi(projectData)).unwrap();
        navigation.goBack();
      } catch (error) {
        // Fallback to offline queue
        await dispatch(queueOfflineOperation({
          type: 'CREATE_PROJECT',
          data: projectData,
          // ...
        }));
      }
    } else {
      // Queue immediately
      await dispatch(queueOfflineOperation({
        type: 'CREATE_PROJECT',
        data: projectData,
        // ...
      }));
    }
  };
};
```

### 2. Thunk Saves to SQLite

```typescript
export const queueOfflineOperation = createAsyncThunk(
  'offline/queueOperation',
  async (operation, { dispatch }) => {
    // Save to local database
    await databaseService.insertProject(operation.data);
    await databaseService.queueOperation(operation);

    // Update sync state
    dispatch(markEntityPending({
      entityType: 'project',
      entityId: operation.data.id,
    }));

    return operation;
  }
);
```

### 3. Reducer Updates State

```typescript
extraReducers: (builder) => {
  builder.addCase(queueOfflineOperation.fulfilled, (state, action) => {
    state.queue.operations.push(action.payload);
    state.stats.totalQueued++;
  });
}
```

### 4. Component Re-renders

```typescript
const ProjectsList = () => {
  // Selector automatically triggers re-render when state changes
  const projects = useAppSelector(state => state.projects.items);

  return (
    <FlatList
      data={projects}
      renderItem={({ item }) => <ProjectCard project={item} />}
    />
  );
};
```

### 5. Network Returns → Middleware Triggers Sync

```typescript
// Middleware detects network change
if (action.type === 'network/setOnline') {
  storeAPI.dispatch(processOfflineQueue());
}
```

### 6. Sync Thunk Processes Queue

```typescript
export const processOfflineQueue = createAsyncThunk(
  'offline/processQueue',
  async (_, { dispatch, getState }) => {
    const operations = await databaseService.getPendingOperations();

    for (const operation of operations) {
      try {
        await offlineService.syncOperation(operation);
        await databaseService.markOperationProcessed(operation.id);

        dispatch(markEntitySynced({
          entityType: operation.metadata.entityType,
          entityId: operation.metadata.entityId,
        }));
      } catch (error) {
        // Handle error
      }
    }
  }
);
```

## Best Practices

### DO:
✅ Use typed hooks (`useAppDispatch`, `useAppSelector`)
✅ Organize state by feature (slices)
✅ Use async thunks for async operations
✅ Use RTK Query for API calls when appropriate
✅ Memoize expensive selectors
✅ Handle all thunk lifecycle states (pending/fulfilled/rejected)
✅ Keep reducers pure (no side effects)

### DON'T:
❌ Mutate state outside reducers (RTK allows immer mutations in reducers)
❌ Put functions/classes in state
❌ Dispatch actions inside reducers
❌ Access store directly (use hooks)
❌ Store derived data (compute with selectors)

## Debugging Redux

### Redux DevTools

```typescript
// Store automatically connects to Redux DevTools in development
const store = configureStore({
  reducer: rootReducer,
  // DevTools enabled by default
});
```

### Logging Middleware

```typescript
import { createLogger } from 'redux-logger';

const logger = createLogger({
  collapsed: true,
  diff: true,
});

// Add to middleware in development only
middleware: (getDefaultMiddleware) =>
  __DEV__
    ? getDefaultMiddleware().concat(logger)
    : getDefaultMiddleware()
```

### Console Logging

```typescript
// In components
const projects = useAppSelector(state => {
  console.log('Projects state:', state.projects);
  return state.projects.items;
});

// In thunks
console.log('Dispatching action with payload:', payload);
```

## Next Steps

1. Explore [02-PROJECT-STRUCTURE.md](./02-PROJECT-STRUCTURE.md) to find Redux files
2. Study [03-OFFLINE-FIRST-ARCHITECTURE.md](./03-OFFLINE-FIRST-ARCHITECTURE.md) for offline patterns
3. Read [05-REACT-NATIVE-PATTERNS.md](./05-REACT-NATIVE-PATTERNS.md) for component patterns

## Resources

- [Redux Toolkit Documentation](https://redux-toolkit.js.org/)
- [RTK Query Tutorial](https://redux-toolkit.js.org/tutorials/rtk-query)
- [Redux Style Guide](https://redux.js.org/style-guide/style-guide)
