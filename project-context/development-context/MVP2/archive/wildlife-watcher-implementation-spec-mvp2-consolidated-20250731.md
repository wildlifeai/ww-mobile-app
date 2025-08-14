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
- **API**: Application Programming Interface - how different software components communicate
- **Redux**: State management system for maintaining app data consistency

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

### What This App Does

The Wildlife Watcher Mobile App is a field companion tool for researchers and conservationists who deploy camera traps to monitor wildlife. Think of it as a smart remote control and data logger for wildlife cameras. Field workers use this app to set up cameras in remote locations, configure their settings (like whether to take photos on motion detection or at regular intervals), and track where each camera is deployed. The app is designed to work without internet connection since camera deployments often happen in areas with no cell service, syncing all the collected data once the user returns to connectivity.

The app connects to Wildlife Watcher cameras via Bluetooth, similar to how your phone connects to wireless earbuds. Users can test the camera, preview what it sees, update its software, and start or end monitoring sessions all from their phone. Each deployment is linked to a research project, making it easy for teams to collaborate and track their conservation efforts across multiple sites.

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

### What We've Built So Far

We've successfully upgraded the app's foundation to use the latest mobile development frameworks, ensuring it will work on the newest phones and operating systems. The Bluetooth connection system that allows the app to talk to wildlife cameras has been built and tested with real devices. We've also set up the basic navigation structure - the menus, screens, and buttons users will interact with. Think of this phase as building the frame of a house - the structure is there, but we still need to add the rooms, plumbing, and electrical systems.

The next phase involves building the actual features users will interact with: the login system, the ability to create and manage research projects, the camera deployment workflow, and most importantly, the offline synchronization system that ensures no data is lost when working in remote areas without internet.

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

### How the App is Organized

Think of the app's architecture like a well-organized filing cabinet. Each drawer contains related items, and within each drawer are folders for specific types of documents. The 'components' drawer contains reusable pieces of the user interface (like buttons and forms that appear in multiple places). The 'navigation' drawer defines how users move between different screens. The 'services' drawer contains all the business logic - the rules and processes that make the app work, like how to connect to a camera or save data offline.

This organization allows multiple developers to work on different features simultaneously without interfering with each other, much like how different departments in a company can work independently while still collaborating toward the same goal. The structure also makes it easier to maintain and update the app over time, as each piece has its own designated place.

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

### How Users Access the App

The authentication system is like a security checkpoint at a building. Users need to prove who they are (login with email and password) before they can access the app's features. New users can sign up for an account, similar to registering for any online service. If users forget their password, they can request a reset link via email, just like most apps and websites offer today.

For organizations that want to pre-register their team members, administrators can add users directly to the system. These users receive an email invitation to set up their password and activate their account. Once logged in, the app remembers the user (if they choose), so they don't have to log in every time they open it - particularly useful when working in the field.

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

### Understanding User Roles

The app has three types of users, similar to different access levels in an office building. **Project Members** are like regular employees - they can use the facilities (start deployments, view data) but can't change the office layout. **Project Admins** are like department managers - they can rearrange their department (edit projects, add team members) and have all the abilities of regular members. **WW Admins** are like building maintenance staff - they have special access to technical areas (developer tools, system diagnostics) that regular users don't need or see.

These roles ensure that team members have appropriate access to features they need while preventing accidental changes to critical settings. For example, only Project Admins can add new team members to a project, preventing unauthorized access to sensitive research data.

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

### How Users Move Through the App

The app uses two main navigation patterns that smartphone users are already familiar with. At the bottom of the screen, there are four tabs (Maps, Projects, Deployments, Devices) that users can tap to switch between major sections - similar to tabs in Instagram or Twitter. There's also a slide-out menu (accessed by swiping from the left or tapping the menu icon) that contains user profile settings, sign-out option, and developer tools for technical users.

Floating Action Buttons (FABs) appear on certain screens for primary actions - like the green "Start Deployment" button that floats above the map. These buttons intelligently show or hide based on context; for example, the "End Deployment" button only appears when there are active deployments to end. On screens where the FAB might cover important content, users can drag to show or hide it as needed.

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

### The Main Dashboard

When users open the app, they see a map - their command center for field operations. This map shows their current location (with permission) and markers for all their active camera deployments. If multiple cameras are deployed close together, the markers intelligently group into clusters that expand when zoomed in, preventing a cluttered view.

The map works even without internet connection by storing recently viewed areas on the phone. A small indicator near the user's profile picture shows whether the app is synced with the cloud (green check), syncing data (spinning arrow), or waiting for internet connection (gray clock). The prominent green "Start Deployment" button floats in the corner, ready for when users arrive at a new camera location. If there are active deployments, a yellow "End Deployment" button also appears.

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

