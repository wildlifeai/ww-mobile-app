# Wildlife Watcher App - User Roles & Permissions Specification

## Document Version
- Version: 1.1
- Date: 4 Sept 2025
- Status: MVP Specification

## Executive Summary

The Wildlife Watcher (WW) mobile app implements a hierarchical role-based access control system with four primary roles: WW Admin, Model Manager, Project Admin, and Project Member. This document defines the complete role structure, permissions, and implementation guidelines for the MVP release.

## 1. Role Definitions

### 1.1 WW Admin (System Administrator)

**Scope**: Application-wide administrative role

**Default Organization**: wildlife.ai

**Core Responsibilities**:
- System-wide user management
- Organization management
- System-level role assignment (WW Admin and Model Manager only)
- System configuration and monitoring

**Key Characteristics**:
- WW Admins default to the wildlife.ai organization
- Can be assigned to one additional organization where they can take on other roles
- When acting purely as WW Admin, no project access is required
- When assigned to another organization, subject to the capabilities of their assigned roles in that organization

**Capabilities**:
- Create, read, update, delete (CRUD) users across the system
- CRUD organizations
- Assign users to organizations
- Assign system-level roles to users (Model Manager, WW Admin only - NOT project roles)
- Send login notifications to newly created users
- Access system logs and diagnostics

**Note**: Project roles (Project Admin, Project Member) are assigned by Project Admins, not WW Admins

### 1.2 Model Manager

**Scope**: Organization-level role

**Core Responsibilities**:
- AI model lifecycle management for the organization
- Model repository maintenance
- Model versioning and updates

**Key Characteristics**:
- Operates at organization level only (NOT project level)
- Accesses system via web interface (not mobile app) for MVP
- No direct project interaction in MVP
- Models uploaded become available for Project Admins to assign
- Has no user viewing capabilities unless also assigned to a project

**Capabilities**:
- Upload new AI models to organization repository
- Update/version existing models
- Delete unused models
- View model metadata
- Manage which models are available to the organization

### 1.3 Project Admin

**Scope**: Project-level role

**Core Responsibilities**:
- Project configuration and management
- Team member management within projects
- Model assignment to projects
- Deployment oversight

**Key Characteristics**:
- Users become Project Admin by creating a project OR being assigned by another Project Admin
- Can be Project Admin for multiple projects
- Has all Project Member capabilities plus administrative functions

**Capabilities**:
- Create new projects
- Edit project details (for own projects)
- Add/remove project members
- Assign Project Admin or Project Member roles to other users in projects
- Select and assign models from organization repository to projects
- Delete deployments
- Archive/delete projects (with restrictions)
- All Project Member capabilities

### 1.4 Project Member

**Scope**: Project-level role

**Core Responsibilities**:
- Field operations and deployment execution
- Device management and testing
- Data collection activities

**Key Characteristics**:
- Basic operational role within projects
- Can be assigned to multiple projects
- Can create new projects (becoming Project Admin of created projects)

**Capabilities**:
- View assigned projects
- Start/end deployments
- Add/register devices
- Test device connections
- Update device firmware
- deploy AI model to camera device
- View deployment lists and details
- Access camera views
- Sync offline data

## 2. Organizational Structure Rules

### 2.1 Organization Assignment Rules

1. **WW Admin Users**:
   - Automatically belong to wildlife.ai organization
   - Can be assigned to ONE additional organization
   - Can hold other roles within their assigned organizations

2. **Non-WW Admin Users**:
   - Must belong to exactly ONE organization
   - Cannot be assigned to multiple organizations
   - Email/authentication is tied to their single organization
   - Require separate email accounts for different organizations (MVP limitation)

3. **Organization Membership**:
   - All users must be assigned to an organization
   - Organization assignment is required before project assignment
   - Users without roles exist in the system but have no capabilities

### 2.2 Role Assignment Rules

1. **Role Hierarchy**:
   ```
   System Level: WW Admin (wildlife.ai)
   ↓
   Organization Level: All Users + Model Manager role
   ↓
   Project Level: Project Admin / Project Member roles
   ```

2. **Multiple Roles**:
   - Users can hold multiple roles within their organization
   - Example: User can be Model Manager + Project Admin + Project Member
   - Capabilities are cumulative (union of all assigned roles)

3. **Project Creation**:
   - Any Project Member can create a new project
   - Project creator automatically becomes Project Admin
   - No approval required for project creation (MVP)

## 3. User Lifecycle Management

### 3.1 User Creation Flow

1. **WW Admin Action**:
   - Creates user account with name and email
   - Assigns user to organization
   - Can assign ONLY system-level roles: Model Manager or WW Admin
   - System sends secure invitation email

