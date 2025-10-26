# Technology Stack Guide

Complete guide to the technologies powering Wildlife Watcher, with real examples from our codebase.

## Core Technologies

### React Native 0.74.5

**What it is**: Framework for building native mobile apps using React.

**Key Concepts for Web Developers**:
- Components render to native views (not DOM)
- Flexbox layout by default
- No CSS files - use StyleSheet API or inline styles
- Platform-specific code via Platform API

**Example from Our App**: src/App.tsx:1-54
```typescript
import { SafeAreaProvider } from "react-native-safe-area-context"
import { Provider as ReduxProvider } from "react-redux"
import store from "./redux"
import { MainNavigation } from "./navigation"

export const App = () => {
  return (
    <SafeAreaProvider>
      <ReduxProvider store={store}>
        <PaperProvider theme={CombinedDefaultTheme}>
          <NavigationContainer theme={CombinedDefaultTheme} linking={linking}>
            <AndroidPermissionsProvider>
              <AppSetupProvider>
                <BleEngineProvider>
                  <ListenToBleEngineProvider>
                    <AuthProvider>
                      <MainNavigation />
                    </AuthProvider>
                  </ListenToBleEngineProvider>
                </BleEngineProvider>
              </AppSetupProvider>
            </AndroidPermissionsProvider>
          </NavigationContainer>
        </PaperProvider>
      </ReduxProvider>
    </SafeAreaProvider>
  )
}
```

**Provider Pattern**: Notice the nested providers - this is the React Context pattern for sharing state/functionality throughout the app.

###
TypeScript ~5.3.3

**Why TypeScript**: Type safety catches bugs at compile time, improves IDE autocomplete, and serves as living documentation.

**Configuration**: `tsconfig.json` extends React Native defaults
```json
{
  "extends": "@react-native/typescript-config/tsconfig.json"
}
```

**Type Example from Our Codebase**: src/types/offline.ts
```typescript
export interface OfflineOperation {
  id: string;
  type: OfflineOperationType;
  data: any;
  user_id: string;
  organisation_id: string;
  timestamp: Date;
  retry_count: number;
  metadata?: {
    entityType: string;
    entityId: string;
    priority: number;
  };
}

export type OfflineOperationType =
  | 'CREATE_PROJECT'
  | 'UPDATE_PROJECT'
  | 'DELETE_PROJECT'
  | 'CREATE_DEPLOYMENT'
  | 'UPDATE_DEPLOYMENT'
  | 'DELETE_DEPLOYMENT'
  | 'UPDATE_DEVICE_LORAWAN_STATUS';
```

**Typed Hooks**: src/redux/index.ts:75-76
```typescript
export const useAppDispatch = () => useDispatch<AppDispatch>()
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector
```

### Expo SDK 51

**What it is**: Tools and libraries that make React Native development easier.

**Key Expo Modules We Use**:
- `expo-sqlite` - Local SQLite database
- `expo-location` - GPS access
- `expo-file-system` - File operations
- `expo-constants` - App configuration
- `expo-linking` - Deep linking support

**Example**: Using Expo SQLite - src/services/offline/DatabaseService.ts:92-100
```typescript
async initializeDatabase(): Promise<void> {
  try {
    this.db = await SQLite.openDatabaseAsync(this.DATABASE_NAME, {
      enableChangeListener: true
    });

    // Enable foreign key constraints
    await this.db.execAsync('PRAGMA foreign_keys = ON;');
    await this.db.execAsync('PRAGMA journal_mode = WAL;');

    await this.runMigrations();
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}
```

## State Management

### Redux Toolkit 2.2.1

**Why Redux Toolkit**: Simplifies Redux with less boilerplate, better TypeScript support, and built-in best practices.

**Store Configuration**: src/redux/index.ts:25-68
```typescript
const store = configureStore({
  reducer: {
    [api.reducerPath]: api.reducer,
    [enhancedApi.reducerPath]: enhancedApi.reducer,
    [projectsApi.reducerPath]: projectsApi.reducer,
    devices: devicesReducer,
    logs: logsReducer,
    configuration: configurationReducer,
    scanning: scanningReducer,
    bleLibrary: bleLibraryReducer,
    blStatus: blStatusReducer,
    locationStatus: locationStatusReducer,
    androidPermissions: androidPermissionsReducer,
    authentication: authReducer,
    projects: projectsReducer,
    deployments: deploymentsReducer,
    wwAdmin: wwAdminReducer,
    offline: offlineReducer,
    sync: syncReducer,
    network: networkReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', ...],
        ignoredPaths: ['offline.pendingOperations.timestamp', ...],
      },
    })
    .concat(api.middleware, enhancedApi.middleware, projectsApi.middleware, offlineSyncMiddleware.middleware),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
```

