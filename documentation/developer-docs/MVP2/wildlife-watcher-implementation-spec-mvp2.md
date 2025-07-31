# Wildlife Watcher Mobile App - MVP Implementation Specification

**Version**: 1.0  
**Date**: December 2024  
**Platform**: React Native (Expo SDK 51)  
**Backend**: Supabase  

---

## Revision History

| Date | Version | Summary of Changes | Author |
|------|---------|-------------------|---------|
| 2025-07-31 | 0.01 | Initial document creation - Complete MVP2 specification including architecture, authentication, core features, offline support, Supabase integration, and implementation timeline | Adarsh (Initial) |
| 2025-07-31 | 0.02 | Added revision history table for tracking document changes | Claude Code |

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Current Implementation Status](#2-current-implementation-status)
3. [Architecture Overview](#3-architecture-overview)
4. [Authentication & User Management](#4-authentication--user-management)
5. [Core Features Implementation](#5-core-features-implementation)
6. [Offline Support Architecture](#6-offline-support-architecture)
7. [Supabase Integration](#7-supabase-integration)
8. [State Management](#8-state-management)
9. [Implementation Timeline](#9-implementation-timeline)
10. [Technical Guidelines](#10-technical-guidelines)

---

## 1. Project Overview

### Application Details
- **Name**: Wildlife Watcher Mobile App
- **Purpose**: Field deployment and management of wildlife monitoring cameras
- **Target Users**: Conservation researchers and field workers
- **Key Requirements**: Offline-first operation, Bluetooth device management, deployment tracking

### Technology Stack
```typescript
// Core Framework
- Expo SDK 51
- React Native 0.74.5
- TypeScript ~5.3.3
- React 18.2.0

// State Management
- @reduxjs/toolkit 2.2.1
- react-redux 9.1.0

// Navigation
- @react-navigation/native 6.1.12
- @react-navigation/native-stack 6.9.20
- react-native-drawer-layout 3.3.0

// UI Components
- react-native-paper 5.12.3
- react-native-vector-icons 10.0.3
- react-native-toast-message 2.2.0

// Hardware Integration
- react-native-ble-manager 11.3.2
- react-native-bluetooth-state-manager 1.3.5
- react-native-nordic-dfu (GitHub fork)
- react-native-maps 1.14.0

// Backend & Storage
- @supabase/supabase-js 2.39.0
- expo-sqlite 13.4.0
- @react-native-async-storage/async-storage 1.23.1
```

---

## 2. Current Implementation Status

### Completed Migration Tasks
- ✅ Expo SDK 51 migration complete
- ✅ EAS Build configuration
- ✅ Core dependencies migrated:
  - `react-native-fs` → `expo-file-system`
  - `react-native-config` → `expo-constants`
  - `react-native-bootsplash` → `expo-splash-screen`
- ✅ BLE functionality verified with real devices
- ✅ Nordic DFU integration ready
- ✅ React Navigation setup complete
- ✅ Redux Toolkit configured
- ✅ Development environment with Metro bundler

### Existing Features to Preserve
- BLE device scanning and connection
- PING/PONG protocol implementation
- DFU firmware update capability
- Basic navigation structure

---

## 3. Architecture Overview

### Project Structure
```
src/
├── components/              # Reusable UI components
│   ├── common/             # Generic components
│   ├── forms/              # Form components
│   └── navigation/         # Navigation components
├── navigation/             # Navigation configuration
│   ├── screens/           # Screen components
│   ├── stacks/            # Stack navigators
│   └── index.tsx          # Root navigation
├── services/              # Business logic & APIs
│   ├── auth/              # Authentication service
│   ├── ble/               # Bluetooth services
│   ├── dfu/               # Firmware update services
│   ├── offline/           # Offline & sync services
│   └── supabase/          # Supabase client & API
├── store/                 # Redux store
│   ├── slices/            # Redux slices
│   └── index.ts           # Store configuration
├── types/                 # TypeScript definitions
├── utils/                 # Utility functions
│   ├── constants.ts       # App constants
│   ├── environment.ts     # Environment config
│   └── helpers.ts         # Helper functions
├── hooks/                 # Custom React hooks
└── App.tsx               # Root component
```

### Data Flow Architecture
```
User Action → Screen Component → Redux Action → Service Layer → Local Storage/Supabase
                                                      ↓
                                              Offline Queue (if no network)
                                                      ↓
                                              Background Sync Service
```

---

## 4. Authentication & User Management

### 4.1 Authentication Flow

#### Login Screen Implementation
```typescript
// src/navigation/screens/auth/LoginScreen.tsx
interface LoginFormData {
  email: string;
  password: string;
}

const LoginScreen: React.FC = () => {
  // Implementation requirements:
  // - Email/password form with react-hook-form
  // - Form validation (email format, password requirements)
  // - Loading state during authentication
  // - Error handling with user-friendly messages
  // - Remember me functionality (AsyncStorage)
  // - Navigate to Maps screen on success
  // - Links to Forgot Password and Sign Up
};
```

#### Sign Up Screen (Basic Implementation)
```typescript
// src/navigation/screens/auth/SignUpScreen.tsx
interface SignUpFormData {
  email: string;
  password: string;
  confirmPassword: string;
  organization: string;
}

// Basic fields only for MVP
// No profile pictures or complex onboarding
```

#### Forgot Password Screen (Basic Implementation)
```typescript
// src/navigation/screens/auth/ForgotPasswordScreen.tsx
// Simple email input and reset link functionality
// Supabase handles email sending
```

### 4.2 User Roles (MVP Scope)
```typescript
enum UserRole {
  PROJECT_ADMIN = 'project_admin',
  PROJECT_MEMBER = 'project_member'
}

// Permissions:
// PROJECT_ADMIN: Can edit project, add/remove members, delete deployments
// PROJECT_MEMBER: Can create/end deployments, view project data
```

---

## 5. Core Features Implementation

### 5.1 Navigation Structure

#### Bottom Tab Navigation
```typescript
// src/navigation/BottomTabNavigator.tsx
const TAB_SCREENS = [
  {
    name: 'Maps',
    component: MapsScreen,
    icon: 'map-marker',
    label: 'Maps'
  },
  {
    name: 'Projects',
    component: ProjectsScreen,
    icon: 'folder',
    label: 'Projects'
  },
  {
    name: 'Deployments',
    component: DeploymentsScreen,
    icon: 'camera',
    label: 'Deployments'
  },
  {
    name: 'Devices',
    component: DevicesScreen,
    icon: 'bluetooth',
    label: 'Devices'
  }
];
```

#### Side Drawer Menu
```typescript
// src/navigation/DrawerNavigator.tsx
// Menu items:
// - User email display
// - Sign Out button
// - App version
```

### 5.2 Maps Screen (Home)

```typescript
// src/navigation/screens/MapsScreen.tsx
interface MapsScreenProps {
  // Features to implement:
  // - Display map centered on user location or last deployment
  // - Show active deployment markers
  // - Cluster markers when zoomed out
  // - Floating Action Buttons:
  //   - Start Deployment (Green) - bottom right
  //   - End Deployment (Yellow) - bottom right
  // - Handle offline map tiles (store last viewed area)
}

// Key functionality:
// - Request location permissions
// - Show user's current location
// - Load deployments from Redux store
// - Navigate to deployment flows
```

### 5.3 Start Deployment Flow

#### Step 1: Project Selection
```typescript
// src/navigation/screens/deployment/start/ProjectSelectionScreen.tsx
interface ProjectSelectionState {
  selectedProjectId: string | null;
  deploymentName: string;
  isCreatingNewProject: boolean;
}

// Components:
// - Dropdown with user's projects
// - "Add new project" option
// - Deployment name text input
// - Continue button (disabled until valid)
// - Back navigation
```

#### Step 2: New Project Creation (if selected)
```typescript
// src/navigation/screens/deployment/start/NewProjectScreen.tsx
interface ProjectFormData {
  name: string;
  owner: string; // Auto-filled with current user
  samplingDesign: string;
  description: string;
  website?: string;
  members: string[]; // Email addresses
  isPrivate: boolean;
  usingBait: boolean;
  monitoringMarked: boolean;
}

// Form sections:
// - Basic Information
// - Project Settings (checkboxes)
// - Team Members (add by email)
// - Save & Continue
```

#### Step 3: Device Discovery
```typescript
// src/navigation/screens/deployment/start/DeviceDiscoveryScreen.tsx
interface DeviceDiscoveryState {
  isScanning: boolean;
  devices: BLEDevice[];
  selectedDevice: BLEDevice | null;
  permissionStatus: 'granted' | 'denied' | 'pending';
}

// UI Elements:
// - Permission request card (if needed)
// - Scanning animation
// - Device list with signal strength
// - Connect button for each device
// - Manual refresh button
```

#### Step 4: Deployment Configuration
```typescript
// src/navigation/screens/deployment/start/DeploymentConfigScreen.tsx
interface DeploymentConfig {
  device: {
    id: string;
    name: string;
  };
  location: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  captureMethod: 'motion' | 'timelapse';
  timelapseInterval?: 10 | 30 | 60 | 120; // seconds
}

// Features:
// - Map showing selected location
// - Coordinate display and edit
// - "Use My Location" button
// - Motion/Timelapse selector
// - Interval picker (if timelapse)
```

#### Step 5: Camera Preview
```typescript
// src/navigation/screens/deployment/start/CameraPreviewScreen.tsx
// Show camera snapshot from device
// "Take Another Snapshot" button
// "Approve & Continue" button
```

#### Step 6: Final Setup
```typescript
// src/navigation/screens/deployment/start/FinalSetupScreen.tsx
interface FinalSetupData {
  locationPhoto?: string; // Base64 or URI
  locationDescription: string;
}

// Features:
// - Camera/gallery picker for location photo
// - Description text area
// - "Start Deployment" button
// - Loading state during deployment creation
```

### 5.4 End Deployment Flow

```typescript
// src/navigation/screens/deployment/end/EndDeploymentFlow.tsx
// Simplified flow:
// 1. Device discovery (reuse component)
// 2. Show deployment details
// 3. Confirm end deployment
// 4. Success/failure screen
```

### 5.5 Projects Screen

```typescript
// src/navigation/screens/ProjectsScreen.tsx
interface ProjectListItem {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  activeDeployments: number;
  totalDeployments: number;
}

// Features:
// - Project cards with summary info
// - Search/filter functionality
// - Pull to refresh
// - Navigation to project details
// - FAB for new project
```

### 5.6 Project Details Screen

```typescript
// src/navigation/screens/ProjectDetailsScreen.tsx
// Sections:
// - Project info (editable for admins)
// - Members list with roles
// - Add member functionality (admin only)
// - Recent deployments
// - Delete project (admin only)
```

### 5.7 Deployments Screen

```typescript
// src/navigation/screens/DeploymentsScreen.tsx
// Features:
// - Tab selector: Active | Ended | All
// - Deployment cards showing:
//   - Project name
//   - Device name
//   - Battery & SD card indicators
//   - Last updated timestamp
// - Pull to refresh
// - Search functionality
```

### 5.8 Devices Screen

```typescript
// src/navigation/screens/DevicesScreen.tsx
// Features:
// - Scan for nearby devices
// - Device list with:
//   - Connection status
//   - Battery level
//   - Firmware version
// - Test camera button (when connected)
// - Firmware update button
```

---

## 6. Offline Support Architecture

### 6.1 Offline Strategy Overview

The app must function completely offline during field deployments, syncing data when connectivity is restored.

### 6.2 Local Database Schema (SQLite)

```typescript
// src/services/offline/schema.ts
export const OFFLINE_SCHEMA = {
  offline_queue: `
    CREATE TABLE IF NOT EXISTS offline_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation_id TEXT UNIQUE NOT NULL,
      operation_type TEXT CHECK(operation_type IN ('CREATE', 'UPDATE', 'DELETE')),
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      retry_count INTEGER DEFAULT 0,
      last_error TEXT,
      synced BOOLEAN DEFAULT 0
    )
  `,
  
  local_deployments: `
    CREATE TABLE IF NOT EXISTS local_deployments (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      synced BOOLEAN DEFAULT 0
    )
  `,
  
  local_projects: `
    CREATE TABLE IF NOT EXISTS local_projects (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      synced BOOLEAN DEFAULT 0
    )
  `
};
```

### 6.3 Offline Service Implementation

```typescript
// src/services/offline/OfflineService.ts
import * as SQLite from 'expo-sqlite';
import NetInfo from '@react-native-community/netinfo';
import { v4 as uuidv4 } from 'uuid';

export class OfflineService {
  private db: SQLite.Database;
  private syncInProgress: boolean = false;
  
  constructor() {
    this.db = SQLite.openDatabase('wildlife_watcher.db');
    this.initializeDatabase();
    this.setupNetworkListener();
  }
  
  // Queue operations when offline
  async queueOperation(operation: {
    type: 'CREATE' | 'UPDATE' | 'DELETE';
    entity: 'project' | 'deployment' | 'device';
    data: any;
  }) {
    const operationId = uuidv4();
    
    await this.db.executeSql(
      `INSERT INTO offline_queue 
       (operation_id, operation_type, entity_type, entity_id, payload)
       VALUES (?, ?, ?, ?, ?)`,
      [operationId, operation.type, operation.entity, 
       operation.data.id || uuidv4(), JSON.stringify(operation.data)]
    );
    
    return operationId;
  }
  
  // Sync when online
  async syncPendingOperations() {
    if (this.syncInProgress) return;
    
    this.syncInProgress = true;
    try {
      const pendingOps = await this.getPendingOperations();
      
      for (const op of pendingOps) {
        try {
          await this.syncOperation(op);
          await this.markSynced(op.id);
        } catch (error) {
          await this.handleSyncError(op, error);
        }
      }
    } finally {
      this.syncInProgress = false;
    }
  }
}
```

### 6.4 Sync Conflict Resolution

```typescript
// src/services/offline/ConflictResolver.ts
export class ConflictResolver {
  // Last-write-wins for most fields
  resolveDeployment(local: any, remote: any): any {
    // Deployment status is critical - ended status always wins
    if (remote.status === 'ended' && local.status === 'active') {
      return remote;
    }
    
    // Otherwise, most recent update wins
    return local.updated_at > remote.updated_at ? local : remote;
  }
  
  // Merge strategy for projects
  resolveProject(local: any, remote: any): any {
    // Merge member lists (union of both)
    const mergedMembers = Array.from(new Set([
      ...local.members,
      ...remote.members
    ]));
    
    // Take most recent for other fields
    return {
      ...remote,
      ...local,
      members: mergedMembers,
      updated_at: new Date().toISOString()
    };
  }
}
```

---

## 7. Supabase Integration

### 7.1 Database Schema

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Organizations (simplified for MVP)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES auth.users(id) NOT NULL,
  organization_id UUID REFERENCES organizations(id),
  sampling_design TEXT,
  description TEXT,
  website TEXT,
  is_private BOOLEAN DEFAULT false,
  using_bait BOOLEAN DEFAULT false,
  monitoring_marked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project members junction table
CREATE TABLE project_members (
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
  added_at TIMESTAMPTZ DEFAULT NOW(),
  added_by UUID REFERENCES auth.users(id),
  PRIMARY KEY (project_id, user_id)
);

-- Devices table
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bluetooth_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  firmware_version TEXT,
  model_type TEXT,
  last_seen TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deployments table
CREATE TABLE deployments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) NOT NULL,
  device_id UUID REFERENCES devices(id) NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'ended')),
  
  -- Location data
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  address TEXT,
  location_description TEXT,
  location_photo_url TEXT,
  
  -- Configuration
  capture_method TEXT NOT NULL CHECK (capture_method IN ('motion', 'timelapse')),
  timelapse_interval INTEGER,
  
  -- Status data
  battery_level INTEGER,
  sd_card_usage INTEGER,
  last_data_received TIMESTAMPTZ,
  
  -- Timestamps and user tracking
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_by UUID REFERENCES auth.users(id) NOT NULL,
  ended_at TIMESTAMPTZ,
  ended_by UUID REFERENCES auth.users(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_deployments_project_id ON deployments(project_id);
CREATE INDEX idx_deployments_device_id ON deployments(device_id);
CREATE INDEX idx_deployments_status ON deployments(status);
CREATE INDEX idx_project_members_user_id ON project_members(user_id);

-- Row Level Security (RLS) policies
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployments ENABLE ROW LEVEL SECURITY;

-- Projects: Users can see projects they're members of
CREATE POLICY "Users can view their projects" ON projects
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM project_members WHERE project_id = projects.id
    ) OR projects.owner_id = auth.uid()
  );

-- Projects: Only admins can update
CREATE POLICY "Project admins can update" ON projects
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT user_id FROM project_members 
      WHERE project_id = projects.id AND role = 'admin'
    ) OR projects.owner_id = auth.uid()
  );

-- Similar policies for other tables...
```

### 7.2 Supabase Client Configuration

```typescript
// src/services/supabase/client.ts
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@env';

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false
    }
  }
);
```

### 7.3 Edge Functions

#### LoRaWAN Data Webhook
```typescript
// supabase/functions/lorawan-webhook/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  try {
    // Verify webhook secret
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${Deno.env.get('LORAWAN_WEBHOOK_SECRET')}`) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    // Parse LoRaWAN payload
    const payload = await req.json();
    const {
      deviceEUI,
      batteryVoltage,
      sdCardFreeSpace,
      timestamp
    } = payload;
    
    // Convert values
    const batteryLevel = voltageToBatteryPercentage(batteryVoltage);
    const sdCardUsage = calculateSDCardUsage(sdCardFreeSpace);
    
    // Update deployment
    const { error } = await supabase
      .from('deployments')
      .update({
        battery_level: batteryLevel,
        sd_card_usage: sdCardUsage,
        last_data_received: timestamp
      })
      .match({
        device_id: deviceEUI,
        status: 'active'
      });
    
    if (error) throw error;
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
});
```

