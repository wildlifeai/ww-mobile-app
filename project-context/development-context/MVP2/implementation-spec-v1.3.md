# Wildlife Watcher Mobile App - MVP Implementation Specification

**Version**: 1.3  
**Date**: August 2025  
**Platform**: React Native (Expo SDK 51)  
**Backend**: Supabase  
**Status**: Ready for AI-Assisted Development with Claude Code

---

## Executive Summary

This specification defines the complete implementation blueprint for the Wildlife Watcher Mobile App MVP. It serves as the authoritative guide for product managers validating Figma designs, developers implementing features, and AI coding assistants (Claude Code) building the application. The document captures all user stories, technical architecture, and implementation details required to deliver a production-ready field deployment tool for wildlife camera management.

Key MVP deliverables include offline-first deployment workflows, Bluetooth camera connectivity, team collaboration features, comprehensive synchronization capabilities, and an admin portal for system management. The app will be built using AI-assisted development with Claude Code and sub-agents, following TDD/BDD practices with Maestro for automated testing.

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

This is a professional tool designed to scale from small citizen science projects (2-3 cameras) to large conservation initiatives spanning multiple countries with hundreds of cameras and diverse international research teams.

### Application Details
- **Name**: Wildlife Watcher Mobile App
- **Bundle ID (iOS)**: `com.wildlife.wildlifewatcher` (production)
- **Package Name (Android)**: `com.wildlife.wildlifewatcher` (production)
- **Development IDs**: Use `.expo` suffix during development for side-by-side testing
- **Purpose**: Field deployment and management of wildlife monitoring cameras
- **Target Users**: Conservation researchers, field technicians, citizen scientists worldwide
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
- react-native-maps 1.14.0 (iOS compatibility verified)

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

The authentication flow is largely complete, with login functionality working and tested. Users can successfully authenticate against the Supabase backend, and sessions persist appropriately. However, the password reset flow currently opens the app and needs modification to support web-based reset for users accessing the link from other devices - this is critical for teams where password reset emails might be accessed on different devices than the phone with the app.

The core Bluetooth infrastructure for camera communication has been thoroughly tested with real Wildlife Watcher devices, successfully implementing the PING/PONG protocol and Nordic DFU firmware updates. The navigation structure is in place with bottom tabs and drawer menu configured. The Maps screen exists but needs the floating action buttons for deployment workflows. Basic Redux store configuration is complete, ready for feature-specific slices to be added as development progresses.

The navigation structure is in place with bottom tabs and drawer menu configured. The Maps screen exists but needs the floating action buttons for deployment workflows. Basic Redux store configuration is complete, ready for feature-specific slices to be added as development progresses.

### Features Requiring Implementation

Several critical user flows need to be built or completed. The member invitation system needs to be created, allowing project admins to add users who may not yet have accounts. This is essential since research teams often span multiple organizations and countries. The offline synchronization infrastructure is planned but not yet implemented - this is crucial for field operations in remote areas.

The start and end deployment flows exist partially but need completion, particularly the project selection improvements (card-based UI instead of dropdown) and camera configuration steps. User profile management needs to be added, initially as optional fields with indicators showing when profiles are incomplete. The LoRaWAN webhook for receiving camera status updates needs to be implemented as an Edge Function, though the exact message format is still being finalized by the hardware team.

Image storage with CDN optimization and thumbnail generation needs to be set up for deployment photos. The admin portal for WW Admin users needs to be implemented as detailed in Section 13.

### Development Environment Status
- ✅ Expo SDK 51 migration complete
- ✅ EAS Build configuration working
- ✅ Development builds on Android tested
- 🟡 iOS development builds need testing with team devices
- ✅ BLE functionality verified with real WW cameras
- 🟡 Password reset needs web form implementation (critical for MVP)
- ⬜ Maestro testing framework needs setup
- ⬜ Admin portal implementation needed

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
│   │   ├── ai/           # AI model management (future)
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
├── ww-admin-portal/       # Admin portal (separate - see Section 13)
│   ├── functions/        # Edge Functions
│   ├── components/       # React components
│   └── public/           # Static assets
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

---

## 4. Authentication & User Management

### 4.1 Authentication Flow

#### User Access Patterns

The app supports three distinct user onboarding paths reflecting real-world organizational needs:

**Path 1: Direct Registration** -  New users can self-register through the app, creating their account with email, password, full name, and organization. This path requires complete profile information during registration to ensure proper user identification within research teams. All fields are mandatory to facilitate effective collaboration and project member management from the moment users join the platform.

**Path 2: Project Invitation** - Project admins invite team members by email. Recipients receive a secure link to set their password. If the invitation expires (7 days), users can request a fresh link from their Project Admin or WW Admin.

**Path 3: WW Admin Provisioning** - System administrators can directly create user accounts through the admin portal, useful for pre-configuring accounts for field teams or workshop participants.

#### Registration Requirements

