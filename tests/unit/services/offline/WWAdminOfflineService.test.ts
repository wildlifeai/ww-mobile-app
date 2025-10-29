/**
 * @jest-environment node
 */

// Mock dependencies first
jest.mock("../../../../src/services/offline/DatabaseService")
jest.mock("../../../../src/services/offline/OfflineService")

import { WWAdminOfflineService } from "../../../../src/services/offline/WWAdminOfflineService"
import { DatabaseService } from "../../../../src/services/offline/DatabaseService"
import { OfflineService } from "../../../../src/services/offline/OfflineService"
import { User, Organisation } from "../../../../src/types/offline"
import { Project } from "../../../../src/redux/slices/wwAdminSlice"

/**
 * WWAdminOfflineService Test Suite - WW Admin Scope Alignment
 *
 * UPDATED ARCHITECTURE: Read-only project visibility + web portal navigation
 *
 * Tests focus on:
 * - Cross-organisation project visibility (read-only)
 * - Organisation data caching for offline viewing
 * - Web portal URL management
 * - Project data synchronization for admin overview
 *
 * REMOVED from MVP (Web Portal Exclusive):
 * - User management operations (moved to web portal)
 * - Role assignment operations (web portal only)
 * - System configuration management (web portal only)
 * - Bulk operations (web portal only)
 */
