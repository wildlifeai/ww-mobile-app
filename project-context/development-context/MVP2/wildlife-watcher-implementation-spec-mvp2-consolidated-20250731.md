# Wildlife Watcher Mobile App - MVP Implementation Specification

**Version**: 1.1  
**Date**: August 2025  
**Platform**: React Native (Expo SDK 51)  
**Backend**: Supabase  

---

## Glossary of Terms

- **BLE (Bluetooth Low Energy)**: Wireless communication technology for short-range device connections
- **DFU (Device Firmware Update)**: Over-the-air firmware update capability via Bluetooth
- **SQLite**: Local database for offline data storage on mobile devices
- **LoRaWAN**: Long-range, low-power wireless protocol for IoT devices
- **FAB (Floating Action Button)**: Material Design UI element that floats above content
- **RLS (Row Level Security)**: Database security feature that restricts data access per user
- **Edge Function**: Serverless functions that run close to users for low latency

---

## User Story Mapping

| User Story | Implementation Section | Priority |
|------------|----------------------|----------|
| User login and authentication | Section 4.1 | MVP |
| Start deployment flow | Section 5.3 | MVP |
| End deployment flow | Section 5.4 | MVP |
| Project management | Sections 5.5, 5.6 | MVP |
| Offline field work | Section 6 | MVP |
| Device management | Section 5.8 | MVP |
| User roles and permissions | Section 4.2 | MVP |

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
9. [Implementation Guidelines](#9-implementation-guidelines)
10. [Production Readiness](#10-production-readiness)

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
- react-native-maps 1.14.0 (iOS compatibility to be verified)

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
- ✅ Core dependencies migrated
- ✅ BLE functionality verified with real devices
- ✅ Nordic DFU integration ready
- ✅ React Navigation setup complete
- ✅ Redux Toolkit configured

### Features to Implement (MVP)
- Authentication flows (login, signup, password reset)
- Offline-first data synchronization
- Project and deployment management
- Device discovery and management
- User roles and permissions
- LoRaWAN integration for field data

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
│   ├── ai/                # AI model management (future)
│   ├── auth/              # Authentication service
│   ├── ble/               # Bluetooth services
│   ├── dfu/               # Firmware update services
│   ├── offline/           # Offline & sync services
│   ├── lorawan/           # LoRaWAN integration
│   └── supabase/          # Supabase client & API
│       ├── db/            # Database operations
│       ├── auth/          # Auth operations
│       ├── storage/       # File storage
│       └── edge/          # Edge functions
├── store/                 # Redux store
│   ├── slices/            # Redux slices
│   └── index.ts           # Store configuration
├── types/                 # TypeScript definitions
├── utils/                 # Utility functions
├── hooks/                 # Custom React hooks
└── App.tsx               # Root component
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
  // - Email/password form with validation
  // - Loading state during authentication
  // - Error handling with user-friendly messages
  // - Remember me functionality (AsyncStorage)
  // - Navigate to Maps screen on success
  // - Links to Forgot Password and Sign Up
  // - Social login options (if configured)
};
```

#### Sign Up Screen Implementation
```typescript
// src/navigation/screens/auth/SignUpScreen.tsx
interface SignUpFormData {
  email: string;
  password: string;
  confirmPassword: string;
  fullName: string;  // Added for user identification
  organization?: string;  // Optional for future use
}

// Implementation notes:
// - For users added directly to DB:
//   - They receive an activation email with temporary password
//   - On first login, force password change
// - For self-signup users:
//   - Standard registration flow
//   - Email verification required
```

#### Password Reset Implementation
```typescript
// src/navigation/screens/auth/ForgotPasswordScreen.tsx
// In-app reset request that triggers web form email
interface PasswordResetData {
  email: string;
}

// Web form implementation (separate web app):
// - Hosted on Supabase or separate domain
// - Handles actual password reset with token
// - Mobile app opens web reset link in browser
```

#### Sign Out Implementation
```typescript
// Located in side drawer menu
// Clears local session, SQLite cache, and returns to login
// Shows confirmation dialog before signing out
```

### 4.2 User Roles & Permissions

```typescript
enum UserRole {
  PROJECT_ADMIN = 'project_admin',
  PROJECT_MEMBER = 'project_member',
  WW_ADMIN = 'ww_admin'  // Special system-wide admin role
}

// WW_ADMIN capabilities:
// - Access developer menu
// - Grant WW_ADMIN to other users
// - View all projects (read-only)
// - Access system diagnostics

// Role checking implementation:
const hasWWAdminRole = (user: User): boolean => {
  return user.roles?.includes('ww_admin') || false;
};
```

---

## 5. Core Features Implementation

### 5.1 Navigation Structure

#### Bottom Tab Navigation with FAB
```typescript
// src/navigation/BottomTabNavigator.tsx
const TAB_SCREENS = [
  { name: 'Maps', component: MapsScreen, icon: 'map-marker' },
  { name: 'Projects', component: ProjectsScreen, icon: 'folder' },
  { name: 'Deployments', component: DeploymentsScreen, icon: 'camera' },
  { name: 'Devices', component: DevicesScreen, icon: 'bluetooth' }
];

// FAB Configuration:
// - Visible on Maps screen (Start/End Deployment)
// - Visible on Projects screen (Add Project)
// - Hidden on functional screens
// - Drag-to-show gesture on other screens
```

#### Side Drawer Menu (Always Accessible)
```typescript
// src/navigation/DrawerNavigator.tsx
const DrawerContent = () => {
  return (
    <>
      {/* User Section */}
      <UserProfile showSyncStatus={true} />
      
      {/* Main Menu Items */}
      <DrawerItem label="Profile" onPress={navigateToProfile} />
      <DrawerItem label="Settings" onPress={navigateToSettings} />
      
      {/* Developer Menu - Only for WW_ADMIN or Dev Environment */}
      {(isDevelopment || hasWWAdminRole) && (
        <DrawerSection title="Developer Tools">
          <DrawerItem label="BLE Testing" />
          <DrawerItem label="DFU Tools" />
          <DrawerItem label="Sync Diagnostics" />
        </DrawerSection>
      )}
      
      <DrawerItem label="Sign Out" onPress={handleSignOut} />
      <AppVersion />
    </>
  );
};
```

### 5.2 Maps Screen (Home)

```typescript
// src/navigation/screens/MapsScreen.tsx
interface MapsScreenProps {
  // Features to implement:
  // - Display map centered on user location or last deployment
  // - Show active deployment markers with clustering
  // - Offline map tile caching (last viewed area)
  // - FAB buttons (context-aware):
  //   - Start Deployment (Green) - always visible
  //   - End Deployment (Yellow) - visible when deployments exist
  
  // Sync status indicator near user avatar
  // iOS compatibility check for react-native-maps
}

// Offline Maps Implementation:
// - Cache map tiles for viewed areas
// - Store last 100 MB of map data
// - Alert user when using cached maps
```

### 5.3 Start Deployment Flow (Enhanced)

#### Step 1: Project Selection (Improved UI)
```typescript
// src/navigation/screens/deployment/start/ProjectSelectionScreen.tsx
interface ProjectSelectionState {
  selectedProjectId: string | null;
  deploymentName: string;
  searchQuery: string;
}

// New implementation with cards instead of dropdown:
// - Display project cards in scrollable list
// - Search bar for filtering projects
// - FAB for "Add new project"
// - Show project sync status on each card
// - Deployment name input at top
```

#### Step 2: New Project Creation
```typescript
// All fields from Figma design captured
// Members added by email with role selection
// Sync indicator shows if creating offline
```

#### Step 3: Device Discovery (Enhanced)
```typescript
// Device filtering options:
enum DeviceFilter {
  ALL = 'all',
  WW_DEVICES = 'ww_devices',
  OTHER_DEVICES = 'other',
  KNOWN_NEARBY = 'known_nearby'  // Based on GPS proximity
}

// Permission request card UI implementation
// Animated scanning indicator
// Signal strength visualization
```

#### Step 4: Deployment Configuration
```typescript
interface DeploymentConfig {
  // ... existing fields ...
  timelapseInterval?: number; // Default: 30 seconds
  
  // Address lookup implementation:
  // - Use reverse geocoding API
  // - Update lat/long when address edited
  // - Update address when map location changed
}
```

#### Step 5 & 6: Camera & Final Setup
```typescript
// Camera integration:
// - Support both camera capture and gallery selection
// - Store images in Supabase storage
// - Save storage URL in database (not base64)
```

### 5.4 End Deployment Flow (3 Screens from Figma)
```typescript
// Screen 1: Device Search
// Screen 2: List of nearby devices
// Screen 3: Deployment details with map
//          - Shows location, lat/long
//          - End Deployment button
//          - Success/Failure screen with Home button
```

### 5.5 Projects Screen

```typescript
// Navigation to filtered deployments after successful creation
// Search functionality for projects
// Project cards with sync status indicators
```

### 5.6 Project Details Screen

```typescript
// Member Management UI (No Profile Pictures):
interface MemberListProps {
  members: Array<{
    id: string;
    fullName: string;
    email: string;
    role: UserRole;
  }>;
}

// Best practice UI for member list:
// - Compact list with name and role
// - Tap member to see full details in modal
// - Search by email or name
// - Add member by email with role dropdown
// - Remove member confirmation dialog
```

### 5.7 Deployments Screen

```typescript
// Show deployment start and end dates
// Include last_updated timestamp
// Filter tabs: Active | Ended | All
```

### 5.8 Devices Screen

```typescript
// Developer features moved to drawer menu
// Regular features:
// - Scan for devices
// - Test camera (non-deployed devices only)
// - View device info
// - Battery and firmware display
```

---

## 6. Offline Support Architecture

### 6.1 Database Schema with Logical Deletes

```typescript
// All tables include deleted_at field for logical deletes
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
      deleted_at DATETIME,  -- Logical delete
      synced BOOLEAN DEFAULT 0
    )
  `,
  
  local_projects: `
    CREATE TABLE IF NOT EXISTS local_projects (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_at DATETIME,  -- Logical delete
      synced BOOLEAN DEFAULT 0
    )
  `
};
```

