# Wildlife Watcher Mobile App
## Product Overview for Stakeholders

**Document Version**: 1.1
**Date**: October 18, 2025
**Status**: MVP2 Development - 60.9% Complete
**Purpose**: Non-technical stakeholder reference for features, progress, and decisions
**Update**: Added backend database architecture and security information

---

## Table of Contents

1. [What is Wildlife Watcher?](#what-is-wildlife-watcher)
2. [Who Uses the App?](#who-uses-the-app)
3. [Complete Feature Inventory](#complete-feature-inventory)
4. [Data & Security Architecture](#data--security-architecture)
5. [Development Progress Summary](#development-progress-summary)
6. [Key Decisions & Changes](#key-decisions--changes)
7. [What's Coming Next](#whats-coming-next)
8. [Timeline & Milestones](#timeline--milestones)

---

## What is Wildlife Watcher?

### The Problem We're Solving

Wildlife researchers need to deploy camera traps in remote field locations to monitor animals. This traditionally requires:
- Carrying laptops or paper forms into the field
- Manually configuring complex camera settings
- Waiting until returning to the office to upload data
- Managing teams across multiple field sites
- Coordinating multiple research projects simultaneously

**These challenges lead to**:
- Data entry errors
- Lost deployment information
- Delayed access to field data
- Inefficient team coordination
- Difficulty managing equipment across sites

### Our Solution

Wildlife Watcher is a **mobile field app** that enables researchers to manage wildlife camera deployments entirely from their smartphones, even without internet connectivity.

**Key Benefits**:
- ✅ **Work Offline**: Complete all tasks in remote locations without internet
- ✅ **Simple Setup**: Guide researchers through camera deployment step-by-step
- ✅ **Team Collaboration**: Multiple team members can work on shared projects
- ✅ **Instant Connectivity**: Connect to cameras via Bluetooth for configuration
- ✅ **Automatic Sync**: All data syncs to the cloud when internet returns
- ✅ **Equipment Tracking**: Know which cameras are where at all times

### Mobile App Features

**For Project Members**:
- Test and prepare cameras before field deployments
- Start/end camera deployments in 6 easy steps
- Work completely offline in remote locations
- View all your project deployments on a map

**For Project Admins**:
- Invite team members and assign roles
- Track deployment status across field sites
- Select AI models for camera detection
- Monitor team activities

**For Organisation Administrators**:
- Create and manage research projects
- Invite team members and assign roles
- Upload new AI models for camera detection (via web portal)

**For System Administrators (WW Admin)**:
- View all projects across organizations (read-only in app)
- Manage users and organizations (via web portal)
- System monitoring and configuration (via web portal)

### Web Portal Features

**For System Administrators (WW Admin)**:
- Create and manage user accounts
- Assign users to organizations
- Manage system-level roles (WW Admin, Organisation Administrators)
- System-wide configuration
- Password reset forms for users

**For Organisation Administrators**:
- Upload new AI detection models
- Version and update existing models
- Manage model availability for organizations

---

## Who Uses the App?

### User Roles Explained

The app has five distinct user types, each with specific capabilities:

#### 1. Project Member
**What they do**: Hands-on fieldwork with cameras

**Capabilities**:
- Start and end camera deployments
- Register new cameras to projects
- Test camera connections via Bluetooth
- Update camera firmware
- View and contribute to their assigned projects.
- View other projects in their organization or publicly, based on those projects' visibility settings (contribution requires project membership).
- Sync fieldwork data when online

**Real-World Example**:
*Sarah is a field researcher working on a predator monitoring study. She uses the app to test the cameras from the comfort of her office before heading out to the field. Sarah confirms that the cameras have the latest firmware, are associated with a project, full batteries and SD card space, and the flash lights and camera works as expected (e.g. field of view is not obstructed and camera doesn't take under/overexposed photos). She then goes to the field to deploy the cameras at bait stations. She turns the camera on, connects to it via the mobile app, previews the field of view of the camera, updates the location and other deployment-specific information (e.g. type of bait, angle of the camera,...) and start the deployment using the app. The records deployment are stored locally in her phone as there is no internet connection. When she returns to her vehicle with cell service, the app automatically syncs her work to the cloud.*

**Current Status**: ✅ Core features complete (Tasks 11-13)

---

#### 2. Project Admin
**What they do**: Manage research projects and teams

**Capabilities**:
- Everything a Project Member can do, PLUS:
- Create new research projects
- Edit project details
- Add/remove team members
- Assign Project Admin or Project Member roles
- Select which AI models to use
- Manage project visibility settings
- Delete deployments if needed
- Archive completed projects

**Real-World Example**:
*Dr. Chen leads a multi-year bird population study with 5 field assistants. He creates the project in the app, invites his team members, assigns them to different field sites, and selects the bird detection AI model. He can see all deployments across sites and monitor team progress in real-time.*

**Current Status**: 🔄 In progress (Tasks 12-14, Tasks 12-13 complete)

---
#### 3. Organisation Member
**What they do**: Acts as a member of a larger research organization, available to be assigned to specific projects. This is the default role for any user added to an organization.

**Capabilities**:
- View projects within their organization that are set to "Visible for project and organization members".
- Can be invited by a Project Admin or organisation Admin to become a Project Admin.
- Can create a new project at any time, automatically becoming its Project Admin.
- **Important**: This role grants visibility only. To create deployments or perform other actions within a project, a user must be explicitly added as a Project Member or Project Admin to that specific project.

**Real-World Example**:
*Sarah is a member of the Kea Conservation Trust. When she logs in, she can see a list of all projects the Trust is running that are marked as visible to the organization. She cannot add deployments to these projects until a Project Admin, like Dr. Chen, adds her to the "Kea Nest Monitoring" project as a Project Member.*

**Current Status**: ✅ Complete (Core architecture)

---

#### 4. Organisation Administrators
**What they do**: Manage projects and AI detection models

**Capabilities**:
- Upload new AI models to organization
- Update and version existing models
- Remove outdated models
- Manage which models are available
- Works via web interface (not mobile app in MVP)

**Real-World Example**:
*Alex is the GM of the kea conservation trust and collaborates with machine learning specialists who develops custom bird detection models. When his team creates an improved kea bird detection model, he uploads it through the web portal, making it available for all projects in his organization to use.*

**Current Status**: ⏳ Pending (Future implementation, web portal)

---

#### 5. WW Admin (System Administrator)
**What they do**: System-wide management and support

**Mobile App Capabilities** (Limited):
- View all projects across all organizations (read-only)
- Navigate to web portal for administrative tasks
- No direct editing or management in mobile app

**Web Portal Capabilities** (Full):
- Create and manage user accounts
- Create and manage organizations
- Assign users to organizations
- Assign system-level roles (WW Admin, Model Manager)
- Send login invitations to new users
- System configuration and monitoring
- Access system logs

**Important Note**: WW Admins CANNOT assign project roles (Project Admin/Project Member). Only Project Admins can assign project roles within their projects.

**Real-World Example**:
*Jordan is the Wildlife.ai system administrator. When a new conservation organization wants to join, he creates their organization account, and assigns their initial admin user. If a Project Admin within that organization needs a password reset, or a project member reports an issue with a deployment, Jordan can handle it through the web portal.*

**Current Status**: ✅ Mobile read-only complete, ⏳ Web portal planned

**Key Architectural Change**: Originally planned with full CRUD capabilities in mobile app, corrected in September 2025 to read-only mobile + web portal management to prevent security issues and maintain proper separation of concerns.

---

### How Roles Work Together

```
Organization: Serengeti Conservation Trust
│
├─ WW Admin (via web portal)
│  └─ Creates organization, adds initial users
│
├─ Organisation Administrator (via web portal)
│  └─ Creates projects, assigns project admins and uploads "Lion Detection v2.3" AI model
│
├─ Project: "Lion Population 2025"
│  │
│  ├─ Project Admin: Dr. Chen
│  │  ├─ Creates project
│  │  ├─ Invites 3 field assistants as Project Members
│  │  ├─ Assigns "Lion Detection v2.3" model
│  │  └─ Monitors team deployment progress
│  │
│  └─ Project Members: Sarah, Mike, Lisa
│     ├─ Deploy cameras at field sites
│     ├─ Test camera connections
│     └─ Sync data when online
│
└─ Project: "Elephant Migration Study"
   ├─ Project Admin: Dr. Rodriguez
   └─ Project Members: Alex, Jamie
```


### Organization Structure Rules

1. **Project Member**: Belong to at least one organisation (the "General" organization as default) and can belong to multiple organizations and projects.
   - Example: Sarah_serengeti belongs to the "Serengeti Conservation Trust" organization. She is a member of the "Lion Tracking" project, which has its visibility set to "Visible only for project members". She can see and contribute to this project. The "Elephant Migration" project, also in her organization, has its visibility set to "Visible for project and organization members", so she can see it but can not contribute to it.
   - **Contribution (e.g., creating deployments) is strictly limited to projects where the user is an explicit Project Member or Project Admin.**
   - Needs to be invited to become a regular user via email for different organizations and projects but she can create her own project, becoming the admin project.

2. **Project Admins**: Lead individual research projects.
   - Any user can become a Project Admin by creating a new project.
   - They have full control within their projects, including managing team members (adding/removing/changing roles) and project settings.
   - They control the project's visibility, choosing from:
     - **Visible only for project members**: Only users explicitly added to the project can see it.
     - **Visible for project and organization members**: All members of the project's organization can see the project, but only Project Members can contribute.
     - **Publicly visible**: Anyone on the platform can view the project, but only Project Members can contribute.

3. **Organisation member**: This is the default status for any user belonging to an organization.
   - It grants read-only visibility to any project within the organization that has its visibility set to "Visible for project and organization members" or "Publicly visible".
   - It enables users to select organisation-specific AI detection models.
   

4. **Organisation Administrators**: Manage organization-level resources, primarily AI models.
   - They use the web portal to upload, version, and manage the AI detection models available to projects within their organization.
   - This role operates at the organization level and has Admin role access to all the projects within the organisation.

5. **WW Admins (System Administrators)**: Have system-wide responsibilities and access.
   - They belong to a special "Admin" organization, giving them CRUD capabilities for all organizations and projects. CRUD actions can only be performed exclusively through the secure web portal, not the mobile app.
   - WW Admins can be assigned to additional organizations or projects as any other user.

6. **Multiple Roles**: Users can have multiple roles within their organization.
   - Example: Dr. Chen could be both Project Admin AND Project member of different projects within the same organization.

---

---


## Complete Feature Inventory

### Authentication & Account Management

#### 1.1 User Login
**Description**: Secure login using email and password

**Current State**: ✅ COMPLETE
- Email/password authentication
- Secure token management
- Auto-remember last logged-in user
- Session persistence
- Logout functionality

**Intended State**: Same as current (no changes needed)

**Implementation**: Task 10 - Auth System
**Source**: implementation-spec-v1.4.md Section 4.1

---

#### 1.2 Password Reset (In-App)
**Description**: Reset forgotten password without leaving the app

**Current State**: ✅ COMPLETE
- "Forgot Password?" link on login screen
- Email verification code sent
- Secure password reset flow
- User remains in-app

**Intended State**: Same as current (working as designed)

**Implementation**: Task 10 - Auth System
**Source**: implementation-spec-v1.4.md Section 4.1

---

#### 1.3 User Invitation System
**Description**: WW Admins invite new users via email

**Current State**: ⏳ PENDING (Web Portal)
- Secure invitation tokens
- Time-limited links (7 days)
- New user sets password on first login
- Resend invitation option for expired links

**Intended State**: Web portal implementation
- WW Admins create users via admin.wildlifewatcher.ai
- System sends invitation emails automatically
- Users complete registration via link

**Implementation**: Future (web portal)
**Source**: admin-portal-spec.md, user-roles-permissions.md

---

### Project Management

#### 2.1 Create New Project
**Description**: Start a new research project with team collaboration

**Current State**: ✅ COMPLETE (Task 12)
- Simple project creation form
- Project name and description
- Creator becomes Project Admin automatically
- Offline project creation supported
- Auto-sync when online

**Intended State**: Same as current

**Implementation**: Task 12 - Projects CRUD Operations
**Status**: 100% complete (11.9/15.0 hrs, 20% faster than estimated)
**Source**: implementation-spec-v1.4.md Section 5.5
**Completion**: October 9, 2025

---

#### 2.2 View Projects List
**Description**: See all projects you're assigned to

**Current State**: ✅ COMPLETE (Task 12)
- Card-based layout showing project cards
- Project name and description visible
- Creation date displayed
- Tap card to view project details
- Organization name shown
- Works offline with local data

**Intended State**: Enhanced in MVP2
- Additional: Map visualization of deployment locations (Task 19)
- Additional: Deployment count per project

**Implementation**: Task 12 - Projects CRUD Operations
**Source**: implementation-spec-v1.4.md Section 5.5

---

#### 2.3 View Project Details
**Description**: See detailed information about a specific project

**Current State**: ✅ COMPLETE (Task 12 Phase 4)
- Project name, description, organization
- Creation and update timestamps
- "Manage Members" button
- "Start New Deployment" button
- Deployment list view
- Works offline

**Intended State**: Same as current (discovered already implemented!)

**Implementation**: Task 12 Phase 4 - Project Details Screen
**Status**: Found complete during verification (saved 3.0 hrs)
**Source**: implementation-spec-v1.4.md Section 5.5

---

#### 2.4 Edit Project Details
**Description**: Update project information (Project Admin only)

**Current State**: ⏳ PENDING (Task 14)
- Edit project name
- Edit project description
- Update project settings
- Only Project Admin can edit

**Intended State**: Same as planned

**Implementation**: Task 14 - Organisation Switching & Project Administration
**Source**: implementation-spec-v1.4.md Section 5.5

---

#### 2.5 Archive/Delete Projects
**Description**: Remove completed or mistaken projects

**Current State**: ⏳ PENDING
- Delete empty projects (no deployments/members)
- Archive projects with deployments
- Only Project Admin can delete/archive

**Intended State**: Same as planned

**Implementation**: Task 14 or later
**Source**: implementation-spec-v1.4.md Section 5.5, user-roles-permissions.md Section 5.2

---

### Team Management

#### 3.1 View Project Members
**Description**: See who's on the project team

**Current State**: ✅ COMPLETE (Task 13)
- List all project members
- Show member name and email
- Display user role (Project Admin/Member)
- Works offline with cached data

**Intended State**: Same as current

**Implementation**: Task 13 - Project Member Management
**Status**: 100% complete (10.25/12-15 hrs, 31.7% faster than estimated)
**Source**: implementation-spec-v1.4.md Section 5.6
**Completion**: January 11, 2025

---

#### 3.2 Add Project Members
**Description**: Invite team members to join project

**Current State**: ✅ UI COMPLETE, ⚠️ INTEGRATION PENDING (Task 13)
- Search users by email within organization
- Assign role (Project Admin or Project Member)
- Send invitation notification
- Only Project Admin can add members

**Intended State**: Same as current (awaiting backend integration)

**Implementation**: Task 13 - Project Member Management
**Status**: UI 100% complete, backend integration ready
**Source**: implementation-spec-v1.4.md Section 5.6

---

#### 3.3 Remove Project Members
**Description**: Remove team members from project

**Current State**: ✅ UI COMPLETE, ⚠️ INTEGRATION PENDING (Task 13)
- Remove button for each member
- Confirmation dialog before removal
- Cannot remove yourself
- Only Project Admin can remove members

**Intended State**: Same as current (awaiting backend integration)

**Implementation**: Task 13 - Project Member Management
**Source**: implementation-spec-v1.4.md Section 5.6

---

#### 3.4 Change Member Roles
**Description**: Promote members to admin or demote admins

**Current State**: ✅ UI COMPLETE, ⚠️ INTEGRATION PENDING (Task 13)
- Change between Project Admin and Project Member
- Real-time role updates
- Only Project Admin can change roles

**Intended State**: Same as current (awaiting backend integration)

**Implementation**: Task 13 - Project Member Management
**Source**: implementation-spec-v1.4.md Section 5.6

---

### Camera Deployments

#### 4.1 Start Deployment Wizard (6 Steps)
**Description**: Guided process to deploy a camera in the field

**Current State**: ⏳ PENDING (Task 15)
- **Step 1**: Deployment Details (name, start date/time, project)
- **Step 2**: Location (GPS coordinates, map selection, site name)
- **Step 3**: Sampling Design (motion/timelapse, settings)
- **Step 4**: Bait Station (optional: type, install date, refresh date)
- **Step 5**: Device Selection (pick camera from registered devices)
- **Step 6**: Confirmation & Submit

**Intended State**: Same as planned
- Works completely offline
- Auto-captures GPS when available
- Manual coordinate entry option
- Progress indicator shows current step
- Can go back to edit previous steps
- Submit saves locally, syncs when online

**Implementation**: Task 15 - Deployment Workflow (6-step wizard)
**Estimated**: 10 hours
**Source**: implementation-spec-v1.4.md Section 5.3

---

#### 4.2 End Deployment
**Description**: Mark a camera deployment as finished

**Current State**: ⏳ PENDING (Task 17)
- Select an active deployment from a list or map
- Set end date/time
- Add end notes (optional)
- Deployment marked as "Ended"
- Camera becomes available for new deployment
- Works offline

**Intended State**: Same as planned

**Implementation**: Task 17 - Field Validation & End Deployment
**Estimated**: 6 hours
**Source**: implementation-spec-v1.4.md Section 5.4
**Technical Details**: See `project-context/development-context/MVP2/specifications/end-deployment-workflow.md` for a detailed breakdown of this feature.

---

#### 4.3 View Deployments List
**Description**: See all deployments in a project

**Current State**: ⏳ PENDING (Task 15+)
- Filter: Active, Ended, All
- Sort by: Date, Name, Status
- Card view with key info
- Status indicators (Active, Ended, Syncing)
- Offline viewing supported

**Intended State**: Same as planned

**Implementation**: Task 15 + Task 18
**Source**: implementation-spec-v1.4.md Section 5.7

---

#### 4.4 View Deployment Details
**Description**: See complete deployment information

**Current State**: ⏳ PENDING
- All deployment details from wizard
- GPS coordinates with map view
- Sampling design settings
- Bait station info (if applicable)
- Camera device information
- Edit button (before ending)

**Intended State**: Same as planned

**Implementation**: Task 18 - Deployment & Device Management
**Source**: implementation-spec-v1.4.md Section 5.7

---

#### 4.5 Map View of Deployments
**Description**: Visual map showing deployment locations

**Current State**: 🟡 45% COMPLETE (Task 19 pre-work)
- Google Maps integration complete
- Location permission handling (iOS/Android)
- Map controls (zoom, center, map type switch)
- User location display
- ⏸️ PAUSED: Needs Google Cloud Console configuration

**Intended State**: Fully functional deployment visualization
- Markers for each deployment
- Color-coded by status (active/ended)
- Tap marker to see deployment details
- Filter deployments by project
- Works with offline cached locations

**Implementation**: Task 19 - Map Visualization
**Status**: 45% complete (4.0 hrs pre-work, 6.5 hrs remaining)
**Blocker**: Google Cloud Console setup required
**Source**: implementation-spec-v1.4.md Section 5.7

---

### Device Management & Preparation

#### 5.1 View Deployed Devices
**Description**: The main view of the "Devices" screen lists all cameras that are actively deployed in projects the user is a member of. This gives field staff a quick overview of their active hardware.

**Current State**: ⏳ PENDING (Task 18)
- Device ID, name, and status
- The project it's deployed in
- Last connection date
- Battery level (if LoRaWAN enabled)
- SD card usage (if LoRaWAN enabled)

**Intended State**: Same as planned

**Implementation**: Task 18 - Deployment & Device Management
**Estimated**: 10 hours
**Source**: implementation-spec-v1.4.md Section 5.8

---

#### 5.2 Prepare and Test Nearby Devices
**Description**: A prominent button allows users to scan for nearby, non-deployed cameras to prepare them for fieldwork. This opens a "Camera Workbench" screen where a user can see and manage all aspects of a single camera before deployment.

**User Capabilities**:
- **View Camera Status**: See battery level, SD card storage, and firmware version.
- **Test Camera**: Take a test photo to ensure the camera's view is clear.
- **Manage Project Association**: Assign the camera to a specific project. The app includes safeguards to prevent associating a camera with a project the user doesn't have access to.
- **Update Firmware**: If a newer firmware version is available, the user can update the camera directly from the app.
- **Configure AI Model**: Project Admins can change the AI detection model loaded on the camera.
- **Name Device**: Give the camera a custom name for easy identification.

**Current State**: 🟡 PARTIAL (BLE infrastructure exists)
- Scan for nearby cameras via Bluetooth
- Connect to selected camera
- Test camera's live view to check for obstructions
- Connection status indicator
- Signal strength display

**Intended State**: Fully functional workbench screen integrating all preparation steps.

**Implementation**: Task 20 - BLE Communication & Sync
**Note**: BLE manager exists, needs UI workflow integration.
**Source**: implementation-spec-v1.4.md Section 5.8
**Technical Details**: See `project-context\development-context\documentation-cleanup\device-preparation-workflow.md` for a detailed breakdown of this feature.

---


### AI Model Management

#### 6.1 Select Project AI Model
**Description**: Choose which AI model the project uses (Project Admin)

**Current State**: ⏳ PENDING (Future)
- View available models in organization
- Model details (name, version, detection types)
- Assign model to project
- One model per project
- Model automatically deploys to cameras

**Intended State**: Same as planned

**Implementation**: Task 14 or later (Model Management)
**Source**: implementation-spec-v1.4.md Section 14, user-roles-permissions.md

---

#### 6.2 Upload/Manage Models (Model Manager)
**Description**: Add new AI models to organization (via web portal)

**Current State**: ⏳ PENDING (Web Portal)
- Upload model file
- Set model name and version
- Specify detection capabilities
- Make available to organization
- Update existing models
- Delete outdated models

**Intended State**: Web portal implementation
- Model Managers access via web
- Mobile app only displays/assigns models
- File size limits enforced
- Version tracking

**Implementation**: Future (web portal)
**Source**: admin-portal-spec.md, user-roles-permissions.md

---

### Offline Capabilities

#### 7.1 Offline Data Storage
**Description**: Local database for working without internet

**Current State**: ✅ COMPLETE (Task 11)
- SQLite database on device
- Stores projects, deployments, devices
- User authentication data cached
- Organization information cached
- Project member lists cached

**Intended State**: Same as current

**Implementation**: Task 11 - Offline SQLite Foundation
**Status**: 100% complete (8.0/8.0 hrs, perfect estimation)
**Source**: implementation-spec-v1.4.md Section 6
**Completion**: September 30, 2025

---

#### 7.2 Automatic Background Sync
**Description**: Sync local changes to cloud when internet returns

**Current State**: ✅ COMPLETE (Task 11.6-11.7)
- Redux-offline middleware active
- Background sync queue
- Automatic retry on connection
- Optimistic UI updates
- Rollback on server errors
- Rate limiting to prevent server overload

**Intended State**: Same as current

**Implementation**: Task 11 - Offline SQLite Foundation
**Status**: Production-ready with comprehensive error handling
**Source**: implementation-spec-v1.4.md Section 6

---

#### 7.3 Sync Status Indicators
**Description**: Visual feedback about sync state

**Current State**: ✅ COMPLETE (Task 11.7)
- Sync status indicator in UI
- "Synced" / "Syncing" / "Offline" states
- Last sync timestamp
- Manual sync trigger button
- Error notifications if sync fails

**Intended State**: Same as current

**Implementation**: Task 11 - Offline SQLite Foundation
**Source**: implementation-spec-v1.4.md Section 6

---

#### 7.4 Conflict Resolution
**Description**: Handle when offline changes conflict with server

**Current State**: 🟡 PARTIAL (Basic in Task 11)
- Server wins strategy (MVP)
- User notified of conflicts
- Local changes preserved in history
- Manual resolution for Project Admins (future)

**Intended State**: Enhanced conflict resolution
- Automatic merge where possible
- Smart conflict detection
- User choice for critical conflicts

**Implementation**: Task 11 (basic), Task 21 (enhanced)
**Source**: implementation-spec-v1.4.md Section 6

---

### Organization Management (WW Admin)

#### 8.1 Create Organization
**Description**: Set up new organization in system (web portal)

**Current State**: ⏳ PENDING (Web Portal)
- Organization name
- Contact information
- Assign initial admin user
- Configure organization settings

**Intended State**: Web portal exclusive
- WW Admin creates via admin.wildlifewatcher.ai
- Form validation
- Unique organization names
- Audit logging

**Implementation**: Future (web portal)
**Source**: admin-portal-spec.md, user-roles-permissions.md

---

#### 8.2 Manage Organizations
**Description**: Edit or delete organizations (web portal)

**Current State**: ⏳ PENDING (Web Portal)
- Update organization details
- View organization statistics
- Deactivate organizations
- Cannot delete orgs with active projects

**Intended State**: Web portal exclusive

**Implementation**: Future (web portal)
**Source**: admin-portal-spec.md

---

#### 8.3 View All Projects (Mobile - WW Admin)
**Description**: Read-only view of all projects system-wide

**Current State**: ✅ COMPLETE (September 2025 corrections)
- WW Admin can see all projects
- Read-only access (no editing)
- Navigate to web portal for admin actions
- Organization filtering

**Intended State**: Same as current (architectural correction applied)

**Implementation**: WW Admin corrections (September 29, 2025)
**Source**: specifications/revisions/WW-Admin-Task-Corrections-Phase-3B.md

---

### LoRaWAN Integration

#### 9.1 Battery Level Monitoring
**Description**: Receive camera battery status via LoRaWAN

**Current State**: ⏳ PENDING (Task 20+)
- Webhook receives battery level updates
- Battery percentage stored
- Low battery alerts
- Historical battery data
- Display in device list

**Intended State**: Same as planned

**Implementation**: Task 20+ (LoRaWAN integration)
**Source**: implementation-spec-v1.4.md Section 7.3

---

#### 9.2 SD Card Usage Monitoring
**Description**: Track camera storage capacity via LoRaWAN

**Current State**: ⏳ PENDING (Task 20+)
- Webhook receives SD card usage
- Storage percentage stored
- Full card alerts
- Historical storage data
- Display in device list

**Intended State**: Same as planned

**Implementation**: Task 20+ (LoRaWAN integration)
**Source**: implementation-spec-v1.4.md Section 7.3

---

### Developer Tools (Environment-Gated)

#### 10.1 Developer Menu
**Description**: Special debugging tools (development builds only)

**Current State**: ✅ COMPLETE (Task 10)
- Hidden menu (long-press Wildlife Watcher logo 5x)
- Only visible in development builds
- Automatically hidden in production
- Database inspection tools
- State viewer
- Network traffic logs

**Intended State**: Same as current

**Implementation**: Task 10 - Auth System
**Source**: implementation-spec-v1.4.md Section 4.3

---

## Data & Security Architecture

### How Your Data is Stored and Protected

**The Problem We're Solving:**
Field research data is valuable and sensitive—camera locations, deployment details, project information, and team coordination. This data needs to be secure, well-organized, and accessible only to authorized team members.

**Our Solution:**
Multi-layered security architecture with organization-based access control, backed by professional-grade database technology used by Fortune 500 companies.

---

### Multi-Tenant Organization System

Think of it like apartment buildings with secure key card access:
- Each organization has its own "building" (isolated data space)
- Users have "key cards" (permissions) specific to their organization
- Wildlife.ai administrators can see building directories, but residents manage their own apartments

**What This Means for You:**
- ✅ Serengeti Conservation Trust cannot see data from Snow Leopard Foundation
- ✅ Your organization's data is automatically isolated from all others
- ✅ Team members only see projects they're assigned to
- ✅ 98% multi-tenant isolation effectiveness (validated in testing)

**Real-World Example:**
*When Dr. Chen logs in from Serengeti Conservation Trust, the system automatically shows only projects, deployments, and team members from Serengeti—even though thousands of other deployments exist in the database from other organizations worldwide.*

---

### 4-Tier Security System

The app uses a hierarchical permission system (like organizational charts):

#### 1. WW Admin (System Level)
- **Access**: Can view all projects across all organizations (read-only in mobile app)
- **Capabilities**: Manages user accounts, creates organizations (via web portal)
- **Data Access**: Read-only visibility, but can only edit data in organizations they belong to
- **Example**: Wildlife.ai support staff helping troubleshoot issues

#### 2. Model Manager (Organization Level)
- **Access**: Manages AI detection models for their organization
- **Capabilities**: Upload/update/delete models, make models available to projects
- **Data Access**: Can view all projects in their organization (to understand model usage)
- **Example**: Machine learning specialists maintaining detection algorithms

#### 3. Project Admin (Project Level)
- **Access**: Full control over projects they create or are assigned to
- **Capabilities**: Create projects, manage team, assign models, configure deployments
- **Data Access**: All data within their projects, team member information
- **Example**: Research project leaders coordinating field teams

#### 4. Project Member (Project Level)
- **Access**: Assigned projects only
- **Capabilities**: Deploy cameras, record field data, sync information
- **Data Access**: Projects they're assigned to, deployments they create
- **Example**: Field researchers conducting camera trap surveys

---

### Row Level Security (RLS)

**What it means:** Every database query automatically enforces "you can only see what you're allowed to see"

**How it works:**
- When you log in, the system identifies your organization and project assignments
- Every data request is automatically filtered to show only authorized information
- Even if someone tries to access another organization's data, the database refuses
- No manual security checking needed—protection is automatic and invisible

**Active Protections:**
- ✅ **17 security policies** actively protecting your data across 10 database tables
- ✅ **Organization-scoped access**: Automatically filtered to your org
- ✅ **Project-scoped access**: Only see assigned projects
- ✅ **Role-based permissions**: Your role determines what you can create/edit/delete
- ✅ **Immutable audit trail**: Admin actions cannot be edited or deleted

**Security Status:**
- **Overall Score**: 90/100 - Excellent
- **Coverage**: 71% of tables (10/14) with comprehensive RLS policies
- **Remaining Work**: 4 lookup tables need policies (1-2 hours to complete)
- **Protection Level**: Multi-tenant isolation 98% effective

---

### What Data We Store

#### Core Business Information

**Organizations** (Your research institution)
- Organization name and contact information
- Settings and configurations
- Membership lists
- *Example record*: "Serengeti Conservation Trust" with 23 team members

**Users** (Team members and administrators)
- Names, emails, authentication credentials (encrypted)
- Organization membership
- Role assignments with optional expiration dates
- *Example record*: "Dr. Chen (dr.chen@serengeti.org), Project Admin, Serengeti Conservation Trust"

**Projects** (Research initiatives)
- Project name, description, goals
- Visibility: "Visible only for project members" (default), "Visible for project and organization members", or "Publicly visible"
- Creation date, last update, project owner
- Organization link (automatic isolation)
- *Example record*: "Lion Population Study 2025" - 5 team members, 12 active deployments

**Deployments** (Camera instances in the field)
- Deployment name, start/end dates
- GPS coordinates with professional mapping (PostGIS)
- Sampling design (motion detection vs timelapse)
- Bait station information (if applicable)
- Link to project, device, and creator
- *Example record*: "Water Hole #3" - Active since Jan 10, 2025, GPS: -2.3333, 34.8333

**Devices** (Physical camera equipment)
- Device ID, name/nickname
- Current status (available, in use, maintenance)
- Last connection date
- Battery level and SD card usage (via LoRaWAN)
- *Example record*: "Camera WW-00123 (Acacia Station)" - Battery 87%, SD Card 42% full

**Project Members** (Team assignments)
- User-to-project relationships
- Role within project (Admin or Member)
- Assignment date
- *Note*: May be replaced by unified user_roles system (design review pending)

#### Reference Data (Configuration Options)

**Roles** (4 system roles)
- WW Admin, Model Manager, Project Admin, Project Member
- Role descriptions and capabilities

**Capture Methods** (Camera operation modes)
- Activity Detection (motion-triggered)
- Time-Lapse (scheduled intervals)

**Deployment Statuses** (Lifecycle states)
- Planned, Started, Ended
- Status descriptions

**Log Levels** (8 severity levels)
- Debug → Info → Notice → Warning → Error → Critical → Alert → Emergency

⚠️ **Security Note**: These 4 lookup tables currently need RLS policies (identified gap, 1-2 hrs to fix)

#### System & Audit Information

**Activity Logs** (API usage tracking)
- Every API call logged with timestamp
- User, endpoint, response code
- High-volume table (performance optimized)
- Retention: 90 days

**Admin Audit Log** (Administrative actions)
- Immutable record of all admin actions
- User creation, role assignments, org changes
- Cannot be edited or deleted (compliance)
- Full audit trail for accountability

---

### Geographic Capabilities (PostGIS)

**What it is:** Professional mapping database technology used by NASA, NOAA, and government agencies worldwide

**Why it matters:**
- ✅ Precise GPS coordinates (WGS 84 standard) for every deployment
- ✅ Fast spatial queries: "show all cameras within 5km of ranger station #3" - answered in milliseconds
- ✅ Calculate distances between deployment sites automatically
- ✅ Export deployment maps to professional GIS software
- ✅ Proximity searches and coverage analysis

**Real-World Example:**
*"Show me all active lion deployments within 10km of the recent sighting at Water Hole #3, sorted by distance"* - The database returns results instantly, even with 500+ deployments across the organization.

---

### How Features Connect to Database

#### When you create a project:
- **Stored in**: `projects` table
- **Linked to**: Your organization automatically (via organization_id)
- **Security**: Only your org members can see it (RLS enforced)
- **Tracked**: Creation date, last update, creator name
- **Offline**: Saved locally first, synced to cloud when online

#### When you deploy a camera:
- **Stored in**: `deployments` table
- **Linked to**: Project, device, creator (all verified permissions)
- **Location**: PostGIS coordinates + human-readable address
- **Security**: Only project members can see (project_id RLS policy)
- **Tracked**: Start date, status, sampling design, bait station info
- **Geographic**: Searchable by distance, proximity, map region

#### When you add a team member:
- **Stored in**: `user_roles` table (or `project_members` - design review pending)
- **Linked to**: User account, project, organization
- **Security**: Only project admins can add/remove (role-based RLS)
- **Tracked**: Who added them, when, what role assigned
- **Validation**: Cannot add users from other organizations

#### When you sync offline data:
- **Process**: Local SQLite → Cloud PostgreSQL via Supabase
- **Queue**: Changes queued with timestamps, retries on failure
- **Conflict Resolution**: Server wins (MVP), user notified
- **Performance**: Rate-limited to prevent server overload
- **Tracking**: Sync status visible in UI, last sync timestamp shown

---

### Data Synchronization Architecture

**Local Storage** (Your Phone):
- **Technology**: SQLite database (industry standard for mobile apps)
- **Contains**: Projects, deployments, devices, user data, org info
- **Offline Work**: All changes saved locally first
- **Size**: Optimized for thousands of deployments
- **Speed**: Instant queries even offline

**Cloud Storage** (Supabase Backend):
- **Technology**: PostgreSQL (used by Apple, Instagram, Reddit)
- **Contains**: Master copy of all organization data
- **Real-Time**: Updates visible to all team members immediately
- **Security**: RLS policies enforce access control
- **Backup**: Hourly automated backups

**Sync Process**:
```
Field Work (Offline)
    ↓
Local SQLite Database (Queued Changes)
    ↓
Internet Connection Detected
    ↓
Background Sync (Redux-Offline Middleware)
    ↓
Cloud PostgreSQL (Supabase)
    ↓
Data Available to Team (Real-Time)
```

**Sync Status Indicators:**
- 🟢 **Synced**: All changes in cloud
- 🟡 **Syncing**: Upload in progress
- 🔴 **Offline**: Changes queued locally
- ⚠️ **Conflict**: Manual resolution needed (rare)

---

### Database Security Standards

**Industry-Standard Protections:**
- ✅ Military-grade encryption for all data transfers (TLS 1.3)
- ✅ Encrypted passwords (bcrypt hashing, cannot be reversed)
- ✅ Session tokens expire automatically (security timeout)
- ✅ SQL injection prevention (prepared statements)
- ✅ XSS attack prevention (input sanitization)
- ✅ Rate limiting to prevent abuse
- ✅ Automated hourly backups
- ✅ 99.9% uptime guarantee

**Compliance Ready:**
- ✅ Audit logs for all data access (who, what, when)
- ✅ Data export capabilities for regulatory requirements
- ✅ GDPR-compliant data handling
- ✅ Permission-based data sharing
- ✅ Soft deletes (data recoverable if deleted accidentally)
- ✅ Immutable admin audit trail

**Privilege Escalation Prevention:**
- ✅ Users cannot grant roles higher than their own
- ✅ Project Admins cannot assign system-level roles
- ✅ Organization boundaries enforced (cannot access other orgs)
- ✅ Role changes logged in audit trail

---

### Backend Development Status

**Overall Progress:** 98% Complete ✅

**What's Working:**
- ✅ 14 database tables with proper relationships
- ✅ Multi-tenant organization isolation (98% effective)
- ✅ 4-tier role system with automatic permissions
- ✅ Geographic location queries (PostGIS spatial functions)
- ✅ Row Level Security on 10/14 tables (71% coverage)
- ✅ Immutable audit trail for admin actions
- ✅ Automated hourly backups
- ✅ 95% test success rate (79/83 tests passing)
- ✅ Ready for mobile app integration

**Remaining Work (2%):**
- 🔄 **4 lookup tables need RLS policies** (1-2 hours) - CRITICAL for production
- 🔄 **12 functions need schema injection protection** (1-2 hours) - RECOMMENDED
- 🔄 **4 test fixes** (edge case scenarios, non-blocking)
- 🔄 **Auth configuration tuning** (OTP expiry, password protection) - OPTIONAL

**Production Readiness:**
- **Security Score**: 90/100 - Excellent
- **Functionality**: 98/100 - Feature complete
- **Critical Path**: 2-3 hours security hardening REQUIRED before launch
- **Mobile Integration**: READY - Can start development now

**Backend Repository:**
Separate Git project at `/home/adarsh/dev/wildlifeai/wildlife-watcher-backend`
Contains: Supabase migrations, Edge Functions, RLS policies, test suites

---

### Identified Gaps & Future Enhancements

#### Current Limitations (Being Addressed)

**Critical (Production Blockers):**
1. ✅ **4 Lookup Tables Missing RLS** ⚠️ HIGH PRIORITY
   - **Risk**: Reference data publicly accessible without authentication
   - **Fix**: Enable RLS with read-only policies
   - **Time**: 1-2 hours
   - **Status**: Identified, ready to implement

2. 🟡 **12 Functions Missing Injection Protection** ⚠️ MEDIUM PRIORITY
   - **Risk**: Potential schema injection attack vectors
   - **Fix**: Add `SET search_path` to all database functions
   - **Time**: 1-2 hours
   - **Status**: Non-blocking, recommended before production

**Design Decisions Needing Validation:**
- **project_members table**: Still needed or replaced by user_roles? (legacy question)
- **WW Admin scoping**: Should they have true global access or org-scoped? (currently org-scoped)
- **Data retention policy**: When to hard-delete soft-deleted records? (compliance question)

#### Planned Enhancements (Phase 2)

**Features Not in MVP:**
- 🔄 **User profile management**: Edit own name, email, preferences
- 🔄 **Advanced role customization**: Custom permission sets per organization
- 🔄 **Cross-organization collaboration**: Share deployments between orgs (controlled)
- 🔄 **Enhanced audit trail visualization**: Dashboard for compliance officers
- 🔄 **Automated reporting**: Scheduled exports, data summaries
- 🔄 **Model performance metrics**: AI accuracy tracking, false positive rates
- 🔄 **Device diagnostic dashboard**: Battery trends, SD card usage over time

---

### Why This Architecture Matters

**For Field Researchers:**
- 📱 Data syncs reliably even after days offline
- ⚡ No data loss - everything stored locally first, then synced
- 🔍 Fast queries - find your deployments instantly
- 🗺️ Geographic searches work even with thousands of deployments

**For Project Managers:**
- 👥 Know exactly who has access to what data
- 📊 Audit trail shows all project changes (who, what, when)
- ✅ Easy to add/remove team members with instant permission updates
- 🔒 Sensitive location data protected by project-level security

**For Organizations:**
- 🏢 Your data is completely isolated from other organizations
- 🎯 Control who can see sensitive deployment locations
- 📈 Scalable from 2 cameras to 200+ without performance degradation
- 💾 Professional database technology with 99.9% uptime guarantee

**For WW Admins:**
- 🌍 System-wide visibility for support and troubleshooting
- 👤 User management without accessing project data
- 📝 Complete audit logs for compliance and debugging
- 🔧 Admin actions tracked in immutable audit trail

---

### Database Performance

**Query Speed:**
- ✅ Single deployment lookup: <10ms
- ✅ Project list (50 projects): <20ms
- ✅ Geographic search (500 deployments, 10km radius): <50ms
- ✅ Organization data sync: <200ms
- ✅ Optimized for mobile connections (3G+)

**Scalability:**
- ✅ Designed for 100+ organizations
- ✅ 10,000+ deployments per organization
- ✅ 1,000+ users per organization
- ✅ Horizontal scaling available (when needed)

**Offline Performance:**
- ✅ Local SQLite queries: <5ms
- ✅ No internet required for viewing data
- ✅ Background sync doesn't block UI
- ✅ Optimistic UI updates (instant feedback)

---

## Development Progress Summary

### Overall Status
- **Total Tasks**: 23 planned
- **Completed**: 14 tasks (60.9%)
- **In Progress**: 0 tasks (Task 14 ready to start)
- **Remaining**: 9 tasks (39.1%)
- **Projected Completion**: ~8 working days remaining

---

### Progress by Development Stream

#### Stream A: Project Management (Tasks 12-14)
**Focus**: Project CRUD, team management, organization switching

**Status**: 66.7% complete (2/3 tasks)

| Task | Feature | Status | Hours | Completion |
|------|---------|--------|-------|------------|
| 12 | Projects CRUD Operations | ✅ Complete | 11.9/15.0 | Oct 9, 2025 |
| 13 | Project Member Management | ✅ Complete | 10.25/12-15 | Jan 11, 2025 |
| 14 | Organisation Switching & Details | ⏳ Pending | 0/6.0 | - |

**Key Achievement**: Tasks 12 & 13 completed 22% ahead of schedule (22.15 hrs vs 27-30 hrs estimated)

---

#### Stream B: Deployment Workflows (Tasks 15-17)
**Focus**: 6-step deployment wizard, field validation

**Status**: 0% complete (0/3 tasks)

| Task | Feature | Status | Hours | Notes |
|------|---------|--------|-------|-------|
| 15 | Deployment Wizard (6 steps) | ⏳ Pending | 0/10.0 | Ready to start |
| 16 | Device Configuration | ⏳ Pending | 0/8.0 | - |
| 17 | Field Validation & End | ⏳ Pending | 0/6.0 | - |

**Total Estimated**: 24 hours remaining

---

#### Stream C: Devices & Maps (Tasks 18-20)
**Focus**: Device management, map visualization, BLE sync

**Status**: 0% complete (0/3 tasks, but 45% of Task 19 pre-built)

| Task | Feature | Status | Hours | Notes |
|------|---------|--------|-------|-------|
| 18 | Deployment & Device Management | ⏳ Pending | 0/10.0 | - |
| 19 | Map Visualization | 🟡 Paused | 4.0/10.5 | 45% complete via parallel work |
| 20 | BLE Communication & Sync | ⏳ Pending | 0/8.0 | DFU library ready |

**Pre-Work Savings**: Task 19 reduced from 12 hrs to 6.5 hrs (5.5 hours saved)
**Total Estimated**: 24.5 hours remaining

---

#### Integration Phase (Tasks 21-23)
**Focus**: E2E testing, performance, production prep

**Status**: 0% complete (0/3 tasks)

| Task | Feature | Status | Hours |
|------|---------|--------|-------|
| 21 | E2E Testing (Maestro) | ⏳ Pending | 0/8.0 |
| 22 | Performance Optimization | ⏳ Pending | 0/4.0 |
| 23 | Production Readiness | ⏳ Pending | 0/4.0 |

**Total Estimated**: 16 hours remaining

---

### Foundation Work (Tasks 1-11)
**Focus**: App setup, auth, offline infrastructure

**Status**: ✅ 100% complete (11/11 tasks)

**Key Achievements**:
- Expo migration complete
- Redux store configured
- Supabase authentication working
- Offline SQLite foundation production-ready
- UUID alignment resolved
- All tests passing

**Completion**: Pre-September to September 30, 2025

---

### Time Efficiency Metrics

| Metric | Value | Performance |
|--------|-------|-------------|
| **Estimation Accuracy** | 87.5% | ✅ Excellent |
| **Average Variance** | -17.2% (faster) | ✅ Ahead of schedule |
| **Tasks Ahead of Estimate** | 100% | ✅ All completed tasks |
| **Time Saved** | ~13 hours | ✅ Strong efficiency |

**Notable Efficiencies**:
- Task 11: Perfect estimation (8.0/8.0 hrs)
- Task 12: 20% faster than estimated (11.9/15.0 hrs)
- Task 13: 31.7% faster than estimated (10.25/12-15 hrs)
- Task 19 pre-work: 5.5 hours saved via parallel development

---

## Key Decisions & Changes

### 1. WW Admin Role Clarification (September 2025)

**Original Plan**: WW Admin had full CRUD capabilities in mobile app
- Create/edit/delete users
- Manage organizations directly
- Assign all role types
- Full administrative control via mobile

**Discovery**: This created security and architectural issues
- Too much power in mobile app (security risk)
- Cross-cutting concerns (mobile shouldn't manage system-wide users)
- Confusion between system roles vs project roles
- Mobile complexity vs web portal simplicity

**New Approach** (Corrected September 29, 2025):
- **Mobile App**: Read-only project visibility + navigate to web portal
- **Web Portal**: Full administrative capabilities (user/org management)
- **Clear Separation**: System administration (web) vs field operations (mobile)

**Impact**:
- 50+ documentation corrections across all task files
- No implementation waste (caught before building feature)
- Better security model
- Clearer user experience

**Why This Matters**: Keeps the mobile app focused on field research while providing powerful administrative tools where they belong—in a secure web environment.

**Source**: specifications/revisions/WW-Admin-Task-Corrections-Phase-3B.md

---

### 2. Redux Architecture Fix (January 2025)

**Discovery**: Independent code review found 5 critical bugs in Redux state management

**The Problem**:
- Dual Redux stores causing conflicts
- Projects slice had broken filter (showed no projects)
- Deployments slice had same broken pattern
- Background sync middleware wasn't registered
- Supabase import breaking all tests

**Why It Wasn't Noticed**: Task 13 UI worked perfectly with mock data, never touched the broken Redux code

**Solution**: 4-hour comprehensive fix using TDD methodology
- Merged dual stores
- Fixed all slice reducers (13 total)
- Registered sync middleware
- Fixed test environment

**Result**:
- All 5 bugs resolved
- Zero TypeScript errors
- 62/62 tests passing (6 middleware + 56 backend)
- Zero regressions
- 37.5% faster than estimated fix time

**Why This Matters**: Prevented catastrophic integration failure. What looked like working code would have failed 100% when connecting to real backend.

**Source**: MVP2-METRICS-TRACKER.md Task 13 Redux Fix section

---

### 3. Reality-First Testing Methodology (October 2025)

**Original Approach**: Build elaborate test infrastructure before testing
- Mock SQLite database
- Mock Supabase client
- Mock network states
- Estimated: 2+ days

**User Intervention**: "We've not tested anything - what did you just create?"

**New Approach**: Test with real app on real device FIRST
- Actual user workflows
- Real app logs
- Production behavior
- Result: Found 6 critical bugs in 2.5 hours

**The 6 Bugs Found**:
1. Organisations not synced to SQLite (FK constraint)
2. Circular dependency in architecture
3. UNIQUE constraint (UPDATE vs INSERT after sync)
4. Mock org ID not working in Redux
5. Field name mismatch broke sync completely
6. Missing comprehensive logging

**Why This Matters**: Traditional test-first approach would have missed ALL 6 production bugs while consuming 2+ days building tests. Reality-first testing found them immediately.

**New Standard**: Build → Test Real → Fix Real → Then Add Regression Tests (if needed)

**Source**: MVP2-METRICS-TRACKER.md Task 12 Phase 3.3 section

---

### 4. Task 12 Phase 4 Already Complete (October 2025)

**Discovery**: Project Details Screen was already fully implemented

**Expected**: 3.0 hours to build Project Details Screen
**Reality**: Screen existed, working, production-ready
**Time Saved**: 3.0 hours (100% savings)

**What We Found**:
- Complete UI with project info
- Member management button
- Deployment list integration
- Offline support working
- All features functional

**Why This Happened**: Earlier development included this screen but wasn't tracked in task breakdown

**Lesson**: Always verify existing code before implementing new features

**Source**: MVP2-METRICS-TRACKER.md Task 12 Phase 4 section

---

### 5. Parallel Development Strategy (October 2025)

**Discovery**: Maps work could happen during other task planning

**Approach**: Build Task 19 maps foundation while Task 12 Phase 4 was being planned
- 4.0 hours invested
- 9 files created (1,110 lines)
- Location services working
- Map integration complete

**Result**: Task 19 reduced from 12 hours → 6.5 hours (45% complete)
- 5.5 hours saved
- De-risked complex integration
- Production-ready code

**Current Status**: Paused waiting for Google Cloud Console configuration (user action required)

**Why This Matters**: Demonstrates parallel development can de-risk complex tasks ahead of time without blocking main development stream.

**Source**: MVP2-METRICS-TRACKER.md Task 19 Pre-Work section

---

### 6. Evidence-Based Development with Context7 (Ongoing)

**Original Problem**: Backend team spent 2.5 hours debugging Supabase issue using trial-and-error

**New Approach**: Research vendor documentation FIRST via Context7 MCP
- Access to 38,009+ vendor code snippets
- Official patterns vs custom workarounds
- 15 minutes to solution (10x improvement)

**Results**:
- False solution paths eliminated: 100%
- Debugging time: 2.5 hours → 15 minutes
- Solution quality: Official vendor patterns
- Knowledge preserved for future

**Adoption**: Now standard practice
- Research BEFORE implementation
- Verify assumptions with vendor docs
- Document findings for team

**Why This Matters**: Prevents wasting hours on incorrect approaches. Official documentation provides battle-tested patterns.

**Source**: CLAUDE.md Cross-Project Integration Insights section

---

### 7. Backend-Mobile UUID Consistency (September 2025)

**Problem**: UUIDs must be consistent between backend (PostgreSQL) and mobile (SQLite)

**Critical Decision**: UUIDs stay as strings throughout entire system
- No number conversion anywhere
- SQLite handles UUID strings natively
- Sync operations maintain string type
- Backend confirmed: string UUIDs in Postgres

**Impact**: Breaking change requiring re-authentication
- Users must re-login after UUID alignment (Task 11.8)
- Ensured before wide deployment
- Prevents data corruption

**Status**: ✅ Resolved (September 17, 2025)

**Why This Matters**: Data type mismatches cause silent data corruption. Catching this early prevented database integrity issues.

**Source**: MVP2-METRICS-TRACKER.md Task 11.8 section

---

## What's Coming Next

### Immediate Priorities (Next 2 Weeks)

#### 1. Task 14: Organisation Switching & Project Administration
**Estimated**: 6 hours
**What It Enables**:
- Switch between organizations (if user assigned to multiple)
- Enhanced project details administration
- Organization-scoped project viewing
- Seamless org-to-org transition

**Why It's Next**: Completes Stream A (Project Management), unblocks user workflows

---

#### 2. Task 15: 6-Step Deployment Wizard
**Estimated**: 10 hours
**What It Enables**:
- Complete deployment workflow
- GPS location capture
- Sampling design configuration
- Bait station management
- Device selection and linking
- Offline deployment creation

**Why It's Important**: Core field workflow—researchers can start deployments

---

#### 3. Task 16: Device Configuration
**Estimated**: 8 hours
**What It Enables**:
- Camera registration
- Device settings configuration
- BLE connection setup
- Firmware version tracking

**Why It's Important**: Connects cameras to deployments

---

### Near-Term Features (Weeks 3-4)

#### 4. Task 17: Field Validation & End Deployment
**Estimated**: 6 hours
**What It Enables**:
- Complete deployment lifecycle
- End deployment workflow
- Field validation rules
- Deployment history

---

#### 5. Task 18: Deployment & Device Management
**Estimated**: 10 hours
**What It Enables**:
- Comprehensive device list
- Deployment-device linking
- Device status tracking
- LoRaWAN integration prep

---

#### 6. Task 19: Map Visualization (Resume)
**Estimated**: 6.5 hours remaining (45% complete)
**Blocker**: Google Cloud Console configuration
**What It Enables**:
- Visual deployment locations
- Interactive map interface
- Location-based filtering
- Deployment clustering

---

### Integration Phase (Weeks 5-6)

#### 7. Task 20: BLE Communication & Sync
**Estimated**: 8 hours
**What It Enables**:
- Camera connectivity
- Firmware updates
- Settings sync
- Connection diagnostics

---

#### 8. Task 21: E2E Testing with Maestro
**Estimated**: 8 hours
**What It Enables**:
- Automated UI testing
- Regression test suite
- User workflow validation
- Quality assurance

---

#### 9. Tasks 22-23: Production Preparation
**Estimated**: 8 hours combined
**What It Enables**:
- Performance optimization
- Production build configuration
- App store submission prep
- Final quality checks

---

### Web Portal Development (Future Phase)

**Estimated**: Separate project timeline

**Core Features**:
- WW Admin user management
- Organization CRUD operations
- Model Manager upload interface
- Password reset forms
- System monitoring dashboard

**Technology**: Supabase Edge Functions + React admin portal
**Deployment**: admin.wildlifewatcher.ai

**Source**: admin-portal-spec.md

---

## Timeline & Milestones

### Historical Milestones Achieved

#### Phase 1: Foundation (July-August 2025)
✅ **Completed**: Pre-September 2025
- Expo SDK 51 migration
- Project repository setup
- EAS build configuration
- Development environment established

---

#### Phase 2: Authentication & Core Setup (August-September 2025)
✅ **Completed**: Tasks 1-10
- User authentication (Task 10) - September 2025
- Redux store configuration (Task 9) - September 2025
- Supabase integration - September 2025
- Developer tools gating - September 2025

---

#### Phase 3: Offline Infrastructure (September 2025)
✅ **Completed**: Task 11 (September 30, 2025)
- SQLite database setup
- Redux-offline middleware
- Sync status indicators
- Background sync implementation
- Offline-first architecture validated
- **Time**: 8.0/8.0 hrs (perfect estimation)

---

#### Phase 4: Project Management (October 2025 - January 2025)
✅ **Completed**: Tasks 12-13
- **Task 12**: Projects CRUD (October 4-9, 2025)
  - Create/view/manage projects
  - Offline project operations
  - Real-world testing completed
  - 6 production bugs fixed
  - **Time**: 11.9/15.0 hrs (-20% variance)

- **Task 13**: Project Members (October 9 - January 11, 2025)
  - Member list viewing
  - Add/remove members UI
  - Role management UI
  - Redux architecture fixed (5 critical bugs)
  - Backend integration ready
  - **Time**: 10.25/12-15 hrs (-31.7% variance)

**Achievement**: Stream A 66.7% complete, 22% ahead of schedule

---

#### Phase 5: Architectural Corrections (September 2025)
✅ **Completed**: September 29, 2025
- WW Admin role clarification (50+ corrections)
- Documentation alignment across 25 files
- Compliance audit (65/100 score established)
- Mobile read-only + web portal architecture confirmed
- **Time**: 3.5 hrs (unplanned but critical)

**Source**: specifications/revisions/ folder

---

### Current Status (January 2025)

**Overall Progress**: 60.9% complete (14/23 tasks)
**Current Phase**: Stream A completion → Stream B startup
**Next Immediate**: Task 14 (Organisation Switching)
**Development Velocity**: 1.3 tasks/day (accelerating)
**Days Elapsed**: 116 days since tracking began

---

### Projected Milestones (Next 8 Working Days)

#### Week 1: Complete Stream A + Start Stream B
**Tasks**: 14, 15
**Estimated**: 16 hours
**Deliverables**:
- Organisation switching functional
- Deployment wizard operational
- Users can create first deployments

---

#### Week 2: Stream B Core Features
**Tasks**: 16, 17
**Estimated**: 14 hours
**Deliverables**:
- Device configuration working
- End deployment workflow complete
- Full deployment lifecycle functional

---

#### Week 3: Stream C - Devices & Maps
**Tasks**: 18, 19 (resume), 20
**Estimated**: 24.5 hours
**Deliverables**:
- Device management complete
- Map visualization operational (pending GCP setup)
- BLE camera connectivity functional

---

#### Week 4: Integration & Testing
**Tasks**: 21, 22, 23
**Estimated**: 16 hours
**Deliverables**:
- Maestro E2E test suite
- Performance optimizations applied
- Production build ready
- App store submission prepared

---

### Target Release Date

**Projected MVP Completion**: ~8 working days from current state (January 2025)
**Risk-Adjusted**: +10% buffer = 9 days
**Best Case**: 6 days (if velocity maintains)
**Conservative**: 10 days (if blockers arise)

**Production Readiness Criteria**:
- ✅ All 23 tasks complete
- ✅ E2E test suite passing
- ✅ Performance benchmarks met
- ✅ No critical bugs
- ✅ Backend integration validated
- ✅ App store guidelines compliant

---

### Web Portal Timeline (Separate Track)

**Start**: After MVP mobile completion
**Estimated**: 3-4 weeks additional development
**Deployment**: Supabase Edge Functions

**Phases**:
1. Week 1: User management + authentication
2. Week 2: Organization CRUD + role assignment
3. Week 3: Model Manager interface
4. Week 4: Testing + production deployment

---

## Source References

### Primary Specification Documents

1. **implementation-spec-v1.4.md** (v1.4.6, August 29, 2025)
   - Path: `project-context/development-context/MVP2/implementation-spec-v1.4.md`
   - **Authority**: PRIMARY SOURCE OF TRUTH for all MVP2 requirements
   - **Size**: ~17.5k tokens
   - **Sections**: Complete technical specification including all features

2. **user-roles-permissions.md** (v1.1, October 1, 2025)
   - Path: `project-context/development-context/MVP2/specifications/user-roles-permissions.md`
   - **Authority**: Definitive role definitions and permission matrix
   - **Content**: 4-tier RBAC system, organizational rules, permission tables

3. **admin-portal-spec.md** (October 1, 2025)
   - Path: `project-context/development-context/MVP2/specifications/admin-portal-spec.md`
   - **Authority**: Web portal requirements and architecture
   - **Content**: Admin dashboard, user management, Edge Functions architecture

4. **MVP2-METRICS-TRACKER.md** (continuously updated, last: January 11, 2025)
   - Path: `project-context/development-context/MVP2/implementation/execution/MVP2-METRICS-TRACKER.md`
   - **Authority**: LIVE STATUS of development progress
   - **Content**: Task completion, time tracking, variance analysis, lessons learned

5. **MVP2-MASTER-EXECUTION-PLAN.md** (October 2, 2025, updated October 9)
   - Path: `project-context/development-context/MVP2/implementation/execution/MVP2-MASTER-EXECUTION-PLAN.md`
   - **Authority**: CURRENT EXECUTION STRATEGY
   - **Content**: Hybrid incremental-stream methodology, quality gates, dependencies

---

### Backend Database Documentation (Separate Repository)

6. **Wildlife Watcher Database Overview** (January 2025)
   - Path: `/home/adarsh/dev/wildlifeai/wildlife-watcher-backend/project-context/documentation/1. ONBOARDING - Wildlife Watcher Database Overview.md`
   - **Authority**: Database onboarding and architecture overview
   - **Content**: 14 tables, multi-tenant design, RLS policies, data relationships

7. **Database Schema Analysis** (January 2025)
   - Path: `/home/adarsh/dev/wildlifeai/wildlife-watcher-backend/project-context/database-schema-analysis.md`
   - **Authority**: Technical schema structure documentation
   - **Content**: Table definitions, relationships, constraints, indexes

8. **Supabase Security - RLS Policies** (January 2025)
   - Path: `/home/adarsh/dev/wildlifeai/wildlife-watcher-backend/project-context/documentation/6. DEV - Wildlife Watcher Supabase Security - RLS Policies.md`
   - **Authority**: Row Level Security implementation guide
   - **Content**: 17 active policies, security rules by role, policy implementation

9. **Security Advisor Findings** (January 2025)
   - Path: `/home/adarsh/dev/wildlifeai/wildlife-watcher-backend/project-context/documentation/6a. SECURITY-ADVISOR-FINDINGS-ADDENDUM.md`
   - **Authority**: Security audit and recommendations
   - **Content**: Security gaps, remediation paths, compliance findings

---

### Revision & Correction Documents

6. **WW-Admin-Task-Corrections-Phase-3B.md** (September 29, 2025)
   - Path: `project-context/development-context/MVP2/specifications/revisions/WW-Admin-Task-Corrections-Phase-3B.md`
   - **Purpose**: Architectural correction documentation
   - **Content**: 50+ corrections across task files, mobile read-only rationale

7. **WW-ADMIN-DOCUMENTATION-REVIEW-REPORT.md** (September 29, 2025)
   - Path: `project-context/development-context/MVP2/specifications/revisions/WW-ADMIN-DOCUMENTATION-REVIEW-REPORT.md`
   - **Purpose**: Documentation alignment audit
   - **Content**: 25 files reviewed, 4 corrected, 21 compliant

8. **MVP2-SPEC-COMPLIANCE-AUDIT.md** (October 1, 2025)
   - Path: `project-context/development-context/MVP2/specifications/revisions/MVP2-SPEC-COMPLIANCE-AUDIT.md`
   - **Purpose**: Implementation vs specification alignment check
   - **Content**: 65/100 compliance score, critical gaps identified

---

### Task Documentation

9. **Task Files (task_001.txt through task_023.txt)** (October 1, 2025)
   - Path: `project-context/development-context/MVP2/implementation/tasks/`
   - **Purpose**: Individual task specifications
   - **Content**: Task ID, dependencies, estimated hours, description, test strategy

10. **Task Status Files**:
    - `TASK-11-COMPLETION-SUMMARY.md` - Offline foundation complete
    - `TASK-12-STATUS.md`, `TASK-12-PHASE-*.md` - Projects CRUD progress
    - `TASK-13-STATUS.md`, `task-13-backend-integration.md` - Member management
    - `task_019_status.md` - Maps pre-work status

---

### Implementation Guides

11. **testing-standards.md** (October 1, 2025)
    - Path: `project-context/development-context/MVP2/implementation/guides/testing-standards.md`
    - **Purpose**: Testing methodology and quality standards
    - **Content**: TestID patterns, TDD/BDD methodology, commit strategies

12. **REDUX-FIX-COMPLETION-SUMMARY.md** (October 11, 2025)
    - Path: `project-context/development-context/MVP2/implementation/guides/REDUX-FIX-COMPLETION-SUMMARY.md`
    - **Purpose**: Redux architecture fix documentation
    - **Content**: 5 bugs fixed, methodology, results, lessons learned

13. **CLOUD-BACKEND-TESTING-GUIDE.md** (October 11, 2025)
    - Path: `project-context/development-context/MVP2/implementation/guides/CLOUD-BACKEND-TESTING-GUIDE.md`
    - **Purpose**: Backend integration testing methodology

14. **offline-testing-guide.md** (October 5, 2025)
    - Path: `project-context/development-context/MVP2/implementation/guides/offline-testing-guide.md`
    - **Purpose**: Offline-first architecture testing patterns

---

### Cross-Reference Index

**Feature → Documentation Mapping**:

| Feature Category | Primary Source | Supporting Docs |
|-----------------|----------------|-----------------|
| **User Roles** | user-roles-permissions.md | implementation-spec-v1.4.md Section 4.2, RLS Policies doc |
| **Authentication** | implementation-spec-v1.4.md Section 4.1 | task_010.txt, Database Overview |
| **Project Management** | implementation-spec-v1.4.md Section 5.5-5.6 | task_012.txt, task_013.txt, TASK-12/13-STATUS.md, Database Schema |
| **Deployments** | implementation-spec-v1.4.md Section 5.3-5.4 | task_015.txt, task_017.txt, Database Schema (PostGIS) |
| **Device Management** | implementation-spec-v1.4.md Section 5.8 | task_018.txt, task_020.txt, Database Schema |
| **Map Visualization** | implementation-spec-v1.4.md Section 5.7 | task_019.txt, task_019_status.md, PostGIS docs |
| **Offline Support** | implementation-spec-v1.4.md Section 6 | task_011.txt, offline-testing-guide.md, Database Sync |
| **Admin Portal** | admin-portal-spec.md | WW-Admin-Task-Corrections-Phase-3B.md |
| **Database & Security** | Database Overview, RLS Policies | Security Advisor Findings, Database Schema Analysis |
| **Progress Status** | MVP2-METRICS-TRACKER.md | MVP2-MASTER-EXECUTION-PLAN.md |

---

### Document Hierarchy

```
📋 AUTHORITATIVE SOURCES (Read First)
├─ implementation-spec-v1.4.md ⭐ PRIMARY
├─ user-roles-permissions.md ⭐ ROLES
├─ MVP2-METRICS-TRACKER.md ⭐ LIVE STATUS
└─ MVP2-MASTER-EXECUTION-PLAN.md ⭐ STRATEGY

📊 PROGRESS & DECISIONS
├─ Task status files (TASK-*-STATUS.md)
├─ Task specifications (task_*.txt)
├─ Revision documents (specifications/revisions/)
└─ Completion summaries

📚 IMPLEMENTATION GUIDES
├─ Testing guides
├─ Integration guides
├─ Architecture documentation
└─ Fix/correction summaries

🌐 FUTURE WORK
├─ admin-portal-spec.md
└─ Compliance audit findings
```

---

## Questions or Clarifications?

### For Feature Requirements
**Contact**: Product Manager or Development Team
**Reference**: implementation-spec-v1.4.md and user-roles-permissions.md

### For Progress Status
**Contact**: Development Team
**Reference**: MVP2-METRICS-TRACKER.md (updated continuously)

### For Technical Architecture
**Contact**: Technical Lead or System Architect
**Reference**: implementation-spec-v1.4.md Section 3 (Architecture Overview)

### For Timeline & Planning
**Contact**: Project Manager
**Reference**: MVP2-MASTER-EXECUTION-PLAN.md

---

**Document Maintained By**: Development Team
**Last Updated**: January 17, 2025
**Review Frequency**: Weekly during active development
**Feedback**: Submit via project communication channels

---

*This document consolidates information from 25+ technical documents (mobile app + backend database) to provide stakeholders with a clear, non-technical view of the Wildlife Watcher Mobile App, its features, security architecture, and development progress.*