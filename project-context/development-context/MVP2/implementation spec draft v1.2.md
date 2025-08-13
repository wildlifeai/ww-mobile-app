# Wildlife Watcher Mobile App - MVP Implementation Specification

**Version**: 1.2  
**Date**: August 2025  
**Platform**: React Native (Expo SDK 51)  
**Backend**: Supabase  
**Status**: Ready for AI-Assisted Development with Claude Code

---

## Executive Summary

This specification defines the complete implementation blueprint for the Wildlife Watcher Mobile App MVP. It serves as the authoritative guide for product managers validating Figma designs, developers implementing features, and AI coding assistants (Claude Code) building the application. The document captures all user stories, technical architecture, and implementation details required to deliver a production-ready field deployment tool for wildlife camera management.

Key MVP deliverables include offline-first deployment workflows, Bluetooth camera connectivity, team collaboration features, and comprehensive synchronization capabilities. The app will be built using AI-assisted development with Claude Code, following TDD/BDD practices with Maestro for automated testing.

---

## Glossary of Terms

### Technical Terms
- **API (Application Programming Interface)**: How different software components communicate
- **BLE (Bluetooth Low Energy)**: Wireless communication technology for short-range device connections
- **CDN (Content Delivery Network)**: Distributed servers that deliver content based on geographic location
- **Claude Code**: Anthropic's AI coding assistant for autonomous development
- **DFU (Device Firmware Update)**: Over-the-air firmware update capability via Bluetooth
- **EAS (Expo Application Services)**: Build and deployment service for Expo apps
- **Edge Function**: Serverless functions that run close to users for low latency
- **Expo**: Framework for building React Native apps with managed workflow
- **LoRaWAN**: Long-range, low-power wireless protocol for IoT devices
- **Maestro**: Mobile UI testing framework for automated testing
- **MCP (Model Context Protocol)**: Tool integration protocol for Claude Code
- **OTA (Over-The-Air)**: Remote update capability without physical access
- **Postgres/PostgreSQL**: Open-source relational database system
- **React**: JavaScript library for building user interfaces
- **React Native**: Framework for building native mobile apps using React
- **Redux**: State management system for maintaining app data consistency
- **RLS (Row Level Security)**: Database security feature that restricts data access per user
- **SQLite**: Local database for offline data storage on mobile devices
- **Sub-agents**: Specialized AI agents that handle specific development tasks
- **Supabase**: Open-source Firebase alternative providing backend services
- **Technology Stack**: Collection of technologies used to build an application
- **TDD/BDD**: Test-Driven Development / Behavior-Driven Development methodologies
- **User Story**: Description of a feature from an end-user perspective

### Domain Terms
- **WW Camera**: Wildlife Watcher camera device that this app connects to and manages
- **Deployment**: The process of setting up and activating a camera in the field
- **Sampling Design**: Research methodology for wildlife monitoring
- **Bait Station**: Location where bait is used to attract animals for monitoring
- **Motion Detection**: Camera triggering based on movement
- **Timelapse**: Camera taking photos at regular intervals
- **Project Admin**: User who manages a specific research project
- **WW Admin**: System administrator with special technical access

---

## User Story Mapping