### 6.2 Sync Status Management

```typescript
// UI Components for sync status
interface SyncStatusIndicator {
  overall: SyncStatus;      // Near avatar icon
  project?: ProjectSyncStatus;  // Per project card
}

// Visual indicators:
// - Green check: Synced
// - Yellow arrow: Syncing
// - Red exclamation: Error
// - Gray clock: Pending
```

---

## 7. Supabase Integration

### 7.1 Database Schema (Updated)

```sql
-- Remove organization table for now (future-proofed in code)
-- All tables include deleted_at for logical deletes

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES auth.users(id) NOT NULL,
  -- organization_id UUID,  -- Reserved for future
  sampling_design TEXT,
  description TEXT,
  website TEXT,
  is_private BOOLEAN DEFAULT false,
  using_bait BOOLEAN DEFAULT false,
  monitoring_marked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ  -- Logical delete
);

-- Add deleted_at to all tables for logical deletes
-- Create indexes on deleted_at for query performance
CREATE INDEX idx_projects_deleted_at ON projects(deleted_at);
```

### 7.2 Edge Functions

#### LoRaWAN Data Webhook (Placeholder)
```typescript
// supabase/functions/lorawan-webhook/index.ts
// Mock implementation for testing
// Will be updated once IoT camera message structure is defined

serve(async (req) => {
  try {
    // Parse LoRaWAN message (structure TBD)
    const payload = await req.json();
    
    // Expected data from design:
    // - Device ID
    // - Battery level
    // - SD card usage
    // - GPS coordinates (if available)
    // - Timestamp
    
    // Mock processing for now
    console.log('LoRaWAN message received:', payload);
    
    // Update deployment with received data
    // Implementation pending IoT camera specs
    
    return new Response(JSON.stringify({ success: true }));
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
```