**Mandatory Profile Information**: All registration paths require users to provide their full name and organization during account creation. This ensures that team members can be properly identified in project collaboration and that administrators have complete user information for effective team management.

**Validation Standards**: Full name must contain at least first and last name (minimum two words) and organization must be at least 3 characters to ensure meaningful institutional identification. These requirements apply regardless of the registration path used.

**User Experience Considerations**: While requiring complete information during signup may slightly increase registration time, it eliminates the need for profile completion prompts after registration and ensures all users have identifiable profiles from the start, which is essential for wildlife research team collaboration.

#### Sign Out Implementation

When users sign out, the app:
1. Shows confirmation dialog
2. Clears local session data
3. Offers option to clear offline cache
4. Resets Redux store to initial state
5. Cancels any pending syncs
6. Navigates to Login screen

### 4.2 User Roles & Permissions

#### Role Hierarchy and Capabilities

The role system reflects real-world research team structures:

```typescript
enum UserRole {
  WW_ADMIN = 'ww_admin',        // System administrators
  PROJECT_ADMIN = 'project_admin', // Research project leaders
  PROJECT_MEMBER = 'project_member' // Field team members
}

// Role Capabilities Matrix:
interface RoleCapabilities {
  'ww_admin': {
    accessDevMenu: 'configurable',  // Individual feature-level control
    manageAllUsers: true,
    viewAllProjects: true,  // Read-only access
    configureSystem: true,
    accessDiagnostics: true,
    manageWWAdminFeatures: true  // Can configure other WW_ADMIN permissions
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
```

**Key Role Rules:**
- Users can have different roles per project
- Any user can create a project and become its admin
- Only WW Admins can grant WW Admin role to others
- Project Admins can add members and assign roles within their projects


#### 4.2.1 WW Admin Developer Feature Configuration

**Business Context**: WW Admin users serve different functions within wildlife research organizations. A field support administrator helping researchers troubleshoot camera connectivity in remote locations needs different tools than a user management administrator who handles account setup and permissions from an office environment. Similarly, a technical support administrator might need access to diagnostic tools and firmware management, while a project oversight administrator only needs cross-project visibility and sync monitoring.
Configurable Access Model: Rather than granting blanket access to all developer tools, the app implements granular feature-level permissions for WW Admin users. This ensures each administrator sees only the tools relevant to their specific responsibilities, reducing interface complexity and preventing accidental access to inappropriate system functions.

##### Real-World Scenarios:

- **Field Support Admin**: Needs BLE diagnostics, device firmware management, and sync queue monitoring to help researchers resolve connectivity issues during deployments
- **User Management Admin**: Requires user administration tools and audit logging but doesn't need technical diagnostic features
- **System Oversight Admin**: Needs cross-project visibility, sync status monitoring, and system health diagnostics but not device-level tools
- **Technical Support Admin**: Requires full diagnostic access including database inspection and raw LoRaWAN message viewing for advanced troubleshooting

**Implementation Considerations**: Feature permissions are configured per WW Admin user and can be modified by other WW Admin users with management privileges. The system maintains an audit trail of permission changes and allows environment-based overrides (development environments can enable additional diagnostic tools temporarily). Default configurations provide sensible baseline permissions that can be customized based on organizational needs and individual administrator responsibilities.


#### 4.2.2 Business Rationale for Configurable WW Admin Features

**Organizational Scale Considerations:** Wildlife research organizations vary dramatically in size and structure, from small university research groups with 2-3 projects to large conservation organizations managing hundreds of camera deployments across multiple continents. This scale variation means WW Admin roles must adapt to different operational contexts - a single technical administrator in a small organization might need access to all diagnostic tools, while a large organization might have specialized administrators for user management, field support, and technical operations.

**Field Operations Reality:** Wildlife research often involves deployments in remote locations where internet connectivity is limited or nonexistent. Field support administrators need immediate access to diagnostic tools that help researchers resolve camera connectivity, firmware, and deployment issues without waiting for remote technical support. However, these same administrators don't need access to user management or database inspection tools that are primarily office-based functions.

**Security and Compliance Requirements:** Research organizations handling sensitive wildlife location data must maintain strict access controls. Configurable permissions ensure that administrators have access only to the tools necessary for their specific responsibilities, reducing the risk of accidental data exposure or system modifications. This granular control supports organizational compliance requirements and audit trails while maintaining operational efficiency.

**Training and Support Efficiency:** Different WW Admin responsibilities require different skill sets and training levels. User management administrators need to understand account provisioning and role assignment but don't need technical knowledge of BLE protocols or database structures. By showing only relevant tools, the interface reduces training complexity and support burden while minimizing the risk of administrators accidentally accessing unfamiliar system functions.

**Operational Workflow Optimization:** Research teams often have established workflows where specific individuals handle particular aspects of camera management. Project coordinators need project oversight tools, field technicians need device diagnostic capabilities, and IT administrators need system-level access. Configurable features allow the app interface to align with existing organizational structures and workflows rather than forcing organizations to adapt to a one-size-fits-all administrative interface.

