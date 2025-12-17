# Getting Started with Wildlife Watcher Mobile App

## Welcome! 👋

You're joining the development team for the **Wildlife Watcher Mobile App** - a React Native application that helps conservation researchers deploy and manage wildlife monitoring cameras in remote locations worldwide.

This guide will give you the essential context to understand what you're building and why it matters.

## What is Wildlife Watcher?

### The Problem We're Solving

Conservation researchers need to deploy camera traps (wildlife cameras) in remote wilderness areas to monitor animal populations and behavior. These deployments face unique challenges:

- **No cellular connectivity** in remote wilderness areas
- **Teams working offline** for days or weeks at a time
- **Collaborative research** across international teams
- **Critical data integrity** - can't lose deployment records
- **Real-time status updates** via LoRaWAN when in range

### Our Solution

The Wildlife Watcher Mobile App is an **offline-first field deployment tool** that enables:

1. **Complete offline operation** - All features work without internet
2. **Bluetooth camera configuration** - Configure Wildlife Watcher cameras via BLE
3. **Intelligent sync** - Automatic synchronization when connectivity returns
4. **Team collaboration** - Multi-user projects with role-based permissions
5. **Remote monitoring** - LoRaWAN status updates (battery, SD card usage)

## High-Level Architecture

### The Stack at a Glance

```
┌─────────────────────────────────────────────────────┐
│           React Native + Expo SDK 51                 │
│    (Cross-platform iOS & Android from one codebase) │
└─────────────────────────────────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          │                             │
┌─────────▼─────────┐        ┌──────────▼─────────┐
│   Local Storage    │        │   Cloud Backend     │
│                    │        │                     │
│  WatermelonDB      │◄──────►│  Supabase           │
│  (Reactive DB)     │  Sync  │  (PostgreSQL +      │
│                    │        │   Auth + Storage)   │
└────────────────────┘        └─────────────────────┘
```

### Key Technologies

- **React Native 0.74.5** - Mobile UI framework
- **TypeScript** - Type-safe JavaScript
- **Redux Toolkit** - State management (UI & Session)
- **Expo SDK 51** - Development tools and APIs
- **WatermelonDB** - High-performance reactive local database
- **Supabase** - Backend (PostgreSQL, Auth, Storage)
- **React Navigation** - Screen navigation
- **React Native Paper** - UI component library

## Core Concepts You Need to Know

### 1. Offline-First Architecture

**This is not a web app with offline support - it's an offline app with sync capabilities.**

Key principles:
- **WatermelonDB as Source of Truth** - UI observes local DB
- **Background Sync** - Supabase Sync Engine handles data transfer
- **Conflict Resolution** - "Last Write Wins" or custom strategies

**Example Flow:**
```
User creates project → Write to WatermelonDB → UI updates automatically (Reactive)
                                ↓
                         (Background Sync)
                                ↓
                    Push Changes → Supabase API → Pull Changes
```

### 2. Redux for State Management

We use **Redux Toolkit (RTK)** for managing app state, but **NOT** for domain data (projects, deployments).

- **Slices** organize UI state (modals, themes) and Session state (Auth).
- **Async thunks** handle non-DB async operations (like Auth).
- **Typed hooks** (`useAppSelector`, `useAppDispatch`) for TypeScript safety.

**Example: Auth State**
```typescript
// src/redux/slices/authSlice.ts
const authSlice = createSlice({
  name: 'authentication',
  initialState: {
    user: null,
    isAuthenticated: false,
  },
  reducers: {
    setUser: (state, action) => {
      state.user = action.payload;
      state.isAuthenticated = true;
    },
    logout: (state) => {
      state.user = null;
      state.isAuthenticated = false;
    }
  }
});
```

### 3. React Native vs Web Development

If you're coming from web development, here are the key differences:

| Web | React Native |
|-----|--------------|
| `<div>`, `<span>` | `<View>`, `<Text>` |
| CSS files | StyleSheet or inline styles |
| HTML semantics | Component semantics |
| Browser APIs | Native APIs via Expo |
| `onClick` | `onPress` |
| Flexbox (optional) | Flexbox (default) |

**Example: Simple Component**
```tsx
// Web way
<div className="container" onClick={handleClick}>
  <h1>Hello</h1>
</div>

// React Native way
<View style={styles.container}>
  <TouchableOpacity onPress={handlePress}>
    <Text style={styles.title}>Hello</Text>
  </TouchableOpacity>
</View>
```

### 4. Navigation Patterns

We use **React Navigation** with a stack-based approach:

- **Bottom Tabs** - Main app sections (Maps, Projects, Deployments, Devices)
- **Stack Navigator** - Drill-down screens
- **Drawer** - Side menu for settings and profile
- **Type-safe routing** - TypeScript types for all routes

**Navigation Structure:**
```
App
├── Bottom Tabs
│   ├── Maps (Home)
│   ├── Projects
│   ├── Deployments
│   └── Devices
├── Modal Screens
│   ├── Add Project
│   ├── Start Deployment
│   └── Project Details
└── Drawer Menu
    ├── Profile
    ├── Settings
    └── Sign Out
```

## Project Organization

