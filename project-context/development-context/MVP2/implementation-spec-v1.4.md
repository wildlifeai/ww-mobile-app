# Wildlife Watcher Mobile App - MVP 1 & 2 Implementation Specification (Consolidated Design)

**Version**: 1.4.3  
**Date**: 27 August 2025  
**Platform**: React Native (Expo SDK 51)  
**Backend**: Supabase  
**Status**: Ready for AI-Assisted Development with Claude Code and Claude Flow

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


### Reference Documents

- **Figma Wireframe & User Stories (combined):** `@project-context/development-context/MVP2/User Stories_ Navigation 2.0-Figma-Design-med.pdf` - Original design document used as base for this specification with additional enhancements
- **Supabase Backend Repository:** `~/dev/wildlifeai/wildlife-watcher-backend` (separate Git repository with Supabase components in `supabase/` subfolder)
- **Local Supabase Documentation:** `@project-context/development-context/supabase-backend/` (integration documentation in this repository)
- **App Architecture Review:** `@project-context/development-context/architecture-review/ARCHITECTURE-REVIEW.md` - Pre-specification architecture state requiring updates based on this document




---

## User Story Mapping

| User Story | Implementation Section | Priority | Status |
|------------|----------------------|----------|---------|
| WW Admin user provisioning | Section 4.1 | MVP | ⬜ Planned |
| User login and authentication | Section 4.1 | MVP | ✅ Complete |
| Password reset via web form | Section 15.5 | Phase 2 | ⬜ Deferred |
| Start deployment flow | Section 5.3 | MVP | 🔄 In Progress |
| End deployment flow | Section 5.4 | MVP | ⬜ Planned |
| Project creation and management | Sections 5.5, 5.6 | MVP | ⬜ Planned |
| Member invitation and roles | Section 4.2, 5.6 | MVP | ⬜ Planned |
| Offline field work | Section 6 | MVP | ⬜ Planned |
| Device discovery and testing | Section 5.8 | MVP | 🟡 Partial |
| Firmware updates | Section 5.8 | MVP | 🟡 Partial |
| Deployments monitoring | Section 5.7 | MVP | ⬜ Planned |
| LoRaWAN status updates | Section 7.3 | MVP | ⬜ Planned |
| User profile management | Section 15.5 | Phase 2 | ⬜ Deferred |
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

The authentication flow is largely complete, with login functionality working and tested. Users can successfully authenticate against the Supabase backend, and sessions persist appropriately. Web Based password reset functionality has been deferred to Phase 2 to focus on core MVP features (app based reset is in place).

The core Bluetooth infrastructure for camera communication has been thoroughly tested with real Wildlife Watcher devices. **Note: Current BLE/DFU implementation is placeholder for testing connectivity only (ping/pong and DFU mode). All device interaction features are work-in-progress pending hardware specification finalization.** The navigation structure is in place with bottom tabs and drawer menu configured. The Maps screen exists but needs the floating action buttons for deployment workflows. Basic Redux store configuration is complete, ready for feature-specific slices to be added as development progresses.

### Features Requiring Implementation

Several critical user flows need to be built or completed. The member management system needs to be implemented, allowing project admins to add existing users to projects. Only WW Admin users can add new users to the system and assign them to organisations. The offline synchronization infrastructure is planned but not yet implemented - this is crucial for field operations in remote areas.

The start and end deployment flows need completion with simplified UI focusing on core functionality rather than advanced features like cards, search, and filtering which have been moved to Phase 2.

The LoRaWAN webhook for receiving camera status updates needs to be implemented as an Edge Function, though the exact message format is still being finalized by the hardware team.

Image storage with CDN optimization and thumbnail generation needs to be set up for deployment photos. The admin portal for WW Admin users needs to be implemented as detailed in Section 13.

