# 🔄 Cross-Project Orchestration & Coordination Guide

**Created**: 2025-09-25
**Purpose**: Address feedback points 3-4 regarding orchestration between mobile app and backend projects

---

## 📋 Project Repository Structure

### Mobile App (This Repository)
- **Location**: `/home/adarsh/dev/wildlifeai/wildlife-watcher-mobile-app`
- **Active Branch**: `dev-mvp2-development-claude-flow-test`
- **Status**: Task 11.8 Complete (UUID alignment), Tasks 11.4-11.7 remaining foundation work
- **Role**: Specification creator, UI/UX implementation, API integration

### Backend Project (Separate Repository)
- **Location**: `/home/adarsh/dev/wildlifeai/wildlife-watcher-backend`
- **Active Branch**: `dev-mobile-app-mvp2-updates-claude-flow`
- **Status**: 98% deployment ready (Phase 2 AADF complete)
- **Role**: Database, APIs, Edge Functions, Supabase services implementation

### Cross-Project Communication Channel
**MVP2-Tasks Folder**: `~/wildlife-watcher-backend/project-context/MVP2-Tasks/`
- Formal specification handoff point
- Backend task tracking and status updates
- Cross-project dependency coordination
- Integration testing coordination

---

## 📊 Complete Supabase Services Requirements Matrix

### Core Database Services (All Tasks)
**Required For**: ALL tasks requiring data persistence
- **Service**: PostgreSQL with RLS (Row Level Security)
- **Components**: Tables, migrations, RLS policies, helper functions
- **Backend Work**: Schema updates, RLS policies, helper functions
- **Mobile Integration**: TypeScript types, REST/GraphQL API endpoints

### Authentication Service Updates
**Required For**: Tasks 12, 13, 14 (User/Role Management)
- **Service**: Supabase Auth + Custom user_roles system
- **Components**: Role assignment APIs, permission checking functions
- **Backend Work**: User role management functions, audit logging
- **Mobile Integration**: Role-based UI components, permission validation

### Storage Service (File Management)
**Required For**: Tasks 16, 17, 20 (Device firmware, AI models, deployment photos)
- **Service**: Supabase Storage with CDN optimization
- **Buckets Required**:
  - `firmware-files` - Device firmware updates (.bin, .hex files)
  - `ai-models` - Machine learning model files (.tflite, .onnx, .pt files)
  - `deployment-photos` - Field deployment validation photos (.jpg, .png)
  - `user-avatars` - User profile images
- **Components**: Upload policies, CDN optimization, thumbnail generation
- **Backend Work**: Storage bucket policies, file validation Edge Functions
- **Mobile Integration**: File upload/download UI, progress tracking, caching

### Edge Functions (Serverless Computing)
**Required For**: Multiple tasks requiring server-side processing

#### Admin Portal Edge Function (Tasks 13, 21)
- **Endpoint**: `/admin/*` - Web-based admin interface
- **Purpose**: WW Admin user management, system configuration
- **Authentication**: Service role for elevated admin operations
- **Components**: React-based admin UI served via Edge Function
- **Features**: User provisioning, organization management, system configuration

#### LoRaWAN Webhook Edge Function (Tasks 18, 20)
- **Endpoint**: `/lorawan/webhook` - Receive device status updates
- **Purpose**: Process camera status (battery level, SD card usage, GPS coordinates)
- **Authentication**: Webhook token validation from LoRaWAN provider
- **Components**: Message parsing, device status updates, alert triggers
- **Integration**: Updates device status in real-time for mobile app consumption

#### Password Reset Edge Function (Task 21)
- **Endpoint**: `/auth/reset-password` - Web form for password reset
- **Purpose**: Alternative to in-app password reset functionality
- **Components**: HTML form, email validation, secure token handling
- **Integration**: Complements mobile app password reset with web option

---

## 🔄 Detailed Orchestration Process Flow

### Phase 1: Specification Creation (Mobile App Repository)
**Responsible Agent**: `cross-project-coordinator` in mobile app repository

#### 1. Mobile Task Analysis
- Review task specification in `/project-context/development-context/MVP2/tasks/`
- Identify backend dependencies (Database, APIs, Storage, Edge Functions)
- Map specific Supabase service requirements from matrix above
- Create comprehensive integration test scenarios
- Document mobile implementation context for backend team