---

## 8. State Management

### 8.1 Redux Store Structure

```typescript
// src/store/index.ts
export const store = configureStore({
  reducer: {
    auth: authSlice.reducer,
    projects: projectsSlice.reducer,
    deployments: deploymentsSlice.reducer,
    devices: devicesSlice.reducer,
    ble: bleSlice.reducer,
    offline: offlineSlice.reducer
  }
});
```

### 8.2 Redux Slices

#### Auth Slice
```typescript
// src/store/slices/authSlice.ts
interface AuthState {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginStart: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    loginSuccess: (state, action) => {
      state.user = action.payload.user;
      state.session = action.payload.session;
      state.isAuthenticated = true;
      state.isLoading = false;
    },
    loginFailure: (state, action) => {
      state.error = action.payload;
      state.isLoading = false;
    },
    logout: (state) => {
      state.user = null;
      state.session = null;
      state.isAuthenticated = false;
    }
  }
});
```

#### Projects Slice
```typescript
// src/store/slices/projectsSlice.ts
interface ProjectsState {
  projects: Project[];
  selectedProject: Project | null;
  isLoading: boolean;
  error: string | null;
  lastSync: string | null;
}
```

#### Deployments Slice
```typescript
// src/store/slices/deploymentsSlice.ts
interface DeploymentsState {
  deployments: Deployment[];
  activeDeployments: Deployment[];
  currentDeployment: Deployment | null;
  isLoading: boolean;
  error: string | null;
}
```