### Development Environment Status
- ✅ Expo SDK 51 migration complete
- ✅ EAS Build configuration working
- ✅ Development builds on Android tested
- 🟡 iOS development builds need testing with team devices
- ✅ BLE functionality verified with real WW cameras (placeholder implementation)
- 🔗 Reference iOS POC at ~/dev/wildlifeai/wildlife-watcher-expo-poc
- 🟡 Password reset deferred to Phase 2 (web-based reset moved from MVP)
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
├── ~/dev/wildlifeai/wildlife-watcher-backend/  # Separate Git repository
│   ├── supabase/         # Supabase project components
│   │   ├── functions/    # Edge Functions
│   │   ├── migrations/   # Database migrations
│   │   └── config.toml   # Supabase configuration
│   ├── admin-portal/     # React-based admin portal
│   └── docs/             # Backend documentation
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

#### User Access Pattern

The app supports a single, controlled user onboarding path to ensure proper organisational management:

**WW Admin Provisioning Only** - System administrators are the only users who can create new user accounts. WW Admin users add users through the admin portal and assign them to organisations. **WW Admin must collect email address when provisioning users.** This controlled approach ensures proper user management and organisational structure from the start.

#### User Provisioning Requirements

**Mandatory Profile Information**: WW Admin users must provide complete user information when creating accounts, including full name and organisation assignment. This ensures that all users have proper identification and organisational context from account creation.

**Validation Standards**: Full name must contain at least first and last name (minimum two words) and organisation assignment must be specified. All users must be assigned to an organisation before they can be added to projects.

**Organisational Structure**: Users belong to organisations first, then can be added to projects within or across organisations. This hierarchical approach ensures proper access control and administrative oversight.

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
  PROJECT_MEMBER = 'project_member', // Field team members
  MODEL_MANAGER = 'model_manager'   // AI model management (org-level)
}

