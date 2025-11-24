/**
 * Database service tests - uses default node environment
 */
import {
	DatabaseService,
	DatabaseProject,
	DatabaseDeployment,
	OfflineQueueItem,
} from "../../../../src/services/offline/DatabaseService"
import * as SQLite from "expo-sqlite"

// Mock expo-sqlite
jest.mock("expo-sqlite", () => ({
	openDatabaseAsync: jest.fn(),
}))

describe("DatabaseService", () => {
	let databaseService: DatabaseService
	let mockDb: any

	beforeEach(async () => {
		// Reset all mocks
		jest.clearAllMocks()

		// Mock SQLite database instance
		mockDb = {
			execAsync: jest.fn(),
			runAsync: jest.fn(),
			getFirstAsync: jest.fn(() => Promise.resolve({ user_version: 0 })),
			getAllAsync: jest.fn(() => Promise.resolve([])),
			closeAsync: jest.fn(),
		}
			; (SQLite.openDatabaseAsync as jest.Mock).mockResolvedValue(mockDb)

		databaseService = new DatabaseService()
		await databaseService.initializeDatabase()
	})

	afterEach(async () => {
		await databaseService.closeDatabase()
	})

	describe("Database Initialization", () => {
		it("should open database successfully", async () => {
			expect(SQLite.openDatabaseAsync).toHaveBeenCalledWith(
				"wildlife_watcher.db",
				{ enableChangeListener: true },
			)
		})

		it("should create required tables on initialization", async () => {
			const expectedTables = [
				"offline_queue",
				"local_deployments",
				"local_projects",
				"local_devices",
				"local_organisations",
				"local_user_roles",
			]

			// Check that CREATE TABLE statements were executed for each table
			expectedTables.forEach((tableName) => {
				expect(mockDb.execAsync).toHaveBeenCalledWith(
					expect.stringContaining(`CREATE TABLE IF NOT EXISTS ${tableName}`),
				)
			})
		})

		it("should enable foreign key constraints", async () => {
			expect(mockDb.execAsync).toHaveBeenCalledWith("PRAGMA foreign_keys = ON;")
		})

		it("should set journal mode to WAL for better performance", async () => {
			expect(mockDb.execAsync).toHaveBeenCalledWith(
				"PRAGMA journal_mode = WAL;",
			)
		})
	})

	describe("Organisation Multi-Tenancy", () => {
		const sampleOrganisation = {
			id: "org-123",
			name: "Test Wildlife Organisation",
			settings: { timezone: "UTC", currency: "USD" },
		}

		it("should insert organisation with proper isolation", async () => {
			mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 1 })

			await databaseService.insertOrganisation(sampleOrganisation)

			expect(mockDb.runAsync).toHaveBeenCalledWith(
				expect.stringContaining("INSERT INTO local_organisations"),
				expect.arrayContaining([
					sampleOrganisation.id,
					sampleOrganisation.name,
					JSON.stringify(sampleOrganisation.settings),
				]),
			)
		})

		it("should retrieve organisations by ID only", async () => {
			mockDb.getFirstAsync.mockResolvedValue({
				id: sampleOrganisation.id,
				name: sampleOrganisation.name,
				settings: JSON.stringify(sampleOrganisation.settings),
			})

			const result = await databaseService.getOrganisationById(
				sampleOrganisation.id,
			)

			expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
				expect.stringContaining(
					"SELECT * FROM local_organisations WHERE id = ?",
				),
				[sampleOrganisation.id],
			)
			expect(result).toEqual(
				expect.objectContaining({
					id: sampleOrganisation.id,
					name: sampleOrganisation.name,
				}),
			)
		})
	})

	describe("User Role Management", () => {
		const sampleUserRole = {
			user_id: "user-456",
			organisation_id: "org-123",
			role: "project_admin" as const,
			permissions: ["create_projects", "manage_members"],
		}

		it("should insert user role with organisation scoping", async () => {
			mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 1 })

			await databaseService.insertUserRole(sampleUserRole)

			expect(mockDb.runAsync).toHaveBeenCalledWith(
				expect.stringContaining("INSERT INTO local_user_roles"),
				expect.arrayContaining([
					sampleUserRole.user_id,
					sampleUserRole.organisation_id,
					sampleUserRole.role,
					JSON.stringify(sampleUserRole.permissions),
				]),
			)
		})

		it("should retrieve user roles by organisation and user", async () => {
			mockDb.getAllAsync.mockResolvedValue([
				{
					user_id: sampleUserRole.user_id,
					organisation_id: sampleUserRole.organisation_id,
					role: sampleUserRole.role,
					permissions: JSON.stringify(sampleUserRole.permissions),
				},
			])

			const result = await databaseService.getUserRolesByOrganisation(
				sampleUserRole.user_id,
				sampleUserRole.organisation_id,
			)

			expect(mockDb.getAllAsync).toHaveBeenCalledWith(
				expect.stringContaining(
					"SELECT * FROM local_user_roles WHERE user_id = ? AND organisation_id = ?",
				),
				[sampleUserRole.user_id, sampleUserRole.organisation_id],
			)
			expect(result).toHaveLength(1)
			expect(result[0].role).toBe(sampleUserRole.role)
		})

		it("should validate WW Admin global access", async () => {
			const adminUserRole = {
				user_id: "admin-789",
				organisation_id: "global",
				role: "ww_admin" as const,
				permissions: ["manage_all_organisations", "provision_users"],
			}

			mockDb.getFirstAsync.mockResolvedValue({
				user_id: adminUserRole.user_id,
				role: adminUserRole.role,
				permissions: JSON.stringify(adminUserRole.permissions),
			})

			const hasGlobalAccess = await databaseService.validateWWAdminAccess(
				adminUserRole.user_id,
			)

			expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
				expect.stringContaining(
					"SELECT * FROM local_user_roles WHERE user_id = ? AND role = 'ww_admin'",
				),
				[adminUserRole.user_id],
			)
			expect(hasGlobalAccess).toBe(true)
		})
	})

	describe("Project Data with Organisation Scoping", () => {
		const sampleProject: DatabaseProject = {
			id: "project-789",
			organisation_id: "org-123",
			name: "Wildlife Survey 2025",
			description: "Annual wildlife population survey",
			status: "active" as const,
			members: ["user-456", "user-789"],
		}

		it("should insert project with organisation scoping", async () => {
			mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 1 })

			await databaseService.insertProject(sampleProject)

			expect(mockDb.runAsync).toHaveBeenCalledWith(
				expect.stringContaining("INSERT INTO local_projects"),
				expect.arrayContaining([
					sampleProject.id,
					sampleProject.organisation_id,
					sampleProject.name,
					sampleProject.description,
					sampleProject.status,
					JSON.stringify(sampleProject.members),
				]),
			)
		})

		it("should prevent cross-organisation project access", async () => {
			mockDb.getAllAsync.mockResolvedValue([])

			const projects = await databaseService.getProjectsByOrganisation(
				"different-org-456",
			)

			expect(mockDb.getAllAsync).toHaveBeenCalledWith(
				expect.stringContaining(
					"SELECT * FROM local_projects WHERE organisation_id = ?",
				),
				["different-org-456"],
			)
			expect(projects).toHaveLength(0)
		})
	})

	describe("Deployment Data with LoRaWAN Integration", () => {
		const sampleDeployment: DatabaseDeployment = {
			id: "deployment-456",
			project_id: "project-789",
			organisation_id: "org-123",
			device_id: "device-123",
			location: { lat: 40.7128, lng: -74.006 },
			status: "active" as const,
			lorawan_status: {
				battery_level: 85,
				sd_card_usage: 45,
				device_status: "online",
				last_seen: "2025-08-31T16:00:00Z",
			},
		}

		it("should insert deployment with LoRaWAN status tracking", async () => {
			mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 1 })

			await databaseService.insertDeployment(sampleDeployment)

			expect(mockDb.runAsync).toHaveBeenCalledWith(
				expect.stringContaining("INSERT INTO local_deployments"),
				expect.arrayContaining([
					sampleDeployment.id,
					sampleDeployment.project_id,
					sampleDeployment.organisation_id,
					sampleDeployment.device_id,
					JSON.stringify(sampleDeployment.location),
					sampleDeployment.status,
					JSON.stringify(sampleDeployment.lorawan_status),
				]),
			)
		})

		it("should update LoRaWAN device status for existing deployment", async () => {
			const updatedLoRaWANStatus = {
				battery_level: 65,
				sd_card_usage: 55,
				device_status: "online" as const,
				last_seen: "2025-08-31T17:00:00Z",
			}

			mockDb.runAsync.mockResolvedValue({ changes: 1 })

			await databaseService.updateDeploymentLoRaWANStatus(
				sampleDeployment.id,
				updatedLoRaWANStatus,
			)

			expect(mockDb.runAsync).toHaveBeenCalledWith(
				expect.stringContaining(
					"UPDATE local_deployments SET lorawan_status = ?",
				),
				expect.arrayContaining([
					JSON.stringify(updatedLoRaWANStatus),
					sampleDeployment.id,
				]),
			)
		})
	})

	describe("Offline Queue System", () => {
		const sampleQueueItem: OfflineQueueItem = {
			id: "queue-123",
			operation_type: "create_project",
			data: { name: "New Project", organisation_id: "org-123" },
			organisation_id: "org-123",
			user_id: "user-456",
			priority: "high" as const,
			retry_count: 0,
			max_retries: 3,
			status: "pending" as const,
		}

		it("should add operation to offline queue", async () => {
			mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 1 })

			await databaseService.addToOfflineQueue(sampleQueueItem)

			expect(mockDb.runAsync).toHaveBeenCalledWith(
				expect.stringContaining("INSERT INTO offline_queue"),
				expect.arrayContaining([
					sampleQueueItem.operation_type,
					JSON.stringify(sampleQueueItem.data),
					sampleQueueItem.organisation_id,
					sampleQueueItem.user_id,
					sampleQueueItem.priority,
					sampleQueueItem.retry_count,
					sampleQueueItem.max_retries,
					sampleQueueItem.status,
				]),
			)
		})

		it("should retrieve pending queue items by priority", async () => {
			mockDb.getAllAsync.mockResolvedValue([
				{
					id: sampleQueueItem.id,
					operation_type: sampleQueueItem.operation_type,
					data: JSON.stringify(sampleQueueItem.data),
					organisation_id: sampleQueueItem.organisation_id,
					priority: sampleQueueItem.priority,
					status: sampleQueueItem.status,
				},
			])

			const queueItems = await databaseService.getPendingQueueItems()

			expect(mockDb.getAllAsync).toHaveBeenCalledWith(
				expect.stringContaining(
					"SELECT * FROM offline_queue WHERE status = 'pending' ORDER BY priority DESC, created_at ASC",
				),
			)
			expect(queueItems).toHaveLength(1)
			expect(queueItems[0].operation_type).toBe(sampleQueueItem.operation_type)
		})

		it("should update queue item retry count and status", async () => {
			mockDb.runAsync.mockResolvedValue({ changes: 1 })

			await databaseService.updateQueueItemRetry(
				sampleQueueItem.id!,
				1,
				"failed",
			)

			expect(mockDb.runAsync).toHaveBeenCalledWith(
				expect.stringContaining(
					"UPDATE offline_queue SET retry_count = ?, status = ?",
				),
				expect.arrayContaining([1, "failed", sampleQueueItem.id]),
			)
		})
	})

	describe("Database Migration System", () => {
		it("should check database version", async () => {
			mockDb.getFirstAsync.mockResolvedValue({ user_version: 1 })

			const version = await databaseService.getDatabaseVersion()

			expect(mockDb.getFirstAsync).toHaveBeenCalledWith("PRAGMA user_version")
			expect(version).toBe(1)
		})

		it("should update database version after migration", async () => {
			mockDb.runAsync.mockResolvedValue({})

			await databaseService.setDatabaseVersion(2)

			expect(mockDb.runAsync).toHaveBeenCalledWith("PRAGMA user_version = 2")
		})

		it("should run migration scripts in order", async () => {
			mockDb.getFirstAsync.mockResolvedValue({ user_version: 0 })
			mockDb.runAsync.mockResolvedValue({})
			mockDb.execAsync.mockResolvedValue({})

			await databaseService.runMigrations()

			// Should update to latest version (1)
			expect(mockDb.runAsync).toHaveBeenCalledWith("PRAGMA user_version = 1")
		})
	})

	describe("Error Handling and Data Integrity", () => {
		it("should handle database connection errors gracefully", async () => {
			; (SQLite.openDatabaseAsync as jest.Mock).mockRejectedValue(
				new Error("Database connection failed"),
			)

			const failingService = new DatabaseService()

			await expect(failingService.initializeDatabase()).rejects.toThrow(
				"Database connection failed",
			)
		})

		it("should validate organisation_id for all operations", async () => {
			const invalidProject = {
				id: "project-invalid",
				organisation_id: "",
				name: "Invalid Project",
				description: "Test project",
				status: "active",
				members: [],
			}

			await expect(
				databaseService.insertProject(invalidProject as any),
			).rejects.toThrow("Organisation ID is required")
		})

		it("should prevent SQL injection in queries", async () => {
			const maliciousOrgId = "'; DROP TABLE local_projects; --"

			mockDb.getAllAsync.mockResolvedValue([])

			await databaseService.getProjectsByOrganisation(maliciousOrgId)

			// Should use parameterized query, not string concatenation
			expect(mockDb.getAllAsync).toHaveBeenCalledWith(
				expect.not.stringContaining("DROP TABLE"),
				[maliciousOrgId],
			)
		})
	})
})