**Implementation Benefits:** This approach provides organizations with the flexibility to adapt the app to their specific operational needs while maintaining system security and interface simplicity. Administrators see only the tools they need for their role, reducing interface complexity and improving task efficiency. Organizations can easily adjust administrator capabilities as roles evolve or as team members take on different responsibilities within research projects.


### 4.3 User Profile Management

User profiles are established with complete core information during registration:

```typescript
// src/navigation/screens/ProfileScreen.tsx
interface UserProfile {
  email: string;           // Immutable, from auth
  fullName: string;        // Mandatory, provided during registration
  organization: string;    // Mandatory, provided during registration
  profilePhoto?: string;   // Optional, stored locally for MVP
  preferences: {
    offlineMapRadius: number;  // km to cache, default 10
    syncOnCellular: boolean;   // default true
    wwAdminFeatures?: WWAdminFeatureConfig;  // Only present for WW_ADMIN users
  };
}

interface WWAdminFeatureConfig {
  essentialFeatures: {
    userManagement: boolean;        // Always true - core admin function
    systemDiagnostics: boolean;     // Always true - system health monitoring
    projectOverview: boolean;       // Always true - cross-project visibility
    syncStatusMonitor: boolean;     // Always true - data integrity monitoring
  };
  configurableFeatures: {
    bleAdvancedDiagnostics: boolean;    // Device troubleshooting tools
    databaseInspector: boolean;         // Direct database access/queries
    rawLoRaWANViewer: boolean;         // Raw message inspection
    deviceFirmwareTools: boolean;       // Firmware update management
    syncQueueManipulation: boolean;     // Manual sync queue control
    apiEndpointTesting: boolean;        // Direct API testing tools
  };
  lastConfiguredBy: string;   // Which admin configured these features
  lastConfiguredAt: Date;     // When configuration was last changed
}
```

**Profile Completion Indicators:**
- Profile completeness is established during registration (fullName and organization are mandatory)
- Optional profile photo indicator shows when image is not yet uploaded
- Preference synchronization status visible in settings
- No profile completion prompts needed for core fields

**Profile Management Approach**: Since full name and organization are required during registration, users have complete core profiles from the start. This eliminates the friction of incomplete profile states and ensures proper user identification for team collaboration immediately upon account creation. The profile screen focuses on managing preferences and optional elements like profile photos rather than completing mandatory information.

**WW Admin Feature Configuration Interface**: For WW Admin users, the profile screen includes an additional "Administrative Features" section that displays their currently enabled developer tools. This section shows which diagnostic and management capabilities are available to them, helping administrators understand their access level and request additional permissions if needed for their role.

The interface clearly distinguishes between essential features (always enabled for all WW Admins) and configurable features (enabled based on individual responsibilities). Essential features include user management, system diagnostics, project overview, and sync monitoring - core capabilities every WW Admin needs regardless of their specific role. Configurable features include specialized tools like BLE diagnostics, database inspection, firmware management, and advanced troubleshooting capabilities.

**User Experience Considerations**: The feature configuration display is read-only for individual administrators - they can see what they have access to but cannot modify their own permissions. This prevents accidental privilege escalation while maintaining transparency about available capabilities. If an administrator needs additional features, they can contact another WW Admin with management privileges or refer to their organization's internal procedures for permission requests.


**Implementation Notes**: The configuration is stored as part of the user's preferences but synchronized with the backend to ensure consistency across devices. When a WW Admin's features are modified by another administrator, the changes take effect immediately upon the next app sync, with appropriate notifications to inform the user of capability changes.

---

## 5. Core Features Implementation

### 5.1 Navigation Structure

#### Bottom Tab Navigation with Context-Aware FABs

```typescript
const TAB_SCREENS = [
  { 
    name: 'Maps', 
    component: MapsScreen, 
    icon: 'map-marker',
    fab: ['startDeployment', 'endDeployment']
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
    fab: null
  },
  { 
    name: 'Devices', 
    component: DevicesScreen, 
    icon: 'bluetooth',
    fab: ['scanDevices']
  }
];
```

#### Side Drawer Menu (Always Accessible)

The drawer menu provides access to user settings and system features:

```typescript
const DrawerContent = () => {
  return (
    <>
      {/* User Section */}
      <UserProfile showSyncStatus={true} />
      
      {/* Main Menu Items */}
      <DrawerItem label="Profile" onPress={navigateToProfile} />
      <DrawerItem label="Settings" onPress={navigateToSettings} />
      <DrawerItem label="Offline Preparation" onPress={navigateToOfflinePrep} />
      
      {/* WW Admin Tools - Configurable per user */}
      {isWWAdmin() && (
        <DrawerSection title="WW Admin Tools">
          {/* Essential admin features - always shown */}
          <DrawerItem label="User Management" onPress={navigateToUserManagement} />
          <DrawerItem label="System Diagnostics" onPress={navigateToSystemDiagnostics} />
          <DrawerItem label="Project Overview" onPress={navigateToProjectOverview} />
          
          {/* Configurable features - shown based on user permissions */}
          {hasWWAdminFeature('deviceFirmwareTools') && (
            <DrawerItem label="Firmware Management" onPress={navigateToFirmwareManagement} />
          )}
          {hasWWAdminFeature('bleAdvancedDiagnostics') && (
            <DrawerItem label="BLE Advanced Diagnostics" onPress={navigateToBLEDiagnostics} />
          )}
          {hasWWAdminFeature('syncQueueManipulation') && (
            <DrawerItem label="Sync Queue Monitor" onPress={navigateToSyncQueue} />
          )}
          {hasWWAdminFeature('databaseInspector') && (
            <DrawerItem label="Database Inspector" onPress={navigateToDatabaseInspector} />
          )}
          {hasWWAdminFeature('rawLoRaWANViewer') && (
            <DrawerItem label="LoRaWAN Message Viewer" onPress={navigateToLoRaWANViewer} />
          )}
          {hasWWAdminFeature('apiEndpointTesting') && (
            <DrawerItem label="API Testing Tools" onPress={navigateToAPITesting} />
          )}
        </DrawerSection>
      )}
      
      {/* Developer Tools - Only in development environment */}
      {isDevelopmentEnvironment() && (
        <DrawerSection title="Developer Tools">
          <DrawerItem label="Mock LoRaWAN Generator" onPress={navigateToMockLoRaWAN} />
          <DrawerItem label="State Debugger" onPress={navigateToStateDebugger} />
          <DrawerItem label="Network Request Logger" onPress={navigateToNetworkLogger} />
          <DrawerItem label="Performance Profiler" onPress={navigateToPerformanceProfiler} />
          <DrawerItem label="Test Data Generator" onPress={navigateToTestDataGenerator} />
        </DrawerSection>
      )}
      
      <DrawerItem label="Sign Out" onPress={handleSignOut} />
      <AppVersion />
    </>
  );
};
```

##### 5.1.1 Intelligent Menu Adaptation

**Contextual Feature Display**: The drawer menu intelligently adapts its content based on the user's role, configured permissions, and environment. This reduces cognitive load by showing only relevant options while maintaining discoverability of available features.

**WW Admin Tool Organization**: WW Admin users see a dedicated "WW Admin Tools" section that separates administrative functions from general app features. Essential administrative capabilities (user management, system diagnostics, project overview) appear for all WW Admin users, providing consistent access to core administrative functions. Additional specialized tools appear only when specifically enabled for that administrator, ensuring the interface remains clean and focused on their actual responsibilities.

**Environment-Based Tool Separation**: Pure development and debugging tools are completely separated from production administrative features. The "Developer Tools" section only appears in development environments, preventing confusion between operational administrative tools and technical debugging capabilities. This clear separation ensures that production WW Admin users never see development-specific features that could cause system instability or confusion.

**User Experience Flow**: When a WW Admin user opens the drawer, they immediately see their available administrative tools without needing to navigate through irrelevant options. Feature visibility is determined in real-time based on their current permissions, so changes to their administrative capabilities are reflected immediately upon app sync. The menu maintains consistent organization regardless of which specific features are enabled, providing a predictable interface structure.

**Implementation Considerations**: The menu adaptation logic checks user permissions efficiently to avoid performance impacts when opening the drawer. Feature visibility decisions are cached locally but refreshed during sync operations to ensure consistency with backend permission changes. The system gracefully handles permission changes during active sessions, updating menu visibility without requiring app restart.


### 5.2 Maps Screen (Home)

The Maps screen serves as mission control, providing immediate access to deployment operations:

**Core Features:**
- User location display with permission handling
- Deployment markers with intelligent clustering
- Offline map tile caching (100MB limit, configurable)
- Sync status overlay (top-right corner)
- Context-aware FABs for deployment operations

**Offline Map Strategy:**
- Cache viewed areas automatically
- Pre-download option in Settings
- Show offline indicator when using cached tiles
- Graceful degradation for uncached areas

### 5.3 Start Deployment Flow (Enhanced)

#### Step 1: Project Selection (Redesigned)

**New Implementation:**
- Card-based UI replacing dropdown for better mobile UX
- Search bar for filtering projects (essential for users with many projects)
- Each project card shows sync status, member count, deployment statistics
- FAB for creating new project
- Auto-generated deployment name with user customization

#### Step 2: New Project Creation (If Selected)

**Complete Project Setup:**
```typescript
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
```

**Member Addition Flow:**
1. Enter email address
2. System checks if user exists in database
3. If exists: Add to project immediately
4. If not: Queue invitation email for when online
5. Assign role (defaults to PROJECT_MEMBER)

#### Step 3: Device Discovery (Enhanced with Filtering)