| User Story | Implementation Section | Priority | Status |
|------------|----------------------|----------|---------|
| User registration and first-time setup | Section 4.1 | MVP | 🟡 Partial |
| User login and authentication | Section 4.1 | MVP | ✅ Complete |
| Password reset via web form | Section 4.1, 13 | MVP | 🔄 In Progress |
| Start deployment flow | Section 5.3 | MVP | 🔄 In Progress |
| End deployment flow | Section 5.4 | MVP | ⬜ Planned |
| Project creation and management | Sections 5.5, 5.6 | MVP | ⬜ Planned |
| Member invitation and roles | Section 4.2, 5.6 | MVP | ⬜ Planned |
| Offline field work | Section 6 | MVP | ⬜ Planned |
| Device discovery and testing | Section 5.8 | MVP | 🟡 Partial |
| Firmware updates | Section 5.8 | MVP | 🟡 Partial |
| Deployments monitoring | Section 5.7 | MVP | ⬜ Planned |
| LoRaWAN status updates | Section 7.3 | MVP | ⬜ Planned |
| User profile management | Section 4.3 | MVP | ⬜ Planned |
| AI Model management | Section 14 | Future | ⬜ Placeholder |

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
10. [Production Readiness & Security](#10-production-readiness--security)
11. [Testing Strategy](#11-testing-strategy)
12. [AI Agent Development Guidelines](#12-ai-agent-development-guidelines)
13. [Admin Portal Integration](#13-admin-portal-integration)
14. [AI Model & Firmware Management](#14-ai-model--firmware-management)
15. [Actions & Clarifications Needed](#15-actions--clarifications-needed)

---

## 1. Project Overview

### What This App Does

The Wildlife Watcher Mobile App empowers conservation researchers to deploy and manage camera traps in remote locations worldwide. Field teams use this app to configure Wildlife Watcher cameras via Bluetooth, setting parameters like motion detection sensitivity or timelapse intervals (e.g., capturing an image every 30 seconds for phenology studies). Each deployment is precisely geolocated and linked to a research project, enabling collaborative monitoring across vast landscapes.

The app's offline-first architecture ensures reliable operation in areas without cellular coverage - a critical requirement since camera deployments often occur in pristine wilderness areas. When field teams return to connectivity, all collected data automatically synchronizes with the cloud, maintaining data integrity across distributed research teams. The system also receives long-range status updates via LoRaWAN, alerting researchers when cameras need attention (low battery, full SD card) without requiring physical visits to remote sites.

### Application Details
- **Name**: Wildlife Watcher Mobile App
- **Bundle ID (iOS)**: `com.wildlife.wildlifewatcher` (production)
- **Package Name (Android)**: `com.wildlife.wildlifewatcher` (production)
- **Development IDs**: Use `.expo` suffix during development for side-by-side testing
- **Purpose**: Field deployment and management of wildlife monitoring cameras
- **Target Users**: Conservation researchers, field technicians, citizen scientists
- **Scale**: Designed to handle small projects (2-3 cameras) to large initiatives (100+ cameras across multiple sites)

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

// Testing (Development)
- maestro (UI automation testing)
- detox (optional alternative)

// File Management
- expo-file-system (for firmware/model storage)
- expo-media-library (for photo management)
```

---

## 2. Current Implementation Status

### Completed Features

The authentication flow is largely complete, with login functionality working and tested. Users can successfully authenticate against the Supabase backend, and sessions persist appropriately. The password reset flow currently opens the app, but needs modification to support web-based reset for users accessing the link from other devices. The core Bluetooth infrastructure for camera communication has been thoroughly tested with real Wildlife Watcher devices, successfully implementing the PING/PONG protocol and Nordic DFU firmware updates.

The navigation structure is in place with bottom tabs and drawer menu configured. The Maps screen exists but needs the floating action buttons for deployment workflows. Basic Redux store configuration is complete, ready for feature-specific slices to be added as development progresses.

### Features Requiring Implementation

Several critical user flows need to be built or completed. The member invitation system needs to be created, allowing project admins to add users who may not yet have accounts. The offline synchronization infrastructure is planned but not yet implemented - this is crucial for field operations. The start and end deployment flows exist partially but need completion, particularly the project selection improvements and camera configuration steps.

User profile management needs to be added, initially as optional fields with indicators showing when profiles are incomplete. The LoRaWAN webhook for receiving camera status updates needs to be implemented as an Edge Function, though the exact message format is still being finalized by the hardware team. Image storage with CDN optimization and thumbnail generation needs to be set up for deployment photos.

### Development Environment Status
- ✅ Expo SDK 51 migration complete
- ✅ EAS Build configuration working
- ✅ Development builds on Android tested
- 🟡 iOS development builds need testing with team devices
- ✅ BLE functionality verified with real WW cameras
- 🟡 Password reset needs web form implementation
- ⬜ Maestro testing framework needs setup

---

## 3. Architecture Overview

### System Architecture Philosophy

The app follows a modular, offline-first architecture designed for collaborative AI-human development. Each module is self-contained with clear interfaces, allowing Claude Code sub-agents to work on different features simultaneously without conflicts. The architecture prioritizes data integrity in offline scenarios, user experience in low-connectivity environments, and maintainability as the system scales from MVP to full production.

The offline-first approach means every operation saves locally first, updates the UI immediately for responsiveness, then queues for remote synchronization. This ensures field researchers never lose data due to connectivity issues. The sync system uses intelligent conflict resolution - for instance, if two team members edit the same project offline, member lists are merged (union of both), while deployment end status always takes precedence over active status to prevent orphaned deployments.

### Project Structure
```
wildlife-watcher-mobile-app/
├── src/                    # Mobile app source
│   ├── components/         # Reusable UI components
│   │   ├── common/        # Buttons, inputs, cards
│   │   ├── forms/         # Form components with validation
│   │   ├── sync/          # Sync status indicators
│   │   └── navigation/    # Navigation helpers
│   ├── navigation/        # Navigation configuration
│   │   ├── screens/       # All screen components
│   │   │   ├── auth/      # Login, signup, password reset
│   │   │   ├── deployment/# Start/end deployment flows
│   │   │   ├── projects/  # Project management
│   │   │   └── devices/   # Device management
│   │   ├── stacks/        # Navigation stacks
│   │   └── index          # Root navigation
│   ├── services/          # Business logic & APIs
│   │   ├── ai/           # AI model management
│   │   ├── auth/         # Authentication service
│   │   ├── ble/          # Bluetooth services
│   │   ├── dfu/          # Firmware update services
│   │   ├── offline/      # Offline & sync services
│   │   ├── lorawan/      # LoRaWAN data processing
│   │   ├── storage/      # Image/file management
│   │   └── supabase/     # Supabase client & API
│   ├── store/            # Redux store
│   │   ├── slices/       # Feature-specific slices
│   │   └── index         # Store configuration
│   ├── types/            # TypeScript definitions
│   ├── utils/            # Utility functions
│   ├── hooks/            # Custom React hooks
│   ├── config/           # App configuration
│   │   ├── constants     # App-wide constants
│   │   └── env           # Environment config
│   └── App               # Root component
├── ww-web-portal/         # Admin portal (separate)
│   ├── admin/            # Admin features
│   └── public/           # Password reset pages
├── tests/                 # Test suites
│   ├── maestro/          # UI automation tests
│   └── unit/             # Unit tests
└── docs/                  # Documentation
```

### Data Flow Architecture

The app implements a unidirectional data flow that ensures predictable state management and facilitates testing:

```
User Action → Screen Component → Redux Action → Service Layer → Local SQLite
                                                      ↓
                                              [Offline Queue] ← Network Monitor
                                                      ↓
                                              Background Sync → Supabase
                                                      ↓
                                              Sync Status → Redux → UI Update
```

This architecture ensures that user actions always have immediate feedback (optimistic updates), while maintaining eventual consistency with the cloud database. The offline queue acts as a buffer, storing operations when offline and processing them in order when connectivity returns.

KEY PRINCIPLES:
- Every operation saves locally first
- UI updates immediately (optimistic)
- Queue for remote sync when offline
- Background sync when connected
- Conflict resolution on sync

---

## 4. Authentication & User Management

### 4.1 Authentication Flow

#### User Access Patterns

The app supports three distinct user onboarding paths, each designed for different organizational contexts:

**Path 1: Direct Registration** - New users can self-register through the app, creating their account with email and password. This path is ideal for citizen scientists or independent researchers joining the platform.

**Path 2: Project Invitation** - Project admins invite team members by email. Recipients receive a secure link to set their password (no temporary passwords for security). If the invitation expires (7 days), users can request a fresh link from their Project Admin or WW Admin. This ensures controlled access to research projects.

**Path 3: WW Admin Provisioning** - System administrators can directly create user accounts for organizational deployments, useful for pre-configuring accounts for field teams or workshop participants.

#### Login Screen Implementation
```typescript
// src/navigation/screens/auth/LoginScreen.tsx
interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

const LoginScreen: React.FC = () => {
  // Implementation requirements:
  // - Email validation (RFC 5322 compliant)
  // - Password field with show/hide toggle
  // - Remember me with secure token storage
  // - Loading overlay during authentication
  // - Error messages with retry logic
  // - Navigate to Maps screen on success
  // - Links to Forgot Password and Sign Up
  // - Offline mode detection with appropriate messaging
  
  // Error handling:
  // - Network timeout (suggest offline mode)
  // - Invalid credentials (clear message)
  // - Account locked (contact admin)
  // - Email not verified (resend option)
};
```

#### Sign Up Screen Implementation
```typescript
// src/navigation/screens/auth/SignUpScreen.tsx
interface SignUpFormData {
  email: string;
  password: string;
  confirmPassword: string;
  fullName?: string;  // Optional, defaults to email
  organization?: string;  // Optional for MVP
  acceptTerms: boolean;
}

// Implementation notes:
// - Password strength indicator
// - Real-time validation feedback
// - Terms of service link (opens in browser)
// - Success leads to email verification notice
// - Store partial profile locally for later completion
```

#### Password Reset Implementation
```typescript
// Two-part implementation:

// 1. In-app request (Mobile)
// src/navigation/screens/auth/ForgotPasswordScreen.tsx
interface PasswordResetRequest {
  email: string;
}
// Triggers email with web reset link

// 2. Web form (Portal - See Section 13)
// Hosted at: https://[domain]/auth/reset-password
// Handles actual password reset with token validation
// Mobile-friendly responsive design
// Success message with app deep link
```

#### Sign Out Implementation
```typescript
// Located in DrawerNavigator.tsx
const handleSignOut = async () => {
  // Show confirmation dialog
  // Clear local session
  // Clear SQLite cache (optional - ask user)
  // Clear Redux store
  // Navigate to Login
  // Cancel any pending syncs
};
```

### 4.2 User Roles & Permissions

#### Role Hierarchy and Capabilities

The role system reflects real-world research team structures while maintaining security boundaries:

```typescript
enum UserRole {
  WW_ADMIN = 'ww_admin',        // System administrators
  PROJECT_ADMIN = 'project_admin', // Research project leaders
  PROJECT_MEMBER = 'project_member' // Field team members
}

// Role Capabilities Matrix:
interface RoleCapabilities {
  'ww_admin': {
    accessDevMenu: true,
    manageAllUsers: true,
    viewAllProjects: true,  // Read-only access
    configureSystem: true,
    accessDiagnostics: true
  },
  'project_admin': {
    editProject: true,
    manageProjectMembers: true,
    deleteDeployments: true,
    assignModels: true,
    startEndDeployments: true
  },
  'project_member': {
    viewProject: true,
    startEndDeployments: true,
    testDevices: true
  }
}

// Implementation note: Users can have different roles per project
// Example: User A might be admin for Project 1 but member for Project 2
```

### 4.3 User Profile Management

#### Profile Fields and Implementation

User profiles start minimal and can be enhanced over time, reducing friction for initial adoption:

```typescript
// src/navigation/screens/ProfileScreen.tsx
interface UserProfile {
  email: string;           // Immutable, from auth
  fullName?: string;       // Optional, defaults to email
  organization?: string;   // Optional for MVP
  profilePhoto?: string;   // Optional, stored locally for MVP
  preferences: {
    offlineMapRadius: number;  // km to cache
    syncOnCellular: boolean;
    developerMode: boolean;    // WW_ADMIN only
  };
}

// Profile Completion Indicator:
// Shows red dot on drawer menu profile section if incomplete
// Tapping opens profile screen with fields to complete
// All fields optional but encouraged through UI hints
```

---

## 5. Core Features Implementation

### 5.1 Navigation Structure

#### Navigation Architecture with Context-Aware FABs

The navigation system combines familiar mobile patterns (bottom tabs, drawer menu) with intelligent floating action buttons that appear based on user context. This design minimizes clicks for common field operations while keeping advanced features accessible but not intrusive.

```typescript
// src/navigation/BottomTabNavigator.tsx
const TAB_SCREENS = [
  { 
    name: 'Maps', 
    component: MapsScreen, 
    icon: 'map-marker',
    fab: ['startDeployment', 'endDeployment'] // Context-aware FABs
  },
  { 
    name: 'Projects', 
    component: ProjectsScreen, 
    icon: 'folder',
    fab: ['addProject']
  },
  { 
    name: 'Deployments', 
    component: DeploymentsScreen, 
    icon: 'camera',
    fab: null  // No FAB needed
  },
  { 
    name: 'Devices', 
    component: DevicesScreen, 
    icon: 'bluetooth',
    fab: ['scanDevices']
  }
];

// FAB Intelligence:
// - Start Deployment: Always visible on Maps
// - End Deployment: Only when active deployments exist
// - Hide when keyboard open
// - Drag gesture to show/hide on scroll
```

#### Side Drawer Menu Implementation
```typescript
// src/navigation/DrawerNavigator.tsx
const DrawerContent = () => {
  const { user, syncStatus, hasIncompleteProfile } = useAppState();
  
  return (
    <>
      <UserSection>
        <Avatar source={user.profilePhoto} />
        <Username>{user.fullName || user.email}</Username>
        <SyncStatusBadge status={syncStatus} />
        {hasIncompleteProfile && <ProfileCompletionDot />}
      </UserSection>
      
      <DrawerItem label="Profile" onPress={navigateToProfile} />
      <DrawerItem label="Settings" onPress={navigateToSettings} />
      <DrawerItem label="Offline Maps" onPress={navigateToOfflineMaps} />
      
      {/* Developer Menu - Conditional Rendering */}
      {shouldShowDevMenu() && (
        <DrawerSection title="Developer Tools">
          <DrawerItem label="BLE Diagnostics" />
          <DrawerItem label="Sync Queue Monitor" />
          <DrawerItem label="Database Inspector" />
          <DrawerItem label="Mock LoRaWAN Messages" />
        </DrawerSection>
      )}
      
      <DrawerItem label="Sign Out" onPress={handleSignOut} />
      <AppVersion />
    </>
  );
};

// Developer menu logic:
const shouldShowDevMenu = () => {
  if (__DEV__) return true;  // Always in development
  if (user.role === 'ww_admin' && settings.devMenuEnabled) return true;
  return false;
};
```

### 5.2 Maps Screen (Home)

#### The Field Operations Dashboard

The Maps screen serves as mission control, providing immediate access to deployment operations while maintaining spatial context of research activities:

```typescript
// src/navigation/screens/MapsScreen.tsx
interface MapsScreenState {
  userLocation: Coordinates | null;
  deployments: Deployment[];
  mapRegion: Region;
  isOffline: boolean;
  cachedMapBounds: BoundingBox;
}

const MapsScreen: React.FC = () => {
  // Core features:
  // 1. Location-aware map centering
  // 2. Deployment clustering with smart zoom
  // 3. Offline tile caching (100MB limit)
  // 4. Sync status indicator overlay
  // 5. Context-aware FABs
  
  // Offline map strategy:
  // - Cache viewed areas automatically
  // - Pre-download option in Settings
  // - Show offline indicator when using cached tiles
  // - Graceful degradation for uncached areas
  
  return (
    <MapContainer>
      <MapView
        provider={Platform.OS === 'ios' ? PROVIDER_DEFAULT : PROVIDER_GOOGLE}
        showsUserLocation={true}
        showsMyLocationButton={true}
        onRegionChangeComplete={cacheMapTiles}
      >
        <DeploymentClusters 
          deployments={deployments}
          onPress={showDeploymentDetails}
        />
      </MapView>
      
      <SyncStatusOverlay position="top-right" />
      
      <FABGroup>
        <FAB
          icon="plus"
          label="Start Deployment"
          color="green"
          onPress={navigateToStartDeployment}
        />
        {hasActiveDeployments && (
          <FAB
            icon="stop"
            label="End Deployment"
            color="yellow"
            onPress={navigateToEndDeployment}
          />
        )}
      </FABGroup>
    </MapContainer>
  );
};
```

### 5.3 Start Deployment Flow (Enhanced)

#### Comprehensive Field Deployment Workflow

The start deployment flow guides users through camera setup with intelligent defaults and validation at each step:

#### Step 1: Project Selection (Redesigned)
```typescript
// src/navigation/screens/deployment/start/ProjectSelectionScreen.tsx
const ProjectSelectionScreen: React.FC = () => {
  // New card-based UI replacing dropdown:
  // - Project cards with sync status badges
  // - Search bar for filtering (useful for users with many projects)
  // - Each card shows: name, description, member count, deployment count
  // - FAB for creating new project
  // - Deployment name input at top (auto-generates suggestion)
  
  return (
    <Screen>
      <DeploymentNameInput 
        placeholder="Deployment #[auto-number]"
        value={deploymentName}
        onChangeText={setDeploymentName}
      />
      
      <SearchBar 
        placeholder="Search projects..."
        onChangeText={filterProjects}
      />
      
      <ProjectList
        data={filteredProjects}
        renderItem={({ item }) => (
          <ProjectCard
            project={item}
            syncStatus={item.syncStatus}
            onPress={() => selectProject(item.id)}
          />
        )}
      />
      
      <FAB icon="plus" onPress={navigateToNewProject} />
    </Screen>
  );
};
```

#### Step 2: New Project Creation (If Selected)
```typescript
// Comprehensive project setup with team management
interface NewProjectData {
  name: string;
  owner: string;  // Auto-populated with current user
  samplingDesign: string;
  description: string;
  website?: string;
  members: Array<{ email: string; role: UserRole }>;
  isPrivate: boolean;
  usingBait: boolean;
  monitoringMarked: boolean;
}

// Member addition flow:
// 1. Enter email address
// 2. System checks if user exists
// 3. If exists: Add to project
// 4. If not: Queue invitation email for when online
// 5. Assign role (defaults to PROJECT_MEMBER)
```

#### Step 3: Device Discovery (Enhanced with Filtering)
```typescript
// src/navigation/screens/deployment/start/DeviceDiscoveryScreen.tsx
enum DeviceFilter {
  ALL = 'all',
  WW_DEVICES = 'ww_devices',      // Wildlife Watcher cameras only
  OTHER_DEVICES = 'other',         // Non-WW BLE devices
  KNOWN_NEARBY = 'known_nearby'   // GPS proximity-based filtering
}

const DeviceDiscoveryScreen: React.FC = () => {
  // Smart device filtering:
  // - Prioritize WW cameras at top
  // - Show signal strength indicators
  // - Group by device type
  // - Remember previously connected devices
  
  // Permission handling:
  // - Check BLE permission
  // - Check location permission (needed for BLE on Android)
  // - Show educational card if denied
  // - Provide settings deep link
};
```

#### Step 4: Deployment Configuration
```typescript
interface DeploymentConfig {
  device: BLEDevice;
  location: {
    latitude: number;
    longitude: number;
    address?: string;  // Reverse geocoded
  };
  captureMethod: 'motion' | 'timelapse';
  timelapseInterval?: number;  // Default: 30 seconds
}

// Smart location features:
// - Auto-detect current location
// - Allow manual coordinate entry
// - Address lookup with map update
// - Offline reverse geocoding fallback
```

#### Step 5: Camera Preview
```typescript
// Live preview from camera before finalizing
const CameraPreviewScreen: React.FC = () => {
  // BLE command to trigger snapshot
  // Display image from camera
  // "Take Another" button
  // Image quality validation
  // Positioning guidance overlay
};
```

#### Step 6: Final Setup
```typescript
interface FinalSetupData {
  locationPhoto?: string;      // Camera placement photo
  locationDescription: string;  // Site notes
}

// Photo handling:
// - Camera capture or gallery selection
// - Compress if over size limit (configurable, default 5MB)
// - Queue for upload when online
// - Store locally for offline access
```

### 5.4 End Deployment Flow

#### Streamlined Retrieval Process

The end deployment flow is optimized for quick camera retrieval in the field:

```typescript
// Three-screen flow from Figma:
// Screen 1: Device discovery (reuses component from start flow)
// Screen 2: Nearby devices list with deployment info
// Screen 3: Deployment details with confirmation

const EndDeploymentFlow = () => {
  // Key features:
  // - Auto-connect to previously paired devices
  // - Show deployment duration and statistics
  // - Confirm location matches (prevent wrong camera)
  // - Success/failure handling with clear next steps
  
  // On success:
  // - Mark deployment as ended
  // - Queue sync if offline
  // - Option to immediately start new deployment
};
```

### 5.5 Projects Screen

#### Research Project Management Hub

```typescript
const ProjectsScreen: React.FC = () => {
  // Display features:
  // - Project cards with key metrics
  // - Sync status per project
  // - Search and filter capabilities
  // - Sort by: recent, name, deployment count
  
  // Navigation intelligence:
  // After creating deployment, navigate to:
  // Deployments screen filtered by that project
  
  return (
    <Screen>
      <SearchBar />
      <FilterChips filters={['Active', 'Archived', 'My Projects']} />
      
      <ProjectList
        renderItem={({ item }) => (
          <ProjectCard
            name={item.name}
            description={item.description}
            memberCount={item.members.length}
            activeDeployments={item.activeDeployments}
            totalDeployments={item.totalDeployments}
            syncStatus={item.syncStatus}
            onPress={() => navigateToProjectDetails(item.id)}
          />
        )}
      />
      
      <FAB icon="plus" onPress={navigateToNewProject} />
    </Screen>
  );
};
```

### 5.6 Project Details Screen

#### Comprehensive Project Information and Team Management

```typescript
const ProjectDetailsScreen: React.FC = () => {
  const { isAdmin } = useProjectRole(projectId);
  
  return (
    <ScrollView>
      <ProjectInfo 
        editable={isAdmin}
        onEdit={isAdmin ? handleEdit : undefined}
      />
      
      <Section title="Team Members">
        <MemberList 
          members={members}
          showActions={isAdmin}
          onAddMember={handleAddMember}
          onRemoveMember={handleRemoveMember}
        />
      </Section>
      
      <Section title="Recent Deployments">
        <DeploymentList 
          deployments={recentDeployments}
          limit={5}
          onViewAll={() => navigateToDeployments(projectId)}
        />
      </Section>
    </ScrollView>
  );
};

// Member management UI (no profile pictures per requirements):
const MemberListItem = ({ member, isAdmin }) => (
  <ListItem>
    <Text>{member.fullName || member.email}</Text>
    <RoleBadge role={member.role} />
    {isAdmin && (
      <Menu>
        <MenuItem onPress={() => changeRole(member.id)}>Change Role</MenuItem>
        <MenuItem onPress={() => removeMember(member.id)}>Remove</MenuItem>
      </Menu>
    )}
  </ListItem>
);

// Add member flow:
// 1. Enter email
// 2. Select role
// 3. Check if user exists
// 4. Send invitation if new
// 5. Add to project
```

### 5.7 Deployments Screen

#### Mission Control for Active Operations

```typescript
const DeploymentsScreen: React.FC = () => {
  const [filter, setFilter] = useState<'active' | 'ended' | 'all'>('active');
  
  return (
    <Screen>
      <TabSelector 
        tabs={['Active', 'Ended', 'All']}
        selected={filter}
        onSelect={setFilter}
      />
      
      <DeploymentList
        data={filteredDeployments}
        renderItem={({ item }) => (
          <DeploymentCard
            projectName={item.project.name}
            deviceName={item.device.name}
            batteryLevel={item.batteryLevel}  // From LoRaWAN
            sdCardUsage={item.sdCardUsage}    // From LoRaWAN
            lastUpdate={item.lastDataReceived}
            startDate={item.startedAt}
            endDate={item.endedAt}
            status={item.status}
            onPress={() => navigateToDeploymentDetails(item.id)}
          />
        )}
      />
    </Screen>
  );
};

// Visual indicators:
// 🟢 Green: Healthy (battery > 30%, SD < 80%)
// 🟡 Yellow: Warning (battery 10-30%, SD 80-95%)
// 🔴 Red: Critical (battery < 10%, SD > 95%)
```

### 5.8 Devices Screen

#### Camera Hardware Management Center

```typescript
const DevicesScreen: React.FC = () => {
  return (
    <Screen>
      <DeviceList
        ListHeaderComponent={
          <ScanButton onPress={startScanning} />
        }
        data={devices}
        renderItem={({ item }) => (
          <DeviceCard
            name={item.name}
            connectionStatus={item.status}
            batteryLevel={item.battery}
            firmwareVersion={item.firmware}
            isDeployed={item.deploymentId !== null}
            onPress={() => handleDevicePress(item)}
          />
        )}
      />
    </Screen>
  );
};

// Device actions (non-deployed only):
// - Test camera view
// - Update firmware (if available)
// - Run diagnostics

// Developer menu additions:
// - Force DFU mode
// - BLE packet inspector
// - Mock device simulator
```

---

## 6. Offline Support Architecture

### 6.1 Offline-First Philosophy

#### Why Offline-First Matters for Wildlife Research

Field researchers often work in remote locations without cellular coverage for days or weeks. The app must function fully offline, storing all operations locally and syncing intelligently when connectivity returns. This isn't just a nice-to-have feature - it's essential for the app's core mission. A researcher setting up cameras in a remote rainforest needs confidence that their work is saved, regardless of network availability.

The offline system implements several key strategies:
- **Optimistic Updates**: UI updates immediately, assuming success
- **Smart Caching**: Frequently accessed data cached proactively
- **Conflict Resolution**: Intelligent merging when multiple users edit offline
- **Sync Prioritization**: Critical data (deployments) syncs before metadata

### 6.2 Pre-Deployment Offline Preparation

#### Preparing for Field Work

Before heading into the field, users can prepare their devices for offline operation:

```typescript
// src/navigation/screens/OfflinePrepScreen.tsx
const OfflinePrepScreen: React.FC = () => {
  return (
    <Screen>
      <PreparationChecklist>
        {/* Automatic background syncing always active */}
        <ChecklistItem 
          title="Projects & Members"
          status={projectsSynced ? 'synced' : 'syncing'}
          action="Force Sync"
        />
        
        <ChecklistItem 
          title="Map Tiles"
          subtitle="Cache area around planned deployments"
          status={mapsCached ? 'cached' : 'needs-cache'}
          action="Download Area"
        />
        
        <ChecklistItem 
          title="Device Firmware"
          subtitle="Latest firmware for offline updates"
          status={firmwareDownloaded ? 'ready' : 'download'}
          action="Download"
        />
        
        <ChecklistItem 
          title="AI Models"
          subtitle="Models assigned to your projects"
          status={modelsDownloaded ? 'ready' : 'download'}
          action="Download"
        />
        
        <ChecklistItem 
          title="Test Device Connection"
          subtitle="Verify BLE connectivity"
          status={deviceTested ? 'tested' : 'test'}
          action="Test Now"
        />
      </PreparationChecklist>
      
      <OfflineReadinessScore score={calculateReadiness()} />
    </Screen>
  );
};

// Background sync constantly maintains fresh data
// Manual prep screen for explicit verification before field work
```

### 6.3 Local Database Schema

#### SQLite Schema with Logical Deletes

```typescript
// src/services/offline/schema.ts
export const OFFLINE_SCHEMA = {
  // Queue for operations pending sync
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
      priority INTEGER DEFAULT 0,  -- Higher priority syncs first
      synced BOOLEAN DEFAULT 0
    )
  `,
  
  // Local storage for projects
  local_projects: `
    CREATE TABLE IF NOT EXISTS local_projects (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,  -- JSON blob
      version INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_at DATETIME,  -- Logical delete
      synced BOOLEAN DEFAULT 0,
      sync_error TEXT
    )
  `,
  
  // Local storage for deployments
  local_deployments: `
    CREATE TABLE IF NOT EXISTS local_deployments (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      data TEXT NOT NULL,  -- JSON blob
      status TEXT CHECK(status IN ('active', 'ended')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_at DATETIME,  -- Logical delete
      synced BOOLEAN DEFAULT 0,
      sync_error TEXT,
      FOREIGN KEY (project_id) REFERENCES local_projects(id)
    )
  `,
  
  // Cached user data for offline member addition
  cached_users: `
    CREATE TABLE IF NOT EXISTS cached_users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      full_name TEXT,
      cached_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ttl INTEGER DEFAULT 604800  -- 7 days in seconds
    )
  `
};
```

### 6.4 Offline Service Implementation

```typescript
// src/services/offline/OfflineService.ts
export class OfflineService {
  private db: SQLite.Database;
  private syncInProgress = false;
  private syncQueue: PriorityQueue<SyncOperation>;
  
  constructor() {
    this.db = SQLite.openDatabase('wildlife_watcher.db');
    this.initializeDatabase();
    this.setupNetworkListener();
    this.setupBackgroundSync();
  }
  
  async queueOperation(operation: SyncOperation) {
    // Priority levels:
    // 1000: Deployment end (critical)
    // 900: Deployment start
    // 800: Project updates
    // 700: Member additions
    // 500: Profile updates
    
    const priority = this.calculatePriority(operation);
    
    await this.db.executeSql(
      `INSERT INTO offline_queue 
       (operation_id, operation_type, entity_type, entity_id, payload, priority)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [operation.id, operation.type, operation.entity, 
       operation.entityId, JSON.stringify(operation.data), priority]
    );
    
    // Try immediate sync if online
    if (await this.isOnline()) {
      this.triggerSync();
    }
  }
  
  async syncPendingOperations() {
    if (this.syncInProgress) return;
    
    this.syncInProgress = true;
    this.updateSyncStatus('syncing');
    
    try {
      // Get operations ordered by priority
      const operations = await this.getPendingOperations();
      
      for (const op of operations) {
        try {
          await this.syncOperation(op);
          await this.markSynced(op.id);
        } catch (error) {
          await this.handleSyncError(op, error);
          
          // Stop syncing if critical operation fails
          if (op.priority >= 900) {
            throw error;
          }
        }
      }
      
      this.updateSyncStatus('synced');
    } catch (error) {
      this.updateSyncStatus('error', error.message);
    } finally {
      this.syncInProgress = false;
    }
  }
}
```

### 6.5 Conflict Resolution

```typescript
// src/services/offline/ConflictResolver.ts
export class ConflictResolver {
  resolveDeployment(local: Deployment, remote: Deployment): Deployment {
    // Rule 1: Ended status always wins (prevent orphaned deployments)
    if (remote.status === 'ended' || local.status === 'ended') {
      const ended = remote.status === 'ended' ? remote : local;
      return {
        ...ended,
        // Preserve the earliest end time if both ended
        endedAt: this.earliestDate(local.endedAt, remote.endedAt)
      };
    }
    
    // Rule 2: Most recent update wins for active deployments
    return local.updatedAt > remote.updatedAt ? local : remote;
  }
  
  resolveProject(local: Project, remote: Project): Project {
    // Merge member lists (union of both)
    const mergedMembers = this.mergeUnique(
      local.members,
      remote.members,
      'userId'
    );
    
    // Merge other fields by last-write-wins
    const winner = local.updatedAt > remote.updatedAt ? local : remote;
    
    return {
      ...winner,
      members: mergedMembers,
      updatedAt: new Date().toISOString()
    };
  }
  
  resolveUser(local: User, remote: User): User {
    // Server version wins for auth-related fields
    // Local version wins for preferences
    return {
      ...remote,  // Server auth data
      preferences: local.preferences,  // Local preferences
      profilePhoto: local.profilePhoto  // Local photo (stored on device)
    };
  }
}
```

### 6.6 Sync Status Management

```typescript
// src/components/sync/SyncStatusIndicator.tsx
interface SyncStatus {
  overall: 'synced' | 'syncing' | 'pending' | 'error';
  pendingCount: number;
  lastSync: Date | null;
  errorMessage?: string;
}

const SyncStatusIndicator: React.FC = () => {
  const status = useAppSelector(selectSyncStatus);
  
  return (
    <TouchableOpacity onPress={showSyncDetails}>
      <StatusBadge>
        {status.overall === 'synced' && <CheckIcon color="green" />}
        {status.overall === 'syncing' && <SpinningIcon />}
        {status.overall === 'pending' && <ClockIcon color="gray" />}
        {status.overall === 'error' && <ExclamationIcon color="red" />}
        
        {status.pendingCount > 0 && (
          <PendingBadge>{status.pendingCount}</PendingBadge>
        )}
      </StatusBadge>
    </TouchableOpacity>
  );
};

// Project-level sync indicators on cards
// Overall sync status near user avatar
// Detailed sync view in developer menu
```

---

## 7. Supabase Integration

### 7.1 Database Schema

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";  -- For geospatial queries

-- User roles table (new for WW_ADMIN support)
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('ww_admin', 'user')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id, role)
);

-- Projects table with logical deletes
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES auth.users(id) NOT NULL,
  sampling_design TEXT,
  
  
  ======================== Chunk 2 ============================================
  
  ---

## 8. State Management

### 8.1 Redux Store Architecture

#### Comprehensive State Management for Offline-First Operations

The Redux store serves as the single source of truth for app state, coordinating between local storage, network operations, and UI updates:

```typescript
// src/store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';

const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['auth', 'user', 'offline'],  // Persist these slices
  blacklist: ['ble']  // Don't persist BLE state
};

export const store = configureStore({
  reducer: {
    auth: authSlice.reducer,
    user: userSlice.reducer,
    projects: projectsSlice.reducer,
    deployments: deploymentsSlice.reducer,
    devices: devicesSlice.reducer,
    ble: bleSlice.reducer,
    offline: offlineSlice.reducer,
    sync: syncSlice.reducer,
    ui: uiSlice.reducer,
    models: modelsSlice.reducer  // AI models
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST']
      }
    }).concat(syncMiddleware, offlineMiddleware)
});
```

### 8.2 Core Redux Slices

#### Auth Slice with Role Management
```typescript
// src/store/slices/authSlice.ts
interface AuthState {
  user: User | null;
  session: Session | null;
  roles: UserRole[];
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action) => {
      state.user = action.payload.user;
      state.roles = action.payload.roles;
      state.isAuthenticated = true;
    },
    signOut: (state) => {
      return initialState;
    }
  }
});
```

#### Sync Slice for Status Management
```typescript
// src/store/slices/syncSlice.ts
interface SyncState {
  overall: 'synced' | 'syncing' | 'pending' | 'error';
  entities: {
    projects: EntitySyncStatus;
    deployments: EntitySyncStatus;
    devices: EntitySyncStatus;
  };
  queue: {
    pending: number;
    failed: number;
    processing: string | null;
  };
  lastSync: string | null;
  errors: SyncError[];
}

