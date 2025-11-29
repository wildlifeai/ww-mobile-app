/**
 * Mock Data for Project Member Management
 *
 * Used for UI development and testing before backend implementation
 */

import {
	OrganizationUser,
	ProjectMember,
	ProjectRole,
} from "../services/UserRoleService"

// Mock organization users (user pool)
export const mockOrganizationUsers: OrganizationUser[] = [
	{
		id: "550e8400-e29b-41d4-a716-446655440001",
		name: "Sarah Johnson",
		email: "sarah.johnson@conservation.org",
		roles: [
			{
				role: "project_admin",
				scope_type: "project",
				scope_id: "proj-001",
				is_active: true,
			},
		],
		is_in_project: false,
	},
	{
		id: "550e8400-e29b-41d4-a716-446655440002",
		name: "Michael Chen",
		email: "michael.chen@conservation.org",
		roles: [
			{
				role: "project_member",
				scope_type: "project",
				scope_id: "proj-002",
				is_active: true,
			},
		],
		is_in_project: false,
	},
	{
		id: "550e8400-e29b-41d4-a716-446655440003",
		name: "Emily Rodriguez",
		email: "emily.rodriguez@conservation.org",
		roles: [],
		is_in_project: false,
	},
	{
		id: "550e8400-e29b-41d4-a716-446655440004",
		name: "David Kim",
		email: "david.kim@conservation.org",
		roles: [
			{
				role: "model_manager",
				scope_type: "organisation",
				scope_id: "org-001",
				is_active: true,
			},
		],
		is_in_project: false,
	},
	{
		id: "550e8400-e29b-41d4-a716-446655440005",
		name: "Lisa Anderson",
		email: "lisa.anderson@conservation.org",
		roles: [],
		is_in_project: false,
	},
	{
		id: "550e8400-e29b-41d4-a716-446655440006",
		name: "James Wilson",
		email: "james.wilson@conservation.org",
		roles: [
			{
				role: "project_member",
				scope_type: "project",
				scope_id: "proj-003",
				is_active: true,
			},
		],
		is_in_project: true, // Already in current project
	},
	{
		id: "550e8400-e29b-41d4-a716-446655440007",
		name: "Maria Garcia",
		email: "maria.garcia@conservation.org",
		roles: [],
		is_in_project: false,
	},
	{
		id: "550e8400-e29b-41d4-a716-446655440008",
		name: "Robert Taylor",
		email: "robert.taylor@conservation.org",
		roles: [
			{
				role: "ww_admin",
				scope_type: "system",
				scope_id: null,
				is_active: true,
			},
		],
		is_in_project: false,
	},
]

// Mock project members (already in current project)
export const mockProjectMembers: ProjectMember[] = [
	{
		id: "550e8400-e29b-41d4-a716-446655440006",
		name: "James Wilson",
		email: "james.wilson@conservation.org",
		role: "project_admin",
		granted_at: "2025-09-15T10:30:00Z",
		granted_by: "550e8400-e29b-41d4-a716-446655440001",
		granted_by_name: "Sarah Johnson",
	},
	{
		id: "550e8400-e29b-41d4-a716-446655440009",
		name: "Jennifer Martinez",
		email: "jennifer.martinez@conservation.org",
		role: "project_member",
		granted_at: "2025-09-20T14:15:00Z",
		granted_by: "550e8400-e29b-41d4-a716-446655440006",
		granted_by_name: "James Wilson",
	},
	{
		id: "550e8400-e29b-41d4-a716-446655440010",
		name: "Christopher Lee",
		email: "christopher.lee@conservation.org",
		role: "project_member",
		granted_at: "2025-09-22T09:45:00Z",
		granted_by: "550e8400-e29b-41d4-a716-446655440006",
		granted_by_name: "James Wilson",
	},
]

// Mock current user (for permission checks)
export const mockCurrentUser = {
	id: "550e8400-e29b-41d4-a716-446655440006", // James Wilson
	name: "James Wilson",
	email: "james.wilson@conservation.org",
	role: "project_admin" as ProjectRole,
	organisationId: "org-001",
}

// Helper function to get available users (not in project)
export const getAvailableUsers = (
	allUsers: OrganizationUser[],
	projectMembers: ProjectMember[],
): OrganizationUser[] => {
	const memberIds = new Set(projectMembers.map((m) => m.id))
	return allUsers.filter((u) => !memberIds.has(u.id))
}

// Helper function to simulate API delay
export const simulateApiDelay = (ms: number = 500): Promise<void> => {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

// Mock API responses
export const mockApiResponses = {
	addMember: async (userId: string, role: ProjectRole) => {
		await simulateApiDelay()
		return {
			success: true,
			user_id: userId,
			project_id: "proj-current",
			role,
		}
	},

	updateRole: async (userId: string, newRole: ProjectRole) => {
		await simulateApiDelay()
		return {
			success: true,
			user_id: userId,
			project_id: "proj-current",
			old_role: "project_member" as ProjectRole,
			new_role: newRole,
		}
	},

	removeMember: async (userId: string) => {
		await simulateApiDelay()
		return {
			success: true,
			user_id: userId,
			project_id: "proj-current",
			removed_role: "project_member" as ProjectRole,
		}
	},
}

// Role display helpers
export const getRoleBadgeColor = (role: string): string => {
	switch (role) {
		case "ww_admin":
			return "#9C27B0" // Purple
		case "model_manager":
			return "#FF9800" // Orange
		case "project_admin":
			return "#2196F3" // Blue
		case "project_member":
			return "#4CAF50" // Green
		default:
			return "#757575" // Grey
	}
}

export const getRoleDisplayName = (role: string): string => {
	switch (role) {
		case "ww_admin":
			return "WW Admin"
		case "model_manager":
			return "Model Manager"
		case "project_admin":
			return "Project Admin"
		case "project_member":
			return "Project Member"
		default:
			return role
	}
}

export const getRoleDescription = (role: string): string => {
	switch (role) {
		case "ww_admin":
			return "System-wide administrator with global access"
		case "model_manager":
			return "Manages AI models for the organization"
		case "project_admin":
			return "Full project management and member administration"
		case "project_member":
			return "Field operations and deployment execution"
		default:
			return "Unknown role"
	}
}

// Permission helpers for UI rendering
export const canAddMembers = (userRole: ProjectRole): boolean => {
	return userRole === "project_admin"
}

export const canRemoveMembers = (userRole: ProjectRole): boolean => {
	return userRole === "project_admin"
}

export const canChangeRoles = (userRole: ProjectRole): boolean => {
	return userRole === "project_admin"
}

export const canRemoveSpecificMember = (
	currentUserRole: ProjectRole,
	targetMemberRole: ProjectRole,
	isLastAdmin: boolean,
): boolean => {
	// Only project admins can remove members
	if (currentUserRole !== "project_admin") {
		return false
	}

	// Cannot remove last admin
	if (targetMemberRole === "project_admin" && isLastAdmin) {
		return false
	}

	return true
}