**Device Filtering Options:**
```typescript
enum DeviceFilter {
  ALL = 'all',
  WW_DEVICES = 'ww_devices',      // Wildlife Watcher cameras only
  OTHER_DEVICES = 'other',         // Non-WW BLE devices
  KNOWN_NEARBY = 'known_nearby'   // GPS proximity-based filtering
}
```

**Permission Request UI:**
- Check BLE and location permissions
- Show educational cards if denied
- Provide deep links to settings
- Clear rationale for permission requirements

#### Step 4: Deployment Configuration

**Enhanced Location Features:**
- Auto-detect current GPS location
- Manual coordinate entry with validation
- Reverse geocoding for address display
- Map interaction updates all location fields
- Offline fallback for address lookup

**Capture Method Configuration:**
- Motion Detection vs Timelapse radio selection
- Timelapse interval picker with default 30 seconds
- Smart defaults based on project type

#### Step 5: Camera Preview

**Live Camera Testing:**
- BLE command to trigger test snapshot
- Display received image with quality indicators
- "Take Another Snapshot" option
- Image quality validation
- Positioning guidance overlay

#### Step 6: Final Setup

**Location Documentation:**
- Camera placement photo (required)
- Site description text area
- Image compression if over size limit
- Offline storage with upload when connected

**Success Flow:**
- Create deployment record locally
- Send configuration to device via BLE
- Show success confirmation
- Navigate to filtered deployments view for project

### 5.4 End Deployment Flow

**Three-Screen Flow from Figma:**
1. **Device Discovery**: Reuse component from start flow
2. **Deployment Selection**: Show nearby devices with deployment info
3. **Confirmation**: Display deployment details with end button

**Key Features:**
- Auto-connect to previously paired devices
- Show deployment duration and statistics
- Location verification to prevent wrong camera selection
- Success/failure handling with clear next steps

### 5.5 Projects Screen

**Enhanced Project Management:**
- Card-based layout with key metrics
- Search and filter capabilities
- Sync status per project
- Pull-to-refresh functionality

**Post-Deployment Navigation Intelligence:**
After successfully creating a deployment, navigate to:
- Deployments screen
- Apply project filter automatically
- Show success notification

### 5.6 Project Details Screen

**Comprehensive Project Management:**

**Team Member Management (No Profile Pictures per Requirements):**
```typescript
const MemberListItem = ({ member, isAdmin, currentUserId }) => (
  <ListItem>
    <Text variant="bodyLarge">{member.fullName}</Text>
    <RoleBadge role={member.role} />
    {isAdmin && member.id !== currentUserId && (
      <IconButton 
        icon="dots-vertical" 
        onPress={() => showMemberActions(member.id)}
      />
    )}
  </ListItem>
);
```

**Add Member Flow:**
1. Enter email address
2. Select role (admin/member)
3. Check if user exists
4. Send invitation if new user (must include fullName and organization requirements)
5. Add to project immediately

**Invitation Requirements**: When sending invitations to new users, the invitation email must clearly communicate that full name and organization are required during account setup to ensure proper team member identification and collaboration within the research project.


### 5.7 Deployments Screen

**Enhanced Deployment Monitoring:**
- Tab filtering: Active | Ended | All
- Status indicators with color coding:
  - 🟢 Green: Healthy (battery >30%, SD <80%)
  - 🟡 Yellow: Warning (battery 10-30%, SD 80-95%)
  - 🔴 Red: Critical (battery <10%, SD >95%)
  - ⚪ Gray: No recent data (>7 days)

**Deployment Card Information:**
- Project name and device name
- Battery level and SD card usage (from LoRaWAN)
- Last update timestamp
- Start/end dates with duration calculation

### 5.8 Devices Screen

**Hardware Management Center:**
- Scan for nearby devices with signal strength
- Connection status indicators
- Battery and firmware version display
- Actions for non-deployed devices only

**Developer Menu Extensions:**
- Force DFU mode
- BLE packet inspector
- Mock device simulator
- Raw command testing

---

## 6. Offline Support Architecture

### 6.1 Offline-First Philosophy

Field researchers often work in locations without cellular coverage for extended periods. The app must function fully offline, storing all operations locally and syncing intelligently when connectivity returns. This is a core requirement, not an optional feature.

### 6.2 Pre-Deployment Offline Preparation

**Offline Readiness Checklist:**
```typescript
interface OfflinePreparation {
  checklist: {
    projectsSync: boolean;      // Latest project data downloaded
    mapTiles: boolean;         // Area maps cached
    deviceFirmware: boolean;   // Latest firmware downloaded
    aiModels: boolean;         // Project models downloaded
    deviceTest: boolean;       // BLE connectivity verified
  };
  readinessScore: number;      // 0-100% based on checklist
}
```

### 6.3 Local Database Schema

