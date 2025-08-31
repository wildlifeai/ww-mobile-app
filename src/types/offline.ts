/**
 * Offline Service Types
 * Types for offline-first architecture with organisation multi-tenancy and role-based sync
 */

// User roles for role-based access control
export type UserRole = 'ww_admin' | 'project_admin' | 'project_member';

// User interface for offline operations
export interface User {
  id: string;
  role: UserRole;
  organisation_id: string;
}

// Network status monitoring
export interface NetworkStatus {
  isConnected: boolean;
  type: string;
}

// Offline operation types
export type OfflineOperationType = 
  | 'CREATE_PROJECT'
  | 'UPDATE_PROJECT'
  | 'DELETE_PROJECT'
  | 'CREATE_DEPLOYMENT'
  | 'UPDATE_DEPLOYMENT' 
  | 'DELETE_DEPLOYMENT'
  | 'UPDATE_DEVICE_LORAWAN_STATUS'
  | 'CREATE_ORGANISATION'
  | 'UPDATE_ORGANISATION'
  | 'CREATE_USER'
  | 'UPDATE_USER'
  | 'DELETE_USER';

// Offline operation structure
export interface OfflineOperation {
  id: string;
  type: OfflineOperationType;
  data: any; // Operation-specific data payload
  user_id: string;
  organisation_id: string;
  timestamp: Date;
  retry_count: number;
  metadata?: Record<string, any>;
}

// LoRaWAN device status
export interface LoRaWANStatus {
  battery_level: number; // 0-100
  sd_card_usage: number; // 0-100
  device_status: 'online' | 'offline' | 'error';
  last_seen?: string;
  signal_strength?: number;
  firmware_version?: string;
}

// Conflict resolution types
export type ConflictType = 
  | 'data_modification'
  | 'deletion_conflict' 
  | 'permission_conflict'
  | 'organisation_boundary_conflict';

export interface ConflictResolution {
  id: string;
  server_version: any;
  local_version: any;
  conflict_type: ConflictType;
  needs_user_resolution: boolean;
  resolution_strategy?: 'server_wins' | 'local_wins' | 'merge' | 'user_choice';
  resolved_at?: Date;
}

// Sync status and progress
export interface SyncStatus {
  is_syncing: boolean;
  last_sync_at?: Date;
  pending_operations_count: number;
  failed_operations_count: number;
  sync_progress?: number; // 0-1
  sync_errors?: string[];
}

// Organisation-scoped data types
export interface Organisation {
  id: string;
  name: string;
  settings?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  organisation_id: string;
  created_by: string;
  status: 'active' | 'inactive' | 'archived';
  created_at: Date;
  updated_at: Date;
}

export interface Deployment {
  id: string;
  name: string;
  project_id: string;
  organisation_id: string;
  status: 'planned' | 'active' | 'completed' | 'cancelled';
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  device_ids: string[];
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface Device {
  id: string;
  name: string;
  device_type: string;
  serial_number: string;
  organisation_id: string;
  battery_level?: number;
  sd_card_usage?: number;
  status: 'active' | 'inactive' | 'maintenance' | 'error';
  lorawan_status?: LoRaWANStatus;
  last_seen?: Date;
  created_at: Date;
  updated_at: Date;
}

// Role-based permissions
export interface UserPermissions {
  canCreateProjects: boolean;
  canManageProjects: boolean;
  canDeleteProjects: boolean;
  canCreateDeployments: boolean;
  canManageDeployments: boolean;
  canDeleteDeployments: boolean;
  canManageUsers: boolean;
  canManageOrganisation: boolean;
  canAccessAllOrganisations: boolean;
  canConfigureDevices: boolean;
  canViewSystemMetrics: boolean;
}

// Operation metadata for enhanced tracking
export interface OperationMetadata {
  correlation_id?: string;
  source: 'user_action' | 'system_sync' | 'background_task';
  priority: 'low' | 'normal' | 'high' | 'critical';
  requires_network?: boolean;
  estimated_size?: number; // bytes
  dependencies?: string[]; // operation IDs this depends on
}

// Enhanced offline operation with metadata
export interface EnhancedOfflineOperation extends OfflineOperation {
  metadata: OperationMetadata;
}

// Sync configuration
export interface SyncConfiguration {
  auto_sync_enabled: boolean;
  sync_interval_minutes: number;
  max_retry_attempts: number;
  retry_backoff_multiplier: number;
  max_offline_storage_mb: number;
  sync_on_wifi_only: boolean;
  batch_sync_size: number;
}

// Database table names for offline storage
export const OFFLINE_TABLES = {
  ORGANISATIONS: 'local_organisations',
  PROJECTS: 'local_projects', 
  DEPLOYMENTS: 'local_deployments',
  DEVICES: 'local_devices',
  USER_ROLES: 'local_user_roles',
  OFFLINE_QUEUE: 'offline_queue',
  SYNC_STATUS: 'sync_status'
} as const;

export type OfflineTableName = typeof OFFLINE_TABLES[keyof typeof OFFLINE_TABLES];