#### 2. Backend Specification Generation
- **Format**: Detailed markdown specification file
- **Location**: `~/wildlife-watcher-backend/project-context/MVP2-Tasks/task-XX-backend-spec.md`
- **Content Template**:
  ```markdown
  # Task XX Backend Specification

  ## Mobile App Context
  - Task Description: [from mobile task file]
  - Mobile Implementation: [UI/UX components being built]
  - Integration Points: [specific API endpoints needed]
  - User Stories: [affected user scenarios]

  ## Required Supabase Services
  - Database: [specific tables, RLS policies, functions needed]
  - Storage: [buckets, file types, policies, CDN requirements]
  - Edge Functions: [endpoints, authentication, processing logic]
  - Auth: [role changes, permission updates, new user flows]

  ## Detailed API Specification
  - REST Endpoints: [exact URL patterns with HTTP methods]
  - GraphQL Queries/Mutations: [if applicable]
  - Request/Response Schemas: [TypeScript interfaces]
  - Authentication Requirements: [JWT claims, role permissions]
  - Error Handling: [expected error codes and messages]

  ## Database Schema Changes
  - New Tables: [if any, with full column specifications]
  - Table Modifications: [column additions, constraint changes]
  - RLS Policy Updates: [organization isolation, role-based access]
  - Functions/Triggers: [business logic, validation, automation]

  ## Storage Requirements
  - Bucket Configuration: [policies, size limits, file types]
  - Upload Workflows: [validation, processing, CDN integration]
  - Security Policies: [access control, virus scanning if needed]

  ## Success Criteria
  - Backend Deliverables: [specific measurable outcomes]
  - Integration Test Requirements: [API testing scenarios]
  - Performance Benchmarks: [response times, throughput]
  - Security Validation: [penetration testing, access control verification]
  ```

#### 3. Backend Priority Assessment
- **CRITICAL**: Mobile development completely blocked without backend
- **HIGH**: Mobile can proceed with mock data temporarily
- **MEDIUM**: Backend enhancement for production readiness, not blocking development

### Phase 2: Backend Implementation (Backend Repository)
**Environment**: Separate VS Code instance in backend repository
**Process**: Backend team/agents execute specification with full independence

#### 1. Implementation Execution
- **Database Migrations**: Schema changes, new tables, column modifications
- **RLS Policy Updates**: Organization-scoped access, role-based permissions
- **API Endpoint Development**: REST/GraphQL endpoints with proper authentication
- **Edge Function Creation**: Admin Portal, LoRaWAN webhook, password reset functions
- **Storage Configuration**: Bucket policies, upload validation, CDN optimization
- **Type Generation**: Generate TypeScript definitions for mobile app integration

#### 2. Quality Validation (Backend)
- **Database Tests**: All pgTAP tests passing with >90% coverage
- **API Testing**: Endpoints tested with real authentication and data
- **Edge Function Testing**: Serverless functions deployed and validated
- **Storage Testing**: File upload/download workflows verified
- **Security Testing**: RLS policies, access control, permission validation
- **Performance Testing**: Response times, query optimization, load testing

#### 3. Status Communication
- Update `~/wildlife-watcher-backend/project-context/PROJECT-STATUS.md` with completion
- Mark backend specification as complete in MVP2-Tasks folder
- Generate and export TypeScript types for mobile app integration
- Document any API changes or deviations from specification
- Provide integration testing endpoints and test data

### Phase 3: Integration & Validation (Both Repositories)
**Coordination**: Both mobile and backend teams working together

#### 1. Mobile App Integration
- Import updated TypeScript types from backend repository
- Replace mock APIs with real backend endpoints
- Update authentication flows with real JWT tokens
- Test data synchronization operations (online/offline)
- Validate role-based access control throughout app

#### 2. End-to-End Testing
- **User Journey Testing**: Complete workflows through real backend
- **Offline/Online Sync**: Data consistency validation
- **Cross-Organization Security**: Data isolation verification
- **Performance Benchmarking**: Real-world usage scenarios
- **Error Handling**: Network failures, invalid data, edge cases

#### 3. Production Readiness
- **Security Audit**: Penetration testing, vulnerability assessment
- **Load Testing**: Production-scale data and concurrent users
- **Monitoring Setup**: Error tracking, performance monitoring, alerts
- **Deployment Pipeline**: CI/CD validation, environment promotion

---

## 🎯 Task-Specific Supabase Service Requirements

### Task 12: Project List & Management Interface
**Required Services**:
- **Database**: Project CRUD operations, organization filtering
- **Auth**: Role-based project access (project_admin, project_member)
- **Mobile Integration**: Project listing UI, creation forms, offline sync