#### BLE Slice
```typescript
// src/store/slices/bleSlice.ts
interface BleState {
  isScanning: boolean;
  devices: BleDevice[];
  connectedDevice: BleDevice | null;
  connectionState: 'disconnected' | 'connecting' | 'connected';
  error: string | null;
}
```

#### Offline Slice
```typescript
// src/store/slices/offlineSlice.ts
interface OfflineState {
  isOnline: boolean;
  pendingOperations: number;
  syncStatus: 'idle' | 'syncing' | 'error';
  lastSyncTime: string | null;
  syncErrors: SyncError[];
}
```

---

## 9. Implementation Timeline

### Week 1: Foundation & Authentication
**Days 1-3: Project Setup & Auth**
- Complete authentication screens (Login, SignUp, ForgotPassword)
- Integrate Supabase Auth
- Setup navigation structure (tabs, drawer)
- Configure Redux store
- Implement session persistence

**Days 4-5: Offline Infrastructure**
- Setup SQLite database
- Create offline service base
- Implement network monitoring
- Create sync queue mechanism

### Week 2: Project Management
**Days 6-8: Projects CRUD**
- Projects list screen
- Project creation form
- Project details screen
- Member management
- Offline support for projects

**Days 9-10: Permissions & Roles**
- Implement role-based access
- Project admin features
- Member invitation flow