```
wildlife-watcher-mobile-app/
├── src/                          # All source code
│   ├── components/               # Reusable UI components
│   ├── screens/                  # Screen components (not in navigation/)
│   ├── navigation/               # Navigation setup
│   │   ├── index.tsx            # Main navigation config
│   │   ├── BottomTabs.tsx       # Bottom tab navigation
│   │   └── types.ts             # Navigation TypeScript types
│   ├── redux/                    # State management (UI/Auth)
│   │   ├── index.ts             # Store configuration
│   │   ├── slices/              # Redux slices
│   │   ├── api/                 # RTK Query APIs
│   │   └── middleware/          # Custom middleware
│   ├── database/                 # WatermelonDB Setup
│   │   ├── index.ts             # Database instance
│   │   ├── schema.ts            # Database schema
│   │   └── models/              # Data models
│   ├── services/                 # Business logic
│   │   ├── auth.ts              # Authentication
│   │   ├── SupabaseSyncService.ts # Sync Engine
│   │   └── supabase.ts          # Supabase client
│   ├── types/                    # TypeScript definitions
│   ├── hooks/                    # Custom React hooks
│   ├── utils/                    # Utility functions
│   └── App.tsx                   # Root component
├── tests/                        # Test files
├── documentation/                # This documentation
└── project-context/              # Project specs and planning

```

## Understanding the User Flow

### Authentication
1. User opens app
2. Check for existing session (AsyncStorage)
3. If no session → Show login screen
4. After login → Store session + navigate to home

### Creating a Deployment (Offline Scenario)
1. User taps "Start Deployment" FAB on Maps screen
2. Select project (or create new one)
3. Scan for nearby Wildlife Watcher cameras via Bluetooth
4. Configure deployment (location, capture method, etc.)
5. Test camera snapshot
6. Save deployment → **Writes to WatermelonDB immediately**
7. UI updates instantly via Observables
8. When network returns → **Supabase Sync Engine pushes changes**

(See full details in **[03-DEPLOYMENT-FLOW.md](./03-DEPLOYMENT-FLOW.md)**)

### Data Sync Flow
```
WatermelonDB (Local)
   ↓
Network Monitor detects connectivity
   ↓
Supabase Sync Engine triggers
   ↓
1. PUSH local changes to Supabase
2. PULL remote changes from Supabase
3. Apply updates to local DB
```

## Key Files to Explore

Start exploring the codebase with these essential files:

1. **`src/App.tsx`** - Application root with providers
2. **`src/database/index.ts`** - WatermelonDB configuration
3. **`src/navigation/index.tsx`** - Navigation structure
4. **`src/services/SupabaseSyncService.ts`** - Core sync logic
5. **`src/database/models/Project.ts`** - Example data model
6. **`src/types/supabase.ts`** - Generated TypeScript types from database schema

## Development Environment

### Prerequisites
- Node.js 18+ (check with `node --version`)
- npm or yarn
- Android Studio (for Android development)
- Xcode (for iOS development - Mac only)
- Expo CLI (installed via npx)

### Quick Start
```bash
# Install dependencies
npm install

# Start development server
npm start

# Run on Android (connects to emulator or device)
npm run android

# Run on iOS (Mac only)
npm run ios
```

### Useful Commands
```bash
# TypeScript type checking
npm run type-check

# Run tests
npm run test

# Linting
npm run lint

# Generate Supabase types (when backend changes)
npm run supabase:types
```

## Common Patterns You'll See

### 1. Custom Hooks for Logic Reuse
```typescript
// src/hooks/useOfflineSync.ts
export const useOfflineSync = () => {
  const isOnline = useAppSelector(state => state.network.isOnline);

  useEffect(() => {
    if (isOnline) {
      SupabaseSyncService.sync();
    }
  }, [isOnline]);
};
```

### 2. Typed Redux Selectors
```typescript
// Component usage
const isSidebarOpen = useAppSelector(state => state.ui.isSidebarOpen);
const user = useAppSelector(state => state.authentication.user);
```

### 3. Service Layer Pattern
```typescript
// src/services/ProjectService.ts
export class ProjectService {
  async createProject(data: ProjectCreate): Promise<Project> {
    // Write directly to WatermelonDB
    await database.write(async () => {
      await projectsCollection.create(project => {
        project.name = data.name;
        // ...
      });
    });
    // Sync happens automatically in background
  }
}
```

## What Makes This App Unique

1. **True offline-first** - Not just "works offline sometimes"
2. **Complex sync logic** - Role-based sync filtering, conflict resolution
3. **Organisation multi-tenancy** - Data isolation across organisations
4. **Bluetooth integration** - Real BLE device communication
5. **LoRaWAN integration** - Remote status updates from deployed cameras
6. **Role-based permissions** - WW Admin, Project Admin, Project Member roles

## Next Steps

Now that you understand the basics:

1. ✅ Read [01-TECHNOLOGY-STACK.md](./01-TECHNOLOGY-STACK.md) for deep dives into each technology
2. ✅ Explore [02-PROJECT-STRUCTURE.md](./02-PROJECT-STRUCTURE.md) to navigate the codebase
3. ✅ Study [03-OFFLINE-FIRST-ARCHITECTURE.md](./03-OFFLINE-FIRST-ARCHITECTURE.md) - this is the heart of the app
4. ✅ Learn Redux patterns in [04-REDUX-STATE-MANAGEMENT.md](./04-REDUX-STATE-MANAGEMENT.md)
5. ✅ Set up your dev environment with [06-DEVELOPMENT-WORKFLOW.md](./06-DEVELOPMENT-WORKFLOW.md)

## Questions?

- Check the other onboarding docs for specific topics
- Search the codebase for examples
- Ask the team in Slack/Teams
- Pair program with experienced developers

Welcome aboard! 🚀