2. **User Onboarding**:
   - User receives email with secure registration link
   - Sets password on first login
   - Views assigned organization and projects   

3. **Security Considerations**:
   - Use time-limited, single-use registration tokens
   - **Expired Link Handling**:  User can request new link through login screen "Resend invitation" option     
   - Implement secure password reset flow if not done 
   - Leverage Supabase's built-in authentication features

### 3.2 Role Assignment Flow

1. **System Roles** (WW Admin, Model Manager):
   - Only WW Admins can assign
   - Immediate effect upon assignment

2. **Project Roles** (Project Admin, Project Member):
   - Project Admins assign within their projects
   - Only users from same organization can be added
   - Email notification sent upon assignment

## 4. Permission Matrix

### 4.1 User Management

| Resource | Action | WW Admin | Model Manager | Project Admin | Project Member |
|----------|--------|----------|---------------|---------------|----------------|
| Users | Create | ✅ | ❌ | ❌ | ❌ |
| Users | View (all) | ✅ | ❌ | ❌ | ❌ |
| Users | View (same org) | ✅ | ❌ | ✅ | ✅ |
| Users | View (same project) | ✅ | ❌ | ✅ | ✅ |
| Users | Update | ✅ | ❌ | ❌ | ❌ |
| Users | Delete/Deactivate | ✅ | ❌ | ❌ | ❌ |
| Users | Assign System Roles | ✅ | ❌ | ❌ | ❌ |
| Users | Assign Project Roles | ❌ | ❌ | ✅ | ❌ |
| Own Profile | Update | N/A (MVP) | N/A (MVP) | N/A (MVP) | N/A (MVP) |

*Note: Profile update feature not available in MVP

### 4.2 Organization Management

| Resource | Action | WW Admin | Model Manager | Project Admin | Project Member |
|----------|--------|----------|---------------|---------------|----------------|
| Organizations | Create | ✅ | ❌ | ❌ | ❌ |
| Organizations | View (all) | ✅ | ❌ | ❌ | ❌ |
| Organizations | View (own) | ✅ | ✅ | ✅ | ✅ |
| Organizations | Update | ✅ | ❌ | ❌ | ❌ |
| Organizations | Delete | ✅ | ❌ | ❌ | ❌ |

### 4.3 Model Management

| Resource | Action | WW Admin | Model Manager | Project Admin | Project Member |
|----------|--------|----------|---------------|---------------|----------------|
| AI Models | Upload | ❌* | ✅ | ❌ | ❌ |
| AI Models | View (org level) | ❌* | ✅ | ✅ | ❌ |
| AI Models | Update/Version | ❌* | ✅ | ❌ | ❌ |
| AI Models | Delete | ❌* | ✅ | ❌ | ❌ |
| AI Models | Assign to Project | ❌ | ❌ | ✅ | ❌ |
| AI Models | Remove from Project | ❌ | ❌ | ✅ | ❌ |

*Unless WW Admin also has Model Manager role in the organization
*Note: Model performance metrics not available in MVP

### 4.4 Project Management

| Resource | Action | WW Admin | Model Manager | Project Admin | Project Member |
|----------|--------|----------|---------------|---------------|----------------|
| Projects | Create | ❌** | ❌** | ✅ | ✅ |
| Projects | View (own projects) | ❌** | ❌** | ✅ | ✅ |
| Projects | View (all in org) | ❌ | ❌ | ❌ | ❌ |
| Projects | Update Details | ❌ | ❌ | ✅ (own) | ❌ |
| Projects | Delete (empty) | ❌ | ❌ | ✅ (own) | ❌ |
| Projects | Archive | ❌ | ❌ | ✅ (own) | ❌ |
| Project Members | Add | ❌ | ❌ | ✅ | ❌ |
| Project Members | Remove | ❌ | ❌ | ✅ | ❌ |
| Project Members | Change Role | ❌ | ❌ | ✅ | ❌ |

**Only if also assigned a project role in the organization

### 4.5 Deployment Management

| Resource | Action | WW Admin | Model Manager | Project Admin | Project Member |
|----------|--------|----------|---------------|---------------|----------------|
| Deployments | Create/Start | ❌** | ❌** | ✅ | ✅ |
| Deployments | View (list) | ❌** | ❌** | ✅ | ✅ |
| Deployments | View (details) | ❌** | ❌** | ✅ | ✅ |
| Deployments | End/Stop | ❌** | ❌** | ✅ | ✅ |
| Deployments | Delete | ❌ | ❌ | ✅ | ❌ |
| Deployment Data | View | ❌** | ❌** | ✅ | ✅ |
| Deployment Data | Export | N/A (MVP) | N/A (MVP) | N/A (MVP) | N/A (MVP) |
| Deployment Logs | View | ✅ | ❌ | ❌ | ❌ |