### Task 13: User Role Management & Permissions
**Required Services**:
- **Database**: user_roles table management, role assignment functions
- **Auth**: Enhanced permission system, role inheritance
- **Edge Functions**: Admin Portal for WW Admin user management
- **Mobile Integration**: Role assignment UI, permission validation

### Task 14: Organisation Context Switching
**Required Services**:
- **Database**: Organization context APIs (mobile-only, minimal backend)
- **Mobile Integration**: Context switching UI, cache management

### Task 15: 6-Step Deployment Wizard UI
**Required Services**:
- **Database**: Deployment workflow storage, draft deployments
- **Storage**: Photo storage for deployment validation
- **Mobile Integration**: Multi-step wizard, form validation, draft persistence

### Task 16: Device Configuration & Setup
**Required Services**:
- **Database**: Device registry, configuration templates
- **Storage**: Firmware file management for OTA updates
- **Auth**: Device registration permissions
- **Mobile Integration**: BLE device discovery, configuration UI

### Task 17: Field Deployment Validation
**Required Services**:
- **Database**: Deployment validation storage
- **Storage**: Photo and file validation for deployments
- **Mobile Integration**: Validation checklist, photo capture, GPS

### Task 18: Device Management Interface
**Required Services**:
- **Database**: Device status queries, real-time updates
- **Edge Functions**: LoRaWAN webhook for device status updates
- **Mobile Integration**: Device status UI, battery/storage indicators

### Task 19: Map Visualization & Deployment Tracking
**Required Services**:
- **Database**: GPS coordinates, deployment locations (minimal backend)
- **Mobile Integration**: MapBox/Google Maps integration

### Task 20: BLE Communication & Device Sync
**Required Services**:
- **Database**: Device sync endpoints, data synchronization
- **Storage**: All file types (firmware, models, photos)
- **Auth**: Device authentication, sync permissions
- **Mobile Integration**: BLE protocols, data download, sync UI

---

## 🔄 Backend Service Implementation Priority

### CRITICAL Priority (Must Complete Before Mobile Development)
1. **User Role Management APIs** (Task 13)
   - **Database**: user_roles table functions, permission checking
   - **Auth**: Role assignment and validation systems
   - **Impact**: Mobile cannot implement role-based UI without backend
   - **Timeline**: Complete before Stream A begins

2. **Device Registry APIs** (Task 16)
   - **Database**: Device tracking, configuration management
   - **Storage**: Firmware file management and policies
   - **Impact**: Mobile cannot register or configure devices
   - **Timeline**: Complete by Stream B start

### HIGH Priority (Mobile Can Use Mocks Temporarily)
3. **Project Management APIs** (Task 12)
   - **Database**: Project CRUD with organization isolation
   - **Impact**: Mobile can use mock data for UI development
   - **Timeline**: Parallel development with mobile UI

4. **Deployment Workflow APIs** (Task 15)
   - **Database**: Deployment creation, validation, draft storage
   - **Storage**: Photo storage for deployment validation
   - **Impact**: Mobile can simulate deployment workflow initially
   - **Timeline**: Complete by Stream B midpoint

### MEDIUM Priority (Production Readiness Features)
5. **LoRaWAN Webhook Edge Function** (Task 18)
   - **Edge Function**: Real-time device status processing
   - **Impact**: Mobile can show mock device status initially
   - **Timeline**: Complete by Stream C

6. **Admin Portal Edge Function** (Tasks 13, 21)
   - **Edge Function**: Web-based admin interface
   - **Impact**: Independent system, no mobile dependencies
   - **Timeline**: Parallel development, complete by integration phase

---

## 📈 Cross-Project Success Metrics

### Coordination Efficiency
- **Specification Handoff Time**: <1 day from mobile task to backend spec
- **Backend Implementation Time**: Meet estimated hours per service
- **Integration Success Rate**: >95% first-time API integration success
- **Communication Clarity**: Zero specification misunderstandings requiring rework

### Technical Quality
- **API Consistency**: 100% TypeScript type safety across projects
- **Security Validation**: Zero cross-organization data leakage
- **Performance Standards**: <200ms API response times, <2s mobile screen loads
- **Test Coverage**: >90% backend test coverage, >85% mobile test coverage

### Project Delivery
- **Timeline Adherence**: Stay within 20-day execution window
- **Feature Completeness**: 100% MVP2 requirements delivered
- **Quality Gates**: All quality gates passed before stream progression
- **Deployment Readiness**: Production-ready build with monitoring and alerts

This orchestration guide ensures crystal-clear coordination between the mobile app and backend projects, with specific attention to Supabase service requirements and cross-project dependencies.