**SQLite Schema with Logical Deletes:**
```sql
-- Queue for operations pending sync
CREATE TABLE offline_queue (
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
);

-- Local storage for projects
CREATE TABLE local_projects (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,  -- JSON blob
  version INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME,  -- Logical delete
  synced BOOLEAN DEFAULT 0,
  sync_error TEXT
);

-- All tables follow similar pattern with logical deletes
```

### 6.4 Sync Conflict Resolution

**Resolution Rules:**
```typescript
class ConflictResolver {
  resolveDeployment(local: Deployment, remote: Deployment): Deployment {
    // Rule 1: 'ended' status always wins (prevent orphaned deployments)
    if (remote.status === 'ended' || local.status === 'ended') {
      return remote.status === 'ended' ? remote : local;
    }
    
    // Rule 2: Most recent update wins for active deployments
    return local.updatedAt > remote.updatedAt ? local : remote;
  }
  
  resolveProject(local: Project, remote: Project): Project {
    // Merge member lists (union of both)
    const mergedMembers = this.mergeUnique(local.members, remote.members, 'userId');
    
    // Last-write-wins for other fields
    const winner = local.updatedAt > remote.updatedAt ? local : remote;
    
    return { ...winner, members: mergedMembers };
  }
}
```

### 6.5 Sync Status Management

**Visual Sync Status Indicators:**
- Global status near user avatar
- Per-project status on project cards
- Per-deployment status on deployment cards
- Detailed sync view in developer menu

**Sync Priority Levels:**
- 1000: Deployment end (critical)
- 900: Deployment start
- 800: Project updates
- 700: Member additions
- 500: Profile updates

---

## 7. Supabase Integration

### 7.1 Database Schema

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";  -- For geospatial queries

-- User roles table (for WW_ADMIN support)
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

-- LoRaWAN messages storage (new requirement)
CREATE TABLE lorawan_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_eui TEXT NOT NULL,
  deployment_id UUID REFERENCES deployments(id),
  raw_payload JSONB NOT NULL,  -- Store complete message for debugging
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

### 7.2 LoRaWAN Integration

**Webhook Implementation:**
LoRaWAN enables cameras to send status updates from remote locations without cellular coverage. The webhook processes these messages and updates deployment status.

