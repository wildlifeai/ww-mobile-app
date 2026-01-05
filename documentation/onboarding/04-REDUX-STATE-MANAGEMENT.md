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

**Location**: `src/redux/index.ts`

```typescript
const store = configureStore({
  reducer: {
    // RTK Query APIs
    [api.reducerPath]: api.reducer,
    
    // Feature slices
    authentication: authReducer,
    sync: syncReducer,          // Sync status
    network: networkReducer,
    deployment: deploymentReducer,
    wwAdmin: wwAdminReducer,
    androidPermissions: androidPermissionsReducer,
    // ... more slices
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST'],
      },
    })
    .concat(api.middleware),
})

// TypeScript types
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

// Typed hooks
export const useAppDispatch = () => useDispatch<AppDispatch>()
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector
```

## The Shift: Redux vs. WatermelonDB

**Crucial Architecture Change**: 
We have moved away from storing large data collections (like `projects`, `deployments`, `observations`) in Redux. 

| Feature | Old Architecture | New Architecture (WatermelonDB) |
|---------|------------------|---------------------------------|
| **Data Persistence** | SQLite + Redux Cache | WatermelonDB (SQLite) |
| **Data Access** | `useAppSelector(state => state.projects)` | `withObservables` or `useDatabase` |
| **Mutations** | Dispatch Thunk -> SQLite -> Redux | Direct DB Write -> Reactive UI Update |
| **Redux Role** | Everything | **Session** (Auth), **UI** (Modals), **Global Status** |

## Creating a Slice

### Example: UI State Slice

**Location**: `src/redux/slices/uiSlice.ts` (Conceptual)

Redux is perfect for ephemeral UI state that doesn't need to be in the database.

```typescript
interface UIState {
  theme: 'light' | 'dark';
  sidebarOpen: boolean;
  activeModal: string | null;
}

const initialState: UIState = {
  theme: 'light',
  sidebarOpen: false,
  activeModal: null,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleTheme: (state) => {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
    },
    setModal: (state, action: PayloadAction<string | null>) => {
      state.activeModal = action.payload;
    },
    closeModal: (state) => {
      state.activeModal = null;
    }
  },
});

export const { toggleTheme, setModal, closeModal } = uiSlice.actions;
export default uiSlice.reducer;
```

## Async Thunks

Async thunks are still used for operations that don't map directly to database writes, like Authentication.

### Example: Auth Thunk

```typescript
export const loginUser = createAsyncThunk(
  'auth/login',
  async (credentials: LoginCredentials, { rejectWithValue }) => {
    try {
      const client = getSupabaseClient();
      const { data, error } = await client.auth.signInWithPassword(credentials);
      if (error) throw error;
      return data.user;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);
```

### Using Thunks in Components

```typescript
const LoginScreen = () => {
  const dispatch = useAppDispatch();

  const handleLogin = async () => {
    try {
      await dispatch(loginUser({ email, password })).unwrap();
      // Navigation handled by auth state change
    } catch (error) {
      console.error('Login failed:', error);
    }
  };
};
```

## Selectors

Selectors are used to read from the Redux state.

### Basic Selectors

```typescript
export const selectIsAuthenticated = (state: RootState) => !!state.authentication.user;
export const selectTheme = (state: RootState) => state.ui.theme;
```

### Memoized Selectors (Reselect)

Useful for deriving data from Redux state (e.g., filtering a list *stored in Redux*, though lists are mostly in DB now).

```typescript
import { createSelector } from '@reduxjs/toolkit';

const selectItems = (state: RootState) => state.someList.items;
const selectFilter = (state: RootState) => state.someList.filter;

export const selectFilteredItems = createSelector(
  [selectItems, selectFilter],
  (items, filter) => items.filter(i => i.includes(filter))
);
```

## Middleware

### Sync Middleware

**Location**: `src/redux/middleware/offlineSyncMiddleware.ts`

Middleware listens for network changes to trigger the WatermelonDB sync engine.

```typescript
export const offlineSyncMiddleware: Middleware = (storeAPI) => (next) => (action) => {
  const result = next(action);

  // When network comes online, trigger sync
  if (action.type === 'network/setOnline') {
    SupabaseSyncService.sync(); 
  }

  return result;
};
```

## Complete Example: Project Creation Flow

### 1. Component (Direct DB Write)

The component interacts directly with WatermelonDB for data creation.

```typescript
// src/screens/ProjectCreateScreen.tsx
const handleSubmit = async (data) => {
  // Write directly to WatermelonDB
  await database.write(async () => {
    await projectsCollection.create(project => {
      project.name = data.name;
      project.description = data.description;
      project.organisation_id = currentOrgId;
    });
  });
  
  // Navigate back - WatermelonDB observers will update the list screen automatically
  navigation.goBack();
};
```

### 2. List Screen (Reactive)

The list screen observes the database. No Redux dispatch needed to fetch data.

```typescript
// src/screens/ProjectsList.tsx
const ProjectsList = ({ projects }) => (
  <FlatList data={projects} renderItem={...} />
);

// Connect to WatermelonDB
const enhance = withObservables([], () => ({
  projects: database.collections.get('projects').query().observe()
}));

export default enhance(ProjectsList);
```

### 3. Redux (UI State Only)

Redux is used if we want to filter this list in the UI.

```typescript
// src/redux/slices/projectsSlice.ts
const projectsSlice = createSlice({
  name: 'projects',
  initialState: { filter: '' },
  reducers: {
    setFilter: (state, action) => { state.filter = action.payload }
  }
});
```

## Best Practices

### DO:
✅ Use Redux for **global UI state** (modals, sidebars, themes).
✅ Use Redux for **session state** (user tokens, permissions).
✅ Use WatermelonDB for **domain data** (projects, observations).
✅ Use `withObservables` to connect components to data.

### DON'T:
❌ Duplicate WatermelonDB data into Redux.
❌ Use Redux for caching API responses (unless using RTK Query for non-DB data).
❌ Dispatch actions to "save" data (write to DB directly).

## Debugging

### Redux DevTools
Still useful for tracking auth state and UI interactions.

### WatermelonDB Flipper Plugin
Use Flipper to inspect the local SQLite database state.

## Next Steps

1. Explore [02-PROJECT-STRUCTURE.md](./02-PROJECT-STRUCTURE.md) to find Redux files
2. Study [03-OFFLINE-FIRST-ARCHITECTURE.md](./03-OFFLINE-FIRST-ARCHITECTURE.md) for offline patterns
3. Read [05-REACT-NATIVE-PATTERNS.md](./05-REACT-NATIVE-PATTERNS.md) for component patterns

## Resources

- [Redux Toolkit Documentation](https://redux-toolkit.js.org/)
- [WatermelonDB Documentation](https://watermelondb.dev/docs)