### Week 3: Deployment Flows
**Days 11-13: Start Deployment**
- Project selection screen
- Device discovery (preserve existing BLE code)
- Deployment configuration
- Camera preview
- Final setup and creation

**Days 14-15: End Deployment**
- Device reconnection
- Deployment termination
- Status updates
- Offline queuing

### Week 4: Devices & Sync
**Days 16-17: Device Management**
- Device list and discovery
- Firmware update integration
- Camera testing

**Days 18-19: Synchronization**
- Complete sync service
- Conflict resolution
- Error recovery
- Retry logic

**Day 20: Testing & Polish**
- End-to-end testing
- Performance optimization
- Bug fixes
- Documentation

---

## 10. Technical Guidelines

### 10.1 Development Principles

#### Offline-First Pattern
```typescript
// Always follow this pattern for data operations
async function saveEntity<T>(entity: T, type: EntityType): Promise<T> {
  try {
    // 1. Generate ID if new
    if (!entity.id) {
      entity.id = generateUUID();
    }
    
    // 2. Save to local SQLite first
    await localDB.save(type, entity);
    
    // 3. Update Redux store immediately
    dispatch(updateLocalEntity({ type, entity }));
    
    // 4. Queue for remote sync
    const operationId = await offlineService.queueOperation({
      type: 'CREATE',
      entity: type,
      data: entity
    });
    
    // 5. Attempt immediate sync if online
    if (await NetInfo.fetch().then(state => state.isConnected)) {
      offlineService.syncOperation(operationId);
    }
    
    return entity;
  } catch (error) {
    // Handle errors gracefully
    dispatch(setError({ type, error: error.message }));
    throw error;
  }
}
```