### 7.3 Image Storage Best Practice

```typescript
// Best practice: Store images in Supabase Storage, URLs in database
interface ImageStorage {
  async uploadImage(image: File | Blob, path: string): Promise<string> {
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('deployment-images')
      .upload(path, image);
    
    if (error) throw error;
    
    // Get public URL
    const { publicURL } = supabase.storage
      .from('deployment-images')
      .getPublicUrl(path);
    
    // Store URL in database, not base64
    return publicURL;
  }
}
```

---

## 8. State Management

### 8.1 Redux Store Structure (Updated)

```typescript
export const store = configureStore({
  reducer: {
    auth: authSlice.reducer,
    projects: projectsSlice.reducer,
    deployments: deploymentsSlice.reducer,
    devices: devicesSlice.reducer,
    ble: bleSlice.reducer,
    offline: offlineSlice.reducer,
    sync: syncSlice.reducer,  // Added for sync status
    user: userSlice.reducer    // Added for user profile
  }
});
```

---

## 9. Implementation Guidelines

### 9.1 Development Workflow

#### Testing Account Configuration
```typescript
// Single test account with role switching
interface TestAccount {
  email: 'dev@wildlifewatcher.ai';
  roles: ['project_admin', 'project_member', 'ww_admin'];
  
  // Role switcher in developer menu
  switchRole(role: UserRole): void;
}
```

