/**
 * Types Index
 * Central export for all type definitions
 */

// Supabase types - only export Database to avoid conflicts with offline.ts
export type { Database } from "./database.types"

// Offline service types
// Offline service types - Alias conflicting types to avoid collisions with API types
export type {
	UserRole as OfflineUserRole,
	User as OfflineUser,
	Organisation as OfflineOrganisation,
	Project as OfflineProject,
	Deployment as OfflineDeployment,
	Device as OfflineDevice,
	NetworkStatus,
	OfflineOperationType,
	OfflineOperation,
	LoRaWANStatus,
	ConflictType,
	ConflictResolution,
	SyncStatus,
	UserPermissions,
	OperationMetadata,
	EnhancedOfflineOperation,
	SyncConfiguration
} from "./offline"

// Project types - explicit re-exports to avoid conflicts
export type {
	Project as ProjectFromProjectTypes,
	ProjectInsert,
	ProjectUpdate,
	ProjectMember,
	Organisation as OrganisationFromProjectTypes,
	UserOrganisation,
	UserRole as UserRoleFromProjectTypes,
	UserProfile,
	ProjectWithDetails,
	ProjectMemberWithProfile,
	CreateProjectInput,
	LoRaWANDeviceStatus,
} from "./project"

// API types
export * from "./api.types"

// Navigation types
export * from "../navigation/types"

// BLE types
export * from "../ble/types"
