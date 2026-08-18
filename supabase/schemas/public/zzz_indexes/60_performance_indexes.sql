-- =============================================================================
-- PERFORMANCE INDEXES
-- =============================================================================
-- Purpose: Advanced performance optimizations for RLS, Logging, and complex joins
-- Note: Basic indexes (PK, FK, Unique) are defined in table files.
--       This file contains only additive performance tuning.
-- =============================================================================

-- 1. RLS PERFORMANCE
-- =============================================================================

-- CRITICAL: Covering index for user_roles permission checks
-- USED BY: ALL RLS policies via has_system_role(), has_organisation_role(), has_project_role()
-- PERFORMANCE: Enables index-only scan (5-10x faster than bitmap heap scan)
-- PATTERN: Covering index includes all columns needed by query (user_id, scope_type, scope_id, role)
create index if not exists idx_user_roles_lookup_covering
on public.user_roles (user_id, scope_type, scope_id, role)
where deleted_at is null and is_active = true;

-- EVIDENCE: Official Supabase pattern for system role lookups
create index if not exists idx_user_roles_system_ww_admin
on public.user_roles (user_id, role)
where scope_type = 'system' and role = 'ww_admin' and is_active = true and deleted_at is null;

-- CRITICAL: Organisation RLS performance indexes
create index if not exists idx_organisations_created_by
on public.organisations (created_by);

-- 2. DEPLOYMENT & ACCESS CONTROL
-- =============================================================================

-- NOTE: Deployment indexes (idx_deployments_project_id, idx_deployments_device_id)
-- are defined in 28_deployments.sql alongside the table definition.

-- Location index for geospatial queries (still valid)
create index if not exists idx_deployments_location
on deployments using gist (location);

-- 3. LOGGING PERFORMANCE (API LOGS)
-- =============================================================================
-- EVIDENCE: Context7 Supabase research - minimal indexes for high-write logging tables

-- CRITICAL Priority: Distributed tracing and session tracking
-- PATTERN: Partial indexes with WHERE clause for nullable UUIDs (30-50% smaller)
create index if not exists idx_api_logs_correlation_id
on public.api_logs (correlation_id)
where correlation_id is not null;

create index if not exists idx_api_logs_session_id
on public.api_logs (session_id)
where session_id is not null;

-- CRITICAL Priority: Time-series optimization for append-only logs
-- EVIDENCE: BRIN indexes are 10-100x smaller than B-tree for time-ordered data
-- PERFORMANCE: Perfect for log tables with natural time ordering
create index if not exists idx_api_logs_created_at_brin
on public.api_logs using brin (created_at);

-- HIGH Priority: RLS policy performance (user/org/project filtering)
create index if not exists idx_api_logs_user_id
on public.api_logs (user_id)
where user_id is not null;

create index if not exists idx_api_logs_organisation_id
on public.api_logs (organisation_id);

create index if not exists idx_api_logs_project_id
on public.api_logs (project_id)
where project_id is not null;

-- MEDIUM Priority: Log category filtering (error/warn/info/debug)
-- PATTERN: Partial index for non-null categorical data
create index if not exists idx_api_logs_log_category
on public.api_logs (log_category)
where log_category is not null;

-- Soft delete pattern index
create index if not exists idx_api_logs_deleted_at
on public.api_logs (deleted_at);