// Role Capabilities Matrix:
interface RoleCapabilities {
  'model_manager': {
    manageAIModels: true,         // Upload, version, assign models
    viewProjectModels: true,      // See which models are deployed
    accessModelMetrics: true,     // Performance and usage statistics
    organisationLevel: true       // Operates at organisation level
  },
  'ww_admin': {
    manageAllUsers: true,  // Core MVP function - user management only
    // Note: Advanced features moved to Phase 2 for MVP simplification:
    // - viewAllProjects (cross-project visibility)
    // - configureSystem (system configuration) 
    // - accessDiagnostics (system diagnostics)
    // - manageWWAdminFeatures (configurable permissions)
    // - accessDevMenu (moved to development environment only)
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
- Only WW Admins can add new users to the system
- Project Admins can add existing users to projects and assign roles
- Model Manager is an organisation-level role for AI model management
- Users must belong to an organisation to access projects


#### 4.2.1 Simplified WW Admin Functions for MVP

**Business Context**: For MVP, WW Admin capabilities are simplified to focus on core system administration without complex feature permissioning. Advanced diagnostic and developer tools are reserved for development environments only.

**MVP WW Admin Functions:**
- User Management: Add, deactivate, and assign users to organisations (core administrative function)

**Removed from MVP:**
- BLE/DFU testing and diagnostics (moved to developer tools)
- Database diagnostics and inspection tools
- LoRaWAN message viewer
- Cross-project visibility beyond basic overview
- Manual sync queue manipulation
- Advanced BLE packet inspection

##### Real-World Scenarios (MVP):

- **System Administrator**: Manages user accounts, creates organisations, and assigns users to appropriate organisations. Focuses purely on administrative functions without requiring technical expertise.

**MVP Implementation Notes**: For MVP, WW Admin functionality is limited to core user management only. All diagnostic, testing, and troubleshooting capabilities are moved to developer tools (accessible only in development environments) to maintain simplicity and focus on essential administrative functions. This focused approach ensures WW Admin users can immediately perform their essential function while maintaining system security and interface simplicity.


### 4.3 User Profile Management (Phase 2)

User profile management has been moved to Phase 2. For MVP, profiles are established with complete core information during WW Admin provisioning:

```typescript
// src/navigation/screens/ProfileScreen.tsx
interface UserProfile {
  email: string;           // Immutable, from auth
  fullName: string;        // Mandatory, provided during registration
  organization: string;    // Mandatory, provided during registration
  // Profile photo removed for MVP - moved to Phase 2
  preferences: {
    offlineMapRadius: number;  // km to cache, default 10
    syncOnCellular: boolean;   // default true
    wwAdminFeatures?: WWAdminFeatureConfig;  // Only present for WW_ADMIN users
  };
}

interface WWAdminFeatureConfig {
  essentialFeatures: {
    userManagement: boolean;        // Always true - core admin function (MVP)
  };
  // Note: All advanced features moved to Phase 2 for MVP simplification
  // configurableFeatures will be restored in Phase 2 with:
  // - systemDiagnostics, projectOverview, syncStatusMonitor
  // - bleAdvancedDiagnostics, databaseInspector, rawLoRaWANViewer
  // - deviceFirmwareTools, syncQueueManipulation, apiEndpointTesting
  lastConfiguredBy: string;   // Which admin configured these features
  lastConfiguredAt: Date;     // When configuration was last changed
}
```

**Profile Information for MVP:**
- Profile completeness is established during WW Admin provisioning (fullName, email and organisation are mandatory)
- Preference synchronization status visible in settings
- No profile completion prompts needed for core fields
- Profile photos deferred to Phase 2 as well a self service by users to manage their profile

**Profile Management Approach**: Since full name and organisation are required during WW Admin provisioning, users have complete core profiles from the start. This eliminates the friction of incomplete profile states and ensures proper user identification for team collaboration immediately upon account creation. For MVP, the profile screen focuses on managing preferences only.

**WW Admin Feature Configuration Interface**: For WW Admin users, the profile screen includes an additional "Administrative Features" section that displays their currently enabled developer tools. This section shows which diagnostic and management capabilities are available to them, helping administrators understand their access level and request additional permissions if needed for their role.

For MVP, the interface is simplified to focus only on essential user management capabilities. Advanced diagnostic features (system diagnostics, project overview, sync monitoring) and specialized tools (BLE diagnostics, database inspection, firmware management) have been moved to Phase 2 to maintain MVP simplicity and focus on core administrative functions.

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
      
      {/* WW Admin Tools - Simplified for MVP */}
      {isWWAdmin() && (
        <DrawerSection title="WW Admin Tools">
          <DrawerItem label="User Management" onPress={navigateToUserManagement} />
        </DrawerSection>
      )}
      
      {/* Developer Tools - Only in development environment */}
      {isDevelopmentEnvironment() && (
        <DrawerSection title="Developer Tools">
          <DrawerItem label="BLE/DFU Testing" onPress={navigateToBLETesting} />
          <DrawerItem label="Mock LoRaWAN Generator" onPress={navigateToMockLoRaWAN} />
          <DrawerItem label="State Debugger" onPress={navigateToStateDebugger} />
          <DrawerItem label="Network Request Logger" onPress={navigateToNetworkLogger} />
          <DrawerItem label="Performance Profiler" onPress={navigateToPerformanceProfiler} />
          <DrawerItem label="Test Data Generator" onPress={navigateToTestDataGenerator} />
          <DrawerItem label="Mock Device Simulator" onPress={navigateToMockDevice} />
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

**WW Admin Tool Organization**: WW Admin users see a dedicated "WW Admin Tools" section that separates administrative functions from general app features. Essential administrative capabilities (user management) appear for all WW Admin users, providing consistent access to core administrative functions. Additional specialized tools appear only when specifically enabled for that administrator, ensuring the interface remains clean and focused on their actual responsibilities.

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

#### Step 1: Project Selection (Simplified)

**MVP Implementation:**
- Simple dropdown list for project selection
- FAB for creating new project
- Auto-generated deployment name with user customization
- Card-based UI, search, and statistics moved to Phase 2

#### Step 2: New Project Creation (If Selected)

**Complete Project Setup:**
```typescript
interface NewProjectData {
  name: string;
  owner: string;  // Auto-populated with current user
  organisation_id: string;  // Linked based on creator's org membership
  samplingDesign: string;
  description: string;
  website?: string;
  members: Array<{ email: string; role: UserRole }>;
  isPrivate: boolean;
  usingBait: boolean;
  monitoringMarked: boolean;
}
```

**Organisation Linking:** Projects are automatically linked to the organisation based on the creator's organisation membership.

**Member Addition Flow:**
1. Search by email address or name within organisation context
2. Select user from search results
3. Assign role (admin/member)
4. Add to project

**User Search:** Users can be found by email or name within their organisation context for easier member management.

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

**Simplified Location Features:**
- Auto-detect current GPS location
- Manual coordinate entry with validation
- NZ address autocomplete using geocoding service
- Map interaction updates location fields

**Capture Method Configuration:**
- Motion Detection vs Timelapse radio selection
- Timelapse interval picker with default 30 seconds
- Smart defaults removed for MVP

#### Step 5: Camera Preview

**Simplified Camera Testing:**
- Camera takes photo immediately on screen entry
- Display received image
- "Take Another Snapshot" option
- Quality indicators and positioning overlay removed for MVP (defer to Phase 2 considearation)

#### Step 6: Final Setup

**BLE Configuration (Placeholder Implementation):**
- Send basic ping/pong commands for connectivity testing
- Configure DFU mode for firmware updates
- **Note: Full camera configuration pending hardware specification**

**Location Documentation:**
- Camera placement photo (required)
- Site description text area
- Image compression if over size limit
- Offline storage with upload when connected

**Success Flow:**
- Create deployment record locally
- Send configuration to device via BLE
- Show success confirmation
- Show home button only (filtered views deferred to Phase 2)

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

**Card-Based Project Display:**
- Card-based layout showing project summaries with key metrics
- Each project card displays:
  - Project name and description
  - Member count (e.g., "Members: 5")
  - Active deployments count (e.g., "Active deployments: 3")
  - Total deployments count (e.g., "All deployments: 3")
  - Project thumbnail/photo (if available)
- "Add new project" button for project creation
- Pull-to-refresh functionality maintained
- Search and filtering functionality moved to Phase 2

**Project Card Layout:**
```typescript
interface ProjectCard {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  activeDeployments: number;
  totalDeployments: number;
  thumbnailUrl?: string;
  lastUpdated: Date;
}
```

**Navigation:**
- Tap project card to view project details
- Project cards only show projects where user is a member or admin



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
1. Search by email address or name within organisation context
2. Select user from search results
3. Set role (admin/member)
4. Add to project

**Organisation Requirements**: Users must already be in the system and assigned to an organisation by a WW Admin before they can be added to projects.


### 5.7 Deployments Screen

**Simplified Deployment Monitoring:**
- Only 2 statuses: Active (green) and Ended (red)
- No tab filtering for MVP
- Status indicators simplified:
  - 🟢 Green: Active deployment
  - 🔴 Red: Ended deployment

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
- "Check camera view" link for deployed devices
- Display loaded AI model for deployed devices
- Show battery and SD card storage status

**Developer Tools (Development Environment Only):**
- Force DFU mode testing
- BLE packet inspector
- Mock device simulator
- Raw BLE command testing

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

**Repository Structure:** The Supabase backend is maintained in a separate Git repository at `~/dev/wildlifeai/wildlife-watcher-backend` with database schema, migrations, and Edge Functions in the `supabase/` subfolder. Mobile app integration documentation is available locally at `@project-context/development-context/supabase-backend/`.

**Schema Overview:** The specification below reflects the current production schema. For the most up-to-date schema definitions, refer to the backend repository migrations and the TypeScript types at `@project-context/development-context/supabase-backend/supabase.ts`.

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- Generates UUID primary keys (uuid_generate_v4())
CREATE EXTENSION IF NOT EXISTS "postgis";        -- For geospatial queries and location data

-- Organisations table
CREATE TABLE organisations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ  -- Logical delete
);

-- User organisations relationship
CREATE TABLE user_organisations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('model_manager')),  -- Optional org-level roles
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  removed_at TIMESTAMPTZ,  -- Logical delete
  UNIQUE(user_id, organisation_id)
);

-- User roles table (for WW_ADMIN support)
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('ww_admin', 'user')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id, role)
);