```typescript
// Edge Function: lorawan-webhook
serve(async (req) => {
  try {
    // Verify webhook authentication
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${Deno.env.get('LORAWAN_WEBHOOK_SECRET')}`) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    const payload = await req.json();
    
    // Store raw message for debugging and audit
    const { data: messageRecord } = await supabase
      .from('lorawan_messages')
      .insert({
        device_eui: payload.deviceEUI,
        raw_payload: payload,
        received_at: payload.timestamp
      })
      .select()
      .single();
    
    // Parse device-specific payload (format TBD by hardware team)
    const parsedData = parseLoRaWANPayload(payload);
    
    // Update deployment status
    if (parsedData.batteryLevel !== undefined || parsedData.sdCardUsage !== undefined) {
      await supabase
        .from('deployments')
        .update({
          battery_level: parsedData.batteryLevel,
          sd_card_usage: parsedData.sdCardUsage,
          last_data_received: new Date().toISOString()
        })
        .match({
          device_id: payload.deviceEUI,
          status: 'active'
        });
    }
    
    return new Response(JSON.stringify({ success: true }));
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
```

### 7.3 Image Storage Best Practices

**Storage Strategy:**
- Store images in Supabase Storage (not as base64 in database)
- Generate thumbnails automatically (200x200px)
- Implement compression for large images (>5MB)
- Use CDN for global delivery
- Cache images locally for offline viewing

```typescript
interface ImageUploadService {
  async uploadDeploymentImage(image: File, deploymentId: string): Promise<string> {
    // Compress if over size limit
    const compressedImage = await compressImage(image);
    
    // Upload to Supabase Storage
    const path = `deployments/${deploymentId}/${Date.now()}.jpg`;
    const { data, error } = await supabase.storage
      .from('deployment-images')
      .upload(path, compressedImage);
    
    if (error) throw error;
    
    // Get public URL (CDN-enabled)
    const { publicURL } = supabase.storage
      .from('deployment-images')
      .getPublicUrl(path);
    
    return publicURL;
  }
}
```

---

## 8. State Management

### 8.1 Redux Store Architecture

```typescript
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
    models: modelsSlice.reducer  // AI models (future)
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST']
      }
    }).concat(syncMiddleware, offlineMiddleware)
});
```

### 8.2 Key Redux Slices

**Auth Slice:**
```typescript
interface AuthState {
  user: User | null;
  session: Session | null;
  roles: UserRole[];
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}
```

**Sync Slice:**
```typescript
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
```

**Offline Slice:**
```typescript
interface OfflineState {
  isOnline: boolean;
  isOfflineModeEnabled: boolean;
  cache: {
    projects: number;
    deployments: number;
    images: number;
    mapTiles: number;  // MB cached
    firmware: string[];  // Version numbers
    models: string[];    // Model IDs
  };
  preparedness: {
    score: number;  // 0-100
    checklist: OfflineChecklistItem[];
  };
}
```

---

## 9. Implementation Guidelines

### 9.1 Development Workflow

**AI-Assisted Development with Claude Code:**
The app will be built using Claude Code with specialized sub-agents working on different features in parallel:

**Sub-Agent Specialization:**
- **Auth Agent**: Authentication, user management, roles
- **Sync Agent**: Offline synchronization, conflict resolution
- **BLE Agent**: Bluetooth hardware communication
- **UI Agent**: Screen components, navigation
- **Data Agent**: Redux store, database operations

**Development Phases:**
1. **Foundation** (Week 1): Navigation, Redux, SQLite
2. **Core Features** (Week 2-3): Authentication, projects, deployments
3. **Integration** (Week 4): Sync, testing, polish

### 9.2 Code Quality Standards

**TypeScript Requirements:**
- Strict mode enabled
- No `any` types
- Comprehensive interfaces
- Null checks required

**React Patterns:**
- Functional components with hooks
- Error boundaries
- Memoization for performance
- Proper cleanup in useEffect

**Testing Requirements:**
- Unit tests for services
- Integration tests for flows
- E2E tests with Maestro
- Error scenario coverage

---

## 10. Production Readiness & Security

### 10.1 Security Checklist

**Critical Security Requirements:**
- [ ] API keys in secure environment variables
- [ ] Certificate pinning for API calls
- [ ] Local database encryption with SQLCipher
- [ ] BLE command encryption and device verification
- [ ] JWT session management with refresh tokens
- [ ] Input validation and SQL injection prevention
- [ ] HTTPS-only communication

**App Store Compliance:**
- [ ] Privacy policy URL hosted
- [ ] Terms of service available
- [ ] Age rating: 4+ (no objectionable content)
- [ ] Export compliance documentation
- [ ] Screenshots and metadata prepared

### 10.2 Performance Requirements

**Target Metrics:**
- App launch: < 3 seconds cold start
- Screen transitions: < 500ms
- BLE operations: < 5 seconds connection
- Memory usage: < 200MB peak
- Battery drain: < 15%/hour active use

---

## 11. Testing Strategy

### 11.1 Maestro UI Testing

**Test Framework Setup:**
Maestro will be used for comprehensive UI automation testing across both platforms.

**Critical Test Flows:**
```yaml
# maestro/deployment-flow.yaml
appId: com.wildlife.wildlifewatcher
---
- launchApp
- tapOn: "Start Deployment"
- assertVisible: "Select Project"
- tapOn: "Test Project"
- tapOn: "Continue"
- assertVisible: "Searching for devices"
- waitForAnimationToEnd
- tapOn: "Wildlife Watcher Camera 1"
- assertVisible: "Deployment Configuration"
- tapOn: "Use My Location"
- tapOn: "Motion Detection"
- tapOn: "Continue"
- assertVisible: "Camera Preview"
- tapOn: "Approve & Continue"
- inputText: "Test deployment location"
- tapOn: "Start Deployment"
- assertVisible: "Deployment Successful"
```

### 11.2 Test Coverage

**Required Test Scenarios:**
- Authentication flows (login, signup, password reset)
- Offline operations (queue, sync, conflict resolution)
- Device management (discovery, connection, firmware update)
- Deployment workflows (start, configure, end)
- Member management (invite, add, remove)
- Sync status and error recovery

---

## 12. AI Agent Development Guidelines

### 12.1 Claude Code Integration

**Development Strategy:**
Multiple Claude Code sub-agents will work in parallel on different aspects of the application, coordinated through shared interfaces and clear module boundaries.

**Sub-Agent Responsibilities:**

**Auth Agent:**
- Domain: Authentication and user management
- Files: `src/navigation/screens/auth/*`, `src/services/auth/*`
- Tasks: Login/signup screens, session management, role verification

**Sync Agent:**
- Domain: Offline synchronization
- Files: `src/services/offline/*`, `src/store/slices/offlineSlice.ts`
- Tasks: SQLite operations, conflict resolution, background sync

**BLE Agent:**
- Domain: Bluetooth and hardware
- Files: `src/services/ble/*`, `src/services/dfu/*`
- Tasks: Device discovery, connection management, firmware updates

**UI Agent:**
- Domain: User interface components
- Files: `src/components/*`, `src/navigation/*`
- Tasks: Screen layouts, form validation, navigation structure

**Data Agent:**
- Domain: Data management
- Files: `src/store/*`, `src/services/supabase/*`
- Tasks: Redux store, database operations, state management

### 12.2 Parallel Development Coordination

**Communication Framework:**
- Shared context via this specification document
- Interface contracts between modules
- Mock implementations for dependencies
- Integration points defined upfront

**Development Milestones:**
- Week 1: Foundation complete (navigation, store, auth)
- Week 2: Core features functional (projects, deployments)
- Week 3: Integration complete (sync, testing)
- Week 4: Polish and production prep

---

## 13. Admin Portal Integration

### 13.1 Wildlife Watcher Admin Portal

**Purpose:** Web-based companion portal for WW Admin users to manage system-wide operations and provide password reset functionality accessible outside the mobile app.

**Architecture:**
- **Hosting**: Supabase Edge Functions
- **Frontend**: React-based SPA served via Edge Functions
- **Authentication**: Shared Supabase Auth
- **Database**: Same Supabase instance as mobile app

**Core Features:**
- User management (view, add, deactivate users)
- WW Admin role assignment
- Password reset form (mobile-responsive)
- Project overview (read-only)
- System administration tools

### 13.2 Password Reset Web Form

**Critical Requirement:** Users need to reset passwords from devices other than their phone.

**Implementation:**
- Hosted at: `https://admin.wildlife.ai/reset-password`
- Mobile-responsive design
- Token validation with expiry
- Success redirect with deep link to app
- Shared with main admin portal infrastructure

**Flow:**
1. User requests password reset in app
2. Email sent with web form link
3. User completes reset on any device
4. Success message with app deep link
5. User continues in mobile app

### 13.3 Repository Strategy

**Recommendation:** Separate repository for admin portal
- Independent versioning and deployment
- Different technology stack flexibility
- Clear separation of concerns
- Simplified mobile app repository

**Alternative:** Subfolder in mobile repo if team prefers unified approach

---

## 14. AI Model & Firmware Management

### 14.1 AI Model Management (Future Implementation)

**Status:** Placeholder for future AI model deployment functionality

**Planned Capabilities:**
- Model storage in Supabase Storage
- Version control and metadata tracking
- Project-based model assignment
- Offline model sync to mobile app
- BLE deployment to cameras
- Performance monitoring and analytics

### 14.2 Firmware Update Management

**Current Implementation:**
- Firmware files stored in Supabase Storage
- Version metadata in database
- Nordic DFU protocol for updates
- Battery level and deployment status checks
- User confirmation required

**Update Process:**
1. Check latest firmware version
2. Download if newer available
3. Verify checksum integrity
4. Transfer via Nordic DFU over BLE
5. Verify successful installation
6. Update device record in database

**Restrictions:**
- No updates during active deployment
- Battery level >30% required
- Stable BLE connection needed
- User confirmation required

---

## 15. Actions & Clarifications Needed

### 15.1 Critical Human Actions Required

**Design Team (Blocking MVP Development):**
- [ ] Complete app icon design (1024x1024px)
- [ ] Create splash screen assets
- [ ] Design missing screens:
  - Member management UI (add/remove/role change)
  - User profile screen layout
  - Sync status detailed view
  - Developer menu interface

**Product Manager (Critical Decisions):**
- [ ] Confirm LoRaWAN message format from hardware team
- [ ] Approve simplified member management flow  
- [ ] Validate offline conflict resolution rules
- [ ] Sign off on user role permission matrix

**Development Team (Setup Required):**
- [ ] Create production Supabase project
- [ ] Configure development environment variables
- [ ] Set up iOS certificates and provisioning profiles
- [ ] Install and configure Maestro testing framework
- [ ] Set up Claude Code development environment

**Hardware Team (Documentation Needed):**
- [ ] Complete BLE command protocol specification
- [ ] Finalize LoRaWAN payload structure and field definitions
- [ ] Provide firmware update procedures and compatibility matrix
- [ ] Document camera snapshot commands and capabilities

### 15.2 Technical Clarifications Required

**Pending Decisions:**
- Maximum image file size and compression settings
- Offline cache size limits and eviction policies
- Session timeout duration and biometric authentication requirements
- Performance limits (max projects/deployments per user)
- Analytics service selection and privacy settings

### 15.3 Risk Mitigation

**High Priority Risks:**
- iOS App Store approval delays (Bluetooth usage requires detailed justification)
- LoRaWAN integration complexity (hardware team coordination critical)
- Offline sync reliability in field conditions

**Mitigation Strategies:**
- Submit to App Store early with detailed review notes
- Implement mock LoRaWAN system for development
- Extensive offline testing with real field scenarios

### 15.4 Success Criteria

**MVP Success Metrics:**
- All core features functional offline and online
- Deployment flow completable in <5 minutes
- App crash rate <1%
- Sync conflicts resolved automatically >95%
- App store rating >4.0 stars
- Support for 100+ concurrent users

### 15.5 Post-MVP Roadmap

**Phase 2 Features:**
- AI model deployment to cameras
- Advanced analytics dashboard
- Multi-language support
- Tablet optimization
- Batch operations for large deployments

**Phase 3 Features:**
- Web companion application
- Third-party API integration
- Advanced mapping features
- Team collaboration tools
- Automated reporting and insights

---

**Document Status:** Ready for AI-assisted development with Claude Code  
**Next Steps:** Begin foundation development with Auth and UI agents  
**Critical Path:** Complete design assets and hardware specifications