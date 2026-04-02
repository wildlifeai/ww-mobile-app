/**
 * Project Management Types
 * Type definitions for project-related data structures
 */

import { Database } from "./database.types"

// Helper type to extract table types from Supabase schema
type Tables<T extends keyof Database["public"]["Tables"]> =
	Database["public"]["Tables"][T]["Row"]
type TablesInsert<T extends keyof Database["public"]["Tables"]> =
	Database["public"]["Tables"][T]["Insert"]
type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
	Database["public"]["Tables"][T]["Update"]

// Base types from Supabase (already generated)
export type Project = Tables<"projects">
export type ProjectInsert = TablesInsert<"projects">
export type ProjectUpdate = TablesUpdate<"projects">

// Note: project_members table removed - using backward-compatible type
export interface ProjectMember {
	id: string;
	project_id: string;
	user_id: string;
	role: 'project_admin' | 'field_worker' | 'analyst' | 'viewer' | string;
	created_at?: string;
	user_profile?: any; // To hold joined profile data
	updated_at: string;
}
export type Organisation = Tables<"organisations">
// Note: user_organisations table removed
export type UserOrganisation = {
	id: string
	user_id: string
	organisation_id: string
	role: string
}
export type UserRole = Tables<"user_roles">

// User profile type (from public.users extension table)
export interface UserProfile {
	name: string
	firstname?: string
	surname?: string
	email?: string
}

// Extended types with computed/joined fields
export interface ProjectWithDetails extends Project {
	organisation?: Organisation
	owner_profile?: UserProfile | null
	created_by_profile?: UserProfile | null
	role?: string
	// Computed fields (from backend queries or LoRaWAN service)
	member_count?: number
	deployment_count?: number
	active_deployment_count?: number
	lorawan_device_count?: number
	device_count?: number
	active_device_count?: number
	battery_level?: number // 0-100%
	sd_card_usage?: number // 0-100%
}

export interface ProjectMemberWithProfile extends ProjectMember {
	user_profile?: UserProfile
	role_details?: {
		value: string
		description: string
	}
}

// Form types for project creation
export interface CreateProjectInput {
	name: string
	description?: string
	organisation_id: string
	model_id?: string // AI model selection (optional, added in T-008)
	// privacy_level removed as it's not in the schema
	is_baited?: boolean
	is_monitoring_marked_individuals?: boolean // Renamed from is_monitoring_marked_individual
	sampling_design_id?: number // Renamed from sampling_design and changed to number ID
	website?: string
	timelapse_interval_seconds?: number
	activity_detection_sensitivity_id?: number
	capture_method_id?: number
	record_gps_in_images?: boolean
	lorawan_required?: boolean
}

// LoRaWAN device status (mock for now)
export interface LoRaWANDeviceStatus {
	project_id: string
	device_count: number
	battery_level: number // Average across devices (0-100)
	sd_card_usage: number // Average across devices (0-100)
	last_updated: string
}