**Only if also assigned a project role in the organization

### 4.6 Device Management

| Resource | Action | WW Admin | Model Manager | Project Admin | Project Member |
|----------|--------|----------|---------------|---------------|----------------|
| Devices | Add/Register | ❌** | ❌** | ✅ | ✅ |
| Devices | View List | ❌** | ❌** | ✅ | ✅ |
| Devices | View Details | ❌** | ❌** | ✅ | ✅ |
| Devices | Update Firmware | ❌** | ❌** | ✅ | ✅ |
| Devices | Test Connection | ❌** | ❌** | ✅ | ✅ |
| Devices | Remove/Unlink | ❌ | ❌ | ✅ | ❌ |
| Camera View | Access | ❌** | ❌** | ✅ | ✅ |

**Only if also assigned a project role in the organization
*Note: Device diagnostics not available in MVP

### 4.7 Data Sync & Offline

| Resource | Action | WW Admin | Model Manager | Project Admin | Project Member |
|----------|--------|----------|---------------|---------------|----------------|
| Offline Data | Sync | ❌** | ❌** | ✅ | ✅ |
| Sync Status | View | ❌** | ❌** | ✅ | ✅ |
| Sync Conflicts | Resolve | ❌ | ❌ | ✅ | ❌ |
| Cached Data | Clear | ❌** | ❌** | ✅ | ✅ |
| System Logs | View | ✅ | ❌ | ❌ | ❌ |

**Only if also assigned a project role in the organization

## 5. Special Considerations for MVP

### 5.1 Simplified Features

1. **No Generic User Role**: Users exist without roles but have no capabilities
2. **No Export Functions**: Data export not available in MVP
3. **No Cross-Project Visibility**: Users only see assigned projects
4. **Model Manager Web Only**: Model management via web interface, not mobile app
5. **Limited Logs**: System logs only available to WW Admin
6. **No Profile Updates**: User profile editing not available in MVP
7. **No Model Performance Metrics**: Model analytics not available in MVP
8. **No Device Diagnostics**: Device diagnostic views not available in MVP

### 5.2 Project Deletion Rules

1. **Empty Projects**: Can be deleted if:
   - No members assigned (except creator)
   - No deployments created
   - No devices linked
   - Essentially a "mistaken" creation

2. **Active/Ended Projects**: Can only be archived, not deleted

### 5.3 Initial System Setup

1. **Default WW Admin Users**:
   - adarsh@wildlife.ai
   - victor@wildlife.ai

2. **Database Requirements**:
   - Supabase RLS policies for WW Admin role
   - Initial data.sql script for default users
   - Role table population

## 6. Implementation Guidelines

### 6.1 Technical Implementation

```typescript
// Role type definitions
enum UserRole {
  WW_ADMIN = 'ww_admin',
  MODEL_MANAGER = 'model_manager',
  PROJECT_ADMIN = 'project_admin',
  PROJECT_MEMBER = 'project_member'
}

// Permission check implementation
interface PermissionCheck {
  resource: string;
  action: string;
  roles: UserRole[];
}

// Example permission checking function
function hasPermission(
  userRoles: UserRole[],
  resource: string,
  action: string
): boolean {
  const permission = permissions[resource]?.[action];
  return userRoles.some(role => permission?.includes(role));
}
```

### 6.2 Security Implementation

1. **Authentication**: Supabase Auth with secure tokens
2. **Row Level Security**: Implement RLS policies per role
3. **API Protection**: Role-based middleware checks
4. **Audit Logging**: Track all role assignments and changes

## 7. Open Questions for MVP

1. **Expired Invitation Links**: 
   - Should users be able to self-request new invitation links through the login screen?
   - Or should the system notify WW Admins to manually reissue invitations?

2. **User Profile Updates**:
   - Confirmation needed: Profile update feature is not available in MVP - correct?

## 8. Appendix

### 8.1 Glossary

- **Organization**: Top-level entity that groups users and projects
- **Project**: Research initiative with deployments and devices
- **Deployment**: Field session using WW cameras
- **Model**: AI model for wildlife detection/classification
- **Device**: WW camera hardware
- **System Roles**: WW Admin and Model Manager roles
- **Project Roles**: Project Admin and Project Member roles

### 8.2 Related Documents

- Wildlife Watcher Mobile App Implementation Specification
- WW-APP-USER-ROLES.md
- Figma Wireframes

### 8.3 Revision History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | Current | Initial consolidated specification | - |
| 1.1 | Current | Updated permissions, removed non-MVP features, clarified role assignments | - |

---

*End of Document*