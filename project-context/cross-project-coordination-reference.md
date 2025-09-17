# Cross-Project Coordination Reference

**Document Version**: 1.0  
**Created**: 2025-09-05  
**Role**: Cross-Project Coordinator  
**My Responsibility**: Coordinate between Wildlife Watcher mobile app and backend projects

## 🎯 My Primary Responsibilities

### 1. **Monitor Backend Database Progress**
- Track database role system implementation status
- Monitor migration script generation and testing
- Assess RLS policy implementation progress
- Coordinate deployment timing between projects

### 2. **Status Synchronization** 
- Update mobile app team on backend changes
- Communicate mobile app requirements to backend
- Maintain alignment on API contracts and types
- Ensure milestone coordination

### 3. **Integration Management**
- Coordinate integration testing between projects  
- Validate cross-project dependencies
- Manage release readiness assessment
- Handle cross-project blocking issues

### 4. **Documentation Maintenance**
- Update project status documents as changes occur
- Maintain cross-references between project specs
- Document integration decisions and rationale
- Track milestone progress across both projects

## 📁 Key Files I Must Monitor

### Backend Project (`/home/adarsh/dev/wildlifeai/wildlife-watcher-backend/`)

#### **Primary Status Documents:**
- `project-context/PROJECT-STATUS.md` - Main project health dashboard
- `project-context/MVP2-Tasks/database-role-system-implementation.md` - Core implementation task
- `project-context/MVP2-work-overview.md` - High-level work summary

#### **Implementation Files to Check:**
- `supabase/schemas/` - Declarative schema files (organisations, user_organisations, user_roles)
- `supabase/migrations/` - Generated migration scripts  
- `supabase/seed.sql` - Seed data updates (roles table, wildlife.ai org)
- `project-context/database-schema-analysis.md` - Schema documentation

#### **Backend Branch Status:**
- **Active Branch**: `dev-mobile-app-mvp2-updates`
- **Main Branch**: `main`
- **Last Known Status**: Phase 2 AADF Implementation Complete (70% MVP2 readiness)

### Mobile App Project (`/home/adarsh/dev/wildlifeai/wildlife-watcher-mobile-app/`)

#### **Primary Requirements Documents:**
- `project-context/development-context/MVP2/implementation-spec-v1.4.md` - Updated with 4-tier roles
- `project-context/development-context/MVP2/Wildlife Watcher App - User Roles & Permissions Specification.md` - Source requirements
- `project-context/superclaude-task-management.md` - Current task status

#### **Mobile App Branch Status:**
- **Active Branch**: `dev-mvp2-development-claude-flow-test`
- **Main Branch**: `main`
- **Current Task**: Task 11.8 UUID alignment (Foundation Layer)

## 🔍 Backend Progress Assessment (Last Known)

### ✅ **Completed (70% Progress)**
1. Branch created (`dev-mobile-app-mvp2-updates`)
2. AADF methodology integrated with philosophical foundations
3. Database role system implementation (Phase 1) 
4. Schema files created (declarative approach - 4-tier role system)
5. Organisation-scoped RLS policies implemented (Phase 2)
6. Migration scripts generated

### 🟡 **In Progress (Current Phase)**
7. Local testing in progress (25 tests to validate)

### ⬜ **Pending**
8. Dev environment deployed
9. Mobile app integration tested  
10. Production ready

### ⚠️ **Known Issues to Monitor**
- **Dev Seed Data Invalid** (`seeds/dev/data.sql`) - Cannot deploy to dev environment
- **Missing Test Fixtures** (`seeds/test/data.sql`) - Limited test coverage

## 🎯 Critical Success Metrics I Track

### **Database Implementation:**
- [ ] 3 new tables created: `organisations`, `user_organisations`, `user_roles`
- [ ] `projects` table updated with `organisation_id`
- [ ] RLS policies implemented for organisation-scoped access
- [ ] Migration scripts tested locally
- [ ] Seed data updated with wildlife.ai organisation

### **Integration Readiness:**
- [ ] Backend API contracts defined
- [ ] Type generation completed for mobile app
- [ ] Authentication/authorization flows tested
- [ ] Dev environment deployment successful
- [ ] Mobile app integration tests passing

### **Cross-Project Alignment:**
- [ ] Mobile app Task 11.8 UUID alignment completed
- [ ] Backend database changes deployed
- [ ] API integration guide updated
- [ ] Both teams ready for integration testing

## 📋 My Regular Check Protocol

### **Daily Checks:**
1. Read `PROJECT-STATUS.md` for latest backend status
2. Check mobile app `superclaude-task-management.md` for current task
3. Monitor both project git branches for new commits
4. Assess any blocking issues requiring coordination

### **Weekly Status Reports:**
1. Compile progress summary across both projects
2. Identify upcoming integration milestones  
3. Flag any cross-project dependencies or risks
4. Update coordination documentation

### **When to Escalate:**
- Backend deployment blocked by database issues
- Mobile app blocked waiting for backend changes
- Integration testing failures
- Timeline misalignment between projects
- API contract changes requiring mobile app updates

## 🚨 Current Status Summary (2025-09-05)

### **Backend Status**: 
- **Progress**: 70% MVP2 readiness (Phase 2 AADF Implementation Complete)
- **Current Phase**: Local testing of 25 database tests
- **Next Milestone**: Dev environment deployment
- **Blockers**: Dev seed data issues, missing test fixtures

### **Mobile App Status**:
- **Current Task**: Task 11.8 UUID alignment (Foundation Layer)
- **Next Phase**: Tasks 12-23 parallel streams after Foundation Layer complete
- **Integration Readiness**: Waiting for backend database deployment

### **Cross-Project Dependencies**:
- Mobile app UUID alignment must complete before backend integration
- Backend dev environment must deploy before integration testing
- API contracts need finalization once database changes are deployed

## 📞 Communication Protocol

### **Status Updates To:**
- Mobile app team: Update when backend milestones complete
- Backend team: Communicate mobile app readiness and requirements
- Both teams: Coordinate integration testing timing

### **Documentation Updates:**
- Update `PROJECT-STATUS.md` when backend milestones change
- Update mobile app coordination docs when backend status changes
- Maintain timeline synchronization between projects

---

**Next Action**: Check backend implementation files to assess current state against documented plan and provide comprehensive status update.