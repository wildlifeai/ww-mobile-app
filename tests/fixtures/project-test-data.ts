/**
 * Project Test Data Fixtures
 * Reusable test data for ProjectService integration tests
 */

import type { CreateProjectInput } from "../../src/types/project"

/**
 * Test user credentials
 */
export const testUsers = {
	org1Admin: {
		email: "test-org1-admin@example.com",
		password: "TestPassword123!",
		name: "Org 1 Admin User",
	},
	org1Member: {
		email: "test-org1-member@example.com",
		password: "TestPassword123!",
		name: "Org 1 Member User",
	},
	org2Admin: {
		email: "test-org2-admin@example.com",
		password: "TestPassword123!",
		name: "Org 2 Admin User",
	},
	wwAdmin: {
		email: "test-ww-admin@example.com",
		password: "TestPassword123!",
		name: "WW Admin User",
	},
}

/**
 * Test organisations
 */
export const testOrganisations = {
	org1: {
		name: "Test Organisation 1",
		slug: "test-org-1",
	},
	org2: {
		name: "Test Organisation 2",
		slug: "test-org-2",
	},
}

/**
 * Sample project inputs
 */
export const sampleProjectInputs: Record<string, CreateProjectInput> = {
	wildlifeSurvey: {
		name: "Wildlife Survey 2025",
		description: "Annual wildlife population survey in national parks",
		organisation_id: "", // Will be set in tests
		privacy_level: "public",
		is_baited: false,
		is_monitoring_marked_individual: false,
		sampling_design: "Random grid sampling with 500m spacing",
		website: "https://wildlifesurvey2025.example.com",
	},
	tigerMonitoring: {
		name: "Tiger Monitoring Project",
		description: "Long-term monitoring of tiger populations",
		organisation_id: "", // Will be set in tests
		privacy_level: "private",
		is_baited: true,
		is_monitoring_marked_individual: true,
		sampling_design: "Targeted monitoring of known territories",
	},
	birdMigration: {
		name: "Bird Migration Study",
		description: "Tracking migratory bird patterns through camera traps",
		organisation_id: "", // Will be set in tests
		privacy_level: "internal",
		is_baited: false,
		is_monitoring_marked_individual: false,
		sampling_design: "Linear transect sampling along migration routes",
	},
}

/**
 * Expected validation errors
 */
export const expectedErrors = {
	missingName: "Project name is required",
	missingOrgId: "Organisation ID is required",
	invalidPrivacyLevel: "Invalid privacy level",
	crossOrgAccess: "Permission denied",
	projectNotFound: "Project not found",
	memberNotFound: "Member not found",
	duplicateMember: "Member already exists in project",
	crossOrgMemberAssignment: "Cannot assign member from different organisation",
}

/**
 * Test roles
 */
export const testRoles = {
	wwAdmin: "ww_admin",
	projectAdmin: "project_admin",
	projectMember: "project_member",
}

/**
 * Role IDs (from seed data)
 */
export const roleIds = {
	wwAdmin: 1,
	projectAdmin: 3,
	projectMember: 4,
}