#### Feature Grouping for Parallel Development

**Foundation Phase (Week 1)**
- Authentication & user management
- Navigation structure
- Offline infrastructure
- Redux store setup

**Core Features Phase (Week 2-3)**
- Projects CRUD (Team A)
- Deployment flows (Team B)
- Device management (Team C)
- Sync services (Team D)

**Integration Phase (Week 4)**
- End-to-end testing
- Sync conflict resolution
- LoRaWAN integration
- Production preparation

### 9.2 Acceptance Criteria Checklist

#### Authentication ✓
- [ ] User can sign up with email
- [ ] User can login with credentials
- [ ] Password reset via web form
- [ ] Session persistence
- [ ] Sign out from drawer menu

#### Projects ✓
- [ ] Create new project
- [ ] View project list
- [ ] Search projects
- [ ] Edit project (admin only)
- [ ] Add/remove members (admin only)
- [ ] Offline project creation

#### Deployments ✓
- [ ] Start deployment flow
- [ ] Device discovery via BLE
- [ ] Camera preview
- [ ] Location selection
- [ ] End deployment flow
- [ ] Offline deployment support

#### Sync ✓
- [ ] Queue operations offline
- [ ] Auto-sync when online
- [ ] Conflict resolution
- [ ] Sync status indicators
- [ ] Error recovery

---

## 10. Production Readiness

### 10.1 App Store Requirements

```typescript
// iOS App Store
- Privacy policy URL
- Terms of service URL
- App screenshots (6.5", 5.5")
- App icon (1024x1024)
- Export compliance (encryption)

// Google Play Store
- Privacy policy URL
- App screenshots
- Feature graphic (1024x500)
- Content rating questionnaire
- Target API level compliance
```

### 10.2 Production Configuration

```typescript
// Environment-specific configs
const config = {
  development: {
    showDevMenu: true,
    enableLogging: true,
    mockLoRaWAN: true
  },
  production: {
    showDevMenu: false,
    enableLogging: false,
    mockLoRaWAN: false,
    sentryDSN: process.env.SENTRY_DSN,
    analyticsId: process.env.ANALYTICS_ID
  }
};
```

### 10.3 Security Checklist

- [ ] API keys in secure storage
- [ ] Certificate pinning for API calls
- [ ] Encrypted local database
- [ ] Secure BLE pairing
- [ ] Session timeout handling
- [ ] Input validation
- [ ] SQL injection prevention

---

## Appendix A: Feature Mapping to Figma Screens

| Figma Screen | Implementation Section | Status |
|--------------|----------------------|---------|
| Login | 4.1 Login Screen | MVP |
| Sign Up | 4.1 Sign Up Screen | MVP |
| Maps (Home) | 5.2 Maps Screen | MVP |
| Start Deployment (1-4) | 5.3 Start Deployment | MVP |
| End Deployment | 5.4 End Deployment | MVP |
| Projects List | 5.5 Projects Screen | MVP |
| Project Details | 5.6 Project Details | MVP |
| Deployments | 5.7 Deployments | MVP |
| Devices | 5.8 Devices Screen | MVP |
| Developer Menu | 5.1 Drawer Menu | MVP |

---

## Appendix B: AI Model Integration (Future)

*Placeholder for AI model management specifications*
- Model deployment to camera
- Model version tracking
- Image processing pipeline
- Edge AI capabilities

---

**End of Document**