-- Projects table with logical deletes and organisation relationship
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  organisation_id UUID REFERENCES organisations(id) NOT NULL,
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

-- User preferences and WW Admin configuration
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  full_name TEXT NOT NULL,
  organisation_name TEXT,  -- Denormalized for quick access
  offline_map_radius INTEGER DEFAULT 10,  -- km to cache
  sync_on_cellular BOOLEAN DEFAULT true,
  ww_admin_features JSONB,  -- Only populated for WW Admin users
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- RLS Policies
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Users can see organisations they belong to
CREATE POLICY "Users view their organisations" ON organisations
  FOR SELECT USING (
    deleted_at IS NULL AND
    EXISTS (
      SELECT 1 FROM user_organisations
      WHERE organisation_id = organisations.id
      AND user_id = auth.uid()
      AND removed_at IS NULL
    )
  );

-- Users can see projects in their organisations or where they're members
CREATE POLICY "Users view their projects" ON projects
  FOR SELECT USING (
    deleted_at IS NULL AND (
      owner_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM project_members 
        WHERE project_id = projects.id 
        AND user_id = auth.uid()
        AND removed_at IS NULL
      ) OR
      EXISTS (
        SELECT 1 FROM user_organisations
        WHERE organisation_id = projects.organisation_id
        AND user_id = auth.uid()
        AND removed_at IS NULL
      )
    )
  );