interface EntitySyncStatus {
  status: 'synced' | 'syncing' | 'pending' | 'error';
  lastSync: string | null;
  pendingCount: number;
}
```

#### Offline Slice for Queue Management
```typescript
// src/store/slices/offlineSlice.ts
interface OfflineState {
  isOnline: boolean;
  isOfflineModeEnabled: boolean;  // User preference
  cachedData: {
    projects: number;
    deployments: number;
    users: number;
    mapTiles:# Wildlife Watcher Mobile App - MVP Implementation Specification

**Version**: 1.2  
**Date**: August 2025  
**Platform**: React Native (Expo SDK 51)  
**Backend**: Supabase  
**Status**: Ready for AI-Assisted Development with Claude Code

---

## Executive Summary

This specification defines the complete implementation blueprint for the Wildlife Watcher Mobile App MVP. It serves as the authoritative guide for product managers validating Figma designs, developers implementing features, and AI coding assistants (Claude Code) building the application. The document captures all user stories, technical architecture, and implementation details required to deliver a production-ready field deployment tool for wildlife camera management.

Key MVP deliverables include offline-first deployment workflows, Bluetooth camera connectivity, team collaboration features, and comprehensive synchronization capabilities. The app will be built using AI-assisted development with Claude Code, following TDD/BDD practices with Maestro for automated testing.

---

## Glossary of Terms

### Technical Terms
- **API (Application Programming Interface)**: How different software components communicate
- **BLE (Bluetooth Low Energy)**: Wireless communication technology for short-range device connections
- **CDN (Content Delivery Network)**: Distributed servers that deliver content based on geographic location
- **Claude Code**: Anthropic's AI coding assistant for autonomous development
- **DFU (Device Firmware Update)**: Over-the-air firmware update capability via Bluetooth
- **EAS (Expo Application Services)**: Build and deployment service for Expo apps
- **Edge Function**: Serverless functions that run close to users for low latency
- **Expo**: Framework for building React Native apps with managed workflow
- **LoRaWAN**: Long-range, low-power wireless protocol for IoT devices
- **Maestro**: Mobile UI testing framework for automated testing
- **MCP (Model Context Protocol)**: Tool integration protocol for Claude Code
- **OTA (Over-The-Air)**: Remote update capability without physical access
- **Postgres/PostgreSQL**: Open-source relational database system
- **React**: JavaScript library for building user interfaces
- **React Native**: Framework for building native mobile apps using React
- **Redux**: State management system for maintaining app data consistency
- **RLS (Row Level Security)**: Database security feature that restricts data access per user
- **SQLite**: Local database for offline data storage on mobile devices
- **Sub-agents**: Specialized AI agents that handle specific development tasks
- **Supabase**: Open-source Firebase alternative providing backend services
- **Technology Stack**: Collection of technologies used to build an application
- **TDD/BDD**: Test-Driven Development / Behavior-Driven Development methodologies
- **User Story**: Description of a feature from an end-user perspective

### Domain Terms
- **WW Camera**: Wildlife Watcher camera device that this app connects to and manages
- **Deployment**: The process of setting up and activating a camera in the field
- **Sampling Design**: Research methodology for wildlife monitoring
- **Bait Station**: Location where bait is used to attract animals for monitoring
- **Motion Detection**: Camera triggering based on movement
- **Timelapse**: Camera taking photos at regular intervals
- **Project Admin**: User who manages a specific research project
- **WW Admin**: System administrator with special technical access

---

## User Story Mapping

| User Story | Implementation Section | Priority | Status |
|------------|----------------------|----------|---------|
| User registration and first-time setup | Section 4.1 | MVP | 🟡 Partial |
| User login and authentication | Section 4.1 | MVP | ✅ Complete |
| Password reset via web form | Section 4.1, 13 | MVP | 🔄 In Progress |
| Start deployment flow | Section 5.3 | MVP | 🔄 In Progress |
| End deployment flow | Section 5.4 | MVP | ⬜ Planned |
| Project creation and management | Sections 5.5, 5.6 | MVP | ⬜ Planned |
| Member invitation and roles | Section 4.2, 5.6 | MVP | ⬜ Planned |
| Offline field work | Section 6 | MVP | ⬜ Planned |
| Device discovery and testing | Section 5.8 | MVP | 🟡 Partial |
| Firmware updates | Section 5.8 | MVP | 🟡 Partial |
| Deployments monitoring | Section 5.7 | MVP | ⬜ Planned |
| LoRaWAN status updates | Section 7.3 | MVP | ⬜ Planned |
| User profile management | Section 4.3 | MVP | ⬜ Planned |
| AI Model management | Section 14 | Future | ⬜ Placeholder |

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
10. [Production Readiness & Security](#10-production-readiness--security)
11. [Testing Strategy](#11-testing-strategy)
12. [AI Agent Development Guidelines](#12-ai-agent-development-guidelines)
13. [Admin Portal Integration](#13-admin-portal-integration)
14. [AI Model & Firmware Management](#14-ai-model--firmware-management)
15. [Actions & Clarifications Needed](#15-actions--clarifications-needed)

---

## 1. Project Overview

### What This App Does

The Wildlife Watcher Mobile App empowers conservation researchers to deploy and manage camera traps in remote locations worldwide. Field teams use this app to configure Wildlife Watcher cameras via Bluetooth, setting parameters like motion detection sensitivity or timelapse intervals (e.g., capturing an image every 30 seconds for phenology studies). Each deployment is precisely geolocated and linked to a research project, enabling collaborative monitoring across vast landscapes.

The app's offline-first architecture ensures reliable operation in areas without cellular coverage - a critical requirement since camera deployments often occur in pristine wilderness areas. When field teams return to connectivity, all collected data automatically synchronizes with the cloud, maintaining data integrity across distributed research teams. The system also receives long-range status updates via LoRaWAN, alerting researchers when cameras need attention (low battery, full SD card) without requiring physical visits to remote sites.

### Application Details
- **Name**: Wildlife Watcher Mobile App
- **Bundle ID (iOS)**: `com.wildlife.wildlifewatcher` (production)
- **Package Name (Android)**: `com.wildlife.wildlifewatcher` (production)
- **Development IDs**: Use `.expo` suffix during development for side-by-side testing
- **Purpose**: Field deployment and management of wildlife monitoring cameras
- **Target Users**: Conservation researchers, field technicians, citizen scientists
- **Scale**: Designed to handle small projects (2-3 cameras) to large initiatives (100+ cameras across multiple sites)

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

// Testing (Development)
- maestro (UI automation testing)
- detox (optional alternative)

// File Management
- expo-file-system (for firmware/model storage)
- expo-media-library (for photo management)
```

---

## 2. Current Implementation Status

### Completed Features

The authentication flow is largely complete, with login functionality working and tested. Users can successfully authenticate against the Supabase backend, and sessions persist appropriately. The password reset flow currently opens the app, but needs modification to support web-based reset for users accessing the link from other devices. The core Bluetooth infrastructure for camera communication has been thoroughly tested with real Wildlife Watcher devices, successfully implementing the PING/PONG protocol and Nordic DFU firmware updates.

The navigation structure is in place with bottom tabs and drawer menu configured. The Maps screen exists but needs the floating action buttons for deployment workflows. Basic Redux store configuration is complete, ready for feature-specific slices to be added as development progresses.

### Features Requiring Implementation

Several critical user flows need to be built or completed. The member invitation system needs to be created, allowing project admins to add users who may not yet have accounts. The offline synchronization infrastructure is planned but not yet implemented - this is crucial for field operations. The start and end deployment flows exist partially but need completion, particularly the project selection improvements and camera configuration steps.

User profile management needs to be added, initially as optional fields with indicators showing when profiles are incomplete. The LoRaWAN webhook for receiving camera status updates needs to be implemented as an Edge Function, though the exact message format is still being finalized by the hardware team. Image storage with CDN optimization and thumbnail generation needs to be set up for deployment photos.

### Development Environment Status
- ✅ Expo SDK 51 migration complete
- ✅ EAS Build configuration working
- ✅ Development builds on Android tested
- 🟡 iOS development builds need testing with team devices
- ✅ BLE functionality verified with real WW cameras
- 🟡 Password reset needs web form implementation
- ⬜ Maestro testing framework needs setup

---

## 3. Architecture Overview

### System Architecture Philosophy

The app follows a modular, offline-first architecture designed for collaborative AI-human development. Each module is self-contained with clear interfaces, allowing Claude Code sub-agents to work on different features simultaneously without conflicts. The architecture prioritizes data integrity in offline scenarios, user experience in low-connectivity environments, and maintainability as the system scales from MVP to full production.

The offline-first approach means every operation saves locally first, updates the UI immediately for responsiveness, then queues for remote synchronization. This ensures field researchers never lose data due to connectivity issues. The sync system uses intelligent conflict resolution - for instance, if two team members edit the same project offline, member lists are merged (union of both), while deployment end status always takes precedence over active status to prevent orphaned deployments.

### Project Structure
```
wildlife-watcher-mobile-app/
├── src/                    # Mobile app source
│   ├── components/         # Reusable UI components
│   │   ├── common/        # Buttons, inputs, cards
│   │   ├── forms/         # Form components with validation
│   │   ├── sync/          # Sync status indicators
│   │   └── navigation/    # Navigation helpers
│   ├── navigation/        # Navigation configuration
│   │   ├── screens/       # All screen components
│   │   │   ├── auth/      # Login, signup, password reset
│   │   │   ├── deployment/# Start/end deployment flows
│   │   │   ├── projects/  # Project management
│   │   │   └── devices/   # Device management
│   │   ├── stacks/        # Navigation stacks
│   │   └── index.tsx      # Root navigation
│   ├── services/          # Business logic & APIs
│   │   ├── ai/           # AI model management
│   │   ├── auth/         # Authentication service
│   │   ├── ble/          # Bluetooth services
│   │   ├── dfu/          # Firmware update services
│   │   ├── offline/      # Offline & sync services
│   │   ├── lorawan/      # LoRaWAN data processing
│   │   ├── storage/      # Image/file management
│   │   └── supabase/     # Supabase client & API
│   ├── store/            # Redux store
│   │   ├── slices/       # Feature-specific slices
│   │   └── index.ts      # Store configuration
│   ├── types/            # TypeScript definitions
│   ├── utils/            # Utility functions
│   ├── hooks/            # Custom React hooks
│   ├── config/           # App configuration
│   │   ├── constants.ts  # App-wide constants
│   │   └── env.ts        # Environment config
│   └── App.tsx           # Root component
├── ww-web-portal/         # Admin portal (separate)
│   ├── admin/            # Admin features
│   └── public/           # Password reset pages
├── tests/                 # Test suites
│   ├── maestro/          # UI automation tests
│   └── unit/             # Unit tests
└── docs/                  # Documentation
```

### Data Flow Architecture

The app implements a unidirectional data flow that ensures predictable state management and facilitates testing:

```
User Action → Screen Component → Redux Action → Service Layer → Local SQLite
                                                      ↓
                                              [Offline Queue] ← Network Monitor
                                                      ↓
                                              Background Sync → Supabase
                                                      ↓
                                              Sync Status → Redux → UI Update
```

This architecture ensures that user actions always have immediate feedback (optimistic updates), while maintaining eventual consistency with the cloud database. The offline queue acts as a buffer, storing operations when offline and processing them in order when connectivity returns.

---

## 4. Authentication & User Management

### 4.1 Authentication Flow

#### User Access Patterns

The app supports three distinct user onboarding paths, each designed for different organizational contexts:

**Path 1: Direct Registration** - New users can self-register through the app, creating their account with email and password. This path is ideal for citizen scientists or independent researchers joining the platform.

**Path 2: Project Invitation** - Project admins invite team members by email. Recipients receive a secure link to set their password (no temporary passwords for security). If the invitation expires (7 days), users can request a fresh link from their Project Admin or WW Admin. This ensures controlled access to research projects.

**Path 3: WW Admin Provisioning** - System administrators can directly create user accounts for organizational deployments, useful for pre-configuring accounts for field teams or workshop participants.

#### Login Screen Implementation
```typescript
// src/navigation/screens/auth/LoginScreen.tsx
interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

const LoginScreen: React.FC = () => {
  // Implementation requirements:
  // - Email validation (RFC 5322 compliant)
  // - Password field with show/hide toggle
  // - Remember me with secure token storage
  // - Loading overlay during authentication
  // - Error messages with retry logic
  // - Navigate to Maps screen on success
  // - Links to Forgot Password and Sign Up
  // - Offline mode detection with appropriate messaging
  
  // Error handling:
  // - Network timeout (suggest offline mode)
  // - Invalid credentials (clear message)
  // - Account locked (contact admin)
  // - Email not verified (resend option)
};
```

#### Sign Up Screen Implementation
```typescript
// src/navigation/screens/auth/SignUpScreen.tsx
interface SignUpFormData {
  email: string;
  password: string;
  confirmPassword: string;
  fullName?: string;  // Optional, defaults to email
  organization?: string;  // Optional for MVP
  acceptTerms: boolean;
}

// Implementation notes:
// - Password strength indicator
// - Real-time validation feedback
// - Terms of service link (opens in browser)
// - Success leads to email verification notice
// - Store partial profile locally for later completion
```

#### Password Reset Implementation
```typescript
// Two-part implementation:

// 1. In-app request (Mobile)
// src/navigation/screens/auth/ForgotPasswordScreen.tsx
interface PasswordResetRequest {
  email: string;
}
// Triggers email with web reset link

// 2. Web form (Portal - See Section 13)
// Hosted at: https://[domain]/auth/reset-password
// Handles actual password reset with token validation
// Mobile-friendly responsive design
// Success message with app deep link
```

#### Sign Out Implementation
```typescript
// Located in DrawerNavigator.tsx
const handleSignOut = async () => {
  // Show confirmation dialog
  // Clear local session
  // Clear SQLite cache (optional - ask user)
  // Clear Redux store
  // Navigate to Login
  // Cancel any pending syncs
};
```

### 4.2 User Roles & Permissions

#### Role Hierarchy and Capabilities

The role system reflects real-world research team structures while maintaining security boundaries:

```typescript
enum UserRole {
  WW_ADMIN = 'ww_admin',        // System administrators
  PROJECT_ADMIN = 'project_admin', // Research project leaders
  PROJECT_MEMBER = 'project_member' // Field team members
}

// Role Capabilities Matrix:
interface RoleCapabilities {
  'ww_admin': {
    accessDevMenu: true,
    manageAllUsers: true,
    viewAllProjects: true,  // Read-only access
    configureSystem: true,
    accessDiagnostics: true
  },
  'project_admin': {
    editProject: true,
    manageProjectMembers: true,
    deleteDeployments: true,
    assignModels: true,
    startEndDeployments: true
  },
  'project_member': {
    viewProject: true,
    startEndDeployments: true,
    testDevices: true
  }
}

// Implementation note: Users can have different roles per project
// Example: User A might be admin for Project 1 but member for Project 2
```

### 4.3 User Profile Management

#### Profile Fields and Implementation

User profiles start minimal and can be enhanced over time, reducing friction for initial adoption:

```typescript
// src/navigation/screens/ProfileScreen.tsx
interface UserProfile {
  email: string;           // Immutable, from auth
  fullName?: string;       // Optional, defaults to email
  organization?: string;   // Optional for MVP
  profilePhoto?: string;   // Optional, stored locally for MVP
  preferences: {
    offlineMapRadius: number;  // km to cache
    syncOnCellular: boolean;
    developerMode: boolean;    // WW_ADMIN only
  };
}

// Profile Completion Indicator:
// Shows red dot on drawer menu profile section if incomplete
// Tapping opens profile screen with fields to complete
// All fields optional but encouraged through UI hints
```

---

## 5. Core Features Implementation

### 5.1 Navigation Structure

#### Navigation Architecture with Context-Aware FABs

The navigation system combines familiar mobile patterns (bottom tabs, drawer menu) with intelligent floating action buttons that appear based on user context. This design minimizes clicks for common field operations while keeping advanced features accessible but not intrusive.

```typescript
// src/navigation/BottomTabNavigator.tsx
const TAB_SCREENS = [
  { 
    name: 'Maps', 
    component: MapsScreen, 
    icon: 'map-marker',
    fab: ['startDeployment', 'endDeployment'] // Context-aware FABs
  },
  { 
    name: 'Projects', 
    component: ProjectsScreen, 
    icon: 'folder',
    fab: ['addProject']
  },
  { 
    name: 'Deployments', 
    component: DeploymentsScreen, 
    icon: 'camera',
    fab: null  // No FAB needed
  },
  { 
    name: 'Devices', 
    component: DevicesScreen, 
    icon: 'bluetooth',
    fab: ['scanDevices']
  }
];

// FAB Intelligence:
// - Start Deployment: Always visible on Maps
// - End Deployment: Only when active deployments exist
// - Hide when keyboard open
// - Drag gesture to show/hide on scroll
```

#### Side Drawer Menu Implementation
```typescript
// src/navigation/DrawerNavigator.tsx
const DrawerContent = () => {
  const { user, syncStatus, hasIncompleteProfile } = useAppState();
  
  return (
    <>
      <UserSection>
        <Avatar source={user.profilePhoto} />
        <Username>{user.fullName || user.email}</Username>
        <SyncStatusBadge status={syncStatus} />
        {hasIncompleteProfile && <ProfileCompletionDot />}
      </UserSection>
      
      <DrawerItem label="Profile" onPress={navigateToProfile} />
      <DrawerItem label="Settings" onPress={navigateToSettings} />
      <DrawerItem label="Offline Maps" onPress={navigateToOfflineMaps} />
      
      {/* Developer Menu - Conditional Rendering */}
      {shouldShowDevMenu() && (
        <DrawerSection title="Developer Tools">
          <DrawerItem label="BLE Diagnostics" />
          <DrawerItem label="Sync Queue Monitor" />
          <DrawerItem label="Database Inspector" />
          <DrawerItem label="Mock LoRaWAN Messages" />
        </DrawerSection>
      )}
      
      <DrawerItem label="Sign Out" onPress={handleSignOut} />
      <AppVersion />
    </>
  );
};

// Developer menu logic:
const shouldShowDevMenu = () => {
  if (__DEV__) return true;  // Always in development
  if (user.role === 'ww_admin' && settings.devMenuEnabled) return true;
  return false;
};
```

### 5.2 Maps Screen (Home)

#### The Field Operations Dashboard

The Maps screen serves as mission control, providing immediate access to deployment operations while maintaining spatial context of research activities:

```typescript
// src/navigation/screens/MapsScreen.tsx
interface MapsScreenState {
  userLocation: Coordinates | null;
  deployments: Deployment[];
  mapRegion: Region;
  isOffline: boolean;
  cachedMapBounds: BoundingBox;
}

const MapsScreen: React.FC = () => {
  // Core features:
  // 1. Location-aware map centering
  // 2. Deployment clustering with smart zoom
  // 3. Offline tile caching (100MB limit)
  // 4. Sync status indicator overlay
  // 5. Context-aware FABs
  
  // Offline map strategy:
  // - Cache viewed areas automatically
  // - Pre-download option in Settings
  // - Show offline indicator when using cached tiles
  // - Graceful degradation for uncached areas
  
  return (
    <MapContainer>
      <MapView
        provider={Platform.OS === 'ios' ? PROVIDER_DEFAULT : PROVIDER_GOOGLE}
        showsUserLocation={true}
        showsMyLocationButton={true}
        onRegionChangeComplete={cacheMapTiles}
      >
        <DeploymentClusters 
          deployments={deployments}
          onPress={showDeploymentDetails}
        />
      </MapView>
      
      <SyncStatusOverlay position="top-right" />
      
      <FABGroup>
        <FAB
          icon="plus"
          label="Start Deployment"
          color="green"
          onPress={navigateToStartDeployment}
        />
        {hasActiveDeployments && (
          <FAB
            icon="stop"
            label="End Deployment"
            color="yellow"
            onPress={navigateToEndDeployment}
          />
        )}
      </FABGroup>
    </MapContainer>
  );
};
```

### 5.3 Start Deployment Flow (Enhanced)

#### Comprehensive Field Deployment Workflow

The start deployment flow guides users through camera setup with intelligent defaults and validation at each step:

#### Step 1: Project Selection (Redesigned)
```typescript
// src/navigation/screens/deployment/start/ProjectSelectionScreen.tsx
const ProjectSelectionScreen: React.FC = () => {
  // New card-based UI replacing dropdown:
  // - Project cards with sync status badges
  // - Search bar for filtering (useful for users with many projects)
  // - Each card shows: name, description, member count, deployment count
  // - FAB for creating new project
  // - Deployment name input at top (auto-generates suggestion)
  
  return (
    <Screen>
      <DeploymentNameInput 
        placeholder="Deployment #[auto-number]"
        value={deploymentName}
        onChangeText={setDeploymentName}
      />
      
      <SearchBar 
        placeholder="Search projects..."
        onChangeText={filterProjects}
      />
      
      <ProjectList
        data={filteredProjects}
        renderItem={({ item }) => (
          <ProjectCard
            project={item}
            syncStatus={item.syncStatus}
            onPress={() => selectProject(item.id)}
          />
        )}
      />
      
      <FAB icon="plus" onPress={navigateToNewProject} />
    </Screen>
  );
};
```

#### Step 2: New Project Creation (If Selected)
```typescript
// Comprehensive project setup with team management
interface NewProjectData {
  name: string;
  owner: string;  // Auto-populated with current user
  samplingDesign: string;
  description: string;
  website?: string;
  members: Array<{ email: string; role: UserRole }>;
  isPrivate: boolean;
  usingBait: boolean;
  monitoringMarked: boolean;
}

// Member addition flow:
// 1. Enter email address
// 2. System checks if user exists
// 3. If exists: Add to project
// 4. If not: Queue invitation email for when online
// 5. Assign role (defaults to PROJECT_MEMBER)
```

#### Step 3: Device Discovery (Enhanced with Filtering)
```typescript
// src/navigation/screens/deployment/start/DeviceDiscoveryScreen.tsx
enum DeviceFilter {
  ALL = 'all',
  WW_DEVICES = 'ww_devices',      // Wildlife Watcher cameras only
  OTHER_DEVICES = 'other',         // Non-WW BLE devices
  KNOWN_NEARBY = 'known_nearby'   // GPS proximity-based filtering
}

const DeviceDiscoveryScreen: React.FC = () => {
  // Smart device filtering:
  // - Prioritize WW cameras at top
  // - Show signal strength indicators
  // - Group by device type
  // - Remember previously connected devices
  
  // Permission handling:
  // - Check BLE permission
  // - Check location permission (needed for BLE on Android)
  // - Show educational card if denied
  // - Provide settings deep link
};
```

#### Step 4: Deployment Configuration
```typescript
interface DeploymentConfig {
  device: BLEDevice;
  location: {
    latitude: number;
    longitude: number;
    address?: string;  // Reverse geocoded
  };
  captureMethod: 'motion' | 'timelapse';
  timelapseInterval?: number;  // Default: 30 seconds
}

// Smart location features:
// - Auto-detect current location
// - Allow manual coordinate entry
// - Address lookup with map update
// - Offline reverse geocoding fallback
```

#### Step 5: Camera Preview
```typescript
// Live preview from camera before finalizing
const CameraPreviewScreen: React.FC = () => {
  // BLE command to trigger snapshot
  // Display image from camera
  // "Take Another" button
  // Image quality validation
  // Positioning guidance overlay
};
```

#### Step 6: Final Setup
```typescript
interface FinalSetupData {
  locationPhoto?: string;      // Camera placement photo
  locationDescription: string;  // Site notes
}

// Photo handling:
// - Camera capture or gallery selection
// - Compress if over size limit (configurable, default 5MB)
// - Queue for upload when online
// - Store locally for offline access
```

### 5.4 End Deployment Flow

#### Streamlined Retrieval Process

The end deployment flow is optimized for quick camera retrieval in the field:

```typescript
// Three-screen flow from Figma:
// Screen 1: Device discovery (reuses component from start flow)
// Screen 2: Nearby devices list with deployment info
// Screen 3: Deployment details with confirmation

const EndDeploymentFlow = () => {
  // Key features:
  // - Auto-connect to previously paired devices
  // - Show deployment duration and statistics
  // - Confirm location matches (prevent wrong camera)
  // - Success/failure handling with clear next steps
  
  // On success:
  // - Mark deployment as ended
  // - Queue sync if offline
  // - Option to immediately start new deployment
};
```

### 5.5 Projects Screen

#### Research Project Management Hub

```typescript
const ProjectsScreen: React.FC = () => {
  // Display features:
  // - Project cards with key metrics
  // - Sync status per project
  // - Search and filter capabilities
  // - Sort by: recent, name, deployment count
  
  // Navigation intelligence:
  // After creating deployment, navigate to:
  // Deployments screen filtered by that project
  
  return (
    <Screen>
      <SearchBar />
      <FilterChips filters={['Active', 'Archived', 'My Projects']} />
      
      <ProjectList
        renderItem={({ item }) => (
          <ProjectCard
            name={item.name}
            description={item.description}
            memberCount={item.members.length}
            activeDeployments={item.activeDeployments}
            totalDeployments={item.totalDeployments}
            syncStatus={item.syncStatus}
            onPress={() => navigateToProjectDetails(item.id)}
          />
        )}
      />
      
      <FAB icon="plus" onPress={navigateToNewProject} />
    </Screen>
  );
};
```

### 5.6 Project Details Screen

#### Comprehensive Project Information and Team Management

```typescript
const ProjectDetailsScreen: React.FC = () => {
  const { isAdmin } = useProjectRole(projectId);
  
  return (
    <ScrollView>
      <ProjectInfo 
        editable={isAdmin}
        onEdit={isAdmin ? handleEdit : undefined}
      />
      
      <Section title="Team Members">
        <MemberList 
          members={members}
          showActions={isAdmin}
          onAddMember={handleAddMember}
          onRemoveMember={handleRemoveMember}
        />
      </Section>
      
      <Section title="Recent Deployments">
        <DeploymentList 
          deployments={recentDeployments}
          limit={5}
          onViewAll={() => navigateToDeployments(projectId)}
        />
      </Section>
    </ScrollView>
  );
};

// Member management UI (no profile pictures per requirements):
const MemberListItem = ({ member, isAdmin }) => (
  <ListItem>
    <Text>{member.fullName || member.email}</Text>
    <RoleBadge role={member.role} />
    {isAdmin && (
      <Menu>
        <MenuItem onPress={() => changeRole(member.id)}>Change Role</MenuItem>
        <MenuItem onPress={() => removeMember(member.id)}>Remove</MenuItem>
      </Menu>
    )}
  </ListItem>
);

// Add member flow:
// 1. Enter email
// 2. Select role
// 3. Check if user exists
// 4. Send invitation if new
// 5. Add to project
```

### 5.7 Deployments Screen

#### Mission Control for Active Operations

```typescript
const DeploymentsScreen: React.FC = () => {
  const [filter, setFilter] = useState<'active' | 'ended' | 'all'>('active');
  
  return (
    <Screen>
      <TabSelector 
        tabs={['Active', 'Ended', 'All']}
        selected={filter}
        onSelect={setFilter}
      />
      
      <DeploymentList
        data={filteredDeployments}
        renderItem={({ item }) => (
          <DeploymentCard
            projectName={item.project.name}
            deviceName={item.device.name}
            batteryLevel={item.batteryLevel}  // From LoRaWAN
            sdCardUsage={item.sdCardUsage}    // From LoRaWAN
            lastUpdate={item.lastDataReceived}
            startDate={item.startedAt}
            endDate={item.endedAt}
            status={item.status}
            onPress={() => navigateToDeploymentDetails(item.id)}
          />
        )}
      />
    </Screen>
  );
};

// Visual indicators:
// 🟢 Green: Healthy (battery > 30%, SD < 80%)
// 🟡 Yellow: Warning (battery 10-30%, SD 80-95%)
// 🔴 Red: Critical (battery < 10%, SD > 95%)
```

### 5.8 Devices Screen

#### Camera Hardware Management Center

```typescript
const DevicesScreen: React.FC = () => {
  return (
    <Screen>
      <DeviceList
        ListHeaderComponent={
          <ScanButton onPress={startScanning} />
        }
        data={devices}
        renderItem={({ item }) => (
          <DeviceCard
            name={item.name}
            connectionStatus={item.status}
            batteryLevel={item.battery}
            firmwareVersion={item.firmware}
            isDeployed={item.deploymentId !== null}
            onPress={() => handleDevicePress(item)}
          />
        )}
      />
    </Screen>
  );
};

// Device actions (non-deployed only):
// - Test camera view
// - Update firmware (if available)
// - Run diagnostics

// Developer menu additions:
// - Force DFU mode
// - BLE packet inspector
// - Mock device simulator
```

---

## 6. Offline Support Architecture

### 6.1 Offline-First Philosophy

#### Why Offline-First Matters for Wildlife Research

Field researchers often work in remote locations without cellular coverage for days or weeks. The app must function fully offline, storing all operations locally and syncing intelligently when connectivity returns. This isn't just a nice-to-have feature - it's essential for the app's core mission. A researcher setting up cameras in a remote rainforest needs confidence that their work is saved, regardless of network availability.

The offline system implements several key strategies:
- **Optimistic Updates**: UI updates immediately, assuming success
- **Smart Caching**: Frequently accessed data cached proactively
- **Conflict Resolution**: Intelligent merging when multiple users edit offline
- **Sync Prioritization**: Critical data (deployments) syncs before metadata

### 6.2 Pre-Deployment Offline Preparation

#### Preparing for Field Work

Before heading into the field, users can prepare their devices for offline operation:

```typescript
// src/navigation/screens/OfflinePrepScreen.tsx
const OfflinePrepScreen: React.FC = () => {
  return (
    <Screen>
      <PreparationChecklist>
        {/* Automatic background syncing always active */}
        <ChecklistItem 
          title="Projects & Members"
          status={projectsSynced ? 'synced' : 'syncing'}
          action="Force Sync"
        />
        
        <ChecklistItem 
          title="Map Tiles"
          subtitle="Cache area around planned deployments"
          status={mapsCached ? 'cached' : 'needs-cache'}
          action="Download Area"
        />
        
        <ChecklistItem 
          title="Device Firmware"
          subtitle="Latest firmware for offline updates"
          status={firmwareDownloaded ? 'ready' : 'download'}
          action="Download"
        />
        
        <ChecklistItem 
          title="AI Models"
          subtitle="Models assigned to your projects"
          status={modelsDownloaded ? 'ready' : 'download'}
          action="Download"
        />
        
        <ChecklistItem 
          title="Test Device Connection"
          subtitle="Verify BLE connectivity"
          status={deviceTested ? 'tested' : 'test'}
          action="Test Now"
        />
      </PreparationChecklist>
      
      <OfflineReadinessScore score={calculateReadiness()} />
    </Screen>
  );
};

// Background sync constantly maintains fresh data
// Manual prep screen for explicit verification before field work
```

### 6.3 Local Database Schema

#### SQLite Schema with Logical Deletes

```typescript
// src/services/offline/schema.ts
export const OFFLINE_SCHEMA = {
  // Queue for operations pending sync
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
      priority INTEGER DEFAULT 0,  -- Higher priority syncs first
      synced BOOLEAN DEFAULT 0
    )
  `,
  
  // Local storage for projects
  local_projects: `
    CREATE TABLE IF NOT EXISTS local_projects (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,  -- JSON blob
      version INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_at DATETIME,  -- Logical delete
      synced BOOLEAN DEFAULT 0,
      sync_error TEXT
    )
  `,
  
  // Local storage for deployments
  local_deployments: `
    CREATE TABLE IF NOT EXISTS local_deployments (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      data TEXT NOT NULL,  -- JSON blob
      status TEXT CHECK(status IN ('active', 'ended')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_at DATETIME,  -- Logical delete
      synced BOOLEAN DEFAULT 0,
      sync_error TEXT,
      FOREIGN KEY (project_id) REFERENCES local_projects(id)
    )
  `,
  
  // Cached user data for offline member addition
  cached_users: `
    CREATE TABLE IF NOT EXISTS cached_users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      full_name TEXT,
      cached_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ttl INTEGER DEFAULT 604800  -- 7 days in seconds
    )
  `
};
```

### 6.4 Offline Service Implementation

```typescript
// src/services/offline/OfflineService.ts
export class OfflineService {
  private db: SQLite.Database;
  private syncInProgress = false;
  private syncQueue: PriorityQueue<SyncOperation>;
  
  constructor() {
    this.db = SQLite.openDatabase('wildlife_watcher.db');
    this.initializeDatabase();
    this.setupNetworkListener();
    this.setupBackgroundSync();
  }
  
  async queueOperation(operation: SyncOperation) {
    // Priority levels:
    // 1000: Deployment end (critical)
    // 900: Deployment start
    // 800: Project updates
    // 700: Member additions
    // 500: Profile updates
    
    const priority = this.calculatePriority(operation);
    
    await this.db.executeSql(
      `INSERT INTO offline_queue 
       (operation_id, operation_type, entity_type, entity_id, payload, priority)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [operation.id, operation.type, operation.entity, 
       operation.entityId, JSON.stringify(operation.data), priority]
    );
    
    // Try immediate sync if online
    if (await this.isOnline()) {
      this.triggerSync();
    }
  }
  
  async syncPendingOperations() {
    if (this.syncInProgress) return;
    
    this.syncInProgress = true;
    this.updateSyncStatus('syncing');
    
    try {
      // Get operations ordered by priority
      const operations = await this.getPendingOperations();
      
      for (const op of operations) {
        try {
          await this.syncOperation(op);
          await this.markSynced(op.id);
        } catch (error) {
          await this.handleSyncError(op, error);
          
          // Stop syncing if critical operation fails
          if (op.priority >= 900) {
            throw error;
          }
        }
      }
      
      this.updateSyncStatus('synced');
    } catch (error) {
      this.updateSyncStatus('error', error.message);
    } finally {
      this.syncInProgress = false;
    }
  }
}
```

### 6.5 Conflict Resolution

```typescript
// src/services/offline/ConflictResolver.ts
export class ConflictResolver {
  resolveDeployment(local: Deployment, remote: Deployment): Deployment {
    // Rule 1: Ended status always wins (prevent orphaned deployments)
    if (remote.status === 'ended' || local.status === 'ended') {
      const ended = remote.status === 'ended' ? remote : local;
      return {
        ...ended,
        // Preserve the earliest end time if both ended
        endedAt: this.earliestDate(local.endedAt, remote.endedAt)
      };
    }
    
    // Rule 2: Most recent update wins for active deployments
    return local.updatedAt > remote.updatedAt ? local : remote;
  }
  
  resolveProject(local: Project, remote: Project): Project {
    // Merge member lists (union of both)
    const mergedMembers = this.mergeUnique(
      local.members,
      remote.members,
      'userId'
    );
    
    // Merge other fields by last-write-wins
    const winner = local.updatedAt > remote.updatedAt ? local : remote;
    
    return {
      ...winner,
      members: mergedMembers,
      updatedAt: new Date().toISOString()
    };
  }
  
  resolveUser(local: User, remote: User): User {
    // Server version wins for auth-related fields
    // Local version wins for preferences
    return {
      ...remote,  // Server auth data
      preferences: local.preferences,  // Local preferences
      profilePhoto: local.profilePhoto  // Local photo (stored on device)
    };
  }
}
```

### 6.6 Sync Status Management

```typescript
// src/components/sync/SyncStatusIndicator.tsx
interface SyncStatus {
  overall: 'synced' | 'syncing' | 'pending' | 'error';
  pendingCount: number;
  lastSync: Date | null;
  errorMessage?: string;
}

const SyncStatusIndicator: React.FC = () => {
  const status = useAppSelector(selectSyncStatus);
  
  return (
    <TouchableOpacity onPress={showSyncDetails}>
      <StatusBadge>
        {status.overall === 'synced' && <CheckIcon color="green" />}
        {status.overall === 'syncing' && <SpinningIcon />}
        {status.overall === 'pending' && <ClockIcon color="gray" />}
        {status.overall === 'error' && <ExclamationIcon color="red" />}
        
        {status.pendingCount > 0 && (
          <PendingBadge>{status.pendingCount}</PendingBadge>
        )}
      </StatusBadge>
    </TouchableOpacity>
  );
};

// Project-level sync indicators on cards
// Overall sync status near user avatar
// Detailed sync view in developer menu
```

---

## 7. Supabase Integration

### 7.1 Database Schema

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";  -- For geospatial queries

-- User roles table (new for WW_ADMIN support)
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('ww_admin', 'user')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id, role)
);

-- Projects table with logical deletes
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES auth.users(id) NOT NULL,
  sampling_design TEXT,
  description TEXT,
  website TEXT,
  is_private BOOLEAN DEFAULT false,
  using_bait BOOLEAN DEFAULT false,
  monitoring_marked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,  -- Logical delete
  version INTEGER DEFAULT 1  -- For optimistic locking
);

-- Project members with roles
CREATE TABLE project_members (
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('project_admin', 'project_member')),
  added_at TIMESTAMPTZ DEFAULT NOW(),
  added_by UUID REFERENCES auth.users(id),
  removed_at TIMESTAMPTZ,  -- Logical delete
  PRIMARY KEY (project_id, user_id)
);

-- Devices table
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bluetooth_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  firmware_version TEXT,
  model_type TEXT DEFAULT 'WW_CAMERA',
  battery_level INTEGER,
  last_seen TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ  -- Logical delete
);

-- Deployments table with comprehensive tracking
CREATE TABLE deployments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) NOT NULL,
  device_id UUID REFERENCES devices(id) NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'ended')),
  
  -- Location data with PostGIS support
  location GEOGRAPHY(POINT, 4326),  -- PostGIS point
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  address TEXT,
  location_description TEXT,
  location_photo_url TEXT,
  
  -- Configuration
  capture_method TEXT NOT NULL CHECK (capture_method IN ('motion', 'timelapse')),
  timelapse_interval INTEGER,  -- seconds
  
  -- Status from LoRaWAN
  battery_level INTEGER,
  sd_card_usage INTEGER,  -- percentage
  last_data_received TIMESTAMPTZ,
  
  -- Timestamps and audit
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_by UUID REFERENCES auth.users(id) NOT NULL,
  ended_at TIMESTAMPTZ,
  ended_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,  -- Logical delete
  version INTEGER DEFAULT 1
);

-- LoRaWAN messages storage (raw data)
CREATE TABLE lorawan_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_eui TEXT NOT NULL,
  deployment_id UUID REFERENCES deployments(id),
  raw_payload JSONB NOT NULL,  -- Store complete message
  parsed_data JSONB,  -- Extracted values
  received_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- User invitations for member management
CREATE TABLE user_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  project_id UUID REFERENCES projects(id),
  role TEXT NOT NULL CHECK (role IN ('project_admin', 'project_member')),
  invited_by UUID REFERENCES auth.users(id) NOT NULL,
  invitation_token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_deployments_project_id ON deployments(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_deployments_device_id ON deployments(device_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_deployments_status ON deployments(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_deployments_location ON deployments USING GIST(location);
CREATE INDEX idx_project_members_user_id ON project_members(user_id) WHERE removed_at IS NULL;
CREATE INDEX idx_lorawan_messages_device ON lorawan_messages(device_eui);
CREATE INDEX idx_lorawan_messages_deployment ON lorawan_messages(deployment_id);

-- RLS Policies
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Users can see projects they're members of
CREATE POLICY "Users view their projects" ON projects
  FOR SELECT USING (
    deleted_at IS NULL AND (
      owner_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM project_members 
        WHERE project_id = projects.id 
        AND user_id = auth.uid()
        AND removed_at IS NULL
      )
    )
  );

-- WW Admins can view all projects (read-only)
CREATE POLICY "WW Admins view all projects" ON projects
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'ww_admin'
    )
  );
```

  ======================== Chunk 3 ============================================
  
  ---

## 8. State Management

### 8.1 Redux Store Architecture

#### Comprehensive State Management for Offline-First Operations

The Redux store serves as the single source of truth for app state, coordinating between local storage, network operations, and UI updates:

```typescript
// src/store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';

const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['auth', 'user', 'offline'],  // Persist these slices
  blacklist: ['ble']  // Don't persist BLE state
};

export const store = configureStore({
  reducer: {
    auth: authSlice.reducer,
    user: userSlice.reducer,
    projects: projectsSlice.reducer,
    deployments: deploymentsSlice.reducer,
    devices: devicesSlice.reducer,
    ble: bleSlice.reducer,
    offline: offlineSlice.reducer,
    sync: syncSlice.reducer,
    ui: uiSlice.reducer,
    models: modelsSlice.reducer  // AI models
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST']
      }
    }).concat(syncMiddleware, offlineMiddleware)
});
```

### 8.2 Core Redux Slices

#### Auth Slice with Role Management
```typescript
// src/store/slices/authSlice.ts
interface AuthState {
  user: User | null;
  session: Session | null;
  roles: UserRole[];
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action) => {
      state.user = action.payload.user;
      state.roles = action.payload.roles;
      state.isAuthenticated = true;
    },
    signOut: (state) => {
      return initialState;
    }
  }
});
```

#### Sync Slice for Status Management
```typescript
// src/store/slices/syncSlice.ts
interface SyncState {
  overall: 'synced' | 'syncing' | 'pending' | 'error';
  entities: {
    projects: EntitySyncStatus;
    deployments: EntitySyncStatus;
    devices: EntitySyncStatus;
  };
  queue: {
    pending: number;
    failed: number;
    processing: string | null;
  };
  lastSync: string | null;
  errors: SyncError[];
}

interface EntitySyncStatus {
  status: 'synced' | 'syncing' | 'pending' | 'error';
  lastSync: string | null;
  pendingCount: number;
}
```

#### Offline Slice for Queue Management
```typescript
// src/store/slices/offlineSlice.ts
interface OfflineState {
  isOnline: boolean;
  isOfflineModeEnabled: boolean;  // User preference
  cachedData: {
    projects: number;
    deployments: number;
    users: number;
    mapTiles: number;  // MB cached
    firmware: string[];  // Version numbers
    models: string[];    // Model IDs
  };
  preparedness: {
    score: number;  // 0-100
    checklist: OfflineChecklistItem[];
  };
}# Wildlife Watcher Mobile App - MVP Implementation Specification

**Version**: 1.2  
**Date**: August 2025  
**Platform**: React Native (Expo SDK 51)  
**Backend**: Supabase  
**Status**: Ready for AI-Assisted Development with Claude Code

---

## Executive Summary

This specification defines the complete implementation blueprint for the Wildlife Watcher Mobile App MVP. It serves as the authoritative guide for product managers validating Figma designs, developers implementing features, and AI coding assistants (Claude Code) building the application. The document captures all user stories, technical architecture, and implementation details required to deliver a production-ready field deployment tool for wildlife camera management.

Key MVP deliverables include offline-first deployment workflows, Bluetooth camera connectivity, team collaboration features, and comprehensive synchronization capabilities. The app will be built using AI-assisted development with Claude Code, following TDD/BDD practices with Maestro for automated testing.

---

## Glossary of Terms

### Technical Terms
- **API (Application Programming Interface)**: How different software components communicate
- **BLE (Bluetooth Low Energy)**: Wireless communication technology for short-range device connections
- **CDN (Content Delivery Network)**: Distributed servers that deliver content based on geographic location
- **Claude Code**: Anthropic's AI coding assistant for autonomous development
- **DFU (Device Firmware Update)**: Over-the-air firmware update capability via Bluetooth
- **EAS (Expo Application Services)**: Build and deployment service for Expo apps
- **Edge Function**: Serverless functions that run close to users for low latency
- **Expo**: Framework for building React Native apps with managed workflow
- **LoRaWAN**: Long-range, low-power wireless protocol for IoT devices
- **Maestro**: Mobile UI testing framework for automated testing
- **MCP (Model Context Protocol)**: Tool integration protocol for Claude Code
- **OTA (Over-The-Air)**: Remote update capability without physical access
- **Postgres/PostgreSQL**: Open-source relational database system
- **React**: JavaScript library for building user interfaces
- **React Native**: Framework for building native mobile apps using React
- **Redux**: State management system for maintaining app data consistency
- **RLS (Row Level Security)**: Database security feature that restricts data access per user
- **SQLite**: Local database for offline data storage on mobile devices
- **Sub-agents**: Specialized AI agents that handle specific development tasks
- **Supabase**: Open-source Firebase alternative providing backend services
- **Technology Stack**: Collection of technologies used to build an application
- **TDD/BDD**: Test-Driven Development / Behavior-Driven Development methodologies
- **User Story**: Description of a feature from an end-user perspective

### Domain Terms
- **WW Camera**: Wildlife Watcher camera device that this app connects to and manages
- **Deployment**: The process of setting up and activating a camera in the field
- **Sampling Design**: Research methodology for wildlife monitoring
- **Bait Station**: Location where bait is used to attract animals for monitoring
- **Motion Detection**: Camera triggering based on movement
- **Timelapse**: Camera taking photos at regular intervals
- **Project Admin**: User who manages a specific research project
- **WW Admin**: System administrator with special technical access

---

## User Story Mapping

| User Story | Implementation Section | Priority | Status |
|------------|----------------------|----------|---------|
| User registration and first-time setup | Section 4.1 | MVP | 🟡 Partial |
| User login and authentication | Section 4.1 | MVP | ✅ Complete |
| Password reset via web form | Section 4.1, 13 | MVP | 🔄 In Progress |
| Start deployment flow | Section 5.3 | MVP | 🔄 In Progress |
| End deployment flow | Section 5.4 | MVP | ⬜ Planned |
| Project creation and management | Sections 5.5, 5.6 | MVP | ⬜ Planned |
| Member invitation and roles | Section 4.2, 5.6 | MVP | ⬜ Planned |
| Offline field work | Section 6 | MVP | ⬜ Planned |
| Device discovery and testing | Section 5.8 | MVP | 🟡 Partial |
| Firmware updates | Section 5.8 | MVP | 🟡 Partial |
| Deployments monitoring | Section 5.7 | MVP | ⬜ Planned |
| LoRaWAN status updates | Section 7.3 | MVP | ⬜ Planned |
| User profile management | Section 4.3 | MVP | ⬜ Planned |
| AI Model management | Section 14 | Future | ⬜ Placeholder |

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
10. [Production Readiness & Security](#10-production-readiness--security)
11. [Testing Strategy](#11-testing-strategy)
12. [AI Agent Development Guidelines](#12-ai-agent-development-guidelines)
13. [Admin Portal Integration](#13-admin-portal-integration)
14. [AI Model & Firmware Management](#14-ai-model--firmware-management)
15. [Actions & Clarifications Needed](#15-actions--clarifications-needed)

---

## 1. Project Overview

### What This App Does

The Wildlife Watcher Mobile App empowers conservation researchers to deploy and manage camera traps in remote locations worldwide. Field teams use this app to configure Wildlife Watcher cameras via Bluetooth, setting parameters like motion detection sensitivity or timelapse intervals (e.g., capturing an image every 30 seconds for phenology studies). Each deployment is precisely geolocated and linked to a research project, enabling collaborative monitoring across vast landscapes.

The app's offline-first architecture ensures reliable operation in areas without cellular coverage - a critical requirement since camera deployments often occur in pristine wilderness areas. When field teams return to connectivity, all collected data automatically synchronizes with the cloud, maintaining data integrity across distributed research teams. The system also receives long-range status updates via LoRaWAN, alerting researchers when cameras need attention (low battery, full SD card) without requiring physical visits to remote sites.

### Application Details
- **Name**: Wildlife Watcher Mobile App
- **Bundle ID (iOS)**: `com.wildlife.wildlifewatcher` (production)
- **Package Name (Android)**: `com.wildlife.wildlifewatcher` (production)
- **Development IDs**: Use `.expo` suffix during development for side-by-side testing
- **Purpose**: Field deployment and management of wildlife monitoring cameras
- **Target Users**: Conservation researchers, field technicians, citizen scientists
- **Scale**: Designed to handle small projects (2-3 cameras) to large initiatives (100+ cameras across multiple sites)

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

// Testing (Development)
- maestro (UI automation testing)
- detox (optional alternative)

// File Management
- expo-file-system (for firmware/model storage)
- expo-media-library (for photo management)
```

---

## 2. Current Implementation Status

### Completed Features

The authentication flow is largely complete, with login functionality working and tested. Users can successfully authenticate against the Supabase backend, and sessions persist appropriately. The password reset flow currently opens the app, but needs modification to support web-based reset for users accessing the link from other devices. The core Bluetooth infrastructure for camera communication has been thoroughly tested with real Wildlife Watcher devices, successfully implementing the PING/PONG protocol and Nordic DFU firmware updates.

The navigation structure is in place with bottom tabs and drawer menu configured. The Maps screen exists but needs the floating action buttons for deployment workflows. Basic Redux store configuration is complete, ready for feature-specific slices to be added as development progresses.

### Features Requiring Implementation

Several critical user flows need to be built or completed. The member invitation system needs to be created, allowing project admins to add users who may not yet have accounts. The offline synchronization infrastructure is planned but not yet implemented - this is crucial for field operations. The start and end deployment flows exist partially but need completion, particularly the project selection improvements and camera configuration steps.

User profile management needs to be added, initially as optional fields with indicators showing when profiles are incomplete. The LoRaWAN webhook for receiving camera status updates needs to be implemented as an Edge Function, though the exact message format is still being finalized by the hardware team. Image storage with CDN optimization and thumbnail generation needs to be set up for deployment photos.

### Development Environment Status
- ✅ Expo SDK 51 migration complete
- ✅ EAS Build configuration working
- ✅ Development builds on Android tested
- 🟡 iOS development builds need testing with team devices
- ✅ BLE functionality verified with real WW cameras
- 🟡 Password reset needs web form implementation
- ⬜ Maestro testing framework needs setup

---

## 3. Architecture Overview

### System Architecture Philosophy

The app follows a modular, offline-first architecture designed for collaborative AI-human development. Each module is self-contained with clear interfaces, allowing Claude Code sub-agents to work on different features simultaneously without conflicts. The architecture prioritizes data integrity in offline scenarios, user experience in low-connectivity environments, and maintainability as the system scales from MVP to full production.

The offline-first approach means every operation saves locally first, updates the UI immediately for responsiveness, then queues for remote synchronization. This ensures field researchers never lose data due to connectivity issues. The sync system uses intelligent conflict resolution - for instance, if two team members edit the same project offline, member lists are merged (union of both), while deployment end status always takes precedence over active status to prevent orphaned deployments.

### Project Structure
```
wildlife-watcher-mobile-app/
├── src/                    # Mobile app source
│   ├── components/         # Reusable UI components
│   │   ├── common/        # Buttons, inputs, cards
│   │   ├── forms/         # Form components with validation
│   │   ├── sync/          # Sync status indicators
│   │   └── navigation/    # Navigation helpers
│   ├── navigation/        # Navigation configuration
│   │   ├── screens/       # All screen components
│   │   │   ├── auth/      # Login, signup, password reset
│   │   │   ├── deployment/# Start/end deployment flows
│   │   │   ├── projects/  # Project management
│   │   │   └── devices/   # Device management
│   │   ├── stacks/        # Navigation stacks
│   │   └── index.tsx      # Root navigation
│   ├── services/          # Business logic & APIs
│   │   ├── ai/           # AI model management
│   │   ├── auth/         # Authentication service
│   │   ├── ble/          # Bluetooth services
│   │   ├── dfu/          # Firmware update services
│   │   ├── offline/      # Offline & sync services
│   │   ├── lorawan/      # LoRaWAN data processing
│   │   ├── storage/      # Image/file management
│   │   └── supabase/     # Supabase client & API
│   ├── store/            # Redux store
│   │   ├── slices/       # Feature-specific slices
│   │   └── index.ts      # Store configuration
│   ├── types/            # TypeScript definitions
│   ├── utils/            # Utility functions
│   ├── hooks/            # Custom React hooks
│   ├── config/           # App configuration
│   │   ├── constants.ts  # App-wide constants
│   │   └── env.ts        # Environment config
│   └── App.tsx           # Root component
├── ww-web-portal/         # Admin portal (separate)
│   ├── admin/            # Admin features
│   └── public/           # Password reset pages
├── tests/                 # Test suites
│   ├── maestro/          # UI automation tests
│   └── unit/             # Unit tests
└── docs/                  # Documentation
```

### Data Flow Architecture

The app implements a unidirectional data flow that ensures predictable state management and facilitates testing:

```
User Action → Screen Component → Redux Action → Service Layer → Local SQLite
                                                      ↓
                                              [Offline Queue] ← Network Monitor
                                                      ↓
                                              Background Sync → Supabase
                                                      ↓
                                              Sync Status → Redux → UI Update
```

This architecture ensures that user actions always have immediate feedback (optimistic updates), while maintaining eventual consistency with the cloud database. The offline queue acts as a buffer, storing operations when offline and processing them in order when connectivity returns.

---

## 4. Authentication & User Management

### 4.1 Authentication Flow

#### User Access Patterns

The app supports three distinct user onboarding paths, each designed for different organizational contexts:

**Path 1: Direct Registration** - New users can self-register through the app, creating their account with email and password. This path is ideal for citizen scientists or independent researchers joining the platform.

**Path 2: Project Invitation** - Project admins invite team members by email. Recipients receive a secure link to set their password (no temporary passwords for security). If the invitation expires (7 days), users can request a fresh link from their Project Admin or WW Admin. This ensures controlled access to research projects.

**Path 3: WW Admin Provisioning** - System administrators can directly create user accounts for organizational deployments, useful for pre-configuring accounts for field teams or workshop participants.

#### Login Screen Implementation
```typescript
// src/navigation/screens/auth/LoginScreen.tsx
interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

const LoginScreen: React.FC = () => {
  // Implementation requirements:
  // - Email validation (RFC 5322 compliant)
  // - Password field with show/hide toggle
  // - Remember me with secure token storage
  // - Loading overlay during authentication
  // - Error messages with retry logic
  // - Navigate to Maps screen on success
  // - Links to Forgot Password and Sign Up
  // - Offline mode detection with appropriate messaging
  
  // Error handling:
  // - Network timeout (suggest offline mode)
  // - Invalid credentials (clear message)
  // - Account locked (contact admin)
  // - Email not verified (resend option)
};
```

#### Sign Up Screen Implementation
```typescript
// src/navigation/screens/auth/SignUpScreen.tsx
interface SignUpFormData {
  email: string;
  password: string;
  confirmPassword: string;
  fullName?: string;  // Optional, defaults to email
  organization?: string;  // Optional for MVP
  acceptTerms: boolean;
}

// Implementation notes:
// - Password strength indicator
// - Real-time validation feedback
// - Terms of service link (opens in browser)
// - Success leads to email verification notice
// - Store partial profile locally for later completion
```

#### Password Reset Implementation
```typescript
// Two-part implementation:

// 1. In-app request (Mobile)
// src/navigation/screens/auth/ForgotPasswordScreen.tsx
interface PasswordResetRequest {
  email: string;
}
// Triggers email with web reset link

// 2. Web form (Portal - See Section 13)
// Hosted at: https://[domain]/auth/reset-password
// Handles actual password reset with token validation
// Mobile-friendly responsive design
// Success message with app deep link
```

#### Sign Out Implementation
```typescript
// Located in DrawerNavigator.tsx
const handleSignOut = async () => {
  // Show confirmation dialog
  // Clear local session
  // Clear SQLite cache (optional - ask user)
  // Clear Redux store
  // Navigate to Login
  // Cancel any pending syncs
};
```

### 4.2 User Roles & Permissions

#### Role Hierarchy and Capabilities

The role system reflects real-world research team structures while maintaining security boundaries:

```typescript
enum UserRole {
  WW_ADMIN = 'ww_admin',        // System administrators
  PROJECT_ADMIN = 'project_admin', // Research project leaders
  PROJECT_MEMBER = 'project_member' // Field team members
}

// Role Capabilities Matrix:
interface RoleCapabilities {
  'ww_admin': {
    accessDevMenu: true,
    manageAllUsers: true,
    viewAllProjects: true,  // Read-only access
    configureSystem: true,
    accessDiagnostics: true
  },
  'project_admin': {
    editProject: true,
    manageProjectMembers: true,
    deleteDeployments: true,
    assignModels: true,
    startEndDeployments: true
  },
  'project_member': {
    viewProject: true,
    startEndDeployments: true,
    testDevices: true
  }
}

// Implementation note: Users can have different roles per project
// Example: User A might be admin for Project 1 but member for Project 2
```

### 4.3 User Profile Management

#### Profile Fields and Implementation

User profiles start minimal and can be enhanced over time, reducing friction for initial adoption:

```typescript
// src/navigation/screens/ProfileScreen.tsx
interface UserProfile {
  email: string;           // Immutable, from auth
  fullName?: string;       // Optional, defaults to email
  organization?: string;   // Optional for MVP
  profilePhoto?: string;   // Optional, stored locally for MVP
  preferences: {
    offlineMapRadius: number;  // km to cache
    syncOnCellular: boolean;
    developerMode: boolean;    // WW_ADMIN only
  };
}

// Profile Completion Indicator:
// Shows red dot on drawer menu profile section if incomplete
// Tapping opens profile screen with fields to complete
// All fields optional but encouraged through UI hints
```

---

## 5. Core Features Implementation

### 5.1 Navigation Structure

#### Navigation Architecture with Context-Aware FABs

The navigation system combines familiar mobile patterns (bottom tabs, drawer menu) with intelligent floating action buttons that appear based on user context. This design minimizes clicks for common field operations while keeping advanced features accessible but not intrusive.

```typescript
// src/navigation/BottomTabNavigator.tsx
const TAB_SCREENS = [
  { 
    name: 'Maps', 
    component: MapsScreen, 
    icon: 'map-marker',
    fab: ['startDeployment', 'endDeployment'] // Context-aware FABs
  },
  { 
    name: 'Projects', 
    component: ProjectsScreen, 
    icon: 'folder',
    fab: ['addProject']
  },
  { 
    name: 'Deployments', 
    component: DeploymentsScreen, 
    icon: 'camera',
    fab: null  // No FAB needed
  },
  { 
    name: 'Devices', 
    component: DevicesScreen, 
    icon: 'bluetooth',
    fab: ['scanDevices']
  }
];

// FAB Intelligence:
// - Start Deployment: Always visible on Maps
// - End Deployment: Only when active deployments exist
// - Hide when keyboard open
// - Drag gesture to show/hide on scroll
```

#### Side Drawer Menu Implementation
```typescript
// src/navigation/DrawerNavigator.tsx
const DrawerContent = () => {
  const { user, syncStatus, hasIncompleteProfile } = useAppState();
  
  return (
    <>
      <UserSection>
        <Avatar source={user.profilePhoto} />
        <Username>{user.fullName || user.email}</Username>
        <SyncStatusBadge status={syncStatus} />
        {hasIncompleteProfile && <ProfileCompletionDot />}
      </UserSection>
      
      <DrawerItem label="Profile" onPress={navigateToProfile} />
      <DrawerItem label="Settings" onPress={navigateToSettings} />
      <DrawerItem label="Offline Maps" onPress={navigateToOfflineMaps} />
      
      {/* Developer Menu - Conditional Rendering */}
      {shouldShowDevMenu() && (
        <DrawerSection title="Developer Tools">
          <DrawerItem label="BLE Diagnostics" />
          <DrawerItem label="Sync Queue Monitor" />
          <DrawerItem label="Database Inspector" />
          <DrawerItem label="Mock LoRaWAN Messages" />
        </DrawerSection>
      )}
      
      <DrawerItem label="Sign Out" onPress={handleSignOut} />
      <AppVersion />
    </>
  );
};

// Developer menu logic:
const shouldShowDevMenu = () => {
  if (__DEV__) return true;  // Always in development
  if (user.role === 'ww_admin' && settings.devMenuEnabled) return true;
  return false;
};
```

### 5.2 Maps Screen (Home)

#### The Field Operations Dashboard

The Maps screen serves as mission control, providing immediate access to deployment operations while maintaining spatial context of research activities:

```typescript
// src/navigation/screens/MapsScreen.tsx
interface MapsScreenState {
  userLocation: Coordinates | null;
  deployments: Deployment[];
  mapRegion: Region;
  isOffline: boolean;
  cachedMapBounds: BoundingBox;
}

const MapsScreen: React.FC = () => {
  // Core features:
  // 1. Location-aware map centering
  // 2. Deployment clustering with smart zoom
  // 3. Offline tile caching (100MB limit)
  // 4. Sync status indicator overlay
  // 5. Context-aware FABs
  
  // Offline map strategy:
  // - Cache viewed areas automatically
  // - Pre-download option in Settings
  // - Show offline indicator when using cached tiles
  // - Graceful degradation for uncached areas
  
  return (
    <MapContainer>
      <MapView
        provider={Platform.OS === 'ios' ? PROVIDER_DEFAULT : PROVIDER_GOOGLE}
        showsUserLocation={true}
        showsMyLocationButton={true}
        onRegionChangeComplete={cacheMapTiles}
      >
        <DeploymentClusters 
          deployments={deployments}
          onPress={showDeploymentDetails}
        />
      </MapView>
      
      <SyncStatusOverlay position="top-right" />
      
      <FABGroup>
        <FAB
          icon="plus"
          label="Start Deployment"
          color="green"
          onPress={navigateToStartDeployment}
        />
        {hasActiveDeployments && (
          <FAB
            icon="stop"
            label="End Deployment"
            color="yellow"
            onPress={navigateToEndDeployment}
          />
        )}
      </FABGroup>
    </MapContainer>
  );
};
```

### 5.3 Start Deployment Flow (Enhanced)

#### Comprehensive Field Deployment Workflow

The start deployment flow guides users through camera setup with intelligent defaults and validation at each step:

#### Step 1: Project Selection (Redesigned)
```typescript
// src/navigation/screens/deployment/start/ProjectSelectionScreen.tsx
const ProjectSelectionScreen: React.FC = () => {
  // New card-based UI replacing dropdown:
  // - Project cards with sync status badges
  // - Search bar for filtering (useful for users with many projects)
  // - Each card shows: name, description, member count, deployment count
  // - FAB for creating new project
  // - Deployment name input at top (auto-generates suggestion)
  
  return (
    <Screen>
      <DeploymentNameInput 
        placeholder="Deployment #[auto-number]"
        value={deploymentName}
        onChangeText={setDeploymentName}
      />
      
      <SearchBar 
        placeholder="Search projects..."
        onChangeText={filterProjects}
      />
      
      <ProjectList
        data={filteredProjects}
        renderItem={({ item }) => (
          <ProjectCard
            project={item}
            syncStatus={item.syncStatus}
            onPress={() => selectProject(item.id)}
          />
        )}
      />
      
      <FAB icon="plus" onPress={navigateToNewProject} />
    </Screen>
  );
};
```

#### Step 2: New Project Creation (If Selected)
```typescript
// Comprehensive project setup with team management
interface NewProjectData {
  name: string;
  owner: string;  // Auto-populated with current user
  samplingDesign: string;
  description: string;
  website?: string;
  members: Array<{ email: string; role: UserRole }>;
  isPrivate: boolean;
  usingBait: boolean;
  monitoringMarked: boolean;
}

// Member addition flow:
// 1. Enter email address
// 2. System checks if user exists
// 3. If exists: Add to project
// 4. If not: Queue invitation email for when online
// 5. Assign role (defaults to PROJECT_MEMBER)
```

#### Step 3: Device Discovery (Enhanced with Filtering)
```typescript
// src/navigation/screens/deployment/start/DeviceDiscoveryScreen.tsx
enum DeviceFilter {
  ALL = 'all',
  WW_DEVICES = 'ww_devices',      // Wildlife Watcher cameras only
  OTHER_DEVICES = 'other',         // Non-WW BLE devices
  KNOWN_NEARBY = 'known_nearby'   // GPS proximity-based filtering
}

const DeviceDiscoveryScreen: React.FC = () => {
  // Smart device filtering:
  // - Prioritize WW cameras at top
  // - Show signal strength indicators
  // - Group by device type
  // - Remember previously connected devices
  
  // Permission handling:
  // - Check BLE permission
  // - Check location permission (needed for BLE on Android)
  // - Show educational card if denied
  // - Provide settings deep link
};
```

#### Step 4: Deployment Configuration
```typescript
interface DeploymentConfig {
  device: BLEDevice;
  location: {
    latitude: number;
    longitude: number;
    address?: string;  // Reverse geocoded
  };
  captureMethod: 'motion' | 'timelapse';
  timelapseInterval?: number;  // Default: 30 seconds
}

// Smart location features:
// - Auto-detect current location
// - Allow manual coordinate entry
// - Address lookup with map update
// - Offline reverse geocoding fallback
```

#### Step 5: Camera Preview
```typescript
// Live preview from camera before finalizing
const CameraPreviewScreen: React.FC = () => {
  // BLE command to trigger snapshot
  // Display image from camera
  // "Take Another" button
  // Image quality validation
  // Positioning guidance overlay
};
```

#### Step 6: Final Setup
```typescript
interface FinalSetupData {
  locationPhoto?: string;      // Camera placement photo
  locationDescription: string;  // Site notes
}

// Photo handling:
// - Camera capture or gallery selection
// - Compress if over size limit (configurable, default 5MB)
// - Queue for upload when online
// - Store locally for offline access
```

### 5.4 End Deployment Flow

#### Streamlined Retrieval Process

The end deployment flow is optimized for quick camera retrieval in the field:

```typescript
// Three-screen flow from Figma:
// Screen 1: Device discovery (reuses component from start flow)
// Screen 2: Nearby devices list with deployment info
// Screen 3: Deployment details with confirmation

const EndDeploymentFlow = () => {
  // Key features:
  // - Auto-connect to previously paired devices
  // - Show deployment duration and statistics
  // - Confirm location matches (prevent wrong camera)
  // - Success/failure handling with clear next steps
  
  // On success:
  // - Mark deployment as ended
  // - Queue sync if offline
  // - Option to immediately start new deployment
};
```

### 5.5 Projects Screen

#### Research Project Management Hub

```typescript
const ProjectsScreen: React.FC = () => {
  // Display features:
  // - Project cards with key metrics
  // - Sync status per project
  // - Search and filter capabilities
  // - Sort by: recent, name, deployment count
  
  // Navigation intelligence:
  // After creating deployment, navigate to:
  // Deployments screen filtered by that project
  
  return (
    <Screen>
      <SearchBar />
      <FilterChips filters={['Active', 'Archived', 'My Projects']} />
      
      <ProjectList
        renderItem={({ item }) => (
          <ProjectCard
            name={item.name}
            description={item.description}
            memberCount={item.members.length}
            activeDeployments={item.activeDeployments}
            totalDeployments={item.totalDeployments}
            syncStatus={item.syncStatus}
            onPress={() => navigateToProjectDetails(item.id)}
          />
        )}
      />
      
      <FAB icon="plus" onPress={navigateToNewProject} />
    </Screen>
  );
};
```

### 5.6 Project Details Screen

#### Comprehensive Project Information and Team Management

```typescript
const ProjectDetailsScreen: React.FC = () => {
  const { isAdmin } = useProjectRole(projectId);
  
  return (
    <ScrollView>
      <ProjectInfo 
        editable={isAdmin}
        onEdit={isAdmin ? handleEdit : undefined}
      />
      
      <Section title="Team Members">
        <MemberList 
          members={members}
          showActions={isAdmin}
          onAddMember={handleAddMember}
          onRemoveMember={handleRemoveMember}
        />
      </Section>
      
      <Section title="Recent Deployments">
        <DeploymentList 
          deployments={recentDeployments}
          limit={5}
          onViewAll={() => navigateToDeployments(projectId)}
        />
      </Section>
    </ScrollView>
  );
};

// Member management UI (no profile pictures per requirements):
const MemberListItem = ({ member, isAdmin }) => (
  <ListItem>
    <Text>{member.fullName || member.email}</Text>
    <RoleBadge role={member.role} />
    {isAdmin && (
      <Menu>
        <MenuItem onPress={() => changeRole(member.id)}>Change Role</MenuItem>
        <MenuItem onPress={() => removeMember(member.id)}>Remove</MenuItem>
      </Menu>
    )}
  </ListItem>
);

// Add member flow:
// 1. Enter email
// 2. Select role
// 3. Check if user exists
// 4. Send invitation if new
// 5. Add to project
```

### 5.7 Deployments Screen

#### Mission Control for Active Operations

```typescript
const DeploymentsScreen: React.FC = () => {
  const [filter, setFilter] = useState<'active' | 'ended' | 'all'>('active');
  
  return (
    <Screen>
      <TabSelector 
        tabs={['Active', 'Ended', 'All']}
        selected={filter}
        onSelect={setFilter}
      />
      
      <DeploymentList
        data={filteredDeployments}
        renderItem={({ item }) => (
          <DeploymentCard
            projectName={item.project.name}
            deviceName={item.device.name}
            batteryLevel={item.batteryLevel}  // From LoRaWAN
            sdCardUsage={item.sdCardUsage}    // From LoRaWAN
            lastUpdate={item.lastDataReceived}
            startDate={item.startedAt}
            endDate={item.endedAt}
            status={item.status}
            onPress={() => navigateToDeploymentDetails(item.id)}
          />
        )}
      />
    </Screen>
  );
};

// Visual indicators:
// 🟢 Green: Healthy (battery > 30%, SD < 80%)
// 🟡 Yellow: Warning (battery 10-30%, SD 80-95%)
// 🔴 Red: Critical (battery < 10%, SD > 95%)
```

### 5.8 Devices Screen

#### Camera Hardware Management Center

```typescript
const DevicesScreen: React.FC = () => {
  return (
    <Screen>
      <DeviceList
        ListHeaderComponent={
          <ScanButton onPress={startScanning} />
        }
        data={devices}
        renderItem={({ item }) => (
          <DeviceCard
            name={item.name}
            connectionStatus={item.status}
            batteryLevel={item.battery}
            firmwareVersion={item.firmware}
            isDeployed={item.deploymentId !== null}
            onPress={() => handleDevicePress(item)}
          />
        )}
      />
    </Screen>
  );
};

// Device actions (non-deployed only):
// - Test camera view
// - Update firmware (if available)
// - Run diagnostics

// Developer menu additions:
// - Force DFU mode
// - BLE packet inspector
// - Mock device simulator
```

---

## 6. Offline Support Architecture

### 6.1 Offline-First Philosophy

#### Why Offline-First Matters for Wildlife Research

Field researchers often work in remote locations without cellular coverage for days or weeks. The app must function fully offline, storing all operations locally and syncing intelligently when connectivity returns. This isn't just a nice-to-have feature - it's essential for the app's core mission. A researcher setting up cameras in a remote rainforest needs confidence that their work is saved, regardless of network availability.

The offline system implements several key strategies:
- **Optimistic Updates**: UI updates immediately, assuming success
- **Smart Caching**: Frequently accessed data cached proactively
- **Conflict Resolution**: Intelligent merging when multiple users edit offline
- **Sync Prioritization**: Critical data (deployments) syncs before metadata

### 6.2 Pre-Deployment Offline Preparation

#### Preparing for Field Work

Before heading into the field, users can prepare their devices for offline operation:

OFFLINE PREPARATION SCREEN REQUIREMENTS:

Checklist Items:
- Projects & Members sync status
- Map tiles download for deployment areas
- Device firmware availability
- AI models download status
- Device connection test

User Actions:
- Force sync specific categories
- Download map areas
- Test device connectivity
- View readiness score (0-100%)

Background Processes:
- Automatic sync when connected
- Cache frequently accessed data
- Pre-fetch team member profiles


### 6.3 Local Database Schema

#### SQLite Schema with Logical Deletes

```typescript
// src/services/offline/schema.ts
export const OFFLINE_SCHEMA = {
  // Queue for operations pending sync
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
      priority INTEGER DEFAULT 0,  -- Higher priority syncs first
      synced BOOLEAN DEFAULT 0
    )
  `,
  
  // Local storage for projects
  local_projects: `
    CREATE TABLE IF NOT EXISTS local_projects (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,  -- JSON blob
      version INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_at DATETIME,  -- Logical delete
      synced BOOLEAN DEFAULT 0,
      sync_error TEXT
    )
  `,
  
  // Local storage for deployments
  local_deployments: `
    CREATE TABLE IF NOT EXISTS local_deployments (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      data TEXT NOT NULL,  -- JSON blob
      status TEXT CHECK(status IN ('active', 'ended')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_at DATETIME,  -- Logical delete
      synced BOOLEAN DEFAULT 0,
      sync_error TEXT,
      FOREIGN KEY (project_id) REFERENCES local_projects(id)
    )
  `,
  
  // Cached user data for offline member addition
  cached_users: `
    CREATE TABLE IF NOT EXISTS cached_users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      full_name TEXT,
      cached_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ttl INTEGER DEFAULT 604800  -- 7 days in seconds
    )
  `
};
```

### 6.4 Offline Service Specification


Core Methods:
- initializeDatabase() → void
- queueOperation(operation) → operationId
- syncPendingOperations() → SyncResult
- getPendingOperations() → Operation[]
- markSynced(operationId) → void
- handleSyncError(operation, error) → void
- isOnline() → boolean
- triggerSync() → void

Priority Levels:
- 1000: Deployment end (critical)
- 900: Deployment start
- 800: Project updates
- 700: Member additions
- 500: Profile updates

Queue Management Rules:
- Operations processed by priority
- Critical operations block lower priority
- Failed operations retry with exponential backoff
- Max retry count: 3
- Permanent failure after max retries

Network Monitoring:
- Listen for connectivity changes
- Auto-trigger sync when online
- Queue operations when offline
- Update UI sync status indicators

### 6.5 Conflict Resolution Specification

CONFLICT RESOLUTION RULES:

Deployment Conflicts:
- Status 'ended' always wins over 'active'
- Earliest end time preserved if both ended
- Most recent update wins for active deployments

Project Conflicts:
- Member lists: Union of both sets (no duplicates)
- Settings: Last-write-wins based on timestamp
- Logical deletes: Deleted state wins

User Data Conflicts:
- Auth data: Server version wins
- Preferences: Local version wins
- Profile photo: Local version wins

Resolution Strategy Matrix:
| Entity Type | Field Type | Resolution Strategy |
|------------|------------|-------------------|
| Deployment | status | 'ended' priority |
| Deployment | data | Latest timestamp |
| Project | members | Union merge |
| Project | settings | Last-write-wins |
| User | auth | Server wins |
| User | preferences | Local wins |
| Device | firmware | Server wins |

### 6.6 Sync Status Management Specification

SYNC STATUS INDICATOR REQUIREMENTS:

Visual States:
- Synced: Green checkmark
- Syncing: Animated spinner
- Pending: Gray clock icon
- Error: Red exclamation

Display Locations:
- Global: Near user avatar in drawer
- Project cards: Sync badge
- Deployment cards: Status indicator
- Bottom sheet: Detailed sync view

Information Displayed:
- Overall sync status
- Pending operation count
- Last successful sync time
- Error messages if any
- Retry option for failures

User Interactions:
- Tap for detailed sync view
- Pull to refresh to force sync
- View sync queue in developer menu
- Clear failed operations (admin only)

---

## Section 7: Supabase Integration

### 7.1 Database Schema

### 7.1 Database Schema

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";  -- For geospatial queries

-- User roles table (new for WW_ADMIN support)
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('ww_admin', 'user')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id, role)
);

-- Projects table with logical deletes
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES auth.users(id) NOT NULL,
  sampling_design TEXT,
  description TEXT,
  website TEXT,
  is_private BOOLEAN DEFAULT false,
  using_bait BOOLEAN DEFAULT false,
  monitoring_marked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,  -- Logical delete
  version INTEGER DEFAULT 1  -- For optimistic locking
);

-- Project members with roles
CREATE TABLE project_members (
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('project_admin', 'project_member')),
  added_at TIMESTAMPTZ DEFAULT NOW(),
  added_by UUID REFERENCES auth.users(id),
  removed_at TIMESTAMPTZ,  -- Logical delete
  PRIMARY KEY (project_id, user_id)
);

-- Devices table
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bluetooth_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  firmware_version TEXT,
  model_type TEXT DEFAULT 'WW_CAMERA',
  battery_level INTEGER,
  last_seen TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ  -- Logical delete
);

-- Deployments table with comprehensive tracking
CREATE TABLE deployments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) NOT NULL,
  device_id UUID REFERENCES devices(id) NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'ended')),
  
  -- Location data with PostGIS support
  location GEOGRAPHY(POINT, 4326),  -- PostGIS point
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  address TEXT,
  location_description TEXT,
  location_photo_url TEXT,
  
  -- Configuration
  capture_method TEXT NOT NULL CHECK (capture_method IN ('motion', 'timelapse')),
  timelapse_interval INTEGER,  -- seconds
  
  -- Status from LoRaWAN
  battery_level INTEGER,
  sd_card_usage INTEGER,  -- percentage
  last_data_received TIMESTAMPTZ,
  
  -- Timestamps and audit
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_by UUID REFERENCES auth.users(id) NOT NULL,
  ended_at TIMESTAMPTZ,
  ended_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,  -- Logical delete
  version INTEGER DEFAULT 1
);

-- LoRaWAN messages storage (raw data)
CREATE TABLE lorawan_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_eui TEXT NOT NULL,
  deployment_id UUID REFERENCES deployments(id),
  raw_payload JSONB NOT NULL,  -- Store complete message
  parsed_data JSONB,  -- Extracted values
  received_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- User invitations for member management
CREATE TABLE user_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  project_id UUID REFERENCES projects(id),
  role TEXT NOT NULL CHECK (role IN ('project_admin', 'project_member')),
  invited_by UUID REFERENCES auth.users(id) NOT NULL,
  invitation_token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_deployments_project_id ON deployments(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_deployments_device_id ON deployments(device_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_deployments_status ON deployments(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_deployments_location ON deployments USING GIST(location);
CREATE INDEX idx_project_members_user_id ON project_members(user_id) WHERE removed_at IS NULL;
CREATE INDEX idx_lorawan_messages_device ON lorawan_messages(device_eui);
CREATE INDEX idx_lorawan_messages_deployment ON lorawan_messages(deployment_id);

-- RLS Policies
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Users can see projects they're members of
CREATE POLICY "Users view their projects" ON projects
  FOR SELECT USING (
    deleted_at IS NULL AND (
      owner_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM project_members 
        WHERE project_id = projects.id 
        AND user_id = auth.uid()
        AND removed_at IS NULL
      )
    )
  );

-- WW Admins can view all projects (read-only)
CREATE POLICY "WW Admins view all projects" ON projects
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'ww_admin'
    )
  );
```

### 7.2 Supabase Client Configuration

**Requirements:**
- Initialize Supabase client with AsyncStorage for React Native persistence
- Configure auto-refresh tokens for session management
- Support both anonymous and authenticated operations
- Include app version in headers for API versioning
- Environment variables for URL and keys (EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY)

**Technical Specifications:**
- Use `@supabase/supabase-js` v2.39.0 or later
- Configure auth storage with AsyncStorage
- Disable URL detection for mobile environment
- Implement separate client for admin operations (Edge Functions only)

### 7.3 LoRaWAN Integration

**Context:** LoRaWAN enables cameras to send status updates from locations 10-15km from nearest gateway without cellular coverage. Messages are small (typically <50 bytes) containing battery level, SD card usage, and basic telemetry.

**Edge Function Requirements:**
- Endpoint: `/functions/v1/lorawan-webhook`
- Authentication: Bearer token validation against LORAWAN_WEBHOOK_SECRET
- Store raw messages for audit/debugging
- Parse device-specific payload format (to be documented by hardware team)
- Update active deployment status
- Create alerts for critical conditions (battery <10%, SD >95%)

**Expected LoRaWAN Message Structure:**
```
// Placeholder - actual format pending from hardware team
{
  deviceEUI: string,      // Device identifier
  timestamp: ISO8601,     // Message timestamp
  data: base64,          // Encoded payload
  rssi: number,          // Signal strength
  gatewayId: string      // Gateway identifier
}
```

**Data Processing Flow:**
1. Receive webhook POST request
2. Validate authentication
3. Store raw message in `lorawan_messages` table
4. Decode payload based on device firmware version
5. Find active deployment for device
6. Update deployment status (battery, SD card, last_data_received)
7. Generate alerts if thresholds exceeded
8. Return success/failure response

### 7.4 Image Storage & CDN Optimization

**Storage Requirements:**
- Bucket: `deployment-images`
- Max file size: 5MB (configurable)
- Thumbnail generation: 200x200px
- Image compression when over size limit
- Local caching for offline access

**Image Processing Pipeline:**
1. Capture/select image
2. Compress if >5MB using expo-image-manipulator
3. Generate thumbnail
4. Upload both to Supabase Storage
5. Store URLs in database (not base64)
6. Cache locally for offline viewing
7. Clean up temporary files

**CDN Considerations:**
- Use Supabase Storage public URLs (CDN-enabled)
- Set appropriate cache headers (3600 seconds default)
- Consider future migration to dedicated CDN if scale requires

### 7.5 Development Test Data

**Test Data Requirements:**
- Create 3 test users with different roles
- Generate projects of varying sizes (small: 2-3 cameras, medium: 10-20, large: 50+)
- Include deployments in different states (active/healthy, active/warning, ended)
- Simulate LoRaWAN messages with various battery/SD levels
- Flag all test data with `is_test_data` column for easy cleanup

**Test Scenarios to Cover:**
1. Single user with multiple projects
2. Multiple users on same project with different roles
3. Offline-created data pending sync
4. Devices with firmware updates available
5. Deployments with critical alerts
6. Historical data for reporting

---
  
  
## Section 8: State Management (Specification Focus)

### 8.1 Redux Store Architecture

**Purpose:** Single source of truth for app state, coordinating between local storage, network operations, and UI updates.

**Requirements:**
- Persist critical slices across app restarts (auth, user, offline queue)
- Exclude transient state from persistence (BLE connections)
- Support offline-first operations with optimistic updates
- Integrate with Redux DevTools in development
- Type-safe with TypeScript

**Store Structure:**
```
SLICES:
├── auth          [persisted] - User authentication state
├── user          [persisted] - User profile and preferences  
├── projects      [cached]    - Project data with sync status
├── deployments   [cached]    - Deployment data with sync status
├── devices       [transient] - Device discovery and status
├── ble           [transient] - Bluetooth connection state
├── offline       [persisted] - Offline queue and sync status
├── sync          [transient] - Real-time sync progress
├── ui            [transient] - UI state (modals, loading)
└── models        [cached]    - AI models metadata
```

**Middleware Requirements:**
- `syncMiddleware`: Intercept actions requiring remote sync
- `offlineMiddleware`: Queue actions when offline
- `persistMiddleware`: Handle Redux Persist operations

### 8.2 Core Redux Slices Specifications

#### Auth Slice
**State Shape:**
```
AuthState {
  user: User | null
  session: Session | null  
  roles: UserRole[]
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  lastLoginAt: timestamp
}
```

**Key Actions:**
- `login` - Authenticate user
- `logout` - Clear session
- `refreshToken` - Update access token
- `setRoles` - Update user roles
- `sessionExpired` - Handle token expiration

#### Projects Slice
**State Shape:**
```
ProjectsState {
  entities: { [id]: Project }
  ids: string[]
  selectedProjectId: string | null
  syncStatus: { [id]: SyncStatus }
  lastFetch: timestamp
  filters: ProjectFilters
}
```

**Sync Status Levels:**
- `synced` - Up to date with server
- `modified` - Local changes pending
- `syncing` - Currently synchronizing
- `conflict` - Requires resolution
- `error` - Sync failed

#### Deployments Slice
**State Shape:**
```
DeploymentsState {
  active: { [id]: Deployment }
  ended: { [id]: Deployment }
  currentDeploymentId: string | null
  draft: DeploymentDraft | null
  syncQueue: string[]
}
```

**Deployment Lifecycle States:**
- `draft` - Being created
- `pending` - Queued for creation
- `active` - Currently deployed
- `ending` - End deployment in progress
- `ended` - Completed
- `failed` - Operation failed

#### Offline Slice
**State Shape:**
```
OfflineState {
  isOnline: boolean
  isOfflineModeEnabled: boolean
  queue: {
    operations: QueuedOperation[]
    failedOperations: FailedOperation[]
    retryCount: { [operationId]: number }
  }
  cache: {
    size: number (MB)
    breakdown: {
      projects: number
      deployments: number
      images: number
      mapTiles: number
      firmware: number
    }
  }
  lastSyncAt: timestamp
}
```

**Queue Priority Levels:**
```
PRIORITY:
1000 - Deployment end (critical)
900  - Deployment start
800  - Project updates  
700  - Member changes
500  - Profile updates
100  - Telemetry/analytics
```

#### Sync Slice
**State Shape:**
```
SyncState {
  overall: 'idle' | 'syncing' | 'error'
  entities: {
    [entityType]: {
      pending: number
      syncing: string[]
      completed: number
      failed: string[]
    }
  }
  progress: {
    current: number
    total: number
    message: string
  }
  errors: SyncError[]
}
```

### 8.3 State Management Patterns

#### Optimistic Updates
**Pattern:** Update UI immediately, queue for sync
```
FLOW:
1. User performs action
2. Update local state optimistically
3. Add to offline queue with unique ID
4. Return success to UI
5. Background sync when online
6. Rollback on failure with error message
```

#### Conflict Resolution
**Strategy Matrix:**
```
CONFLICT RESOLUTION:
├── Deployment.status: 'ended' always wins
├── Project.members: Union of both sets
├── Device.firmware: Server version wins
├── User.preferences: Local wins
└── Default: Last-write-wins (timestamp)
```

#### Cache Management
**Policies:**
```
CACHE POLICIES:
- Projects: Keep all assigned projects
- Deployments: Keep 30 days of ended, all active
- Images: LRU cache, max 100MB
- Map tiles: Radius-based, max 200MB
- Firmware: Keep latest + current device versions
```

### 8.4 Redux Integration Points

**Component Hooks:**
```
HOOKS:
- useAppSelector: Type-safe state selection
- useAppDispatch: Type-safe action dispatch
- useOfflineStatus: Connection state monitoring
- useSyncStatus: Sync progress for entity
- useOptimistic: Optimistic update helper
```

**Persistence Configuration:**
```
PERSIST CONFIG:
- Storage: AsyncStorage
- Whitelist: ['auth', 'user', 'offline']
- Blacklist: ['ble', 'ui', 'sync']
- Migrations: Version-based schema updates
- Throttle: 1000ms write delay
```

---