### Setting Up a Camera in the Field

Starting a deployment is like setting up a security camera, but for wildlife. The process guides users through several steps to ensure the camera is properly configured and documented. First, users select which research project this camera belongs to (or create a new one). They can search through their projects if they have many, and each project card shows whether it's synced or waiting to upload.

Next, the app searches for nearby cameras using Bluetooth, displaying them in a list with signal strength indicators - stronger signals mean the camera is closer. Once connected, users configure the deployment settings: marking the exact location on a map, choosing whether the camera should trigger on motion or take photos at regular intervals (like every 30 seconds for time-lapse studies).

Before finalizing, users can preview what the camera sees to ensure it's positioned correctly, then document the installation with a photo of the camera's location and notes about the site. All this information is saved locally if there's no internet, automatically uploading when connection is restored.

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

### Retrieving a Camera from the Field

When it's time to collect a camera, the end deployment process ensures all data is properly saved and the deployment is officially closed. Users start by scanning for nearby devices, then select their camera from the list. The app shows the deployment details including a map of where it was deployed and how long it's been active. 

After confirming they want to end the deployment, the app communicates with the camera to stop recording and marks the deployment as complete in the database. Users see a success message and can immediately start a new deployment with the same camera if needed. This process ensures there's a clear record of when each monitoring session started and ended, crucial for scientific data collection.

```typescript
// Screen 1: Device Search
// Screen 2: List of nearby devices
// Screen 3: Deployment details with map
//          - Shows location, lat/long
//          - End Deployment button
//          - Success/Failure screen with Home button
```

### 5.5 Projects Screen

### Managing Research Projects

The Projects screen is like a filing system for research initiatives. Each project appears as a card showing key information: project name, description, number of team members, and deployment counts. Users can search through projects if they have many, and a floating button lets them create new projects instantly.

Each project card also shows a sync indicator, so users know if their recent changes have been uploaded to the cloud. Tapping a project opens its details where admins can edit settings and manage team members. After successfully creating a deployment, the app intelligently navigates users to view all deployments for that specific project, maintaining context and reducing navigation steps.

```typescript
// Navigation to filtered deployments after successful creation
// Search functionality for projects
// Project cards with sync status indicators
```

### 5.6 Project Details Screen

### Project Information and Team Management

The project details screen is the control panel for each research project. It displays all project information including the sampling methodology, website, and special settings like whether bait is being used to attract animals. Project admins see an edit button to modify these details, while regular members see this information as read-only.

The team member section shows a clean list of all collaborators with their roles, without cluttering the interface with profile pictures. Admins can add new members by searching for their email address, assign them appropriate roles, and remove members if needed. When adding members, a dropdown lets admins choose whether the new person should be a regular member or a project admin. All these changes sync across the team when internet is available.

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

### Tracking Active and Historical Camera Deployments

The Deployments screen is mission control for all camera activities. It shows every deployment across all projects the user has access to, with tabs to filter between currently active cameras, completed deployments, or view everything at once. Each deployment card displays essential field information: which project it belongs to, the camera name, battery level (received via long-range radio when available), SD card space remaining, and when data was last received.

The screen uses color coding and icons to make status immediately clear - green for healthy active deployments, yellow for cameras needing attention (low battery or full SD card), and gray for completed deployments. Users can pull down to refresh the list, and tapping any deployment shows its complete details including start/end dates and location information.

```typescript
// Show deployment start and end dates
// Include last_updated timestamp
// Filter tabs: Active | Ended | All
```

### 5.8 Devices Screen

### Camera Hardware Management

The Devices screen is the workshop for managing camera hardware. When users are near cameras, they can scan to discover available devices and see which ones are already connected. Each device shows its connection status, battery level, and firmware version. For cameras that aren't currently deployed, users can run a test to check the camera view and ensure everything is working properly before heading into the field.

Advanced features like firmware updates and diagnostic tools have been moved to a special developer menu to keep the main interface clean and simple for regular users. This separation ensures field researchers aren't confused by technical options while still providing access to these tools for trained technicians when needed.

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

### Working Without Internet

The offline system is like having a smart notebook that remembers everything you write and automatically copies it to the cloud when you get back to WiFi. When users are in remote areas without internet, the app stores all their actions locally on the phone - new projects, deployments, changes to settings - everything is saved in a local database.