**Slice Example**: src/redux/slices/offlineSlice.ts:32-56
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
```

**Async Thunk Example**: src/redux/slices/offlineSlice.ts:75-123
```typescript
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
      dispatch(markEntityPending({
        entityType: operation.entityType as any,
        entityId: operation.entityId,
      }));

      return offlineOp;
    } catch (error: any) {
      return rejectWithValue({ error: error.message });
    }
  }
);
```

### RTK Query

**What it is**: Data fetching and caching built into Redux Toolkit.

**API Definition**: src/redux/api/index.ts:15-20
```typescript
export const api = createApi({
  reducerPath: "api",
  baseQuery: extendedBaseQuery,
  tagTypes: ["User", "Device", "Media", "Observation", "Project", "SensorRecord", "Deployment", "ApiLog"],
  endpoints: () => ({}),
})
```

**Benefits**:
- Automatic caching
- Request deduplication
- Optimistic updates
- Automatic re-fetching
- TypeScript code generation

## Database & Backend

### SQLite (expo-sqlite)

**Purpose**: Local offline data storage.

**Schema Example**: src/services/offline/DatabaseService.ts:157-283
```typescript
private async createTables(): Promise<void> {
  // Projects table with organisation scoping
  await this.db.execAsync(`
    CREATE TABLE IF NOT EXISTS local_projects (
      id TEXT PRIMARY KEY,
      organisation_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT CHECK(status IN ('active', 'inactive', 'completed')) DEFAULT 'active',
      members TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (organisation_id) REFERENCES local_organisations (id)
    );
  `);

  // Offline queue table for sync operations
  await this.db.execAsync(`
    CREATE TABLE IF NOT EXISTS offline_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation_type TEXT NOT NULL,
      data TEXT NOT NULL,
      organisation_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      priority TEXT CHECK(priority IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
      retry_count INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 3,
      status TEXT CHECK(status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create indexes for better query performance
  await this.db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_projects_org ON local_projects (organisation_id);
    CREATE INDEX IF NOT EXISTS idx_queue_status ON offline_queue (status);
    CREATE INDEX IF NOT EXISTS idx_queue_priority ON offline_queue (priority);
  `);
}
```

### Supabase (@supabase/supabase-js)

**What it is**: Open-source Firebase alternative providing PostgreSQL database, authentication, and storage.

**Client Setup**: src/services/supabase.ts
```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

**Typed Operations**: src/services/database.ts:16-56
```typescript
export const userOperations = {
  getCurrentProfile: async (): Promise<Tables<'users'> | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching user profile:', error);
      throw new Error(error.message);
    }

    return data;
  },

  createProfile: async (profileData: Omit<TablesInsert<'users'>, 'id'>): Promise<Tables<'users'>> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No authenticated user');

    const { data, error } = await supabase
      .from('users')
      .insert({
        id: user.id,
        ...profileData,
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return data;
  },
};
```

## Navigation

### React Navigation 6

**Stack Navigator**: src/navigation/index.tsx:61-62
```typescript
export const Stack = createNativeStackNavigator<RootStackParamList>()
```

**TypeScript Route Types**: src/navigation/index.tsx:33-52
```typescript
export interface RootStackParamList extends ParamListBase {
  CommunityDiscussion: undefined
  Notifications: undefined
  Profile: undefined
  Settings: undefined
  Home: undefined
  DeviceNavigator: { deviceId: string }
  Terminal: { deviceId: string }
  DfuScreen: { deviceId: string }
  Login: undefined
  Register: undefined
  ForgotPassword: undefined
  AddDeployment: { selectedProject?: Option } | undefined
  AddProject: undefined
  NewProjectScreen: undefined
  ProjectDetailsScreen: { projectId: string }
  ProjectMembersScreen: { projectId: string; projectName: string }
}

export type Routes = keyof RootStackParamList
```

**Navigation Usage in Components**:
```typescript
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const MyComponent = () => {
  const navigation = useNavigation<NavigationProp>();

  const goToProjectDetails = (projectId: string) => {
    navigation.navigate('ProjectDetailsScreen', { projectId });
  };
};
```

