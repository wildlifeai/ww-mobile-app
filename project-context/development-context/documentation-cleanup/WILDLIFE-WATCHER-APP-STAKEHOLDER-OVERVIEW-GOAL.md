# Wildlife Watcher Mobile App
## Product Overview for Stakeholders

**Document Version**: 1.2
**Date**: October 27, 2025
**Status**: MVP2 Development - 60.9% Complete
**Purpose**: Non-technical stakeholder reference for features, progress, and decisions

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
- Carrying tablets or paper forms into the field
- Manually configuring camera settings
- Waiting until returning to the office to upload data
- Manually managing teams across multiple field sites
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

- ✅ **Prepare Cameras before going to the field**: Test camera functions, check battery and SD card status, and update firmware from your office to ensure every device is field-ready, preventing wasted trips.
- ✅ **Error-Proof Deployments**: A step-by-step wizard guides you through setup, capturing all critical data correctly and reducing field errors.
- ✅ **Perfect Camera Placement**: Use a live camera preview to perfectly frame your shot and location information with photos of the setup for easy retrieval.
- ✅ **Work Anywhere, Sync Later**: Complete all tasks in remote locations without an internet connection. Data syncs to the cloud automatically when connectivity returns.
- ✅ **Remote Camera Health Monitoring**: Receive crucial in-field updates on battery life and key operational statistics (e.g., number of images taken) via LoRaWAN to prevent failed deployments.
- ✅ **Secure Team Collaboration**: Work with your team in a secure, isolated organization. Robust permissions ensure data is only seen by authorized users.


### Mobile App Features

**For Project Members**:
- Test and prepare cameras before field deployments
- Start/end camera deployments in 4-5 easy steps
- Work completely offline in remote locations
- View all your project deployments on a list or a map

**For Project Admins**:
- Invite team members and assign roles
- Track deployment status across field sites
- Select which AI model a project uses from a list of available models
- Monitor team activities

---

## Who Uses the App?

### User Roles Explained

The app has three distinct user types, each with specific capabilities:
 
#### 1. Project Member
**What they do**: Hands-on fieldwork with cameras

**Capabilities**:
- Start and end camera deployments within the project
- Test and prepare cameras before field deployments via Bluetooth
- Update camera firmware
- Create, read, and end any deployment within their assigned projects.
- View and contribute to their assigned projects.
- View other projects in their organization or publicly, based on those projects' visibility settings (contribution requires project membership).
- Sync fieldwork data when online

**Real-World Example**:
*Sarah is a field researcher working on a predator monitoring study. She uses the app to test and prepare 20 cameras from the comfort of her office. Sarah confirms that the cameras have the latest firmware, full batteries, and clear SD cards. She verifies that each camera's pre-provisioned LoRaWAN registration is active so they can send remote updates. She also ensures the cameras are associated with the predator monitoring project and that the flash and camera work as expected. Before heading out, she ensures the cameras are "disarmed" so they don't trigger during transport. In the field, she connects to each camera, checks the LoRaWAN signal strength, previews the field of view, records location details, and then starts the deployment. The deployment records are stored locally on her phone. When she returns to her vehicle with cell service, the app automatically syncs her work to the cloud.*

**Current Status**: TBC by AL

---

#### 2. Project Admin
**What they do**: Manage research projects and teams

**Capabilities**:
- Everything a Project Member can do, PLUS:
- Edit project details
- Add/remove team members
- Assign Project Admin or Project Member roles 
- Select which AI models the deployments use
- Create, read, and end any deployment within their projects.

**Real-World Example**:
*Dr. Chen leads a multi-year kiwi bird population study with five field assistants. He creates the project in the app, invites the assistants as team members, sets deployments and project visibilty as "Visible for project and organization members", and selects the kiwi bird detection AI model. He can see all deployments across sites and monitor team progress in real-time.*

**Current Status**: TBC by AL
 
---
#### 3. Organisation Member (Default Status)
**What they do**: Acts as a member of a larger research organization, available to be assigned to specific projects. This is the default role for any user added to an organization.

**Capabilities**:
- Can be invited by a Project Admin or organisation Admin to become a Project Member or Project Admin.
- Can create a new project at any time, automatically becoming its Project Admin.
- **Important**: This role grants visibility only. To create deployments or perform other actions within a project, a user must be explicitly added as a Project Member or Project Admin to that specific project.

**Real-World Example**:
*Sarah is a member of the Kiwi Conservation Trust. When she logs in, she can see a list of all projects the Trust is running that are marked as visible to the organization. She cannot add deployments to these projects until a Project Admin, like Dr. Chen, adds her to the "kiwi bird population" project as a Project Member.*

**Current Status**: TBC by AL

---

### How Roles Work Together

```
Organization: General
│
├─ Project: "Lion Population 2025"
│  │
│  ├─ Project Admin: Dr. Chen
│  │  ├─ Creates the project
│  │  ├─ Invites 3 field assistants as Project Members
│  │  ├─ Assigns "Lion Detection v2.3" model
│  │  └─ Monitors team deployment progress
│  │
│  └─ Project Members: Sarah, Mike, Lisa
│     ├─ Prepare camera for deployments
│     ├─ Deploy cameras at field sites
│     └─ Sync data when online
│
└─ Project: "Elephant Migration Study"
   ├─ Project Admin: Dr. Rodriguez
   └─ Project Members: Alex, Jamie
```