-- NOTE: WW Admin cross-project visibility removed from MVP
-- This policy will be restored in Phase 2 when project overview features are implemented
-- CREATE POLICY "WW Admins view all projects" ON projects
--   FOR SELECT USING (
--     EXISTS (
--       SELECT 1 FROM user_roles
--       WHERE user_id = auth.uid()
--       AND role = 'ww_admin'
--     )
--   );

-- Users can only access their own preferences
CREATE POLICY "Users manage own preferences" ON user_preferences
  FOR ALL USING (user_id = auth.uid());
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

**Note:** Storage configuration details are maintained in the Supabase repository.

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

**AI-Assisted Development with Claude Code and Claude Flow:**
The app will be built using Claude Code with specialized sub-agents coordinated through Claude Flow for parallel development.

**Sub-Agent Specialization:**
- **Auth Agent**: Authentication, user management, roles
- **Sync Agent**: Offline synchronization, conflict resolution
- **BLE Agent**: Bluetooth hardware communication
- **UI Agent**: Screen components, navigation
- **Data Agent**: Redux store, database operations

**Development Approach:**
- Task order and dependencies managed for parallel development
- No fixed time estimates - implementation will be completed in hours/days with Claude Flow
- Focus on systematic completion of features with proper integration

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

**Performance Tracking:**
- Measure app launch times using React Native Performance Monitor
- Track memory usage with Flipper integration
- Monitor BLE operation latency with custom metrics
- Use Sentry for crash reporting and performance monitoring
- Battery usage analysis through device analytics

---

## 11. Testing Strategy

### 11.1 Maestro UI Testing

**Test Framework Setup:**
Maestro will be used for comprehensive UI automation testing across both platforms. **Note: Actual Wildlife Watcher camera hardware is available for testing BLE connectivity and device interaction flows.**

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

**Development Approach:**
- Remove traditional week-based breakdowns
- Implementation will be completed in hours/days with Claude Flow
- Focus on task order and dependencies for effective parallel development
- Systematic feature completion with proper integration testing