The app uses a sophisticated conflict resolution system, similar to how Google Docs handles multiple people editing the same document. If two team members make changes while offline, the app intelligently merges their work when both sync. For example, if two people add different members to a project offline, both new members are kept. If two people try to deploy the same camera, the first one wins and the second person is notified of the conflict. Status indicators throughout the app show users when they're working offline and when their changes have been successfully synced to the cloud.

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

### Keeping Users Informed

The sync status system works like a delivery tracking service. Users always know whether their data has been saved to the cloud (green checkmark), is currently uploading (spinning arrow), is waiting for internet (gray clock), or encountered an error (red exclamation mark). These indicators appear in two places: next to the user's profile picture for overall app status, and on individual project cards to show project-specific sync status.

This visual feedback is crucial for field workers who need confidence that their valuable research data is safe. If syncing fails, the app provides clear information about what went wrong and options to retry, ensuring no data is lost due to connectivity issues.

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

### The Cloud Backend

Supabase is like the app's headquarters in the cloud - it stores all the data, manages user accounts, and coordinates between team members. Think of it as a combination of a filing cabinet (database), a security system (authentication), a photo album (file storage), and a message center (real-time updates). When users make changes in the app, those changes are sent to Supabase where they're permanently stored and shared with other team members.

The system includes special security rules (Row Level Security) that ensure users can only see and edit data they have permission to access. For example, users can only see projects they're members of, and only project admins can edit project settings. The database also uses "logical deletes" - when something is deleted, it's marked as deleted but not actually erased, allowing recovery if needed and maintaining a complete audit trail for research purposes.

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

### Processing Camera Data from the Field

Edge functions are like automated postal workers that receive and process messages from cameras in the field. When a camera sends data via LoRaWAN (a long-range, low-power radio system), these functions automatically receive the message, extract important information like battery level and SD card usage, and update the database.

This system is currently set up with placeholder code that will be refined once we receive the exact message format from the camera engineers. The important thing is that the infrastructure is ready - when cameras start sending real data, we just need to update the parsing logic to match the actual message structure. This approach allows field cameras to send status updates even when they're far from cellular networks, using minimal battery power.

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

### Handling Photos Efficiently

When users take photos (like the camera location photo during deployment), the app stores them in Supabase's file storage system, similar to how photos are stored in Google Photos or iCloud. Instead of embedding the actual image data in the database (which would make it slow and bloated), the app uploads the image to storage and just saves the web address (URL) in the database. This is like keeping a photo album separate from your address book, with the address book just noting which album and page to find each photo.

This approach makes the app faster, reduces data usage, and allows for future features like thumbnail generation and content delivery networks (CDNs) that speed up image loading worldwide. It also makes it easier to manage storage costs and implement features like automatic old photo archival.

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

### Keeping App Data Organized

State management is like the app's short-term memory system. While the database stores information permanently, the state management system (using Redux) keeps track of what's happening right now - which user is logged in, what projects are loaded, which camera is connected, and what's being synced. Think of it like your desk while working - you have papers spread out that you're actively using (state), while filed documents are in the cabinet (database).

This system ensures that all parts of the app have access to the same current information. When you update something on one screen, other screens immediately know about it without having to ask the database. It's particularly important for offline functionality, as the state manager coordinates between what's stored locally and what needs to be synced to the cloud.

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

### How We'll Build This App

The development approach is like constructing a building with multiple specialized crews working simultaneously. We'll start with the foundation (authentication, navigation, offline infrastructure) that everything else depends on. Then, different teams can work in parallel - one team building project management features, another working on deployment flows, a third handling device management, and a fourth ensuring everything syncs properly.

For testing, we'll use a single development account that can switch between different user roles, like an actor changing costumes to play different parts. This allows developers to quickly test how the app behaves for different types of users without constantly logging in and out of different accounts. The implementation will follow an agile approach, with features grouped into logical chunks that can be built, tested, and refined independently before being integrated into the complete app.

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

### Preparing for Public Release

Getting the app ready for public release is like preparing a product for store shelves. Both Apple's App Store and Google Play have specific requirements - we need privacy policies explaining how user data is handled, terms of service defining usage rules, and various marketing materials like screenshots and app descriptions. The app icon needs to be designed in multiple sizes, and we must comply with regulations about encryption and data handling.

Beyond the store requirements, we need to ensure the app is secure (encrypted data, secure API connections), stable (crash reporting, error tracking), and performant (fast loading, efficient battery usage). We'll implement different configurations for development versus production, ensuring test features don't accidentally appear in the public version. Analytics will help us understand how users interact with the app, while security measures protect both the research data and the camera hardware from unauthorized access.

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