### Organization Structure Rules (Partially implemented)
For the mvp2 release, the organizational structure is simple to focus on core project collaboration.

1.  **Single "General" Organization**: All users belong to a single, default organization called "General". There is no concept of separate organizations in the mvp2. **(To be implemented)**
2.  **Anyone Can Create a Project**: Any user can create a new project at any time. By doing so, they automatically become the **Project Admin** for that project. **(Implemented)**
3.  **Project-Based Contribution**: To contribute to a project (e.g., create deployments), a user must be explicitly added to that project's team as either a **Project Member** or a **Project Admin**. **(Implemented but requires fixing, error fetching project members, to update with the invitations feature)**
4.  **Multiple Roles**: A user can have different roles across different projects. For example, Dr. Chen can be the Project Admin of the "Lion Population 2025" project and a Project Member of the "Elephant Migration Study". **(Implemented)**


## Complete Feature Inventory

### Authentication & Account Management

#### 1.1 User Login
**Description**: Secure login using email and password

**Current State**: Implemented
- Email and password fields. **Implemented**
- "Remember me" checkbox for session persistence. **Implemented**
- "Sign In" button to access the app.**Implemented**
- Links to "Forgot Password?" and "Sign Up".**Implemented**

**Intended State**: Same as current (no changes needed)

**Implementation**: Task 10 - Auth System
**Source**: implementation-spec-v1.4.md Section 4.1 

---

#### 1.2 Password Reset (In-App)
**Description**: Reset forgotten password without leaving the app