---

## 13. Admin Portal Integration

### 13.1 Wildlife Watcher Admin Portal (MVP)

**Purpose:** Web-based companion portal for WW Admin users to perform core user management functions.

**Architecture:**
- **Hosting**: Supabase Edge Functions
- **Frontend**: React-based SPA served via Edge Functions
- **Authentication**: Shared Supabase Auth
- **Database**: Same Supabase instance as mobile app

**MVP Features:**
- User management (add, deactivate users, assign to organisations)
- WW Admin role assignment

**Deferred from MVP:**
- Web-based password reset (moved to Phase 2)
- Project overview and read-only access
- System administration tools

### 13.2 Repository Strategy

**Current Implementation:** Separate backend repository at `~/dev/wildlifeai/wildlife-watcher-backend`
- **Structure:** Admin portal components in `admin-portal/` subfolder
- **Supabase Components:** All backend infrastructure in `supabase/` subfolder  
- **Benefits:** Independent versioning, clear separation of concerns, simplified mobile app repository
- **Integration:** Mobile app connects via Supabase client with shared database and authentication

**Local Documentation:** Mobile app integration details maintained at `@project-context/development-context/supabase-backend/` for development reference

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
- [ ] Complete app icon design (1024x1024px) - Use existing assets or create placeholders
- [ ] Create splash screen assets - Use existing assets or create placeholders
- [ ] Design missing screens:
  - Organisation management UI for WW Admin
  - Member management UI (add existing users/role change)
  - Developer menu interface
  - Basic sync status indicators (detailed sync monitoring moved to Phase 2)

**Product Manager (Critical Decisions):**
- [ ] Mock LoRaWAN implementation for development (actual format pending hardware team)
- [ ] Approve organisation-based user management approach
- [ ] Validate offline conflict resolution rules
- [ ] Sign off on updated user role permission matrix including Model Manager role
- [ ] Approve Phase 2 feature deferral (user self-registration, profile management, web reset, advanced WW Admin features)

**Development Team (Setup Required):**
- [ ] Note: Supabase project already exists in separate repository
- [ ] Configure development environment variables
- [ ] Set up iOS certificates and provisioning profiles
- [ ] Install and configure Maestro testing framework
- [ ] Claude Flow environment ready for parallel development

**Hardware Team (Documentation Needed):**
- [ ] Complete BLE command protocol specification
- [ ] Finalize LoRaWAN payload structure and field definitions
- [ ] Provide firmware update procedures and compatibility matrix
- [ ] Document camera snapshot commands and capabilities

### 15.2 Technical Clarifications Required

**Pending Decisions:**
- **Image Management**: Make image size/compression configurable with sensible defaults (5MB max, 80% quality)
- **Cache Management**: Set cache limits configurable with defaults (100MB maps, 50MB images)
- Session timeout duration and biometric authentication requirements
- **Resource Limits**: Remove or clarify project/deployment limits for MVP
- **Analytics Service**: Remove or clarify analytics service requirements for MVP

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

### 15.5 Phase 2 Features

**Deferred from MVP:**
- User self-registration
- User profile management and profile photos
- Web-based password reset
- Advanced UI features (cards, search, filtering for projects/deployments)
- Quality indicators and positioning overlays for camera preview
- Smart defaults for deployment configuration
- Tab filtering for deployments screen
- Enhanced reverse geocoding and address lookup

**Advanced WW Admin Features (Deferred from MVP):**
- System diagnostics and monitoring
- Project overview (cross-project visibility for WW Admins)
- Advanced BLE diagnostics and troubleshooting tools
- Database inspector for data verification
- Raw LoRaWAN message viewer and debugging
- Device firmware management and update tools
- Sync queue manipulation and conflict resolution
- API endpoint testing and validation
- Configurable WW Admin feature permissions management

**Additional Phase 2 Features:**
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