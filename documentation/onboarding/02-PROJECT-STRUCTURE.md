# Project Structure Walkthrough

Navigate the Wildlife Watcher codebase like a pro. Understand where everything lives and why.

## Root Directory

```
wildlife-watcher-mobile-app/
├── src/                    # All application source code
├── tests/                  # Test files (unit, integration, e2e)
├── documentation/          # This documentation
├── project-context/        # Project specs, planning docs
├── android/                # Android native code (Expo generated)
├── ios/                    # iOS native code (Expo generated)
├── node_modules/           # Dependencies
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── app.json                # Expo configuration
├── babel.config.js         # Babel transpiler config
└── metro.config.js         # Metro bundler config
```

## Source Code (`src/`)

```
src/
├── App.tsx                 # Root component with providers
├── theme.ts                # App theming (React Native Paper + Navigation)
├── components/             # Reusable UI components
├── screens/                # Screen components
├── navigation/             # Navigation configuration
├── redux/                  # State management (Redux Toolkit)
├── services/               # Business logic & APIs
├── types/                  # TypeScript type definitions
├── hooks/                  # Custom React hooks
├── utils/                  # Utility functions
├── providers/              # React context providers
├── assets/                 # Images, fonts, etc.
├── ble/                    # Bluetooth Low Energy logic
├── features/               # Feature-specific modules
└── mocks/                  # Mock data for development
```

### `src/App.tsx` - Application Root

**Purpose**: Sets up all providers and renders main navigation.

**What it does**:
```typescript
export const App = () => {
  return (
    <SafeAreaProvider>              {/* Safe area handling */}
      <ReduxProvider store={store}>  {/* Redux state */}
        <PaperProvider>              {/* UI components */}
          <NavigationContainer>      {/* Navigation */}
            <AndroidPermissionsProvider>
              <AppSetupProvider>     {/* App initialization */}
                <BleEngineProvider>  {/* Bluetooth */}
                  <AuthProvider>     {/* Authentication */}
                    <MainNavigation />
                  </AuthProvider>
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

**Nested Providers Pattern**: Each provider wraps children to share functionality.

### `src/components/` - Reusable Components

```
components/
├── ui/                    # Generic UI components
│   └── WWSelect.tsx       # Custom select/dropdown
├── form/                  # Form-specific components
├── sync/                  # Sync status indicators
├── ProjectCard.tsx        # Project list item
├── DeploymentCard.tsx     # Deployment list item
├── DeviceItem.tsx         # Device list item
├── NavigationBar.tsx      # Header bar
├── AppDrawer.tsx          # Side drawer menu
├── OrgSwitcher.tsx        # Organisation switcher
└── SideNavigation.tsx     # Drawer content
```

**Example Component**: `src/components/ProjectCard.tsx`
```typescript
interface ProjectCardProps {
  project: Project;
  onPress: (id: string) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project, onPress }) => {
  return (
    <Card onPress={() => onPress(project.id)}>
      <Card.Title title={project.name} />
      <Card.Content>
        <Text>{project.description}</Text>
        <Text>Members: {project.members.length}</Text>
      </Card.Content>
    </Card>
  );
};
```

### `src/screens/` - Screen Components

**Note**: Some screens are in `src/screens/`, others in `src/navigation/screens/`.

```
screens/
├── Deployments/           # Deployment-related screens
│   ├── StartDeploymentScreen.tsx
│   ├── EndDeploymentScreen.tsx
│   └── ...
├── Devices/               # Device management screens
│   ├── PrepareAndTestScreen.tsx
│   ├── DeviceDiscoveryScreen.tsx
│   └── ...
├── Projects/              # Project management screens
│   ├── ProjectDetailsScreen.tsx
│   └── ...
└── AuthTestScreen.tsx     # Auth testing (dev only)
```

**Example Screen**:
```typescript
const ProjectDetailsScreen = () => {
  const route = useRoute<AppParams<'ProjectDetailsScreen'>>();
  const { projectId } = route.params;

  const project = useAppSelector(state =>
    state.projects.items.find(p => p.id === projectId)
  );

  if (!project) {
    return <Text>Project not found</Text>;
  }

  return (
    <ScrollView>
      <Text>{project.name}</Text>
      <Text>{project.description}</Text>
      {/* More content */}
    </ScrollView>
  );
};
```

### `src/navigation/` - Navigation Setup

```
navigation/
├── index.tsx              # Main navigation config
├── BottomTabs.tsx         # Bottom tab navigation
├── types.ts               # Navigation TypeScript types
├── linking.ts             # Deep linking configuration
└── screens/               # Auth & Utility screens
    ├── Login.tsx
    ├── Profile.tsx
    └── ...