#### Error Handling Strategy
```typescript
class AppError extends Error {
  constructor(
    public code: string,
    public userMessage: string,
    public technicalMessage: string,
    public isRecoverable: boolean = true
  ) {
    super(technicalMessage);
  }
}

// Usage
try {
  await deploymentService.start(config);
} catch (error) {
  if (error instanceof AppError) {
    if (error.code === 'NETWORK_ERROR') {
      // Queue for offline
      showToast('Deployment saved offline');
    } else if (error.code === 'AUTH_ERROR') {
      // Re-authenticate
      navigation.navigate('Login');
    } else {
      // Show user-friendly message
      Alert.alert('Error', error.userMessage);
    }
  }
}
```

### 10.2 Code Standards

#### TypeScript Usage
- Strict mode enabled
- No `any` types
- Interfaces for all data structures
- Proper null checking

#### Component Structure
```typescript
// Standard functional component pattern
interface ScreenNameProps {
  navigation: NavigationProp<RootStackParamList>;
  route: RouteProp<RootStackParamList, 'ScreenName'>;
}

export const ScreenName: React.FC<ScreenNameProps> = ({ navigation, route }) => {
  // Hooks first
  const dispatch = useAppDispatch();
  const { data, isLoading } = useAppSelector(selectData);
  
  // Local state
  const [localState, setLocalState] = useState<Type>();
  
  // Effects
  useEffect(() => {
    // Load data
  }, []);
  
  // Handlers
  const handleAction = useCallback(() => {
    // Handle action
  }, [dependencies]);
  
  // Render
  if (isLoading) return <LoadingScreen />;
  
  return (
    <SafeAreaView style={styles.container}>
      {/* Component JSX */}
    </SafeAreaView>
  );
};
```

