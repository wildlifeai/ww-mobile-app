/**
 * Project Management Types
 * Type definitions for project-related data structures
 */

import { Database } from "./supabase"

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

export type ProjectMember = Tables<"project_members">
export type Organisation = Tables<"organisations">
export type UserOrganisation = Tables<"user_organisations">
export type UserRole = Tables<"user_roles">

// User profile type (from public.users extension table)
export interface UserProfile {
	name: string
}

// Extended types with computed/joined fields
export interface ProjectWithDetails extends Project {
	organisation?: Organisation
	owner_profile?: UserProfile | null
	created_by_profile?: UserProfile | null
	// Computed fields (from backend queries or LoRaWAN service)
	member_count?: number
	deployment_count?: number
	lorawan_device_count?: number
	battery_level?: number // 0-100%
	sd_card_usage?: number // 0-100%
}

export interface ProjectMemberWithProfile extends ProjectMember {
	user_profile?: UserProfile
	role?: {
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
}

// LoRaWAN device status (mock for now)
export interface LoRaWANDeviceStatus {
	project_id: string
	device_count: number
	battery_level: number // Average across devices (0-100)
	sd_card_usage: number // Average across devices (0-100)
	last_updated: string
}
