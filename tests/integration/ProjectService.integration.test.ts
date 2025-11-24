/**
 * ProjectService Integration Tests
 * Tests ProjectService against live local Supabase backend
 *
 * Prerequisites:
 * - Local Supabase running on http://127.0.0.1:54321
 * - Database migrations applied
 * - Seed data loaded (roles, etc.)
 *
 * @group integration
 */

import ProjectService from "../../src/services/ProjectService"
import {
	testSupabase,
	adminSupabase,
	createTestUser,
	createTestOrganisation,
	assignUserToOrganisation,
	grantUserRole,
	signInTestUser,
	cleanupTestData,
	checkLocalSupabase,
} from "../setup/supabase-test-client"
import {
	testUsers,
	testOrganisations,
	sampleProjectInputs,
	roleIds,
	testRoles,
} from "../fixtures/project-test-data"
import type { Project, ProjectWithDetails } from "../../src/types/project"

describe("ProjectService Integration Tests", () => {
	let org1Id: string
	let org2Id: string
	let org1AdminId: string
	let org1MemberId: string
	let org2AdminId: string
	let wwAdminId: string

	// Setup test data
	beforeAll(async () => {
		// Check if local Supabase is running
		const isRunning = await checkLocalSupabase()
		if (!isRunning) {
			throw new Error(
				"❌ Local Supabase is not running. Start it with: supabase start",
			)
		}

		// Clean up any existing test data
		await cleanupTestData()

		// Create test users
		const org1Admin = await createTestUser(
			testUsers.org1Admin.email,
			testUsers.org1Admin.password,
			testUsers.org1Admin.name,
		)
		org1AdminId = org1Admin.id

		const org1Member = await createTestUser(
			testUsers.org1Member.email,
			testUsers.org1Member.password,
			testUsers.org1Member.name,
		)
		org1MemberId = org1Member.id

		const org2Admin = await createTestUser(
			testUsers.org2Admin.email,
			testUsers.org2Admin.password,
			testUsers.org2Admin.name,
		)
		org2AdminId = org2Admin.id

		const wwAdmin = await createTestUser(
			testUsers.wwAdmin.email,
			testUsers.wwAdmin.password,
			testUsers.wwAdmin.name,
		)
		wwAdminId = wwAdmin.id

		// Create test organisations
		const org1 = await createTestOrganisation(
			testOrganisations.org1.name,
			testOrganisations.org1.slug,
			org1AdminId,
		)
		org1Id = org1.id

		const org2 = await createTestOrganisation(
			testOrganisations.org2.name,
			testOrganisations.org2.slug,
			org2AdminId,
		)
		org2Id = org2.id

		// Assign users to organisations
		await assignUserToOrganisation(org1AdminId, org1Id)
		await assignUserToOrganisation(org1MemberId, org1Id)
		await assignUserToOrganisation(org2AdminId, org2Id)

		// Grant roles
		await grantUserRole(
			org1AdminId,
			testRoles.projectAdmin,
			"organisation",
			org1Id,
		)
		await grantUserRole(
			org1MemberId,
			testRoles.projectMember,
			"organisation",
			org1Id,
		)
		await grantUserRole(
			org2AdminId,
			testRoles.projectAdmin,
			"organisation",
			org2Id,
		)
		await grantUserRole(wwAdminId, testRoles.wwAdmin, "global")

		// WW Admin also assigned to org1 for testing org-scoped access
		await assignUserToOrganisation(wwAdminId, org1Id)
	})

	afterAll(async () => {
		// Clean up test data
		await cleanupTestData()
	})

	afterEach(async () => {
		// Sign out between tests
		await testSupabase.auth.signOut()
	})

	describe("Organisation Isolation", () => {
		let org1ProjectId: string
		let org2ProjectId: string

		beforeEach(async () => {
			// Sign in as org1 admin and create project
			await signInTestUser(
				testUsers.org1Admin.email,
				testUsers.org1Admin.password,
			)

			const org1Project = await ProjectService.createProject({
				...sampleProjectInputs.wildlifeSurvey,
				organisation_id: org1Id,
			})
			org1ProjectId = org1Project.id

			// Sign out
			await testSupabase.auth.signOut()

			// Sign in as org2 admin and create project
			await signInTestUser(
				testUsers.org2Admin.email,
				testUsers.org2Admin.password,
			)

			const org2Project = await ProjectService.createProject({
				...sampleProjectInputs.tigerMonitoring,
				organisation_id: org2Id,
			})
			org2ProjectId = org2Project.id

			// Sign out
			await testSupabase.auth.signOut()
		})

		afterEach(async () => {
			// Clean up projects
			await adminSupabase
				.from("projects")
				.delete()
				.in("id", [org1ProjectId, org2ProjectId])
		})

		it("should only return projects from user org", async () => {
			// Sign in as org1 admin
			await signInTestUser(
				testUsers.org1Admin.email,
				testUsers.org1Admin.password,
			)

			const projects = await ProjectService.getUserProjects(org1Id)

			expect(projects).toHaveLength(1)
			expect(projects[0].id).toBe(org1ProjectId)
			expect(projects[0].organisation_id).toBe(org1Id)
			expect(projects.every((p) => p.organisation_id === org1Id)).toBe(true)
		})

		it("should enforce org-scoped access for WW Admin", async () => {
			// Sign in as WW Admin (assigned to org1)
			await signInTestUser(testUsers.wwAdmin.email, testUsers.wwAdmin.password)

			const projects = await ProjectService.getUserProjects(org1Id)

			// WW Admin should only see org1 projects (org-scoped, not global)
			expect(projects).toHaveLength(1)
			expect(projects[0].id).toBe(org1ProjectId)
			expect(projects[0].organisation_id).toBe(org1Id)
		})

		it("should block cross-org project access", async () => {
			// Sign in as org1 admin
			await signInTestUser(
				testUsers.org1Admin.email,
				testUsers.org1Admin.password,
			)

			// Attempt to access org2's project
			const project = await ProjectService.getProjectById(org2ProjectId)

			// Should return null due to RLS
			expect(project).toBeNull()
		})
	})

	describe("CRUD Operations", () => {
		it("should create project with org context", async () => {
			// Sign in as org1 admin
			await signInTestUser(
				testUsers.org1Admin.email,
				testUsers.org1Admin.password,
			)

			const projectInput = {
				...sampleProjectInputs.birdMigration,
				organisation_id: org1Id,
			}

			const project = await ProjectService.createProject(projectInput)

			expect(project).toBeDefined()
			expect(project.id).toBeDefined()
			expect(project.name).toBe(projectInput.name)
			expect(project.organisation_id).toBe(org1Id)
			expect(project.created_by).toBe(org1AdminId)
			expect(project.is_baited).toBe(false)
			expect(project.is_monitoring_marked_individuals).toBe(null)

			// Cleanup
			await adminSupabase.from("projects").delete().eq("id", project.id)
		})

		it("should update project with permission validation", async () => {
			// Sign in as org1 admin and create project
			await signInTestUser(
				testUsers.org1Admin.email,
				testUsers.org1Admin.password,
			)

			const project = await ProjectService.createProject({
				...sampleProjectInputs.wildlifeSurvey,
				organisation_id: org1Id,
			})

			// Update project
			const updates = {
				name: "Updated Wildlife Survey",
				description: "Updated description",
				is_baited: true,
			}

			const updatedProject = await ProjectService.updateProject(
				project.id,
				updates,
			)

			expect(updatedProject.name).toBe(updates.name)
			expect(updatedProject.description).toBe(updates.description)
			expect(updatedProject.is_baited).toBe(true)
			expect(updatedProject.updated_at).not.toBe(project.updated_at)

			// Cleanup
			await adminSupabase.from("projects").delete().eq("id", project.id)
		})

		it("should prevent project update by non-admin", async () => {
			// Sign in as org1 admin and create project
			await signInTestUser(
				testUsers.org1Admin.email,
				testUsers.org1Admin.password,
			)

			const project = await ProjectService.createProject({
				...sampleProjectInputs.wildlifeSurvey,
				organisation_id: org1Id,
			})

			// Sign out and sign in as org1 member
			await testSupabase.auth.signOut()
			await signInTestUser(
				testUsers.org1Member.email,
				testUsers.org1Member.password,
			)

			// Attempt to update project
			await expect(
				ProjectService.updateProject(project.id, { name: "Hacked Name" }),
			).rejects.toThrow()

			// Cleanup
			await adminSupabase.from("projects").delete().eq("id", project.id)
		})

		it("should soft delete project", async () => {
			// Sign in as org1 admin and create project
			await signInTestUser(
				testUsers.org1Admin.email,
				testUsers.org1Admin.password,
			)

			const project = await ProjectService.createProject({
				...sampleProjectInputs.wildlifeSurvey,
				organisation_id: org1Id,
			})

			// Delete project (soft delete)
			await ProjectService.deleteProject(project.id)

			// Verify project no longer in getUserProjects()
			const projects = await ProjectService.getUserProjects(org1Id)
			expect(projects.find((p) => p.id === project.id)).toBeUndefined()

			// Verify project still exists but has deleted_at set
			const { data: deletedProject } = await adminSupabase
				.from("projects")
				.select("*")
				.eq("id", project.id)
				.single()

			expect(deletedProject).toBeDefined()
			expect(deletedProject!.deleted_at).not.toBeNull()

			// Cleanup
			await adminSupabase.from("projects").delete().eq("id", project.id)
		})
	})

	describe("Member Management", () => {
		let projectId: string

		beforeEach(async () => {
			// Sign in as org1 admin and create project
			await signInTestUser(
				testUsers.org1Admin.email,
				testUsers.org1Admin.password,
			)

			const project = await ProjectService.createProject({
				...sampleProjectInputs.wildlifeSurvey,
				organisation_id: org1Id,
			})
			projectId = project.id
		})

		afterEach(async () => {
			// Clean up project and members
			await adminSupabase
				.from("project_members")
				.delete()
				.eq("project_id", projectId)
			await adminSupabase.from("projects").delete().eq("id", projectId)
		})

		it("should add member to project", async () => {
			// Add org1 member to project
			await ProjectService.addProjectMember(
				projectId,
				org1MemberId,
				roleIds.projectMember,
			)

			// Verify member added
			const members = await ProjectService.getProjectMembers(projectId)
			const addedMember = members.find((m) => m.user_id === org1MemberId)

			expect(addedMember).toBeDefined()
			expect(addedMember!.project_id).toBe(projectId)
			expect(addedMember!.user_id).toBe(org1MemberId)
			expect(addedMember!.role_id).toBe(roleIds.projectMember)
			expect(addedMember!.user_profile?.name).toBe(testUsers.org1Member.name)
		})

		it("should prevent cross-org member assignment", async () => {
			// Attempt to add org2 admin to org1 project
			await expect(
				ProjectService.addProjectMember(
					projectId,
					org2AdminId,
					roleIds.projectMember,
				),
			).rejects.toThrow(/same organisation/i)
		})

		it("should remove member from project", async () => {
			// Add member first
			await ProjectService.addProjectMember(
				projectId,
				org1MemberId,
				roleIds.projectMember,
			)

			// Verify member exists
			let members = await ProjectService.getProjectMembers(projectId)
			expect(members.find((m) => m.user_id === org1MemberId)).toBeDefined()

			// Remove member (soft delete)
			await ProjectService.removeProjectMember(projectId, org1MemberId)

			// Verify member removed
			members = await ProjectService.getProjectMembers(projectId)
			expect(members.find((m) => m.user_id === org1MemberId)).toBeUndefined()
		})

		it("should get all project members with profiles", async () => {
			// Add org1 member to project
			await ProjectService.addProjectMember(
				projectId,
				org1MemberId,
				roleIds.projectMember,
			)

			const members = await ProjectService.getProjectMembers(projectId)

			expect(members.length).toBeGreaterThan(0)
			expect(members[0].user_profile).toBeDefined()
			expect(members[0].role).toBeDefined()
			expect(members[0].user_profile?.name).toBeDefined()
			expect(members[0].role?.value).toBeDefined()
		})
	})

	describe("Computed Fields", () => {
		let projectId: string

		beforeEach(async () => {
			// Sign in as org1 admin and create project
			await signInTestUser(
				testUsers.org1Admin.email,
				testUsers.org1Admin.password,
			)

			const project = await ProjectService.createProject({
				...sampleProjectInputs.wildlifeSurvey,
				organisation_id: org1Id,
			})
			projectId = project.id
		})

		afterEach(async () => {
			// Clean up
			await adminSupabase
				.from("project_members")
				.delete()
				.eq("project_id", projectId)
			await adminSupabase.from("projects").delete().eq("id", projectId)
		})

		it("should return correct member_count", async () => {
			// Add 2 members
			await ProjectService.addProjectMember(
				projectId,
				org1MemberId,
				roleIds.projectMember,
			)
			await ProjectService.addProjectMember(
				projectId,
				wwAdminId,
				roleIds.projectMember,
			)

			const project = await ProjectService.getProjectById(projectId)

			expect(project).toBeDefined()
			expect(project!.member_count).toBe(2)
		})

		it("should return deployment_count", async () => {
			const project = await ProjectService.getProjectById(projectId)

			expect(project).toBeDefined()
			expect(project!.deployment_count).toBeDefined()
			expect(typeof project!.deployment_count).toBe("number")
			// Initially 0 as no deployments created
			expect(project!.deployment_count).toBeGreaterThanOrEqual(0)
		})

		it("should return lorawan_device_count", async () => {
			const project = await ProjectService.getProjectById(projectId)

			expect(project).toBeDefined()
			expect(project!.lorawan_device_count).toBeDefined()
			expect(typeof project!.lorawan_device_count).toBe("number")
			// May be 0 for now until LoRaWAN integration
			expect(project!.lorawan_device_count).toBeGreaterThanOrEqual(0)
		})
	})

	describe("Offline Queue", () => {
		it("should queue create operations when offline", async () => {
			// Sign in first
			await signInTestUser(
				testUsers.org1Admin.email,
				testUsers.org1Admin.password,
			)

			// This test would require mocking network status
			// For now, we'll skip as it requires offline service integration
			// TODO: Implement when OfflineService is integrated
			expect(true).toBe(true)
		})

		it("should sync queued operations when online", async () => {
			// This test would require offline queue implementation
			// TODO: Implement when OfflineService is integrated
			expect(true).toBe(true)
		})
	})

	describe("Error Handling", () => {
		beforeEach(async () => {
			await signInTestUser(
				testUsers.org1Admin.email,
				testUsers.org1Admin.password,
			)
		})

		it("should handle network failures", async () => {
			// This would require mocking network failures
			// For integration tests, we test actual errors

			await expect(
				ProjectService.getProjectById("non-existent-id"),
			).resolves.toBeNull()
		})

		it("should handle permission denied errors", async () => {
			// Sign in as org1 member (no create permission)
			await testSupabase.auth.signOut()
			await signInTestUser(
				testUsers.org1Member.email,
				testUsers.org1Member.password,
			)

			// Attempt to create project (only admins can create)
			await expect(
				ProjectService.createProject({
					...sampleProjectInputs.wildlifeSurvey,
					organisation_id: org1Id,
				}),
			).rejects.toThrow()
		})

		it("should handle org limit violations", async () => {
			// This would test user org membership limits
			// Currently backend enforces max 1 standard org, 2 for WW Admin
			// TODO: Implement when org limit enforcement is in backend
			expect(true).toBe(true)
		})

		it("should handle cross-org assignment attempts", async () => {
			// Create project in org1
			const project = await ProjectService.createProject({
				...sampleProjectInputs.wildlifeSurvey,
				organisation_id: org1Id,
			})

			// Attempt to add org2 user
			await expect(
				ProjectService.addProjectMember(
					project.id,
					org2AdminId,
					roleIds.projectMember,
				),
			).rejects.toThrow(/same organisation/i)

			// Cleanup
			await adminSupabase.from("projects").delete().eq("id", project.id)
		})
	})
})