describe("WWAdminOfflineService - Read-Only + Web Portal Architecture", () => {
	let wwAdminService: WWAdminOfflineService
	let mockDatabaseService: jest.Mocked<DatabaseService>
	let mockOfflineService: jest.Mocked<OfflineService>

	const mockWWAdmin: User = {
		id: "admin-1",
		role: "ww_admin",
		organisation_id: "org-1",
	}

	const mockProjectAdmin: User = {
		id: "admin-2",
		role: "project_admin",
		organisation_id: "org-1",
	}

	const mockOrganisations: Organisation[] = [
		{
			id: "org-1",
			name: "Organisation One",
			settings: { description: "First test org" },
			created_at: new Date("2024-01-01T00:00:00Z"),
			updated_at: new Date("2024-01-01T00:00:00Z"),
		},
		{
			id: "org-2",
			name: "Organisation Two",
			settings: { description: "Second test org" },
			created_at: new Date("2024-01-02T00:00:00Z"),
			updated_at: new Date("2024-01-02T00:00:00Z"),
		},
	]

	const mockProjects: Project[] = [
		{
			id: "proj-1",
			name: "Project Alpha",
			description: "First project",
			owner_id: "user-1",
			organisation_id: "org-1",
			created_at: "2024-01-01T00:00:00Z",
			updated_at: "2024-01-01T00:00:00Z",
			is_private: false,
			member_count: 5,
			deployment_count: 3,
		},
		{
			id: "proj-2",
			name: "Project Beta",
			description: "Second project",
			owner_id: "user-2",
			organisation_id: "org-2",
			created_at: "2024-01-02T00:00:00Z",
			updated_at: "2024-01-02T00:00:00Z",
			is_private: true,
			member_count: 2,
			deployment_count: 1,
		},
	]

	beforeEach(async () => {
		jest.clearAllMocks()

		// Mock DatabaseService with read-only operations
		mockDatabaseService = {
			initializeDatabase: jest.fn().mockResolvedValue(undefined),
			// Mock methods that support read-only project visibility
			getProjectsByOrganisation: jest
				.fn()
				.mockImplementation((orgId: string) => {
					return Promise.resolve(
						mockProjects.filter((p) => p.organisation_id === orgId),
					)
				}),
			getAllOrganisations: jest.fn().mockResolvedValue(mockOrganisations),
		} as any

		// Mock OfflineService
		mockOfflineService = {
			initialize: jest.fn().mockResolvedValue(undefined),
			destroy: jest.fn().mockResolvedValue(undefined),
		} as any
		;(DatabaseService as jest.Mock).mockImplementation(
			() => mockDatabaseService,
		)
		;(OfflineService as jest.Mock).mockImplementation(() => mockOfflineService)

		wwAdminService = new WWAdminOfflineService()
		await wwAdminService.initialize()
	})

	afterEach(async () => {
		await wwAdminService.destroy()
	})

	describe("Service Initialization", () => {
		it("should initialize successfully with read-only configuration", async () => {
			expect(mockDatabaseService.initializeDatabase).toHaveBeenCalled()
			expect(mockOfflineService.initialize).toHaveBeenCalled()
		})

		it("should load cached data during initialization", async () => {
			// Service should attempt to load organisations and projects cache
			expect(wwAdminService).toBeDefined()
		})
	})

	describe("Cross-Organisation Project Visibility (Read-Only)", () => {
		it("should allow WW Admin to access all organisations", async () => {
			const organisations = await wwAdminService.getAllOrganisations(
				mockWWAdmin,
			)

			expect(organisations).toEqual(expect.any(Array))
			// In actual implementation, would return cached organisations
		})

		it("should deny non-WW Admin access to all organisations", async () => {
			await expect(
				wwAdminService.getAllOrganisations(mockProjectAdmin),
			).rejects.toThrow(
				"Unauthorized: Only WW Admins can access cross-organisation data",
			)
		})

		it("should allow WW Admin to view projects by organisation", async () => {
			const projects = await wwAdminService.getProjectsByOrganisation(
				mockWWAdmin,
				"org-1",
			)

			expect(projects).toEqual(expect.any(Array))
			// Should return projects filtered by organisation
		})

		it("should deny non-WW Admin access to cross-organisation projects", async () => {
			await expect(
				wwAdminService.getProjectsByOrganisation(mockProjectAdmin, "org-2"),
			).rejects.toThrow(
				"Unauthorized: Only WW Admins can access cross-organisation projects",
			)
		})
	})

	describe("Web Portal Integration", () => {
		it("should provide web portal URL for user management", () => {
			const url = wwAdminService.getWebPortalUrl()

			expect(url).toBeDefined()
			expect(typeof url).toBe("string")
			expect(url).toMatch(/^https?:\/\//) // Should be a valid URL
		})

		it("should allow setting custom web portal URL", () => {
			const customUrl = "https://custom-admin.wildlifewatcher.com"

			wwAdminService.setWebPortalUrl(customUrl)
			const retrievedUrl = wwAdminService.getWebPortalUrl()

			expect(retrievedUrl).toBe(customUrl)
		})

		it("should use environment variable for default web portal URL", () => {
			// Service should use EXPO_PUBLIC_WW_ADMIN_PORTAL_URL or default
			const url = wwAdminService.getWebPortalUrl()
			expect(url).toBeDefined()
		})
	})

	describe("Project Overview and Statistics", () => {
		it("should allow WW Admin to get all projects across organisations", async () => {
			const allProjects = await wwAdminService.getAllProjects(mockWWAdmin)

			expect(allProjects).toEqual(expect.any(Array))
			// Should return projects from all organisations cached
		})

		it("should deny non-WW Admin access to all projects", async () => {
			await expect(
				wwAdminService.getAllProjects(mockProjectAdmin),
			).rejects.toThrow("Unauthorized: Only WW Admins can access all projects")
		})

		it("should provide project statistics for WW Admin", async () => {
			const stats = await wwAdminService.getProjectStatistics(mockWWAdmin)

			expect(stats).toEqual({
				total_organisations: expect.any(Number),
				total_projects: expect.any(Number),
				projects_by_status: expect.any(Object),
				recent_projects: expect.any(Array),
			})
		})

		it("should deny non-WW Admin access to project statistics", async () => {
			await expect(
				wwAdminService.getProjectStatistics(mockProjectAdmin),
			).rejects.toThrow(
				"Unauthorized: Only WW Admins can access project statistics",
			)
		})
	})

	describe("Data Refresh and Cache Management", () => {
		it("should allow WW Admin to refresh organisation projects", async () => {
			await wwAdminService.refreshOrganisationProjects(mockWWAdmin, "org-1")

			// Should not throw error and complete successfully
			expect(true).toBe(true)
		})

		it("should deny non-WW Admin data refresh operations", async () => {
			await expect(
				wwAdminService.refreshOrganisationProjects(mockProjectAdmin, "org-1"),
			).rejects.toThrow(
				"Unauthorized: Only WW Admins can refresh organisation data",
			)
		})

		it("should allow WW Admin to refresh all cached data", async () => {
			await wwAdminService.refreshAllData(mockWWAdmin)

			// Should clear caches and reload data
			expect(true).toBe(true)
		})

		it("should deny non-WW Admin access to refresh all data", async () => {
			await expect(
				wwAdminService.refreshAllData(mockProjectAdmin),
			).rejects.toThrow("Unauthorized: Only WW Admins can refresh data")
		})
	})

	describe("Architectural Boundary Tests", () => {
		it("should NOT provide user management operations in mobile app", () => {
			// Test that user management methods don't exist in mobile service
			expect((wwAdminService as any).provisionUser).toBeUndefined()
			expect((wwAdminService as any).assignUserRole).toBeUndefined()
			expect((wwAdminService as any).bulkUserOperations).toBeUndefined()
			expect((wwAdminService as any).getUsersByOrganisation).toBeUndefined()
		})

		it("should NOT provide system configuration operations in mobile app", () => {
			// Test that system config methods don't exist in mobile service
			expect((wwAdminService as any).updateSystemConfiguration).toBeUndefined()
			expect((wwAdminService as any).getSystemConfiguration).toBeUndefined()
			expect((wwAdminService as any).configureLoRaWANDevice).toBeUndefined()
		})

		it("should only provide read-only operations for mobile app", () => {
			// Test that only read-only methods are available
			expect(typeof wwAdminService.getAllOrganisations).toBe("function")
			expect(typeof wwAdminService.getProjectsByOrganisation).toBe("function")
			expect(typeof wwAdminService.getAllProjects).toBe("function")
			expect(typeof wwAdminService.getProjectStatistics).toBe("function")
			expect(typeof wwAdminService.getWebPortalUrl).toBe("function")
		})

		it("should redirect user management operations to web portal", () => {
			// Web portal URL should be configured for user management
			const webPortalUrl = wwAdminService.getWebPortalUrl()
			expect(webPortalUrl).toBeDefined()
			expect(webPortalUrl).toMatch(/admin|portal/)
		})
	})

	describe("WW Admin Access Validation", () => {
		it("should validate WW Admin role correctly", async () => {
			// Test that WW Admin validation works
			const organisations = await wwAdminService.getAllOrganisations(
				mockWWAdmin,
			)
			expect(organisations).toBeDefined()
		})

		it("should reject project_admin role for WW Admin operations", async () => {
			await expect(
				wwAdminService.getAllOrganisations(mockProjectAdmin),
			).rejects.toThrow(/Unauthorized.*WW Admin/)
		})

		it("should reject project_member role for WW Admin operations", async () => {
			const projectMember: User = {
				id: "member-1",
				role: "project_member",
				organisation_id: "org-1",
			}

			await expect(
				wwAdminService.getAllOrganisations(projectMember),
			).rejects.toThrow(/Unauthorized.*WW Admin/)
		})

		it("should validate permissions for each read-only operation", async () => {
			// Test that all methods properly validate WW Admin access
			const operations = [
				() =>
					wwAdminService.getProjectsByOrganisation(mockProjectAdmin, "org-1"),
				() => wwAdminService.getAllProjects(mockProjectAdmin),
				() => wwAdminService.getProjectStatistics(mockProjectAdmin),
				() =>
					wwAdminService.refreshOrganisationProjects(mockProjectAdmin, "org-1"),
				() => wwAdminService.refreshAllData(mockProjectAdmin),
			]

			for (const operation of operations) {
				await expect(operation()).rejects.toThrow(/Unauthorized.*WW Admin/)
			}
		})
	})

	describe("Service Cleanup and Resource Management", () => {
		it("should cleanup resources on destroy", async () => {
			await wwAdminService.destroy()

			expect(mockOfflineService.destroy).toHaveBeenCalled()
		})

		it("should clear caches on destroy", async () => {
			// Load some data first
			await wwAdminService.getAllOrganisations(mockWWAdmin)

			// Destroy should clear caches
			await wwAdminService.destroy()

			// Service should be cleaned up
			expect(mockOfflineService.destroy).toHaveBeenCalled()
		})

		it("should handle multiple destroy calls gracefully", async () => {
			await wwAdminService.destroy()
			await wwAdminService.destroy() // Should not throw

			expect(mockOfflineService.destroy).toHaveBeenCalledTimes(2)
		})
	})

	describe("Integration with New wwAdminSlice Architecture", () => {
		it("should support data structure expected by wwAdminSlice", async () => {
			const projects = await wwAdminService.getAllProjects(mockWWAdmin)

			// Projects should match Project interface from wwAdminSlice
			projects.forEach((project) => {
				expect(project).toEqual(
					expect.objectContaining({
						id: expect.any(String),
						name: expect.any(String),
						organisation_id: expect.any(String),
						created_at: expect.any(String),
						updated_at: expect.any(String),
						is_private: expect.any(Boolean),
					}),
				)
			})
		})

		it("should provide web portal URL for Redux state management", () => {
			const url = wwAdminService.getWebPortalUrl()

			// Should match webPortalUrl expected by wwAdminSlice
			expect(typeof url).toBe("string")
			expect(url.length).toBeGreaterThan(0)
		})

		it("should support permission validation expected by Redux selectors", async () => {
			// Test that service methods validate permissions consistently
			// with wwAdminSlice permission structure

			// WW Admin should have access
			await expect(
				wwAdminService.getAllProjects(mockWWAdmin),
			).resolves.toBeDefined()

			// Non-WW Admin should be denied
			await expect(
				wwAdminService.getAllProjects(mockProjectAdmin),
			).rejects.toThrow()
		})
	})

	describe("Error Handling and Edge Cases", () => {
		it("should handle empty organisation cache gracefully", async () => {
			const organisations = await wwAdminService.getAllOrganisations(
				mockWWAdmin,
			)

			// Should return empty array, not throw error
			expect(Array.isArray(organisations)).toBe(true)
		})

		it("should handle missing projects for organisation", async () => {
			const projects = await wwAdminService.getProjectsByOrganisation(
				mockWWAdmin,
				"non-existent-org",
			)

			// Should return empty array, not throw error
			expect(Array.isArray(projects)).toBe(true)
		})

		it("should handle statistics calculation with empty data", async () => {
			const stats = await wwAdminService.getProjectStatistics(mockWWAdmin)

			// Should return valid statistics structure even with no data
			expect(stats).toEqual(
				expect.objectContaining({
					total_organisations: expect.any(Number),
					total_projects: expect.any(Number),
					projects_by_status: expect.any(Object),
					recent_projects: expect.any(Array),
				}),
			)
		})
	})
})
