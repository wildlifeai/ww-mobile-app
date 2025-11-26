// New UUID-first API types based on Supabase database schema
import type { Tables, TablesInsert, TablesUpdate } from "./supabase"

// HTTP Method enum
export enum HttpMethod {
	GET = "GET",
	POST = "POST",
	PUT = "PUT",
	DELETE = "DELETE",
	PATCH = "PATCH",
}

// Base Response Types
export type BaseResponse = {
	code: number
	message: string
	type?: string
	details?: string
}

export type ApiResponse<T> = {
	data: T
	success: boolean
	error?: BaseResponse
}

export type PaginatedResponse<T> = {
	data: T[]
	total: number
	page: number
	limit: number
}

// Database-aligned types (UUID strings throughout)
export type User = Tables<"users">
export type UserCreate = TablesInsert<"users">
export type UserUpdate = TablesUpdate<"users">

export type Project = Tables<"projects">
export type ProjectCreate = TablesInsert<"projects">
export type ProjectUpdate = TablesUpdate<"projects">

export type Deployment = Tables<"deployments">
export type DeploymentCreate = TablesInsert<"deployments">
export type DeploymentUpdate = TablesUpdate<"deployments">

export type Device = Tables<"devices">
export type DeviceCreate = TablesInsert<"devices">
export type DeviceUpdate = TablesUpdate<"devices">

export type Organisation = Tables<"organisations">
export type OrganisationCreate = TablesInsert<"organisations">
export type OrganisationUpdate = TablesUpdate<"organisations">

export type UserRole = Tables<"user_roles">
export type UserRoleCreate = TablesInsert<"user_roles">
export type UserRoleUpdate = TablesUpdate<"user_roles">

export type ProjectMember = Tables<"project_members">
export type ProjectMemberCreate = TablesInsert<"project_members">
export type ProjectMemberUpdate = TablesUpdate<"project_members">

export type UserOrganisation = Tables<"user_organisations">
export type UserOrganisationCreate = TablesInsert<"user_organisations">
export type UserOrganisationUpdate = TablesUpdate<"user_organisations">

// Role and other lookup types
export type Role = Tables<"roles">
export type CaptureMethod = Tables<"capture_methods">
export type DeploymentStatus = Tables<"deployment_statuses">
export type LogLevel = Tables<"log_levels">

// API Log types
export type ApiLog = Tables<"api_logs">
export type ApiLogCreate = TablesInsert<"api_logs">
export type ApiLogUpdate = TablesUpdate<"api_logs">

// Helper types for common patterns
export type BaseEntity = {
	id: string
}

export type GeoLocation = {
	latitude: number
	longitude: number
}

export type ExifData = {
	[key: string]: string
}

// Role-related types (replacing ProjectRole enum)
export type UserRoleType = "ww_admin" | "project_admin" | "project_member"
export type UserScopeType = "system" | "organisation" | "project"

export type ProjectMembership = {
	project_id: string
	role: string
	user_id: string
}

// Composite types for Service layer
export type ProjectInput = ProjectCreate

export type ProjectMemberWithProfile = ProjectMember & {
	profile: User
}

export type ProjectWithDetails = Project & {
	members: ProjectMemberWithProfile[]
	deployments_count: number
	role: string
}