```

**Navigation Types**: `src/navigation/types.ts` or `index.tsx:33-52`
```typescript
export interface RootStackParamList extends ParamListBase {
  Home: undefined;
  ProjectDetailsScreen: { projectId: string };
  ProjectMembersScreen: { projectId: string; projectName: string };
  AddDeployment: { selectedProject?: Option } | undefined;
  // ... more routes
}
```

**Bottom Tabs**: `src/navigation/BottomTabs.tsx`
```typescript
export const BottomTabs = () => {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Maps" component={MapsScreen} />
      <Tab.Screen name="Projects" component={ProjectsScreen} />
      <Tab.Screen name="Deployments" component={DeploymentsScreen} />
      <Tab.Screen name="Devices" component={DevicesScreen} />
    </Tab.Navigator>
  );
};
```

### `src/redux/` - State Management

```
redux/
├── index.ts               # Store configuration
├── slices/                # Redux slices (feature state)
│   ├── authSlice.ts
│   ├── syncSlice.ts
│   ├── networkSlice.ts
│   └── ... more slices
├── api/                   # RTK Query APIs
│   ├── index.ts           # Base API setup
│   ├── enhanced.ts        # Enhanced API with interceptors
│   ├── fetch.ts           # Custom fetch logic
│   ├── types.ts           # API type definitions
│   ├── urls.ts            # API endpoints
│   ├── auth/              # Auth endpoints
│   ├── devices/           # Device endpoints
│   └── ... more endpoints
└── middleware/            # Custom middleware
    └── offlineSyncMiddleware.ts