## UI Library

### React Native Paper 5.12.3

**Why Paper**: Material Design components for React Native with consistent theming.

**Theme Configuration**: src/theme.ts
```typescript
import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper'
import { DarkTheme as NavigationDarkTheme, DefaultTheme as NavigationDefaultTheme } from '@react-navigation/native'

export const CombinedDefaultTheme = {
  ...NavigationDefaultTheme,
  ...MD3LightTheme,
  colors: {
    ...NavigationDefaultTheme.colors,
    ...MD3LightTheme.colors,
  },
}
```

**Component Usage**:
```typescript
import { Button, Card, TextInput } from 'react-native-paper'

<Card>
  <Card.Title title="Project Name" />
  <Card.Content>
    <TextInput
      label="Email"
      value={email}
      onChangeText={setEmail}
      mode="outlined"
    />
    <Button mode="contained" onPress={handleSubmit}>
      Submit
    </Button>
  </Card.Content>
</Card>
```

## Network & Connectivity

### NetInfo (@react-native-community/netinfo)

**Purpose**: Monitor network connectivity for offline sync.

**Usage in OfflineService**: src/services/offline/OfflineService.ts:70-100
```typescript
private async setupNetworkMonitoring(): Promise<void> {
  // Get initial network state
  const initialState = await NetInfo.fetch();
  this.updateNetworkStatus(initialState);

  // Listen for network changes
  this.networkUnsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
    const wasOffline = !this.networkStatus.isConnected;
    this.updateNetworkStatus(state);
    const isNowOnline = this.networkStatus.isConnected;

    console.log('📡 ============ NETWORK STATE CHANGE ============');
    console.log('📡 Was offline:', wasOffline);
    console.log('📡 Is now online:', isNowOnline);

    // Trigger sync when coming online
    if (wasOffline && isNowOnline) {
      console.log('📡 🔄 TRANSITIONING FROM OFFLINE → ONLINE');
      this.syncPendingOperations().catch(error => {
        console.error('📡 ❌ Failed to sync pending operations:', error);
      });
    }
  });
}
```

## Hardware Integration

### Bluetooth (react-native-ble-manager)

**Purpose**: Communication with Wildlife Watcher cameras.

**Key Operations**:
- Device scanning and discovery
- Connect/disconnect
- Read/write characteristics
- Firmware updates (DFU)

## Development Tools

### Testing
- **Jest** - Unit testing framework
- **@testing-library/react-native** - Component testing
- **Maestro** - E2E UI testing

### Code Quality
- **ESLint** - Linting
- **Prettier** - Code formatting
- **TypeScript** - Static type checking

### Build & Deploy
- **EAS (Expo Application Services)** - Cloud builds for iOS and Android
- **Metro** - JavaScript bundler
- **Babel** - JavaScript transpiler

## Key Concepts Summary

### Component Lifecycle in React Native
Same as React web, but consider:
- App state (active, background, inactive)
- Memory constraints on mobile
- Native module initialization

### Styling Differences
```typescript
// StyleSheet API (recommended)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
});

// Usage
<View style={styles.container}>
  <Text style={styles.title}>Hello</Text>
</View>
```

### Performance Considerations
- **FlatList** for long lists (not ScrollView)
- **useMemo/useCallback** for expensive computations
- **React.memo** for component optimization
- **Hermes** JavaScript engine for faster startup

## Next Steps

1. Explore [02-PROJECT-STRUCTURE.md](./02-PROJECT-STRUCTURE.md) to understand code organization
2. Deep dive into [03-OFFLINE-FIRST-ARCHITECTURE.md](./03-OFFLINE-FIRST-ARCHITECTURE.md)
3. Learn Redux patterns in [04-REDUX-STATE-MANAGEMENT.md](./04-REDUX-STATE-MANAGEMENT.md)
4. Study React Native specifics in [05-REACT-NATIVE-PATTERNS.md](./05-REACT-NATIVE-PATTERNS.md)

## Additional Resources

- [React Native Documentation](https://reactnative.dev/docs/getting-started)
- [Expo Documentation](https://docs.expo.dev/)
- [Redux Toolkit Documentation](https://redux-toolkit.js.org/)
- [React Navigation Documentation](https://reactnavigation.org/)
- [Supabase Documentation](https://supabase.com/docs)
