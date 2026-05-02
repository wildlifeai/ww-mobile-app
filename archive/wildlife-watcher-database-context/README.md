# Wildlife Watcher Database: Technical Documentation

## Overview

This directory contains comprehensive technical documentation for the Wildlife Watcher backend database system. The documentation provides detailed analysis of database components, security model, seed data, and architectural decisions to support development, maintenance, and operational activities.

## Documentation Structure

### 📋 **database-schema-analysis.md**
**Complete database schema analysis including all components and ERD**

- Comprehensive table analysis with full schema definitions
- Entity Relationship Diagram (Mermaid syntax)
- Detailed column analysis with data types and constraints
- Foreign key relationships and dependencies
- Supabase-specific components and configurations
- Architecture highlights and design patterns

**Key Sections:**
- Mermaid ERD diagram
- Core entity tables analysis
- Lookup tables with seed values
- Database relationships summary
- Supabase components integration

### 🔧 **database-functions-triggers.md**
**Detailed analysis of all database functions and triggers**

- Complete function documentation with code examples
- Trigger implementation and integration patterns
- Security and performance considerations
- Function and trigger interaction patterns
- Maintenance and extensibility guidelines

**Key Sections:**
- 7 core database functions
- Timestamp management triggers
- Spatial data synchronization
- Authorization framework
- Security implementation patterns

### 🔒 **security-model-analysis.md**
**Comprehensive security model documentation and analysis**

- Row Level Security (RLS) configuration
- Detailed security policies by table
- Role-based access control (RBAC) implementation
- Authorization framework and patterns
- Security vulnerabilities and mitigations

**Key Sections:**
- RLS policies for 6 protected tables
- Role hierarchy and access matrix
- Security patterns and implementation
- Performance and compliance considerations
- Best practices and recommendations

### 🌱 **seed-data-analysis.md**
**Complete analysis of seed data across all environments**

- Environment-specific seed data analysis
- Data quality assessment and issues
- Seed data loading process documentation
- Security and performance considerations
- Maintenance recommendations

**Key Sections:**
- Main production seed data (15 lookup records)
- Environment-specific data analysis
- Critical issues and recommendations
- Data loading architecture
- Best practices for seed data management

## Database Overview

### **System Purpose**
Wildlife monitoring and data collection platform using camera traps and recording devices.

### **Core Entities**
- **Users**: Authentication and profile management
- **Projects**: Wildlife monitoring projects with ownership controls
- **Deployments**: Camera deployments with geographic data
- **Devices**: Recording equipment and metadata
- **Project Members**: Role-based project access control
- **API Logs**: Comprehensive system audit trails

### **Key Features**
- **Multi-tenancy**: Project-based data isolation
- **Role-based Security**: Admin/user hierarchy with RLS
- **Soft Deletes**: Data preservation with logical deletion
- **Geographic Support**: PostGIS integration for spatial data
- **Audit Trail**: Comprehensive logging and timestamp tracking
- **Supabase Integration**: Native auth and real-time features

## Quick Reference

### **Database Tables** (10 total)
| Type | Count | Tables |
|------|-------|--------|
| **Core Entities** | 6 | users, projects, deployments, devices, project_members, api_logs |
| **Lookup Tables** | 4 | roles, capture_methods, deployment_statuses, log_levels |

### **Security Components**
| Component | Count | Coverage |
|-----------|-------|----------|
| **RLS Policies** | 18 | 6 protected tables |
| **Database Functions** | 7 | Authorization, soft delete, triggers |
| **Triggers** | 9 | Timestamp management, spatial sync |

### **Seed Data**
| Environment | Status | Records | Quality |
|-------------|---------|---------|---------|
| **Production** | ✅ Complete | 15 | High |
| **Local** | ⚠️ Test marker | 1 | Needs cleanup |
| **Dev** | ❌ Corrupted | 0 | Critical issue |
| **Staging** | ⚠️ Empty | 0 | No specific data |
| **Test** | ⚠️ Empty | 0 | Missing fixtures |