```

**Store Setup**: `src/redux/index.ts`
```typescript
const store = configureStore({
  reducer: {
    [api.reducerPath]: api.reducer,
    authentication: authReducer,
    projects: projectsReducer,
    offline: offlineReducer,
    // ... more reducers
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .concat(api.middleware, offlineSyncMiddleware.middleware),
})
```

### `src/services/` - Business Logic

```
services/
├── auth.ts                # Authentication service
├── supabase.ts            # Supabase client (factory)
├── database.ts            # Typed Supabase operations
├── ProjectService.ts      # Project operations
├── ProjectMemberService.ts # Member management
├── DfuService.ts          # Firmware updates
├── MockLoRaWANService.ts  # LoRaWAN mocking
├── offline/               # Offline services (THE CORE!)
│   ├── OfflineService.ts      # Main offline logic
│   ├── SupabaseSyncService.ts # WatermelonDB Sync Adapter
│   └── ConflictResolutionService.ts
└── sync/                  # Sync-related services
```

**Service Pattern**:
```typescript
// src/services/ProjectService.ts
export class ProjectService {
  async createProject(data: ProjectCreate): Promise<Project> {
    // Save locally first (offline-first!) - WatermelonDB handles this
    await database.write(async () => {
        await projectsCollection.create(project => {
            project.name = data.name;
            // ...
        });
    });

    // WatermelonDB Sync Engine handles the rest automatically!
    return data;
  }
}
```

### `src/types/` - TypeScript Definitions

```
types/
├── index.ts               # Barrel exports
├── database.types.ts      # Generated from database schema
├── offline.ts             # Offline operation types
├── api.types.ts           # API request/response types
├── database.types.ts      # Database entity types
├── project.ts             # Project-specific types
└── expo-constants.d.ts    # Expo type declarations
```

**Generated Types**: `src/types/database.types.ts`
```typescript
// Auto-generated from Supabase schema
export interface Database {
  public: {
    Tables: {
      users: {
        Row: { id: string; name: string; email: string; ... }
        Insert: { name: string; email: string; ... }
        Update: { name?: string; email?: string; ... }
      }
      projects: { ... }
      // ... more tables
    }
  }
}

// Helper types
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
```

### `src/hooks/` - Custom Hooks

```
hooks/
├── useOfflineSync.ts      # Offline sync logic
├── useOptimisticUpdate.ts # Optimistic UI updates
├── useSupabaseAuth.ts     # Supabase authentication
├── useUserOrganisations.ts # User org management
├── useDeepLinking.ts      # Deep link handling
├── useBle.ts              # Bluetooth operations
├── useAppNavigation.tsx   # Typed navigation hook
└── ... more hooks
```

**Example Hook**: `src/hooks/useOfflineSync.ts`
```typescript
export const useOfflineSync = () => {
  const dispatch = useAppDispatch();
  const isOnline = useAppSelector(state => state.network.isOnline);

  useEffect(() => {
    if (isOnline) {
      dispatch(processOfflineQueue());
    }
  }, [isOnline, dispatch]);

  return { isOnline };
};
```

### `src/providers/` - Context Providers

```
providers/
├── AndroidPermissionsProvider.tsx  # Android permissions
├── AppSetupProvider.tsx            # App initialization
├── BleEngineProvider.tsx           # Bluetooth engine
├── ListenToBleEngineProvider.tsx   # BLE event listeners
├── AuthProvider.tsx                # Authentication context
└── DeviceReconnectProvider.tsx     # Device reconnection
```

## Test Directory (`tests/`)

```
tests/
├── maestro/               # UI automation tests
│   ├── auth-workflow.yaml
│   ├── offline/
│   │   └── complete-offline-workflow.yaml
│   └── ... more tests
├── integration/           # Integration tests
└── unit/                  # Unit tests
```

## Project Context (`project-context/`)

```
project-context/
├── development-context/
│   └── MVP2/
│       ├── implementation-spec-v1.4.md  # Complete project spec
│       ├── implementation/
│       │   ├── tasks/                   # Task breakdown
│       │   ├── guides/                  # Implementation guides
│       │   └── execution/               # Execution plans
│       └── specifications/              # Detailed specs
└── learnings/                           # Development learnings
```

## Configuration Files

### `package.json` - Dependencies & Scripts

```json
{
  "scripts": {
    "start": "npx expo start",
    "android": "npx expo run:android",
    "ios": "npx expo run:ios",
    "test": "jest",
    "type-check": "tsc --noEmit",
    "lint": "eslint ."
  },
  "dependencies": {
    "react": "18.3.1",
    "react-native": "0.81.5",
    "expo": "~54.0.0",
    "@reduxjs/toolkit": "^2.2.1",
    "@supabase/supabase-js": "^2.53.0",
    "expo-sqlite": "~14.0.6",
    // ... more
  }
}
```

### `app.json` - Expo Configuration

```json
{
  "expo": {
    "name": "Wildlife Watcher",
    "slug": "wildlife-watcher",
    "version": "0.0.1",
    "platforms": ["ios", "android"],
    "ios": {
      "bundleIdentifier": "com.wildlife.wildlifewatcher"
    },
    "android": {
      "package": "com.wildlife.wildlifewatcher"
    }
  }
}
```

## Finding Things

### "Where is the authentication logic?"
- **Redux State**: `src/redux/slices/authSlice.ts`
- **Service Layer**: `src/services/auth.ts`
- **Supabase**: `src/services/supabase.ts` (use `getSupabaseClient()`)

### "Where are the project screens?"
- **List Screen**: `src/screens/Projects/ProjectsListScreen.tsx`
- **Details Screen**: `src/screens/Projects/ProjectDetailsScreen.tsx`
- **Members Screen**: `src/screens/Projects/ProjectMembersScreen.tsx`
- **Create Screen**: `src/screens/Projects/AddProjectScreen.tsx`

### "Where is navigation configured?"
- **Main Nav**: `src/navigation/index.tsx`
- **Tabs**: `src/navigation/BottomTabs.tsx`
- **Types**: `src/navigation/types.ts`
- **Deep Links**: `src/navigation/linking.ts`

### "Where are the TypeScript types?"
- **Generated**: `src/types/database.types.ts` (from database schema)
- **Custom**: `src/types/*.ts` files
- **Inline**: Within component files

## File Naming Conventions

- **Components**: PascalCase - `ProjectCard.tsx`, `DeviceItem.tsx`
- **Screens**: PascalCase - `ProjectDetailsScreen.tsx`, `Login.tsx`
- **Services**: PascalCase - `OfflineService.ts`, `ProjectService.ts`
- **Hooks**: camelCase with `use` prefix - `useOfflineSync.ts`
- **Types**: camelCase - `offline.ts`, `api.types.ts`
- **Redux Slices**: camelCase with `Slice` suffix - `authSlice.ts`
- **Utils**: camelCase - `formatDate.ts`, `validateEmail.ts`

## Import Patterns

### Absolute Imports
```typescript
// Enabled in tsconfig.json
import { useAppSelector } from '../redux';
import { OfflineService } from '../services/offline/OfflineService';
import type { Project } from '../types';
```

### Barrel Exports
```typescript
// src/types/index.ts
export * from './offline';
export * from './api.types';
export * from './project';

// Usage
import { OfflineOperation, ProjectCreate } from '../types';
```

## Next Steps

1. Clone the repo and explore the structure yourself
2. Read [03-OFFLINE-FIRST-ARCHITECTURE.md](./03-OFFLINE-FIRST-ARCHITECTURE.md) for the core logic
3. Study [04-REDUX-STATE-MANAGEMENT.md](./04-REDUX-STATE-MANAGEMENT.md) for state patterns
4. Check [01-TECHNOLOGY-STACK.md](./01-TECHNOLOGY-STACK.md) for technology details

## Quick Navigation Cheatsheet

| What You Need | Where to Look |
|---------------|---------------|
| App entry point | `src/App.tsx` |
| Redux store | `src/redux/index.ts` |
| Main navigation | `src/navigation/index.tsx` |
| Offline sync | `src/services/offline/SupabaseSyncService.ts` |
| Local database | `src/database/index.ts` (WatermelonDB) |
| API calls | `src/redux/api/` or `src/services/database.ts` |
| TypeScript types | `src/types/` |
| Custom hooks | `src/hooks/` |
| Reusable components | `src/components/` |
| Screens | `src/screens/{Feature}/` |
| Business logic | `src/services/` |
| Tests | `tests/` |
| Configuration | Root directory (`*.json`, `*.config.js`) |
| Documentation | `documentation/` |
| Project specs | `project-context/` |

Happy coding! 🚀