### 10.3 Performance Guidelines

1. **List Optimization**
   - Use FlatList for all lists
   - Implement keyExtractor
   - Use getItemLayout when possible
   - Lazy load images

2. **Memory Management**
   - Clear BLE listeners on unmount
   - Cancel async operations
   - Limit Redux store size
   - Implement data pagination

3. **Battery Optimization**
   - Minimize background operations
   - Batch network requests
   - Use efficient location updates
   - Stop BLE scanning when not needed

### 10.4 Testing Requirements

1. **Unit Tests**
   - Services and utilities
   - Redux reducers
   - Business logic

2. **Integration Tests**
   - API interactions
   - Offline/online transitions
   - Sync operations

3. **Device Testing**
   - Real device BLE testing
   - Offline mode testing
   - Different Android/iOS versions

### 10.5 Security Considerations

1. **Data Protection**
   - Encrypt sensitive local data
   - Secure API keys in env files
   - Implement proper session management

2. **API Security**
   - Use Supabase RLS policies
   - Validate all inputs
   - Implement rate limiting

3. **BLE Security**
   - Verify device identity
   - Encrypt sensitive commands
   - Implement pairing verification

---

## Appendix A: Environment Setup

### Required Environment Variables
```bash
# .env.local
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID=AIzaSyD4GgP2HPVqgEOIbOiA1QF6AfTaSBg4vfI
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS=your_ios_maps_key
EXPO_PUBLIC_LORAWAN_WEBHOOK_SECRET=your_webhook_secret
```

### Dependencies to Add
```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.39.0",
    "@react-native-community/netinfo": "^11.3.0",
    "expo-sqlite": "~13.4.0",
    "uuid": "^9.0.1",
    "react-hook-form": "^7.54.1"
  }
}
```

---

## Appendix B: BLE Protocol Reference

*Note: BLE protocol specification is work in progress. Current implementation includes:*
- Device scanning and discovery
- PING/PONG command structure
- Connection management
- DFU firmware updates

*Detailed protocol documentation will be provided separately.*

---

**End of Document**