### **Critical Issues Identified**

1. **🔴 CRITICAL**: Development environment seed data corrupted
   - **File**: `seeds/dev/data.sql`
   - **Issue**: Contains invalid SQL content ("s")
   - **Impact**: Development deployment failures

2. **🟡 MEDIUM**: Missing test data fixtures
   - **Files**: `seeds/test/data.sql`
   - **Issue**: No test-specific seed data
   - **Impact**: Limited automated testing capability

3. **🟡 MEDIUM**: Local environment data pollution
   - **File**: `seeds/local/data.sql`
   - **Issue**: Test marker pollutes production roles table
   - **Impact**: Non-production data in lookup table

## Architecture Highlights

### **Security Model**
- **Defense in Depth**: Multiple security layers (Auth → RLS → Function checks → Audit)
- **Principle of Least Privilege**: Minimal necessary permissions per role
- **Project-based Isolation**: Data access scoped to project membership
- **Audit Trail**: Comprehensive logging with user context

### **Data Integrity**
- **Soft Delete Pattern**: Data preservation with logical deletion
- **Automatic Timestamps**: Trigger-based audit trail maintenance
- **Spatial Data Sync**: Automatic coordinate-to-geography conversion
- **Referential Integrity**: Foreign key constraints with cascading rules

### **Performance Features**
- **Optimized Queries**: Efficient RLS policies and function design
- **Proper Indexing**: Strategic indexes for common access patterns
- **Minimal Overhead**: Lightweight triggers and functions
- **Scalable Logging**: High-volume API logging with BIGINT keys

### **Supabase Integration**
- **Native Auth**: Direct integration with Supabase Auth system
- **Real-time**: Configured for real-time subscriptions
- **Storage**: File storage for deployment photos and project images
- **API**: Auto-generated REST and GraphQL APIs with RLS

## Development Guidelines

### **Schema Changes**
1. Always work through declarative schema files in `schemas/`
2. Use `supabase db diff` to generate migrations
3. Test changes in local environment first
4. Validate RLS policies after schema modifications

### **Security Updates**
1. Review RLS policies when adding new tables or columns
2. Test authorization functions with different user roles
3. Validate soft delete functionality after changes
4. Update audit logging for new operations

### **Data Management**
1. Fix critical seed data issues before deployment
2. Add comprehensive test fixtures for automated testing
3. Validate seed data loading in all environments
4. Document environment-specific data requirements

## Maintenance Tasks

### **Immediate Actions Required**
1. **Fix Development Seed Data**: Replace corrupted `dev/data.sql`
2. **Add Test Fixtures**: Create comprehensive test data in `test/data.sql`
3. **Clean Local Data**: Remove test marker from local environment

### **Recommended Enhancements**
1. **Staging Data**: Add staging-specific test scenarios
2. **Performance Monitoring**: Implement RLS policy performance tracking
3. **Security Auditing**: Regular review of role assignments and permissions
4. **Documentation Updates**: Keep technical documentation current with changes

## Support and Resources

### **Key Files**
- **Schema**: `supabase/schemas/` (declarative database structure)
- **Migrations**: `supabase/migrations/` (version-controlled changes)
- **Config**: `supabase/config.toml` (Supabase configuration)
- **Seeds**: `supabase/seeds/` (environment data)

### **Deployment**
- **Local**: `bash deployment_scripts/deploy.local.sh`
- **Cloud**: GitHub Actions workflow with environment selection

### **Monitoring**
- **Database**: Supabase dashboard for performance and logs
- **Security**: API logs table for audit trail
- **Development**: Local Supabase Studio at `localhost:54323`

This technical documentation provides a comprehensive understanding of the Wildlife Watcher database system, enabling effective development, maintenance, and operational support for the wildlife monitoring platform.