**Current State**: Partial (update password submission doesn't go thorugh)
- "Forgot Password?" link on the login screen navigates to this feature. **Implemented**
- User enters their email address to receive a secure reset link. **Implemented**
- A confirmation message is shown after the email is sent. **Not working**

**Intended State**: Same as current (working as designed)

**Implementation**: Task 10 - Auth System
**Source**: implementation-spec-v1.4.md Section 4.1

#### 1.3 User Creation (Self-Registration)
**Description**: Allow new users to create an account directly from the mobile app.

**Current State**: Partial (registration works but no email verification)
- "Sign Up" link on the login screen navigates to this feature. **Implemented**
- Registration form requires first and last name, email, password, and password confirmation. **Partially Implemented (new requirement)**
- Requires email verification to activate the account. **Not working**
- After signup, the user is informed to check their email and is returned to the login screen. **Not working**
- The user is automatically assigned to the general organisation. **Not implemented (new requirement)**

**Intended State**: Requirements updated.

**Implementation**: Part of core app features
**Source**: app-screen-guide.md Section 1 - Sign Up Screen


---

### Main Navigation

#### 2.1 Bottom Tab Bar
**Description**: The primary navigation method, allowing users to switch between the app's main sections.

**Current State**: Implemented
- Always visible at the bottom of the screen after login.**Implemented**
- Contains four tabs: Maps, Projects, Deployments, and Devices.**Implemented**
- Tapping a tab switches to the corresponding screen.**Implemented**

**Intended State**: Same as current.

**Implementation**: Part of core app navigation.
**Source**: app-screen-guide.md Section 2 - Main Navigation (Bottom Tabs)

---

#### 2.2 Header Bar & Side Drawer Menu
**Description**: Provides access to secondary features and user settings via a slide-out menu.

**Current State**: Partial implemented
- A "hamburger" menu icon on the left opens the Side Drawer Menu. **Implemented**
- Remove the "Wildlife Watcher" name displayed at the top and the user avatar icon logo. **Not Implemented (New requirement)**
- The Side Drawer contains a user avatar with the user name displayed on the side and links to Notifications, Profile, Settings, Feedback, and Sign Out. **Partially implemented (requires feedback and remove community discussion)**


**Intended State**: Requirements updated.

**Implementation**: Part of core app navigation.
**Source**: app-screen-guide.md Section 5 - Side Drawer Menu

---

#### 2.3 Profile Screen
**Description**: Displays the user's personal account information.

**Current State**: Not implemented (new feature)
- A read-only field for the user's "First Name", "Last Name" and "Email Address".  **Not Implemented (New requirement)**
- The organization(s) the user belongs to.  **Not Implemented (New requirement)**
- A reset password option.  **Not Implemented (New requirement, reuse existing implementation from authentification process, where possible)**

**Intended State**: Fully implemented as described.

**Implementation**: To be scheduled.
**Source**: app-screen-guide.md Section 4 - Profile Screen

---

#### 2.4 Settings Screen
**Description**: Allows the user to customize app behavior, particularly for data synchronization.

**Current State**: Not implemented (new feature)
- A "Data Synchronization" section with options. **Not Implemented (New requirement)**
- **Sync on Wi-Fi only**: A switch to prevent uploads over cellular data. **Not Implemented (New requirement)**
- **Ask before syncing**: A switch to prompt for confirmation before large data uploads. **Not Implemented (New requirement)**
- **Automatic sync**: The default behavior. **Not Implemented (New requirement)**

**Intended State**: Fully implemented as described.

**Implementation**: To be scheduled.
**Source**: app-screen-guide.md Section 4 - Settings Screen

---

#### 2.5 Feedback Screen
**Description**: Provides a simple way for users to send feedback, bug reports, or suggestions.

**Current State**: Not implemented (new feature)
- A title like "Send Feedback". **Not Implemented (New requirement)**
- A large, multi-line text box for the message. **Not Implemented (New requirement)**
- A "Send" button that provides confirmation or error messages. **Not Implemented (New requirement)**
- A "Cancel/Back" button. **Not Implemented (New requirement)**

**Intended State**: Fully implemented as described.

**Implementation**: To be scheduled.
**Source**: app-screen-guide.md Section 4 - Feedback Screen

---

#### 2.6 Notifications Screen
**Description**: Acts as a notification center for users to view and respond to pending project invitations.

**Current State**: Partially implemented (new feature)
- A list of invitation "cards" showing project name, inviting admin, and assigned role. **Not Implemented (New requirement)**
- "Accept" and "Decline" buttons on each card. **Not Implemented (New requirement)**
- A message is displayed if there are no pending invitations. **Not Implemented (New requirement)**

**Intended State**: Fully implemented as described.

**Implementation**: To be scheduled.
**Source**: app-screen-guide.md Section 4 - Invitations Screen

---

#### 2.7 Maps Screen (Home)
**Description**: The user's command center for field operations, providing a map-based view of all deployments.

**Current State**: Partially implemented (the map doesn't load)
- Displays a map with color-coded pins for camera deployments. **Not Implemented (New requirement)**
- Tapping a pin shows a summary with an option to view full details. **Not Implemented (New requirement)**
- Floating Action Buttons (FABs) to "Start Deployment" and "End Deployment". **Not Implemented (New requirement)**
- A "Layers" icon to filter deployments on the map. **Not Implemented (New requirement)**
- Remove the S S H option. **Not Implemented (New requirement)** 

**Intended State**: New requirements added

**Implementation**: Task 19 - Map Visualization.
**Source**: app-screen-guide.md Section 2 - Maps Screen (Home)

---

#### 2.8 Projects Screen
**Description**: A digital filing cabinet for managing all research projects.

**Current State**: Partial implemented (issues with users not belonging to an organisation can't see or create the project)
- Displays a list of project "cards" with summary information. **Implemented**
- The information includes project title, description, stats for members and number of deployment are displayed **Implemented but need to check if working**
- A search bar to find projects. **Implemented**
- A floating "+" button to create a new project. **Implemented**
- Tapping a card navigates to the Project Details Screen. **Implemented**


**Intended State**: Same as current.

**Implementation**: Task 12 - Projects CRUD Operations.
**Source**: app-screen-guide.md Section 2 - Projects Screen

---

#### 2.9 Deployments Screen
**Description**: Provides a detailed list of every camera deployment the user has access to, across all their projects.

**Current State**: Partial implemented (issues with users not belonging to an organisation can't see or create the project)
- Filter buttons at the top for "All", "Active", and "Ended" deployments. **Not Implemented (New requirement)**
- A list of deployment "cards" showing key info like project name, camera name, and status. **TBC**
- Cards are color-coded to show their status (e.g., green for healthy, red for ended). **TBC**
- A floating "+" button provides a shortcut to start a new deployment. **Implemented**
- Remove the Scan button and "Deployments" title. **Not Implemented (New requirement)**

**Intended State**: Same as current.

**Implementation**: To be scheduled.
**Source**: app-screen-guide.md Section 2 - Deployments Screen

---

#### 2.10 Devices Screen
**Description**: The hardware management center, where users can see the status of their cameras and prepare them for fieldwork.

**Current State**: Not Implemented
- A list of all cameras associated with the user's projects, showing their name and status ("Deployed" or "Available"). **Not Implemented**
- For deployed cameras, the card also shows the project it's in and its last known battery/SD card status. **Not Implemented**
- A prominent button to "Prepare and Test Nearby Devices," which opens the Camera Workbench. **Not Implemented**

**Intended State**: Same as current.

**Implementation**: To be scheduled.
**Source**: app-screen-guide.md Section 2 - Devices Screen

---

### Project Management

#### 3.1 Create New Project
**Description**: Start a new research project with team collaboration

**Current State**: Partially implemented (works with test users but not for users without an organisation)
- A "+" button on the Projects Screen opens a "New Project" form.
- **Project Details**: Users can set the Project Name, Description, and configure project-level settings. **Implemented**
- **Project Settings**:
   - **Is Baited?**: Toggle to indicate if bait is used. **Implemented**
   - **Monitoring marked individuals**: Toggle to indicate if marked individuals are monitored. **Implemented**
   - **Sampling Design**: Select from a list of standard methods (e.g., random, systematic). **Implemented but not dropdown or extra information is displayed**
   - **Capture Method**: Choose between "Motion Detection" (with sensitivity) or "Time-lapse" (with interval). **Not implemented (New feature)**
   - **Default AI Model**: Select a default AI model for the project. **Not implemented (New feature)**
- **Offline Creation**: Projects can be created fully offline and are queued for synchronization. **Implemented but not tested**
- **Automatic Admin**: The creator of the project automatically becomes its first Project Admin. **Implemented**
- Remove privacy level as all projects for MVP2 are set to private only visible to project members. **Not implemented (New feature)**

**Intended State**: Same as current

**Implementation**: Task 12 - Projects CRUD Operations
**Status**: TBC by AL
**Source**: implementation-spec-v1.4.md Section 5.5
**Completion**: October 9, 2025


---

#### 3.3 View and Edit Project Details
**Description**: View detailed project information and edit settings (Project Admins only).

**Current State**: Partially implemented (details to match schema updates)
- **Viewing (All Members)**:
  - Displays project name, description, and settings. **Implemented**
  - Shows lists of team members and deployments. **Implemented**
  - All details are viewable offline. **Implemented but not tested**
- **Editing (Project Admins only)**:
  - The "Edit" button is only visible to Project Admins. **Implemented but not tested**
  - Admins can edit the project name, description, and settings like "Is Baited?" and "Sampling Design". **Implemented**
  - Admins can configure capture methods ("Motion Detection" or "Time-lapse") and select a default AI model. **Not Implemented (new feature)**
  - Changes can be made offline and are queued for synchronization. **Implemented but not tested**

**Intended State**: Fully implemented as described.

**Implementation**: Task 12 & 14
**Status**: TBC by AL
**Source**: implementation-spec-v1.4.md Section 5.5

---

### Team Management (Project Level)

#### 4.1 View Project Members
**Description**: See who's on the project team

**Current State**: Implemented not tested
- List all project members
- Show member name and email
- Display user role (Project Admin/Member)
- Works offline with cached data

**Intended State**: Same as current

**Implementation**: Task 13 - Project Member Management
**Status**: TBC by AL
**Source**: implementation-spec-v1.4.md Section 5.6
**Completion**: January 11, 2025

---

#### 4.2 Add Project Members
**Description**: Invite team members to join project

**Current State**: Partially implemented (new feature)
- **Add Existing Users**: Project Admins can search for and add any existing user from within their organization to the project. **Not implemented (New feature)**
- **Assign Role**: The Admin assigns a role (Project Admin or Project Member) during the invitation. **Implemented not tested**
- **Pending Status**: The invited user appears in the member list with a "Pending" status until they accept. **Not implememented (New feature)**
- **Acceptance Required**: The user is only added to the project after they accept the invitation through the in-app notification center. **Not implememented (New feature)**
- **Admin Control**: Only Project Admins can add members. **Implemented not tested**
- **No New User Invites**: Project Admins cannot invite new users via email. **(New clarification)**

**Intended State**: Same as current (awaiting backend integration)

**Implementation**: Task 13 - Project Member Management
**Status**: TBC by AL
**Source**: implementation-spec-v1.4.md Section 5.6

---

#### 4.3 In-App Project Invitations
**Description**: A notification center for users to view and manage their pending project invitations.

**Current State**: Not implememented (New feature)
- **Notification Indicator**: A badge on the Side Drawer Menu icon indicates new invitations. **Not implememented (New feature)**
- **Notifications Screen**: A dedicated screen, accessible from the side menu, lists all pending invitations. **Implememented**
- **Invitation Details**: Each item shows the project name, the inviting Admin, and the assigned role. **Not implememented (New feature)**
- **Actions**: Users can "Accept" or "Decline" an invitation directly from this screen. **Not implememented (New feature)**
- **Acceptance**: Accepting an invitation adds the user to the project team and removes the item from the list. **Not implememented (New feature)**
- **Declined**: Declining removes the invitation. **Not implememented (New feature)**

**Intended State**: Same as planned.

**Implementation**: To be scheduled.
**Source**: User request for in-app invitation management.
---

#### 4.3 Remove Project Members
**Description**: Remove team members from project

**Current State**: TBC by AL
- Remove button for each member
- Confirmation dialog before removal
- Cannot remove yourself
- Only Project Admin can remove members

**Intended State**: Same as current (awaiting backend integration)

**Implementation**: Task 13 - Project Member Management
**Source**: implementation-spec-v1.4.md Section 5.6

---

#### 4.4 Change Member Roles
**Description**: Promote members to admin or demote admins

**Current State**: TBC by AL
- Change between Project Admin and Project Member
- Real-time role updates
- Only Project Admin can change roles

**Intended State**: Same as current (awaiting backend integration)

**Implementation**: Task 13 - Project Member Management
**Source**: implementation-spec-v1.4.md Section 5.6

---

### Device & Deployment Workflows
#### 5.0 Camera Preparation Workflow (Pre-Deployment)
**Description**: 2-step process for checking and configuring cameras before field deployment

**Workflow Philosophy**: Ensure cameras are field-ready before deployment to prevent wasted trips

**Current State**: TBC by AL
- **Step 1: Device Selection**: Scan for nearby available cameras via Bluetooth
- **Step 2: Camera Workbench**: Comprehensive device preparation screen including:
  - View device name
  - View device ID (read-only)
  - Associate camera with a project
  - Check battery level and SD card space
  - View/update firmware version
  - View installed AI model (matches project default)
  - Test camera function with preview photo
  - Verify LoRaWAN registration status (pre-provisioned by admin)

**Data Management**:
- Test photos deleted after preview to conserve storage
- Device configuration synced when online

**User Flow**: Accessible from Devices Screen or triggered automatically during Start Deployment if device unprepared

**Intended State**: Same as planned

**Implementation**: Task 20 - BLE Communication & Sync
**Source**: app-screen-guide.md Section 3 - Prepare and Test (Camera Workbench)

#### 5.1 Start Deployment Wizard (4-5 Steps)
**Description**: Guided process to deploy a camera in the field
**Workflow Philosophy**: The wizard is designed to get the physical camera setup right first (pairing, connectivity, and field of view) before asking the user for metadata. This ensures the most critical, in-field tasks are prioritized.

**Current State**: TBC by AL
- **Step 1: Device Selection & Pairing**: Select an available camera from a list of nearby Bluetooth devices.
- **Step 2: Connectivity Setup**: Choose to enable LoRaWAN for remote status updates or operate in an offline-only mode. Includes an option to test signal reception.
- **Step 3: Camera View & Adjustment**: Use a test photo preview from the camera to physically adjust its position and field of view until satisfied.
- **Data Management**: Test photos taken during this step are for temporary preview only and are stored in a dedicated "test" folder on the SD card to distinguish them from deployment data.
- **Step 4: Location**: Set the deployment's GPS coordinates on a map, name the site, and take a photo of the deployed camera *with the phone* to help with later retrieval.
- **Data Management**: Photos taken during this step are stored in the mobile phone so that they can be displayed at a later time for finding the Wildlife Watcher.
- **Step 5: Deployment Details & Submit**: Configure the deployment name and review a summary of all entered information. Tapping "Submit" finalizes the deployment, which configures the camera and saves the record. Project, start time, and capture method are set at the project level and are not configured during deployment.

**Intended State**: Same as planned
- Works completely offline
- Auto-captures GPS when available
- Manual coordinate entry option
- Progress indicator shows current step
- Can go back to edit previous steps
- Final submission saves the record locally, adds it to the sync queue, and sends the configuration to the camera via BLE.

**Implementation**: Task 15 - Deployment Workflow (4-5-step wizard)
**Source**: app-screen-guide.md Section 3 - Start Deployment Wizard

---

#### 5.2 End Deployment
**Description**: Mark a camera deployment as finished
**Workflow Philosophy**: A simple and efficient process for field use, ensuring the user is ending the correct deployment and capturing final notes before retrieving the hardware.

**Current State**: TBC by AL
- **Step 1: Device Selection**: The user initiates the flow and is presented with a list of nearby Bluetooth devices, identical to the first step of the Start Deployment wizard. Tapping a camera verifies it's part of an active deployment the user has access to.
- **Step 2: Confirmation & Finalization**:
  - **Confirmation**: The screen displays key details of the active deployment (Deployment Name, Project Name, Start Date) to prevent errors.
  - **Retrieval Notes**: An optional text box allows the user to add notes about the retrieval (e.g., "SD card was full," "Device damaged by animal").
  - **Submission**: Tapping the final "End Deployment" button marks the deployment as "Ended," makes the camera "Available" again for a new deployment, and queues the change for synchronization. The user is then taken to the Deployment Details screen to see a final summary.
- **Disarming**: The camera is automatically "disarmed" (motion detection disabled) upon ending the deployment.
- Works completely offline.

**Intended State**: Same as planned

**Implementation**: Task 17 - Field Validation & End Deployment
**Source**: app-screen-guide.md Section 3 - End Deployment Flow

---

#### 5.3 View Deployments List
**Description**: See all deployments in a project

**Current State**: TBC by AL
- Filter: Active, Ended, All
- Sort by: Date, Name, Status, Project
- Card view with key info
- Status indicators (Active, Ended)
- Offline viewing supported

**Intended State**: Same as planned

**Implementation**: Task 15 + Task 18
**Source**: implementation-spec-v1.4.md Section 5.7

---

#### 5.4 View Deployment Details
**Description**: See complete deployment information

**Current State**: TBC by AL
- All deployment details from wizard
- GPS coordinates with map view
- Sampling design settings
- Camera device information with battery status and sd card information if deployment active and connected to lorawan
- "End Deployment" button for active deployments.

**Intended State**: Same as planned

**Implementation**: Task 18 - Deployment & Device Management
**Source**: implementation-spec-v1.4.md Section 5.7

---

#### 5.5 Map View of Deployments
**Description**: Visual map showing deployment locations

**Current State**: TBC by AL
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
**Status**: TBC by AL
**Blocker**: Google Cloud Console setup required
**Source**: implementation-spec-v1.4.md Section 5.7

### Data Management Policies

#### Photo Storage Strategy

**Test Photos (Camera Preview)**:
- **Purpose**: Verify camera function and clear lens before deployment
- **Taken With**: Wildlife Watcher camera (via BLE command)
- **Storage**: Temporary preview only
- **Deletion Policy**: Automatically deleted from app and camera SD card after viewing to conserve space
- **Rationale**: Preview photos serve no long-term purpose and waste storage

**Deployment Setup Photos**:
- **Purpose**: Document camera location and hiding spot for retrieval
- **Taken With**: User's phone camera
- **Storage**: 
  - Low-resolution preview stored locally for offline viewing
  - Full-resolution uploaded to cloud when online
  - Can be downloaded on-demand when needed
- **Deletion Policy**: Retained for life of deployment, deleted when deployment archived
- **Rationale**: Critical for finding cameras in field, must persist

**Detection Event Photos** (Future Enhancement):
- **Purpose**: Animal identification evidence from AI model
- **Taken With**: Wildlife Watcher camera (automatic trigger)
- **Storage**: SD card only, synced to cloud periodically
- **Deletion Policy**: Retained according to project settings
- **Rationale**: Primary research data, must be preserved

---

### Device Management

#### 6.1 Device Status Lifecycle
**Description**: Cameras exist in one of three states

**Device States**:
- **Available**: Not deployed, ready for preparation or deployment. Devices enter this state after deployment ends or after Camera Workbench preparation.
- **Deployed**: Currently part of an active deployment in the field
- **In Preparation**: Connected to user's phone in Camera Workbench (temporary state)

**Status Transitions**:
- Available → In Preparation (via "Prepare and Test" button)
- In Preparation → Available (via "Finish Preparation" button)
- Available → Deployed (via Start Deployment wizard)
- Deployed → Available (via End Deployment flow)

**Current State**: TBC by AL
**Source**: app-screen-guide.md Section 4 - Device Details Screen

---

#### 6.2 View Deployed Devices
**Description**: The main view of the "Devices" screen lists all cameras that are actively deployed in projects the user is a member of. This gives field staff a quick overview of their active hardware.

**Current State**: TBC by AL
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

#### 6.3 Prepare and Test Nearby Devices
**Description**: A prominent button allows users to scan for nearby, non-deployed cameras to prepare them for fieldwork. This opens a "Camera Workbench" screen where a user can see and manage all aspects of a single camera before deployment.

**User Capabilities**:
- **View Camera Status**: See battery level, SD card storage, and firmware version.
- **Test Camera**: Take a test photo to ensure the camera's view is clear and preview it.
- **Manage Project Association**: Assign the camera to a specific project. The app includes safeguards to prevent associating a camera with a project the user doesn't have access to.
- **Update Firmware**: If a newer firmware version is available, the user can update the camera directly from the app.
- **Verify Remote Updates**: Check the status of the camera's pre-provisioned LoRaWAN registration.
- **Configure AI Model**: Project Admins can change the AI detection model loaded on the camera.
- **Name Device**: Give the camera a custom name for easy identification.

**Current State**: TBC by AL
- Scan for nearby cameras via Bluetooth
- Connect to selected camera
- Take a test photo to check for obstructions
- Connection status indicator
- Signal strength display

**Intended State**: Fully functional workbench screen integrating all preparation steps.

**Implementation**: Task 20 - BLE Communication & Sync
**Note**: BLE manager exists, needs UI workflow integration.
**Source**: implementation-spec-v1.4.md Section 5.8
**Technical Details**: See `project-context\development-context\documentation-cleanup\device-preparation-workflow.md` for a detailed breakdown of this feature.

---

### AI & Data Management
 
#### 7.1 Select Project AI Model (Project Admin)
**Description**: From within the mobile app, a Project Admin can select which of the organization's available AI models will be used for all deployments within that specific project.

**Current State**: TBC by AL
- View available models in organization.
- See model details (name, version, detection types).
- Assign a specific model to a project.
- One model per project.

**Intended State**: Same as planned.

**Implementation**: Task 14 or later
**Source**: implementation-spec-v1.4.md Section 14, user-roles-permissions.md

---

### Offline & Sync Capabilities

#### 8.1 Offline Data Storage
**Description**: Local database for working without internet

**Current State**: TBC by AL
- SQLite database on device
- Stores projects, deployments, devices
- User authentication data cached
- Organization information cached
- Project member lists cached
- **Deployment Photos**: To help find cameras, a photo of the setup is taken with the user's phone. A low-resolution preview is stored locally for offline viewing, minimizing storage space. The full-quality photo is uploaded to the cloud and can be downloaded on demand when an internet connection is available.

**Intended State**: Same as current

**Implementation**: Task 11 - Offline SQLite Foundation
**Status**: TBC by AL
**Source**: implementation-spec-v1.4.md Section 6
**Completion**: September 30, 2025

---

#### 8.2 Automatic Background Sync
**Description**: Sync local changes to the cloud based on user-defined settings.

**Current State**: TBC by AL
- Redux-offline middleware active
- Background sync queue
- User-configurable: Supports auto-sync, ask before sync, and Wi-Fi only sync.
- Automatic retry on connection
- Optimistic UI updates
- Rollback on server errors
- Rate limiting to prevent server overload

**Intended State**: Same as current

**Implementation**: Task 11 - Offline SQLite Foundation
**Status**: TBC by AL
**Source**: implementation-spec-v1.4.md Section 6

---

#### 8.3 Sync Status Indicators
**Description**: Visual feedback about sync state

**Current State**: TBC by AL
- Sync status indicator in UI
- "Synced" / "Syncing" / "Offline" states
- Last sync timestamp
- Manual sync trigger button
- Error notifications if sync fails

**Intended State**: Same as current

**Implementation**: Task 11 - Offline SQLite Foundation
**Source**: implementation-spec-v1.4.md Section 6

---

#### 8.4 Conflict Resolution
**Description**: Handle when offline changes conflict with server

**Current State**: TBC by AL
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


### Remote Monitoring (LoRaWAN)

#### 9.1 Remote Battery Level Monitoring
**Description**: Receive camera battery status via LoRaWAN
**Note**: The specific payload for LoRaWAN messages is pending discussion and will be defined as this feature becomes a higher priority.

**Current State**: TBC by AL
- Webhook receives battery level updates
- Battery percentage stored
- Low battery alerts
- Historical battery data
- Display in device and deployment list

**Intended State**: Same as planned

**Implementation**: Task 20+ (LoRaWAN integration)
**Source**: implementation-spec-v1.4.md Section 7.3

---

#### 9.2 Remote Operational Statistics Monitoring
**Description**: Track camera operational data via LoRaWAN

**Current State**: TBC by AL
- Webhook receives key statistics like number of images taken.
- Data is stored against the deployment record.
- Full card alerts
- Historical storage data
- Display in device and deployment list

**Intended State**: Same as planned

**Implementation**: Task 20+ (LoRaWAN integration)
**Source**: implementation-spec-v1.4.md Section 7.3

---

### App Utilities

#### 10.1 Developer Menu (Environment-Gated)
**Description**: Special debugging tools (development builds only)

**Current State**: TBC by AL
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
#### 10.2 In-App Feedback
**Description**: Submit feedback, bug reports, or suggestions to the Wildlife Watcher team.

**Current State**: TBC by AL
- Accessible from the side drawer menu.
- Large text area for the user's message.
- Sends feedback to a nominated support email address.
- Displays a confirmation message on success.
- Includes error handling with a retry option for network issues.

**Intended State**: Same as current.

**Implementation**: Part of core app features.
**Source**: app-screen-guide.md Section 5 - Side Drawer Menu & Feedback Screen.

---

#### 10.3 User Settings
**Description**: Allow users to customize app behavior, particularly for data synchronization, to manage mobile data usage.

**Current State**: TBC by AL
- Accessible from the side drawer menu.
- **Sync on Wi-Fi only**: A switch to prevent uploads over cellular data.
- **Ask before syncing**: A switch to prompt for confirmation before large data uploads.
- **Automatic sync**: The default behavior where the app syncs automatically when an internet connection is available.

**Intended State**: Same as current.

**Implementation**: Part of core app features.
**Source**: app-screen-guide.md Section 4 - Settings Screen.

---

## Data & Security Architecture

### How Your Data is Stored and Protected

**The Problem We're Solving:**
Field research data is valuable and sensitive—camera locations, deployment details, project information, and team coordination. This data needs to be secure, well-organized, and accessible only to authorized team members.

**Our Solution:**
Multi-layered security architecture with organization-based access control, backed by professional-grade database technology.

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


### 2-Tier Security System (MVP2 Version)

For the mvp2, the app uses a simple, project-focused permission system:

#### 1. Project Admin (Project Level)

#### 2. Project Member (Project Level)
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

**Security Status**: TBC by AL
- **Overall Score**: 90/100 - Excellent
- **Coverage**: 71% of tables (10/14) with comprehensive RLS policies
- **Remaining Work**: 4 lookup tables need policies (1-2 hours to complete)
- **Protection Level**: Multi-tenant isolation 98% effective

---

### What Data We Store

#### Core Business Information
**Organizations** (Beta: "General" Organization)
- For the mvp2, all users and projects belong to a single "General" organization.
- *Future*: Will store details for multiple research institutions like "Serengeti Conservation Trust".

**Users** (Team members and administrators)
- **Beta**: All users belong to the "General" organization.
- *Future*: Will support membership in multiple organizations.
- *Example record*: "Dr. Chen (dr.chen@wildlife.app), Project Admin"

**Projects** (Research initiatives)
- Creation date, last update, project owner
- Organization link (automatic isolation)
- *Example record*: "Lion Population Study 2025" - 5 team members, 12 active deployments

**Deployments** (Camera instances in the field)
- Deployment name, start/end dates
- GPS coordinates with professional mapping (PostGIS)
- Sampling design (motion detection vs timelapse)
- Link to project, device, and creator
- **Setup Photo**: A photo of the deployed camera setup, taken with the user's phone to help with retrieval.
- *Example record*: "Water Hole #3" - Active since Jan 10, 2025, GPS: -2.3333, 34.8333

**Devices** (Physical camera equipment)
- Device ID, name/nickname
- Current status (available, in use, maintenance)
- Last connection date
- Battery level and SD card usage (via LoRaWAN)
- LoRaWAN Details: Secure registration keys for sending remote status updates.
- *Example record*: "Camera WW-00123 (Acacia Station)" - Battery 87%, SD Card 42% full

**Project Members** (Team assignments)
- User-to-project relationships
- Role within project (Admin or Member)
- Assignment date

#### Reference Data (Configuration Options)
**Roles** (2 system roles for Beta)
- Project Admin, Project Member

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
- **Linked to**: The "General" organization automatically (via organization_id).

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

**Overall Progress**: TBC by AL

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

**Production Readiness**: TBC by AL
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
   - **Risk**: TBC by AL
   - **Fix**: Enable RLS with read-only policies
   - **Time**: 1-2 hours
   - **Status**: TBC by AL

2. 🟡 **12 Functions Missing Injection Protection** ⚠️ MEDIUM PRIORITY
   - **Risk**: TBC by AL
   - **Fix**: Add `SET search_path` to all database functions
   - **Time**: 1-2 hours
   - **Status**: TBC by AL
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
- **Completed**: TBC by AL
- **In Progress**: 0 tasks (Task 14 ready to start)
- **Remaining**: 9 tasks (39.1%)
- **Projected Completion**: ~8 working days remaining

---

### Progress by Development Stream

#### Stream A: Project Management (Tasks 12-14)
**Focus**: Project CRUD, team management, organization switching

**Status**: TBC by AL

| Task | Feature | Status | Hours | Completion |
|------|---------|--------|-------|------------|
| 12 | Projects CRUD Operations | ✅ Complete | 11.9/15.0 | Oct 9, 2025 |
| 13 | Project Member Management | ✅ Complete | 10.25/12-15 | Jan 11, 2025 |
| 14 | Organisation Switching & Details | ⏳ Pending | 0/6.0 | - |

**Key Achievement**: Tasks 12 & 13 completed 22% ahead of schedule (22.15 hrs vs 27-30 hrs estimated)

---

#### Stream B: Deployment Workflows (Tasks 15-17)
**Focus**: 6-step deployment wizard, field validation

**Status**: TBC by AL

| Task | Feature | Status | Hours | Notes |
|------|---------|--------|-------|-------|
| 15 | Deployment Wizard (6 steps) | ⏳ Pending | 0/10.0 | Ready to start |
| 16 | Device Configuration | ⏳ Pending | 0/8.0 | - |
| 17 | Field Validation & End | ⏳ Pending | 0/6.0 | - |

**Total Estimated**: 24 hours remaining

---

#### Stream C: Devices & Maps (Tasks 18-20)
**Focus**: Device management, map visualization, BLE sync

**Status**: TBC by AL

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

**Status**: TBC by AL

| Task | Feature | Status | Hours |
|------|---------|--------|-------|
| 21 | E2E Testing (Maestro) | ⏳ Pending | 0/8.0 |
| 22 | Performance Optimization | ⏳ Pending | 0/4.0 |
| 23 | Production Readiness | ⏳ Pending | 0/4.0 |

**Total Estimated**: 16 hours remaining

---

### Foundation Work (Tasks 1-11)
**Focus**: App setup, auth, offline infrastructure

**Status**: TBC by AL

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
| **Estimation Accuracy** | TBC by AL | ✅ Excellent |
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

**Impact**: TBC by AL
- Users must re-login after UUID alignment (Task 11.8)
- Ensured before wide deployment
- Prevents data corruption

**Status**: ✅ Resolved (September 17, 2025)

**Why This Matters**: Data type mismatches cause silent data corruption. Catching this early prevented database integrity issues.

**Source**: MVP2-METRICS-TRACKER.md Task 11.8 section

## Navigation Structure

### Bottom Tab Bar
The primary navigation for the app, always visible after login:
- **Maps**: Home screen, deployment overview, start/end deployment buttons
- **Projects**: Project list, create new project
- **Deployments**: Deployment list with filters (All/Active/Ended)
- **Devices**: Device list, prepare and test button

### Side Drawer Menu
Accessible via hamburger icon (top-left), provides:
- **Profile**: View account information (read-only)
- **Settings**: Configure sync preferences
- **Feedback**: Submit bug reports and suggestions
- **Sign Out**: Secure logout
- **App Version**: Display current version number
- **Sync Status Indicator**: Shows synced/syncing/offline/error states

### Screen Transitions
Key navigation flows:
- Tapping project card → Project Details Screen
- Tapping deployment card → Deployment Details Screen
- Tapping device card → Device Details Screen
- Start Deployment button → 4-5 step wizard (full-screen takeover)
- End Deployment button → 2-step confirmation flow
- Prepare and Test → 2-step Camera Workbench flow

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

#### 2. Task 15: 4-5-Step Deployment Wizard
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
**Blocker**: TBC by AL
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
- **Status**: TBC by AL
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
- **Status**: TBC by AL
- Documentation alignment across 25 files
- Compliance audit (65/100 score established)
- Mobile read-only + web portal architecture confirmed
- **Time**: 3.5 hrs (unplanned but critical)

**Source**: specifications/revisions/ folder

---

### Current Status (January 2025)

**Overall Progress**: TBC by AL
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

**Projected MVP Completion**: TBC by AL
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
## Future Enhancements 
### Web Portal Features

**For System Administrators (WW Admin)**:
- Create and manage user accounts
- Assign users to organizations
- Manage system-level roles (WW Admin, Organisation Administrator) 
- System-wide configuration
- Password reset forms for users

**For Organisation Administrators**:
- Upload new AI detection models
- Version and update existing models
- Manage model availability for organizations

### User roles
to expand from three to five. The two extra roles and their capabilties are:

#### 4. Organisation Administrator
**What they do**: Manage projects. Future enhancements for this role will include managing users and AI models at an organization level.

**Capabilities**:
- Create new projects within their organization.

**Future Enhancement (via Web Portal)**:
- Add/remove users from the organization.
- Upload, version, and manage the AI detection models available to the organization.
- Has administrative access to all projects within their organization.

**Real-World Example (Future)**:
*Alex will be the administrator for the Kea Conservation Trust. He will onboard new researchers by adding them to the Trust's organization via the web portal. He will also collaborate with machine learning specialists to upload and manage the custom bird detection models that all projects in the Trust can use.*

**Current Status**: ⏳ PENDING (Future Enhancement)

---

#### 5. WW Admin (System Administrator)
**What they do**: System-wide management and support

**Mobile App Capabilities** (Limited):
- View all projects across all organizations (read-only)
- Navigate to web portal for administrative tasks
- No direct editing or management in mobile app
 
**Web Portal Capabilities (Future Enhancement)**:
- Create and manage user accounts.
- Create and manage organizations.
- Assign users to organizations.
- Assign system-level roles (WW Admin, Organisation Administrator).
- Send login invitations to new users.
- System configuration and monitoring.
- Access system logs.

**Real-World Example (Future)**:
*Jordan is the Wildlife.ai system administrator. When a new conservation organization wants to join, he will create their organization account and assign their initial organisation admin user via the web portal. If a user needs a password reset or reports an issue, Jordan will be able to handle it through the web portal.*

**Current Status**: TBC by AL

**Key Architectural Change**: Originally planned with full CRUD capabilities in mobile app, corrected in September 2025 to read-only mobile + web portal management to prevent security issues and maintain proper separation of concerns.

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
