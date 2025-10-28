# Wildlife Watcher App - Requirements Change Impact Analysis

**Version**: 1.0
**Date**: January 27, 2025
**Status**: Action Required
**Purpose**: Comprehensive analysis of specification changes and their impact on implementation

---

## Executive Summary

The stakeholder documentation refresh introduces **significant architectural simplifications** and **new user-facing features** that require careful integration with the existing codebase. This analysis identifies 47 specific changes across 11 categories, affecting 8 completed tasks and all 9 remaining tasks.

**Critical Finding**: The changes are largely **additive and simplifying** rather than breaking. Most completed work (Tasks 1-13) remains valid with targeted enhancements. The new specifications reduce complexity in some areas (organization structure, role management) while adding clarity in others (BLE communication, photo management).

**Recommended Approach**: **Incremental adaptation** via targeted mini-tasks alongside pending development, avoiding disruptive rewrites.

---

## Table of Contents

1. [Change Categories Overview](#1-change-categories-overview)
2. [Detailed Change Analysis](#2-detailed-change-analysis)
3. [Impact on Completed Tasks (1-13)](#3-impact-on-completed-tasks-1-13)
4. [Impact on Pending Tasks (14-23)](#4-impact-on-pending-tasks-14-23)
5. [Database Schema Changes Required](#5-database-schema-changes-required)
6. [Smart Execution Plan](#6-smart-execution-plan)
7. [Risk Assessment](#7-risk-assessment)
8. [Recommendations](#8-recommendations)

---

## 1. Change Categories Overview

### 1.1 Impact Classification

| Category | Changes | Impact Level | Affected Tasks | Effort Estimate |
|----------|---------|--------------|----------------|-----------------|
| **User Authentication** | 3 major | 🔴 HIGH | 10, 21 | 8-10 hrs |
| **Organization Structure** | 2 major | 🟢 LOW (Simplification) | 14 | -3 hrs (savings) |
| **User Roles** | 4 major | 🟡 MEDIUM | 13, 14 | 4-6 hrs |
| **Navigation & UI** | 6 major | 🟡 MEDIUM | All UI tasks | 6-8 hrs |
| **Deployment Workflows** | 5 major | 🟡 MEDIUM | 15-17 | 4-6 hrs |
| **Camera Workbench** | 8 major | 🔴 HIGH | 18, 20 | 10-12 hrs |
| **Photo Management** | 3 major | 🟡 MEDIUM | 15, 17 | 3-4 hrs |
| **Project Settings** | 7 major | 🟡 MEDIUM | 12 | 4-5 hrs |
| **Team Management** | 4 major | 🟡 MEDIUM | 13 | 3-4 hrs |
| **LoRaWAN Integration** | 6 major | 🔴 HIGH | 18, 20 | 8-10 hrs |
| **BLE Communication** | 9 major | 🔴 HIGH | 20 | 12-15 hrs |

**Total New Work**: 65-80 hours
**Total Rework**: 15-20 hours
**Net Impact**: 80-100 hours additional development

---

## 2. Detailed Change Analysis

### 2.1 User Authentication (HIGH IMPACT)

#### 🆕 NEW: User Self-Registration
**OLD**: Users could ONLY be provisioned by WW Admin via web portal
**NEW**: Users can self-register via mobile app Sign Up screen

**Changes Required:**
1. **Sign Up Screen** (NEW)
   - Email, password, confirm password fields
   - Email verification flow
   - Auto-return to Login after confirmation
   - Error handling (duplicate email, weak password)

2. **Forgot Password Screen** (NEW)
   - Email input field
   - "Send Reset Link" button
   - Confirmation message display
   - Email template configuration (backend)

3. **Login Screen Enhancement**
   - Add "Sign Up" link
   - Add "Forgot Password?" link
   - Persist "Remember me" functionality

**Impact on Completed Work:**
- **Task 10 (Auth System)**: Needs significant enhancement
  - Current: Basic login only
  - Required: Add 2 new screens + email verification logic

**Backend Requirements:**
- Email verification templates
- Password reset token generation
- User self-registration RLS policy updates

---

### 2.2 Organization Structure (LOW IMPACT - Simplification!)

#### 🎯 SIMPLIFIED: Single "General" Organization for MVP2
**OLD**: Full multi-tenant structure with multiple organizations from day 1
**NEW**: Single "General" organization for all MVP2 users, defer multi-org to Phase 2

**Changes Required:**
1. **Database Seeding**
   - Create single "General" organisation record
   - Default all users to this organisation
   - Remove organisation selection UI for MVP2

2. **User Interface**
   - Hide organisation switcher (Task 14 scope reduced)
   - Remove organisation field from Project creation
   - Auto-assign projects to "General" organisation

**Impact on Completed Work:**
- **Task 11 (SQLite Foundation)**: ✅ No changes needed (schema supports multi-org)
- **Task 12 (Projects CRUD)**: 🟡 Remove org selection UI (saves dev time)
- **Task 13 (Member Management)**: ✅ No changes needed (org-scoped already)

**Backend Requirements:**
- Seed migration: Create "General" organisation
- Default user assignment to "General" on registration

**Effort Saved**: ~3 hours (simplified Task 14)

---

### 2.3 User Roles (MEDIUM IMPACT)

#### 🔧 REFINED: 3 Core Mobile Roles (Down from 4)
**OLD**: 4 roles - WW Admin, Model Manager, Project Admin, Project Member
**NEW**: 3 mobile roles - Project Admin, Project Member, Organisation Member
(WW Admin & Model Manager moved to web portal only)

**Changes Required:**
1. **Role Type Definitions**
   ```typescript
   // OLD
   enum UserRole {
     WW_ADMIN = 'ww_admin',
     MODEL_MANAGER = 'model_manager',
     PROJECT_ADMIN = 'project_admin',
     PROJECT_MEMBER = 'project_member'
   }

   // NEW (Mobile App)
   enum MobileUserRole {
     ORGANISATION_MEMBER = 'organisation_member', // NEW
     PROJECT_ADMIN = 'project_admin',
     PROJECT_MEMBER = 'project_member'
   }
   ```

2. **Permission Matrix Updates**
   - Remove Model Manager capabilities from mobile app
   - Remove WW Admin user management from mobile app
   - Add Organisation Member permissions (view org projects)

3. **UI Components**
   - Remove WW Admin tools from drawer menu
   - Remove Model Manager role from member assignment
   - Add Organisation Member role option

**Impact on Completed Work:**
- **Task 13 (Member Management)**: 🟡 Simplify role assignment UI
  - Remove Model Manager option
  - Add Organisation Member option
  - Remove WW Admin user provisioning

**Backend Requirements:**
- No changes (roles already support this structure)

---

### 2.4 Navigation & UI (MEDIUM IMPACT)

#### 🆕 NEW: 5 Additional Screens
**OLD**: Basic navigation with main tabs
**NEW**: Enhanced navigation with drawer menu + 5 new screens

**New Screens Required:**

1. **Profile Screen** (NEW)
   - View/edit first name, last name
   - Read-only email display
   - Organisation membership display
   - "Reset Password" button
   - **Backend integration**: User preferences table

2. **Settings Screen** (NEW)
   - Sync preferences:
     - "Sync on Wi-Fi only" toggle
     - "Ask before syncing" toggle
     - "Automatic sync" (default)
   - **Backend integration**: User preferences storage

3. **Feedback Screen** (NEW)
   - Multi-line text input
   - "Send" button
   - Email integration to support team
   - Success/error handling

4. **Notifications Screen** (NEW - Critical for invitation flow)
   - List of pending project invitations
   - Accept/Decline buttons per invitation
   - Empty state message
   - **Backend integration**: Invitation system

5. **Sign Up Screen** (NEW - covered in Auth section)

**Side Drawer Menu Enhancement:**
- Add Profile link
- Add Settings link
- Add Invitations link (with badge count)
- Add Feedback link
- Add sync status indicator
- Add app version number

**Impact on Completed Work:**
- **Task 9 (Redux Store)**: 🟡 Add new slices
  - `notificationsSlice` for invitations
  - `settingsSlice` for user preferences
  - `feedbackSlice` for submission tracking

---

### 2.5 Deployment Workflows (MEDIUM IMPACT)

#### 🔧 REFINED: 4-5 Step "Reality-First" Wizard
**OLD**: 6-step linear wizard (Project → Device → Config → Preview → Location → Details)
**NEW**: 4-5 step reality-first wizard (Device → Connectivity → Camera View → Location → Details)

**Philosophy Change:**
- **OLD**: Metadata-first (select project before touching hardware)
- **NEW**: Reality-first (pair device and validate field conditions first)

**Step Changes:**

| Step | OLD Spec | NEW Spec | Change Type |
|------|----------|----------|-------------|
| 1 | Project Selection | Device Selection | 🔄 Reordered (now first) |
| 2 | Device Selection | Connectivity Setup (LoRaWAN) | 🆕 NEW (conditional on registration) |
| 3 | Deployment Config | Camera View & Adjustment | 🔄 Reordered (moved earlier) |
| 4 | Camera Preview | Location | 🔄 Reordered |
| 5 | Final Setup | Deployment Details | 🔄 Simplified (project pre-assigned in workbench) |
| 6 | ❌ Removed | - | 🗑️ Eliminated redundancy |

**Key Workflow Changes:**

1. **Device Selection First** (Step 1)
   - Check if device already associated with project
   - If not prepared → redirect to Camera Workbench
   - If prepared → continue deployment
   - **NEW**: "I can't find my device" help link

2. **Conditional LoRaWAN Step** (Step 2)
   - Only shown if device registered for LoRaWAN
   - Live signal strength testing
   - "Test Signal" button with real-time feedback
   - **NEW**: Critical for field deployment success

3. **Camera View Earlier** (Step 3)
   - Moved from step 4 to step 3
   - Emphasizes physical validation before location
   - Test photos auto-delete to conserve space

4. **Deployment Details Simplified** (Step 5)
   - Project already assigned (from Camera Workbench)
   - AI Model read-only (project default)
   - Capture method inherited from project settings

**Impact on Pending Work:**
- **Task 15 (Start Deployment)**: 🔴 Significant redesign required
  - Reorder step sequence
  - Add LoRaWAN connectivity step
  - Integrate with Camera Workbench prep status
  - Add device discovery help

---

### 2.6 Camera Workbench (HIGH IMPACT)

#### 🆕 NEW: Formal "Prepare and Test" Workflow
**OLD**: Ad-hoc device preparation mentioned briefly
**NEW**: Comprehensive 2-step Camera Workbench workflow with detailed specifications

**New Workflow Structure:**

**Step 1: Device Selection**
- Scan for available (non-deployed) cameras
- BLE discovery with signal strength
- Connect and validate deployment status
- Error: "To prepare this device, stop its active deployment"

**Step 2: Camera Workbench Screen**

Full device management interface:

1. **Basic Info**
   - Editable Device Name
   - Read-only Device ID
   - Project Association (tap to change)

2. **Status Indicators**
   - Battery Level (real-time via BLE)
   - SD Card Space (real-time via BLE)
   - Firmware Version
   - AI Model Version
   - LoRaWAN Status (Registered/Not Registered)
   - Network Name (if registered)

3. **Action Buttons**
   - **Check Camera View**: Take test photo
   - **Update Firmware**: DFU workflow (if available)
   - **Update AI Model**: Transfer project's AI model
   - **Register for Remote Updates**: LoRaWAN setup
   - **Deregister Device**: Remove from LoRaWAN
   - **Finish Preparation**: Save and exit

**Device Status Lifecycle** (NEW):
```
Available → In Preparation (Camera Workbench) → Available → Deployed → Ended → Available
```

**Impact on Pending Work:**
- **Task 18 (Device Management)**: 🔴 Major enhancement
  - Build Camera Workbench UI (Step 2)
  - Implement device discovery flow (Step 1)
  - Add real-time BLE status polling
  - Integrate firmware update (DFU) workflow
  - Add LoRaWAN registration flow

---

### 2.7 Photo Management (MEDIUM IMPACT)

#### 🆕 NEW: Three Distinct Photo Types with Different Lifecycles
**OLD**: Generic "deployment photos"
**NEW**: Explicit policies for 3 photo types

**Photo Type Definitions:**

1. **Test Photos** (Temporary)
   - **Source**: Camera Workbench "Check Camera View" button
   - **Storage**: Temporary file on camera SD card (`temp_pic.jpg`)
   - **Lifecycle**: Created → Displayed in app → Auto-deleted after view
   - **Purpose**: Lens validation, focus check
   - **Transfer**: BLE WWUS file transfer protocol

2. **Deployment Setup Photos** (Persistent)
   - **Source**: User's phone camera (Step 4: Location)
   - **Purpose**: Document camera hiding spot for retrieval
   - **Storage**: Supabase Storage (permanent)
   - **Lifecycle**: Created → Uploaded → Linked to deployment → Permanent
   - **Display**: Deployment Details screen (Location section)

3. **Detection Event Photos** (Future - Phase 2)
   - **Source**: Camera AI processor
   - **Purpose**: Wildlife detection images
   - **Status**: Not implemented in MVP2

**Changes Required:**

1. **Camera Workbench**
   ```typescript
   // Test Photo Workflow
   async function takeTestPhoto() {
     await bleService.sendCommand("AI snap\n");
     const filename = await bleService.waitForResponse(); // "temp_pic.jpg"
     const imageData = await bleService.transferFile(filename);
     displayImage(imageData);
     await bleService.sendCommand(`AI rm ${filename}\n`); // Auto-cleanup
   }
   ```

2. **Deployment Location Step**
   ```typescript
   // Setup Photo Workflow
   async function captureSetupPhoto() {
     const image = await ImagePicker.launchCameraAsync();
     const compressed = await compressImage(image);
     const url = await supabase.storage.uploadDeploymentPhoto(compressed);
     deployment.setupPhotos.push(url);
   }
   ```

**Impact on Pending Work:**
- **Task 15 (Start Deployment)**: 🟡 Add setup photo capture
- **Task 17 (Field Validation)**: 🟡 Test photo lifecycle
- **Task 20 (BLE Sync)**: 🔴 Implement file transfer protocol

---

### 2.8 Project Settings (MEDIUM IMPACT)

#### 🆕 NEW: 7 Additional Project Configuration Fields
**OLD**: Basic project (name, description, sampling design)
**NEW**: Comprehensive project configuration with capture settings

**New Project Fields:**

1. **`is_baited: boolean`** (NEW)
   - Toggle switch in Project Details
   - Indicates if bait is used in study
   - References: Wearn & Glover-Kapfer (2017)

2. **`monitoring_marked: boolean`** (NEW)
   - Track if individual animals are marked
   - Important for population studies

3. **`capture_method: 'motion' | 'timelapse'`** (NEW)
   - **Motion Detection**: Triggered by movement
   - **Time-lapse**: Fixed interval captures
   - Project-wide default (inherited by deployments)

4. **`motion_sensitivity: 'low' | 'medium' | 'high'`** (NEW)
   - Only visible if capture_method = 'motion'
   - Affects PIR sensor threshold

5. **`timelapse_interval: number`** (NEW)
   - Only visible if capture_method = 'timelapse'
   - Options: 30s, 1min, 5min, 10min, 30min, 1hr
   - Stored in seconds

6. **`default_ai_model_id: uuid`** (NEW - Project Admin only)
   - Dropdown of organisation's available AI models
   - All deployments inherit this model
   - Updated during Camera Workbench preparation

7. **`sampling_design: string[]`** (ENHANCED)
   - Now supports multiple selections
   - Options: simpleRandom, systematicRandom, clusteredRandom, experimental, targeted, opportunistic
   - Must select at least one

**Database Schema Impact:**
```sql
-- Backend migration required
ALTER TABLE projects ADD COLUMN is_baited BOOLEAN DEFAULT false;
ALTER TABLE projects ADD COLUMN monitoring_marked BOOLEAN DEFAULT false;
ALTER TABLE projects ADD COLUMN capture_method TEXT CHECK (capture_method IN ('motion', 'timelapse'));
ALTER TABLE projects ADD COLUMN motion_sensitivity TEXT CHECK (motion_sensitivity IN ('low', 'medium', 'high'));
ALTER TABLE projects ADD COLUMN timelapse_interval INTEGER; -- seconds
ALTER TABLE projects ADD COLUMN default_ai_model_id UUID REFERENCES ai_models(id);
ALTER TABLE projects ALTER COLUMN sampling_design TYPE TEXT[]; -- array support
```

**Impact on Completed Work:**
- **Task 12 (Projects CRUD)**: 🔴 Major enhancement required
  - Update Project Details screen UI
  - Add 7 new form fields with conditional visibility
  - Update TypeScript types
  - Regenerate types from backend
  - Add validation logic

---

### 2.9 Team Management (MEDIUM IMPACT)

#### 🔧 REFINED: Hybrid Invitation System
**OLD**: Email invitations only (assumed)
**NEW**: Dual-mode system - Email for new users, In-app for existing users

**New Invitation Flow:**

**For New Users (Not in System):**
1. Project Admin enters email in "Manage Members"
2. System checks if user exists
3. If not found → Send email invitation
4. Email contains registration link + project details
5. User registers → Auto-added to project

**For Existing Users (Already in Organisation):**
1. Project Admin searches by email/name in "Manage Members"
2. Select user → Choose role → Send invitation
3. Invitation appears in user's **Notifications Screen**
4. User receives in-app notification badge
5. User accepts/declines from Notifications Screen

**Changes Required:**

1. **Notifications Screen** (NEW - Critical)
   - List pending project invitations
   - Show: Project name, inviter name, proposed role
   - Accept button → Add to project + navigate to Project Details
   - Decline button → Confirmation dialog + remove invitation
   - Badge counter on drawer menu

2. **Manage Members Screen** (Enhanced)
   - User search (by email or name)
   - Invitation status indicator (Pending/Accepted)
   - Resend invitation option
   - Role change after acceptance

3. **Backend Integration**
   - `user_invitations` table
   - Push notification triggers (optional for MVP2)
   - Email templates

**Impact on Completed Work:**
- **Task 13 (Member Management)**: 🟡 Add invitation system
  - Already has "Manage Members" screen
  - Need to add Notifications Screen
  - Need to add invitation status tracking

---

### 2.10 LoRaWAN Integration (HIGH IMPACT)

#### 🆕 NEW: Comprehensive LoRaWAN Specification
**OLD**: Brief mention of LoRaWAN status updates
**NEW**: Detailed provisioning, registration, and testing workflows

**New LoRaWAN Components:**

1. **Device Provisioning** (One-Time Setup)
   - Backend registers device with LNS (The Things Network / Chirpstack)
   - Generates security keys (DevEUI, AppKey)
   - Stores keys in secure database
   - Transmits keys to camera via BLE

2. **Registration Workflow** (Camera Workbench)
   - "Register for Remote Updates" button
   - Progress indicator: "Contacting server..." → "Sending keys..." → "Complete!"
   - BLE command: `"AI set_lora_keys <DevEUI> <AppKey> ...\n"`
   - Update device record: `lorawan_status = 'registered'`

3. **Signal Testing** (Deployment Step 2)
   - "Test Signal" button sends ping via LoRaWAN
   - Display RSSI and SNR values
   - Visual indicator (signal bars)
   - Helps user find optimal physical location

4. **Status Updates** (Passive - Backend Webhook)
   - Camera sends periodic pings (every 15min / 1hr)
   - LoRaWAN gateway → Backend → Edge Function → Database
   - App syncs battery level, SD card usage, last_seen timestamp

5. **De-registration** (Camera Workbench)
   - "Deregister Device" button
   - Confirmation dialog
   - Removes device from LoRaWAN network
   - Allows re-registration to different network

**BLE Commands (NEW):**
```typescript
// Registration
await bleService.sendCommand("AI set_lora_keys <DevEUI> <AppKey> <JoinEUI>\n");

// Signal Testing
await bleService.sendCommand("ping\n");
const response = await bleService.waitForResponse(); // "RSSI: -75 dB, SNR: 8 dB"

// Check Status
await bleService.sendCommand("lora status\n");
const status = await bleService.waitForResponse(); // "Registered to TTN-US"
```

**Impact on Pending Work:**
- **Task 18 (Device Management)**: 🔴 Add LoRaWAN UI
  - Registration flow in Camera Workbench
  - Status display
  - De-registration capability

- **Task 20 (BLE Sync)**: 🔴 Implement LoRaWAN commands
  - Key provisioning protocol
  - Ping/status commands
  - Response parsing

---

### 2.11 BLE Communication (HIGH IMPACT)

#### 🆕 NEW: Comprehensive BLE Protocol Specification
**OLD**: High-level BLE mention
**NEW**: Complete technical specification in `ble-lorawan-communication-spec.md`

**Critical New Information:**

1. **Two-Processor Architecture**
   ```
   Mobile App ← BLE → BLE Processor (nRF52832) ← I2C → AI Processor (Camera + ML)
   ```
   - **BLE Processor**: Communication hub, LoRaWAN radio
   - **AI Processor**: Camera control, ML inference, SD card
   - Mobile app NEVER talks directly to AI Processor

2. **Two BLE Services**
   - **WWUS (Wildlife Watcher UART Service)**: Normal operations
     - UUID: `6e400001-b5a3-f393-e0a9-e50e24dcca9d`
     - Write: `6e400002...` (Send commands)
     - Read: `6e400003...` (Receive responses)

   - **DFU (Device Firmware Update)**: BLE processor updates only
     - UUID: `00001530-1212-efde-1523-785feabcd123`
     - Used ONLY for nRF52832 firmware updates

3. **Command Structure**
   - **Direct commands**: Handled by BLE processor
     - `"battery\n"` → Battery level
     - `"lora status\n"` → LoRaWAN connection
     - `"setutc 2025-10-18T10:00:00Z\n"` → Set time

   - **Proxied commands**: Forwarded to AI processor (prefix: `"AI "`)
     - `"AI snap\n"` → Take photo
     - `"AI read temp_pic.jpg\n"` → Transfer file (244-byte chunks)
     - `"AI rm temp_pic.jpg\n"` → Delete file
     - `"AI setgps <coords>\n"` → Set GPS location

4. **File Transfer Protocol** (NEW - Critical)
   ```typescript
   // Take and display test photo
   async function getTestPhoto() {
     // 1. Command camera to take photo
     await ble.write("AI snap\n");
     const response = await ble.read(); // "File created: temp_pic.jpg"

     // 2. Request file transfer
     await ble.write("AI read temp_pic.jpg\n");

     // 3. Receive file in 244-byte chunks
     const chunks: Uint8Array[] = [];
     while (!transferComplete) {
       const chunk = await ble.read(); // Max 244 bytes per chunk
       chunks.push(chunk);
     }

     // 4. Reassemble JPEG
     const imageData = concatenateChunks(chunks);

     // 5. Cleanup
     await ble.write("AI rm temp_pic.jpg\n");

     return imageData;
   }
   ```

5. **DFU Mode Transition**
   ```typescript
   // Enter DFU mode for firmware update
   await ble.write("dfu\n"); // Device disconnects immediately
   await ble.disconnect();

   // Scan for DFU service
   const dfuDevice = await ble.scan({ services: ['00001530...'] });
   await ble.connect(dfuDevice);

   // Use Nordic DFU library
   await NordicDFU.startUpdate(firmwareFile);
   ```

6. **Mandatory Actions on BLE Connection**
   - Send UTC time: `"setutc <ISO8601>\n"`
   - Send GPS location: `"AI setgps <coords>\n"`
   - Request battery status: `"battery\n"`
   - Request LoRaWAN status: `"lora status\n"`

**Impact on Pending Work:**
- **Task 20 (BLE Sync)**: 🔴 Complete rewrite required
  - Implement WWUS service discovery
  - Implement command/response protocol
  - Implement file transfer protocol (chunked reads)
  - Implement DFU mode workflow
  - Add UTC time sync
  - Add GPS location sync
  - Add mandatory status checks

---

## 3. Impact on Completed Tasks (1-13)

### Summary Table

| Task | Title | Status | Impact Level | Changes Required | Effort |
|------|-------|--------|--------------|------------------|--------|
| 1-8 | Foundation & Setup | ✅ Complete | 🟢 NONE | None | 0 hrs |
| 9 | Redux Store Setup | ✅ Complete | 🟡 MINOR | Add 3 new slices | 2-3 hrs |
| 10 | Auth System | ✅ Complete | 🔴 MAJOR | Add 2 screens + flows | 8-10 hrs |
| 11 | Offline SQLite | ✅ Complete | 🟡 MINOR | Add 2 tables | 2-3 hrs |
| 12 | Projects CRUD | ✅ Complete | 🟡 MEDIUM | Add 7 fields + UI | 4-5 hrs |
| 13 | Member Management | ✅ Complete | 🟡 MEDIUM | Add Notifications screen | 3-4 hrs |

**Total Rework**: 19-25 hours

---

### 3.1 Tasks 1-8: Foundation (NO IMPACT ✅)

**Tasks Included:**
- Expo SDK 51 migration
- React Navigation setup
- TypeScript configuration
- Build tooling
- Development environment

**Assessment**: Zero impact. These foundational tasks are platform-agnostic and remain valid.

---

### 3.2 Task 9: Redux Store Setup (MINOR IMPACT 🟡)

**Current State**: Core Redux store with auth, projects, deployments, devices, offline slices

**Changes Required:**

1. **Add `notificationsSlice`**
   ```typescript
   // New slice for project invitations
   interface NotificationsState {
     invitations: ProjectInvitation[];
     unreadCount: number;
     isLoading: boolean;
   }
   ```

2. **Add `settingsSlice`**
   ```typescript
   // New slice for user preferences
   interface SettingsState {
     syncOnWifiOnly: boolean;
     askBeforeSyncing: boolean;
     autoSync: boolean; // default
   }
   ```

3. **Add `feedbackSlice`**
   ```typescript
   // New slice for feedback submission
   interface FeedbackState {
     isSubmitting: boolean;
     lastSubmission: string | null;
     error: string | null;
   }
   ```

**Effort**: 2-3 hours
- Slice creation: 1 hr
- Integration with offline sync: 1 hr
- Testing: 0.5-1 hr

---

### 3.3 Task 10: Auth System (MAJOR IMPACT 🔴)

**Current State**: Login screen with basic authentication

**Changes Required:**

1. **Sign Up Screen** (NEW)
   - **File**: `src/navigation/screens/auth/SignUpScreen.tsx`
   - **Components**:
     - Email input with validation
     - Password input with strength indicator
     - Confirm password input
     - Sign Up button
     - "Back to Login" link
   - **Logic**:
     - Supabase signup: `supabase.auth.signUp()`
     - Email verification trigger
     - Confirmation message modal
     - Auto-navigate to Login after dismiss
   - **Effort**: 3-4 hours

2. **Forgot Password Screen** (NEW)
   - **File**: `src/navigation/screens/auth/ForgotPasswordScreen.tsx`
   - **Components**:
     - Email input
     - "Send Reset Link" button
     - Message display area
     - "Back to Login" link
   - **Logic**:
     - Supabase reset: `supabase.auth.resetPasswordForEmail()`
     - Email template configuration
     - Confirmation display
   - **Effort**: 2-3 hours

3. **Login Screen Enhancement**
   - Add Sign Up link
   - Add Forgot Password link
   - Implement "Remember me" persistence
   - **Effort**: 1 hour

4. **Backend Coordination**
   - Email templates (signup, reset password)
   - RLS policy updates for self-registration
   - Rate limiting on auth endpoints
   - **Effort**: 2-3 hours (backend team)

**Total Effort**: 8-10 hours (mobile) + 2-3 hours (backend)

---

### 3.4 Task 11: Offline SQLite (MINOR IMPACT 🟡)

**Current State**: SQLite schema with projects, deployments, devices, offline_queue

**Changes Required:**

1. **Add `user_preferences` Table**
   ```sql
   CREATE TABLE IF NOT EXISTS user_preferences (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL UNIQUE,
     sync_on_wifi_only INTEGER DEFAULT 0,
     ask_before_syncing INTEGER DEFAULT 0,
     auto_sync INTEGER DEFAULT 1,
     created_at TEXT DEFAULT CURRENT_TIMESTAMP,
     updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
     synced INTEGER DEFAULT 0
   );
   ```

2. **Add `project_invitations` Table**
   ```sql
   CREATE TABLE IF NOT EXISTS project_invitations (
     id TEXT PRIMARY KEY,
     project_id TEXT NOT NULL,
     inviter_id TEXT NOT NULL,
     invitee_email TEXT NOT NULL,
     role TEXT NOT NULL,
     status TEXT DEFAULT 'pending', -- pending, accepted, declined
     created_at TEXT DEFAULT CURRENT_TIMESTAMP,
     responded_at TEXT,
     synced INTEGER DEFAULT 0
   );
   ```

3. **Update DatabaseService**
   - Add CRUD methods for new tables
   - Add sync handlers
   - **Effort**: 2-3 hours

---

### 3.5 Task 12: Projects CRUD (MEDIUM IMPACT 🟡)

**Current State**: Project Details screen with name, description, sampling design

**Changes Required:**

1. **Update TypeScript Types**
   ```typescript
   interface Project {
     // ... existing fields
     is_baited: boolean;
     monitoring_marked: boolean;
     capture_method: 'motion' | 'timelapse';
     motion_sensitivity?: 'low' | 'medium' | 'high';
     timelapse_interval?: number; // seconds
     default_ai_model_id?: string;
     sampling_design: string[]; // changed from string to array
   }
   ```

2. **Update Project Details Screen UI**
   - Add "Is Baited?" toggle
   - Add "Monitoring Marked?" toggle
   - Add Capture Method radio buttons (Motion / Time-lapse)
   - Add conditional Motion Sensitivity slider (if Motion)
   - Add conditional Time-lapse Interval picker (if Time-lapse)
   - Add Default AI Model dropdown (Project Admin only)
   - Change Sampling Design to multi-select
   - Add info icon for sampling design definitions

3. **Update ProjectService**
   - Update CRUD operations for new fields
   - Add validation logic
   - Update offline sync

4. **Backend Coordination**
   - Schema migration (7 new columns)
   - Type regeneration
   - **Effort**: 2 hours (backend)

**Total Effort**: 4-5 hours (mobile) + 2 hours (backend)

---

### 3.6 Task 13: Member Management (MEDIUM IMPACT 🟡)

**Current State**: Project Members screen with add/remove/role change

**Changes Required:**

1. **Add Notifications Screen** (NEW)
   - **File**: `src/navigation/screens/NotificationsScreen.tsx`
   - **Components**:
     - Invitation list
     - Accept button
     - Decline button
     - Empty state
   - **Logic**:
     - Fetch pending invitations
     - Accept → Add to project + navigate
     - Decline → Confirmation + remove
   - **Effort**: 3-4 hours

2. **Update Drawer Menu**
   - Add "Invitations" link
   - Add badge with unread count
   - **Effort**: 0.5 hours

3. **Update Manage Members Screen**
   - Add user search (email or name)
   - Show invitation status
   - Add resend invitation option
   - **Effort**: 1 hour

4. **Backend Integration**
   - `user_invitations` table (already planned)
   - Email templates
   - **Effort**: 2 hours (backend)

**Total Effort**: 4.5-5.5 hours (mobile) + 2 hours (backend)

---

## 4. Impact on Pending Tasks (14-23)

### Summary Table

| Task | Title | Old Estimate | Impact Level | Changes Required | New Estimate | Delta |
|------|-------|--------------|--------------|------------------|--------------|-------|
| 14 | Org Switching | 6 hrs | 🟢 SIMPLIFIED | Reduced scope (single org) | 3 hrs | -3 hrs |
| 15 | Start Deployment | 10 hrs | 🔴 MAJOR | 4-5 step wizard redesign | 14 hrs | +4 hrs |
| 16 | Device Config | 8 hrs | 🟡 MEDIUM | Add project setting inheritance | 10 hrs | +2 hrs |
| 17 | Field Validation | 6 hrs | 🟡 MINOR | Test photo lifecycle | 7 hrs | +1 hr |
| 18 | Device Management | 10 hrs | 🔴 MAJOR | Camera Workbench + LoRaWAN | 18 hrs | +8 hrs |
| 19 | Maps Visualization | 6.5 hrs | 🟢 NONE | Already 95% complete | 6.5 hrs | 0 hrs |
| 20 | BLE Sync | 8 hrs | 🔴 MAJOR | Complete protocol rewrite | 16 hrs | +8 hrs |
| 21 | E2E Testing | 8 hrs | 🟡 MEDIUM | More screens to test | 10 hrs | +2 hrs |
| 22 | Performance Opt | 4 hrs | 🟢 NONE | No changes | 4 hrs | 0 hrs |
| 23 | Production Prep | 4 hrs | 🟢 NONE | No changes | 4 hrs | 0 hrs |

**Total Pending Work**: 92.5 hours (was 70.5 hrs) → **+22 hours net increase**

---

### 4.1 Task 14: Organisation Switching (SIMPLIFIED 🟢)

**Original Scope**: Build organisation switcher UI for users in multiple organisations

**New Scope**: Simplified for MVP2 single "General" organisation

**Changes:**
1. Remove organisation switcher UI
2. Auto-assign all users to "General" organisation
3. Auto-assign all projects to "General" organisation
4. Keep underlying multi-org architecture (for future)

**Effort Saved**: 3 hours (from 6 hrs → 3 hrs)

**Remaining Work**:
- Ensure "General" org seeded in database
- Update project creation to auto-assign org
- Update user registration to auto-assign org

---

### 4.2 Task 15: Start Deployment (MAJOR REDESIGN 🔴)

**Original Scope**: 6-step linear wizard
**New Scope**: 4-5 step reality-first wizard with Camera Workbench integration

**Changes Required:**

1. **Step Reordering**
   - Move Device Selection to Step 1
   - Add conditional LoRaWAN step (Step 2)
   - Move Camera View to Step 3
   - Simplify Deployment Details (Step 5)

2. **Camera Workbench Integration**
   - Check device preparation status
   - Redirect to workbench if unprepared
   - Return to wizard after prep completion

3. **New UI Components**
   - "I can't find my device" help popup
   - LoRaWAN signal testing (conditional)
   - Progress bar with dynamic step count (4 or 5)

4. **Logic Changes**
   - Project already assigned (from workbench)
   - Capture method inherited from project
   - AI model read-only (project default)

**New Estimate**: 14 hours (+4 hours)
- Step reordering: 2 hrs
- Workbench integration: 3 hrs
- LoRaWAN step: 4 hrs
- UI polish: 2 hrs
- Testing: 3 hrs

---

### 4.3 Task 16: Device Configuration (MEDIUM IMPACT 🟡)

**Original Scope**: Configure device settings during deployment
**New Scope**: Inherit project settings + device-specific overrides

**Changes Required:**

1. **Project Setting Inheritance**
   - Capture method (motion/timelapse) from project
   - Motion sensitivity from project
   - Timelapse interval from project
   - AI model from project

2. **BLE Configuration Commands**
   - Send capture settings to camera
   - Send AI model reference
   - Validate settings applied

**New Estimate**: 10 hours (+2 hours)

---

### 4.4 Task 17: Field Validation (MINOR IMPACT 🟡)

**Original Scope**: Validate deployment workflow
**New Scope**: Add test photo lifecycle validation

**Changes Required:**
- Test photo creation
- Test photo display
- Test photo auto-deletion
- Setup photo capture (phone camera)
- Setup photo upload to Supabase

**New Estimate**: 7 hours (+1 hour)

---

### 4.5 Task 18: Device Management (MAJOR IMPACT 🔴)

**Original Scope**: Basic device list and status
**New Scope**: Comprehensive Camera Workbench + LoRaWAN registration

**Changes Required:**

1. **Camera Workbench UI** (NEW - 8 hours)
   - Device info display (name, ID, battery, SD card)
   - Project association selector
   - Firmware update button + workflow
   - AI model update button + workflow
   - LoRaWAN registration button + workflow
   - De-registration button + confirmation
   - "Check Camera View" button
   - "Finish Preparation" button

2. **Device Discovery Flow** (NEW - 3 hours)
   - BLE scanning for available devices
   - Signal strength indicators
   - Connection status handling
   - Deployment status validation

3. **LoRaWAN Integration** (NEW - 4 hours)
   - Registration API calls
   - Key provisioning via BLE
   - Status display
   - De-registration workflow

4. **Device Status Management** (NEW - 3 hours)
   - Available / In Preparation / Deployed states
   - State transitions
   - UI updates based on state

**New Estimate**: 18 hours (+8 hours)

---

### 4.6 Task 19: Maps Visualization (NO IMPACT 🟢)

**Current State**: 95% complete (4 hours pre-work done)
**Remaining Work**: Google Cloud Platform API key configuration

**No Changes Required**: New specs don't affect maps functionality

**Estimate**: 6.5 hours (unchanged)

---

### 4.7 Task 20: BLE Sync (MAJOR REWRITE 🔴)

**Original Scope**: Basic BLE device sync
**New Scope**: Complete WWUS protocol + file transfer + DFU mode

**Changes Required:**

1. **WWUS Service Implementation** (5 hours)
   - Service discovery (UUID: `6e400001...`)
   - Write characteristic (`6e400002...`)
   - Read characteristic with notifications (`6e400003...`)
   - Command/response handling

2. **File Transfer Protocol** (4 hours)
   - Chunked file reads (244 bytes per chunk)
   - Chunk reassembly
   - JPEG validation
   - Progress indicators

3. **Command Library** (3 hours)
   - Direct commands: `battery`, `lora status`, `setutc`, `dfu`
   - Proxied commands: `AI snap`, `AI read`, `AI rm`, `AI setgps`
   - Response parsing

4. **DFU Mode Workflow** (2 hours)
   - DFU service discovery (UUID: `00001530...`)
   - Nordic DFU library integration
   - Firmware file handling
   - Progress tracking

5. **Mandatory Connection Actions** (2 hours)
   - UTC time sync on every connection
   - GPS location sync on every connection
   - Battery status check
   - LoRaWAN status check

**New Estimate**: 16 hours (+8 hours)

---

### 4.8 Task 21: E2E Testing (MEDIUM IMPACT 🟡)

**Original Scope**: Test main workflows
**New Scope**: Test additional screens + new workflows

**Additional Test Coverage:**
- Sign Up flow
- Forgot Password flow
- Profile screen
- Settings screen
- Feedback screen
- Notifications screen
- Camera Workbench
- LoRaWAN registration

**New Estimate**: 10 hours (+2 hours)

---

### 4.9 Tasks 22-23: Performance & Production (NO IMPACT 🟢)

**No Changes Required**: These tasks are implementation-agnostic

**Estimates Unchanged**:
- Task 22 (Performance): 4 hours
- Task 23 (Production Prep): 4 hours

---

## 5. Database Schema Changes Required

### 5.1 Backend Migrations (Critical Path)

**Migration 1: User Preferences**
```sql
-- Enable user settings storage
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  sync_on_wifi_only BOOLEAN DEFAULT false,
  ask_before_syncing BOOLEAN DEFAULT false,
  auto_sync BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own preferences" ON user_preferences
  FOR ALL USING (user_id = auth.uid());
```

**Migration 2: Project Invitations**
```sql
-- Track project invitations
CREATE TABLE project_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  inviter_id UUID REFERENCES auth.users(id),
  invitee_email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('project_admin', 'project_member')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);

-- RLS policies
ALTER TABLE project_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view their invitations" ON project_invitations
  FOR SELECT USING (invitee_email = auth.email());
```

**Migration 3: Enhanced Project Settings**
```sql
-- Add new project configuration fields
ALTER TABLE projects ADD COLUMN is_baited BOOLEAN DEFAULT false;
ALTER TABLE projects ADD COLUMN monitoring_marked BOOLEAN DEFAULT false;
ALTER TABLE projects ADD COLUMN capture_method TEXT
  CHECK (capture_method IN ('motion', 'timelapse'));
ALTER TABLE projects ADD COLUMN motion_sensitivity TEXT
  CHECK (motion_sensitivity IN ('low', 'medium', 'high'));
ALTER TABLE projects ADD COLUMN timelapse_interval INTEGER; -- seconds
ALTER TABLE projects ADD COLUMN default_ai_model_id UUID
  REFERENCES ai_models(id) ON DELETE SET NULL;

-- Convert sampling_design to array
ALTER TABLE projects ALTER COLUMN sampling_design TYPE TEXT[]
  USING ARRAY[sampling_design];
```

**Migration 4: General Organisation Seed**
```sql
-- Create default "General" organisation for MVP2
INSERT INTO organisations (id, name, description)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'General', 'Default organisation for MVP2 users')
ON CONFLICT DO NOTHING;

-- Assign existing users to General organisation
INSERT INTO user_organisations (user_id, organisation_id)
SELECT id, '00000000-0000-0000-0000-000000000001'
FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM user_organisations WHERE user_id = auth.users.id
);

-- Assign existing projects to General organisation
UPDATE projects
SET organisation_id = '00000000-0000-0000-0000-000000000001'
WHERE organisation_id IS NULL;
```

### 5.2 Mobile SQLite Schema Updates

**Priority 1: Immediate (for rework tasks)**
```sql
-- User preferences (Task 9, Settings screen)
CREATE TABLE IF NOT EXISTS user_preferences (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  sync_on_wifi_only INTEGER DEFAULT 0,
  ask_before_syncing INTEGER DEFAULT 0,
  auto_sync INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  synced INTEGER DEFAULT 0
);

-- Project invitations (Task 13, Notifications screen)
CREATE TABLE IF NOT EXISTS project_invitations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  inviter_id TEXT NOT NULL,
  invitee_email TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  responded_at TEXT,
  synced INTEGER DEFAULT 0
);
```

**Priority 2: For Task 12 (Project CRUD)**
```sql
-- Update projects table
ALTER TABLE projects ADD COLUMN is_baited INTEGER DEFAULT 0;
ALTER TABLE projects ADD COLUMN monitoring_marked INTEGER DEFAULT 0;
ALTER TABLE projects ADD COLUMN capture_method TEXT;
ALTER TABLE projects ADD COLUMN motion_sensitivity TEXT;
ALTER TABLE projects ADD COLUMN timelapse_interval INTEGER;
ALTER TABLE projects ADD COLUMN default_ai_model_id TEXT;
-- Note: sampling_design remains TEXT (JSON string) in SQLite
```

---

## 6. Smart Execution Plan

### 6.1 Philosophy: Incremental Adaptation

**Core Principle**: Minimize disruption by integrating changes as mini-tasks alongside new development.

**Approach**:
1. **High-priority rework first** (Auth, Project settings, Member management)
2. **Parallel development** (New tasks proceed with updated specs)
3. **Incremental testing** (Each mini-task verified before proceeding)
4. **Backend synchronization** (Coordinate schema migrations)

---

### 6.2 Phase 1: Critical Foundation (Week 1)

**Goal**: Fix blocking issues for new development

**Tasks**:

**1.1 Backend Schema Migrations** (2-3 hours - Backend team)
- Migration 4: Seed "General" organisation
- Migration 3: Enhanced project settings
- Migration 2: Project invitations table
- Migration 1: User preferences table
- Type regeneration: `npm run types:local`

**1.2 Mobile Type Sync** (0.5 hours)
- Pull backend changes
- Run `npm run types:local`
- Verify TypeScript compilation

**1.3 SQLite Schema Updates** (2-3 hours)
- Add user_preferences table
- Add project_invitations table
- Add new project columns
- Update DatabaseService CRUD methods
- Test migrations on fresh install

**1.4 Redux Store Enhancement** (2-3 hours - Task 9 rework)
- Create notificationsSlice
- Create settingsSlice
- Create feedbackSlice
- Register slices in store
- Add offline sync support

**Phase 1 Total**: 6.5-9.5 hours
**Deliverable**: Foundation ready for new features

---

### 6.3 Phase 2: UI Enhancements (Week 2)

**Goal**: Add new screens and update existing UI

**Tasks**:

**2.1 Authentication Screens** (8-10 hours - Task 10 rework)
- **Sign Up Screen**: 3-4 hours
  - UI implementation
  - Supabase signup integration
  - Email verification flow
- **Forgot Password Screen**: 2-3 hours
  - UI implementation
  - Password reset email trigger
- **Login Enhancement**: 1 hour
  - Add links to new screens
  - "Remember me" persistence
- **Testing**: 2 hours
  - Flow validation
  - Error handling

**2.2 Profile & Settings Screens** (4-5 hours - NEW)
- **Profile Screen**: 2-3 hours
  - View/edit name fields
  - Read-only email
  - Organisation display
  - Reset password button
- **Settings Screen**: 2 hours
  - Sync preferences UI
  - Save to user_preferences

**2.3 Notifications Screen** (3-4 hours - Task 13 rework)
- Invitation list UI
- Accept/Decline logic
- Backend integration
- Badge counter in drawer

**2.4 Feedback Screen** (2 hours - NEW)
- Text input UI
- Email submission
- Success/error handling

**Phase 2 Total**: 17-21 hours
**Deliverable**: Complete navigation + new screens

---

### 6.4 Phase 3: Project Management Updates (Week 3)

**Goal**: Enhance Project CRUD with new settings

**Tasks**:

**3.1 Project Details Enhancement** (4-5 hours - Task 12 rework)
- Add 7 new form fields
- Conditional visibility logic
- Multi-select sampling design
- Validation
- Testing

**3.2 Member Management Update** (1 hour - Task 13 rework)
- User search functionality
- Invitation status display
- Resend invitation option

**3.3 Organisation Simplification** (3 hours - Task 14)
- Auto-assign "General" org
- Remove org switcher UI
- Update project creation

**Phase 3 Total**: 8-9 hours
**Deliverable**: Project management feature-complete

---

### 6.5 Phase 4: Camera Workbench & BLE (Weeks 4-5)

**Goal**: Implement comprehensive device management

**Tasks**:

**4.1 BLE Protocol Implementation** (16 hours - Task 20)
- WWUS service: 5 hours
- File transfer protocol: 4 hours
- Command library: 3 hours
- DFU mode: 2 hours
- Mandatory connection actions: 2 hours

**4.2 Camera Workbench** (18 hours - Task 18)
- Device discovery flow: 3 hours
- Workbench UI: 8 hours
- LoRaWAN integration: 4 hours
- Device status management: 3 hours

**Phase 4 Total**: 34 hours
**Deliverable**: Full device management + BLE communication

---

### 6.6 Phase 5: Deployment Workflows (Week 6)

**Goal**: Implement new deployment wizard

**Tasks**:

**5.1 Start Deployment Redesign** (14 hours - Task 15)
- Step reordering: 2 hours
- Workbench integration: 3 hours
- LoRaWAN connectivity step: 4 hours
- UI polish: 2 hours
- Testing: 3 hours

**5.2 Device Configuration** (10 hours - Task 16)
- Project setting inheritance: 4 hours
- BLE configuration: 4 hours
- Validation: 2 hours

**5.3 Field Validation** (7 hours - Task 17)
- Test photo lifecycle: 3 hours
- Setup photo capture: 2 hours
- Testing: 2 hours

**Phase 5 Total**: 31 hours
**Deliverable**: Complete deployment workflows

---

### 6.7 Phase 6: Testing & Polish (Week 7)

**Goal**: Comprehensive testing and production readiness

**Tasks**:

**6.1 E2E Testing** (10 hours - Task 21)
- Test new screens: 4 hours
- Test workflows: 4 hours
- Regression testing: 2 hours

**6.2 Performance Optimization** (4 hours - Task 22)
- Profile performance
- Optimize re-renders
- Image compression tuning

**6.3 Production Prep** (4 hours - Task 23)
- Environment configuration
- Build verification
- Deployment checklist

**Phase 6 Total**: 18 hours
**Deliverable**: Production-ready app

---

### 6.8 Total Timeline Summary

| Phase | Duration | Total Hours | Key Deliverables |
|-------|----------|-------------|------------------|
| 1: Foundation | Week 1 | 6.5-9.5 hrs | Schema + Redux ready |
| 2: UI Enhancements | Week 2 | 17-21 hrs | Auth + Settings screens |
| 3: Project Updates | Week 3 | 8-9 hrs | Enhanced Projects CRUD |
| 4: Device & BLE | Weeks 4-5 | 34 hrs | Camera Workbench + BLE |
| 5: Deployments | Week 6 | 31 hrs | New deployment wizard |
| 6: Testing | Week 7 | 18 hrs | Production ready |

**Grand Total**: **114.5-122.5 hours** (vs original 70.5 hrs)
**Net Increase**: **+44-52 hours**

---

## 7. Risk Assessment

### 7.1 High-Risk Areas

**1. BLE Communication Protocol** (HIGHEST RISK)
- **Risk**: Incomplete hardware specs could block development
- **Mitigation**:
  - Refer to `ble-lorawan-communication-spec.md` constantly
  - Request hardware team review of BLE commands
  - Build mock BLE service for parallel testing
- **Contingency**: Defer DFU mode to Phase 2 if blocked

**2. LoRaWAN Registration Workflow** (HIGH RISK)
- **Risk**: Backend LNS integration may not be ready
- **Mitigation**:
  - Define clear API contract with backend team
  - Build UI with mock responses first
  - Test with The Things Network sandbox
- **Contingency**: Manual registration via web portal for MVP2

**3. Camera Workbench Complexity** (MEDIUM-HIGH RISK)
- **Risk**: Large scope (18 hours) with many dependencies
- **Mitigation**:
  - Break into 4 sub-tasks (discovery, UI, LoRaWAN, status)
  - Parallel development where possible
  - Early prototype for stakeholder feedback
- **Contingency**: Simplify MVP2 version (skip firmware/model updates)

**4. Photo File Transfer Protocol** (MEDIUM RISK)
- **Risk**: Chunked file transfer may have edge cases
- **Mitigation**:
  - Extensive testing with real hardware
  - Add robust error handling + retry logic
  - Log all transfer operations
- **Contingency**: Larger chunk size if performance issues

**5. Invitation System Email Integration** (MEDIUM RISK)
- **Risk**: Email delivery reliability for invitations
- **Mitigation**:
  - Use Supabase email templates
  - Add retry mechanism
  - Provide resend option in UI
- **Contingency**: Admin can manually notify users

---

### 7.2 Dependencies & Coordination

**Backend Dependencies:**
1. Schema migrations (Phase 1) - **CRITICAL PATH**
2. Email templates (Phase 2) - **BLOCKING AUTH**
3. LoRaWAN LNS integration (Phase 4) - **BLOCKING DEVICE MGT**
4. Type regeneration after each migration - **ONGOING**

**Hardware Dependencies:**
1. BLE command validation (Phase 4) - **CRITICAL**
2. File transfer testing (Phase 4) - **CRITICAL**
3. DFU firmware files (Phase 4) - **OPTIONAL**

**Coordination Points:**
- Weekly sync: Backend + Mobile teams
- BLE validation: Hardware + Mobile teams
- UAT testing: Stakeholders + Mobile team

---

### 7.3 Rollback Strategy

**If Major Issues Arise:**

**Option 1: Phased Rollout**
- Release MVP2.1 with rework only (Phases 1-3)
- Defer Camera Workbench to MVP2.2 (Phases 4-5)
- Benefits: Lower risk, faster initial release

**Option 2: Feature Flags**
- Implement new features behind flags
- Enable incrementally in production
- Benefits: Gradual validation, easy rollback

**Option 3: Parallel Branches**
- Maintain "stable" branch with old specs
- Develop "next" branch with new specs
- Merge only when fully tested
- Benefits: No disruption to ongoing work

---

## 8. Recommendations

### 8.1 Immediate Actions (This Week)

1. **Backend Team**: Execute Phase 1 migrations (Priority 1)
   - Seed "General" organisation
   - Add project settings columns
   - Create invitations table
   - Create user_preferences table
   - **ETA**: 2-3 hours

2. **Mobile Team**: Sync types and update SQLite
   - Run `npm run types:local`
   - Update SQLite schema
   - Update DatabaseService
   - **ETA**: 3 hours

3. **Project Manager**: Review and approve plan
   - Confirm 7-week timeline acceptable
   - Approve +44-52 hour increase
   - Prioritize if scope reduction needed

4. **Hardware Team**: Validate BLE specification
   - Review `ble-lorawan-communication-spec.md`
   - Confirm command structure
   - Provide file transfer test cases
   - **ETA**: 2 hours

---

### 8.2 Strategic Recommendations

**1. Adopt Incremental Approach** ✅
- **Rationale**: Minimizes risk, maintains momentum
- **Action**: Follow 6-phase plan
- **Benefit**: Early wins, continuous validation

**2. Prioritize Camera Workbench** ⚡
- **Rationale**: Most complex, highest stakeholder value
- **Action**: Allocate best resources to Phase 4
- **Benefit**: De-risk critical path

**3. Build BLE Mock Service** 🎯
- **Rationale**: Enables parallel development without hardware
- **Action**: Create mock in Phase 1
- **Benefit**: Faster iteration, better testing

**4. Early Stakeholder Demo** 👥
- **Rationale**: Validate direction before full implementation
- **Action**: Demo after Phase 2 (Week 2)
- **Benefit**: Catch misalignment early

**5. Maintain Old Spec Branch** 🔀
- **Rationale**: Safety net if new specs problematic
- **Action**: Tag current codebase as `v1.4-baseline`
- **Benefit**: Easy rollback option

---

### 8.3 Success Criteria

**Phase 1 Success (Week 1):**
- ✅ All schema migrations deployed
- ✅ Types regenerated and TypeScript compiles
- ✅ SQLite schema updated
- ✅ Redux store enhanced

**Phase 2 Success (Week 2):**
- ✅ Sign Up + Forgot Password working
- ✅ Profile + Settings screens functional
- ✅ Notifications screen displays invitations
- ✅ Feedback screen submits successfully

**Phase 3 Success (Week 3):**
- ✅ Project CRUD with all 7 new fields
- ✅ Member management with invitations
- ✅ "General" org auto-assigned

**Phase 4 Success (Weeks 4-5):**
- ✅ BLE commands working with real hardware
- ✅ Camera Workbench fully functional
- ✅ LoRaWAN registration working
- ✅ Test photos transfer correctly

**Phase 5 Success (Week 6):**
- ✅ New deployment wizard working end-to-end
- ✅ All photo types handled correctly
- ✅ Field validation passes

**Phase 6 Success (Week 7):**
- ✅ E2E tests passing
- ✅ Performance targets met
- ✅ Production builds successful
- ✅ **MVP2 RELEASE READY** 🎉

---

## Appendix A: Change Summary Matrix

| Change ID | Category | Type | Priority | Affected Tasks | Effort |
|-----------|----------|------|----------|----------------|--------|
| CHG-001 | Auth | NEW | P0 | 10, 21 | 8-10 hrs |
| CHG-002 | Org | SIMPLIFIED | P1 | 14 | -3 hrs |
| CHG-003 | Roles | REFINED | P2 | 13, 14 | 4-6 hrs |
| CHG-004 | Nav | NEW | P1 | All | 6-8 hrs |
| CHG-005 | Deployment | REDESIGN | P0 | 15-17 | 10-12 hrs |
| CHG-006 | Workbench | NEW | P0 | 18, 20 | 18-20 hrs |
| CHG-007 | Photos | NEW | P2 | 15, 17, 20 | 3-4 hrs |
| CHG-008 | Projects | ENHANCED | P1 | 12 | 4-5 hrs |
| CHG-009 | Team | ENHANCED | P2 | 13 | 3-4 hrs |
| CHG-010 | LoRaWAN | NEW | P0 | 18, 20 | 8-10 hrs |
| CHG-011 | BLE | COMPLETE | P0 | 20 | 12-15 hrs |

**Priority Definitions:**
- **P0**: Critical for MVP2 launch
- **P1**: Important for user experience
- **P2**: Nice to have, can defer if needed

---

## Appendix B: Testing Checklist

### Rework Testing (Tasks 1-13)

**Task 9: Redux Store**
- [ ] New slices registered
- [ ] Offline sync working
- [ ] No TypeScript errors

**Task 10: Auth System**
- [ ] Sign Up flow completes
- [ ] Email verification sent
- [ ] Password reset works
- [ ] Login links to new screens

**Task 11: SQLite**
- [ ] New tables created
- [ ] Sync working
- [ ] Migration on fresh install

**Task 12: Projects CRUD**
- [ ] All 7 new fields save
- [ ] Conditional visibility works
- [ ] Multi-select sampling design
- [ ] Offline CRUD works

**Task 13: Member Management**
- [ ] Notifications screen displays invitations
- [ ] Accept invitation works
- [ ] Decline invitation works
- [ ] Badge counter accurate

### New Task Testing (Tasks 14-20)

**Task 14: Org Switching**
- [ ] "General" org auto-assigned
- [ ] Projects link to "General"
- [ ] No org switcher UI

**Task 15: Start Deployment**
- [ ] 4-5 step wizard flow
- [ ] Workbench redirect if unprepared
- [ ] LoRaWAN step (conditional)
- [ ] Camera view test photo

**Task 16: Device Config**
- [ ] Project settings inherited
- [ ] BLE commands sent
- [ ] Settings validated

**Task 17: Field Validation**
- [ ] Test photo lifecycle
- [ ] Setup photos upload
- [ ] All validations pass

**Task 18: Device Management**
- [ ] Device discovery works
- [ ] Camera Workbench UI functional
- [ ] LoRaWAN registration completes
- [ ] Device status updates

**Task 20: BLE Sync**
- [ ] WWUS service connects
- [ ] Commands execute
- [ ] File transfer works (244-byte chunks)
- [ ] DFU mode transitions
- [ ] Mandatory connection actions

---

**Document Status**: ✅ Complete
**Next Steps**: Review with stakeholders → Approve → Execute Phase 1
**Estimated Completion**: 7 weeks from Phase 1 start
**Total Additional Effort**: 114.5-122.5 hours

---

*Generated: January 27, 2025*
*For Questions: Contact development team*
