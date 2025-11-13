/**
 * @jest-environment node
 */
import { OfflineService } from "../../../../src/services/offline/OfflineService"
import {
	DatabaseService,
	OfflineQueueItem,
} from "../../../../src/services/offline/DatabaseService"
import NetInfo from "@react-native-community/netinfo"
import {
	UserRole,
	OfflineOperation,
	NetworkStatus,
	OfflineOperationType,
	LoRaWANStatus,
} from "../../../../src/types/offline"

// Mock expo-sqlite first (before other imports)
jest.mock("expo-sqlite", () => ({
	openDatabaseAsync: jest.fn(),
}))

// Mock dependencies
jest.mock("../../../../src/services/offline/DatabaseService")
jest.mock("../../../../src/services/offline/OfflineApiService", () => ({
	OfflineApiService: {
		createProject: jest
			.fn()
			.mockResolvedValue({ id: "project-1", name: "Test Project" }),
		updateProject: jest
			.fn()
			.mockResolvedValue({ id: "project-1", name: "Updated Project" }),
		deleteProject: jest.fn().mockResolvedValue(undefined),
		createDeployment: jest
			.fn()
			.mockResolvedValue({ id: "deployment-1", project_id: "project-1" }),
		updateDeployment: jest
			.fn()
			.mockResolvedValue({ id: "deployment-1", project_id: "project-1" }),
		deleteDeployment: jest.fn().mockResolvedValue(undefined),
	},
}))
jest.mock("@react-native-community/netinfo", () => ({
	fetch: jest.fn(() =>
		Promise.resolve({
			isConnected: true,
			type: "wifi",
			details: null,
		}),
	),
	addEventListener: jest.fn(() => jest.fn()), // Return unsubscribe function
	default: {
		fetch: jest.fn(() =>
			Promise.resolve({
				isConnected: true,
				type: "wifi",
				details: null,
			}),
		),
		addEventListener: jest.fn(() => jest.fn()),
	},
}))

describe("OfflineService", () => {
	let offlineService: OfflineService
	let mockDatabaseService: jest.Mocked<DatabaseService>
	let mockNetInfo: jest.Mocked<typeof NetInfo>

	const mockUser = {
		id: "user-1",
		role: "project_admin" as UserRole,
		organisation_id: "org-1",
	}

	beforeEach(() => {
		// Reset all mocks
		jest.clearAllMocks()

		// Mock DatabaseService
		mockDatabaseService = {
			initializeDatabase: jest.fn().mockResolvedValue(undefined),
			addToOfflineQueue: jest.fn().mockResolvedValue(undefined),
			getPendingQueueItems: jest.fn().mockResolvedValue([]),
			getQueueItemsByOrganisation: jest.fn().mockResolvedValue([]),
			markQueueItemCompleted: jest.fn().mockResolvedValue(undefined),
			updateQueueItemRetry: jest.fn().mockResolvedValue(undefined),
			updateDeploymentLoRaWANStatus: jest.fn().mockResolvedValue(undefined),
			getProjectsByOrganisation: jest.fn().mockResolvedValue([]),
			getDeploymentsByOrganisation: jest.fn().mockResolvedValue([]),
			insertProject: jest.fn().mockResolvedValue(undefined),
			insertDeployment: jest.fn().mockResolvedValue(undefined),
		} as any
		;(DatabaseService as jest.Mock).mockImplementation(
			() => mockDatabaseService,
		)

		// Mock NetInfo
		mockNetInfo = NetInfo as jest.Mocked<typeof NetInfo>
		mockNetInfo.fetch.mockResolvedValue({
			isConnected: true,
			type: "wifi",
			details: null,
		} as any)

		offlineService = new OfflineService()
	})

	describe("Initialization", () => {
		it("should initialize successfully", async () => {
			await offlineService.initialize()
			expect(mockDatabaseService.initializeDatabase).toHaveBeenCalled()
		})

		it("should set up network monitoring", async () => {
			await offlineService.initialize()
			expect(mockNetInfo.addEventListener).toHaveBeenCalled()
		})
	})

	describe("Network Monitoring", () => {
		it("should detect network status changes", async () => {
			await offlineService.initialize()

			const networkListener = (mockNetInfo.addEventListener as jest.Mock).mock
				.calls[0][0]

			// Simulate going offline
			networkListener({ isConnected: false, type: "none" })
			expect(offlineService.getNetworkStatus().isConnected).toBe(false)

			// Simulate coming online
			networkListener({ isConnected: true, type: "wifi" })
			expect(offlineService.getNetworkStatus().isConnected).toBe(true)
		})

		it("should trigger sync when coming online", (done) => {
			const syncSpy = jest
				.spyOn(offlineService, "syncPendingOperations")
				.mockImplementation(() => {
					// Test passes when sync is called
					expect(syncSpy).toHaveBeenCalled()
					done()
					return Promise.resolve()
				})

			offlineService.initialize().then(() => {
				const networkListener = (mockNetInfo.addEventListener as jest.Mock).mock
					.calls[0][0]

				// Set offline first
				networkListener({ isConnected: false, type: "none" })
				expect(offlineService.getNetworkStatus().isConnected).toBe(false)

				// Simulate coming online - this should trigger sync
				networkListener({ isConnected: true, type: "wifi" })
				expect(offlineService.getNetworkStatus().isConnected).toBe(true)
			})
		}, 1000) // 1 second timeout should be sufficient
	})

	describe("Operations Queue", () => {
		beforeEach(async () => {
			await offlineService.initialize()
		})

		it("should queue operations when offline", async () => {
			// Set offline state
			offlineService.setNetworkStatus({ isConnected: false, type: "none" })

			const operation: OfflineOperation = {
				id: "op-1",
				type: "CREATE_PROJECT" as OfflineOperationType,
				data: { name: "Test Project", organisation_id: "org-1" },
				user_id: "user-1",
				organisation_id: "org-1",
				timestamp: new Date(),
				retry_count: 0,
			}

			await offlineService.queueOperation(operation)
			expect(mockDatabaseService.addToOfflineQueue).toHaveBeenCalledWith(
				expect.objectContaining({
					id: operation.id,
					type: operation.type,
					data: JSON.stringify(operation.data),
					user_id: operation.user_id,
					organisation_id: operation.organisation_id,
				}),
			)
		})

		it("should execute operations immediately when online", async () => {
			// Set online state
			offlineService.setNetworkStatus({ isConnected: true, type: "wifi" })

			const operation: OfflineOperation = {
				id: "op-2",
				type: "UPDATE_DEPLOYMENT" as OfflineOperationType,
				data: { id: "deployment-1", status: "active" },
				user_id: "user-1",
				organisation_id: "org-1",
				timestamp: new Date(),
				retry_count: 0,
			}

			const executeSpy = jest
				.spyOn(offlineService, "executeOperation")
				.mockResolvedValue(true)
			await offlineService.queueOperation(operation)

			expect(executeSpy).toHaveBeenCalledWith(operation)
		})
	})

	describe("Role-Based Sync Filtering", () => {
		beforeEach(async () => {
			await offlineService.initialize()
		})

		describe("WW Admin Role", () => {
			const wwAdminUser = { ...mockUser, role: "ww_admin" as UserRole }

			it("should sync all organisations data for ww_admin", async () => {
				const operations = await offlineService.getOperationsForSync(
					wwAdminUser,
				)
				expect(mockDatabaseService.getPendingQueueItems).toHaveBeenCalled() // No parameters for global access
			})

			it("should allow cross-organisation operations for ww_admin", () => {
				const operation: OfflineOperation = {
					id: "op-3",
					type: "CREATE_PROJECT" as OfflineOperationType,
					data: { name: "Cross-org Project", organisation_id: "org-2" },
					user_id: wwAdminUser.id,
					organisation_id: "org-2",
					timestamp: new Date(),
					retry_count: 0,
				}

				expect(
					offlineService.canUserPerformOperation(wwAdminUser, operation),
				).toBe(true)
			})
		})

		describe("Project Admin Role", () => {
			const projectAdminUser = {
				...mockUser,
				role: "project_admin" as UserRole,
			}

			it("should sync only organisation data for project_admin", async () => {
				const operations = await offlineService.getOperationsForSync(
					projectAdminUser,
				)
				expect(
					mockDatabaseService.getQueueItemsByOrganisation,
				).toHaveBeenCalledWith(projectAdminUser.organisation_id)
			})

			it("should deny cross-organisation operations for project_admin", () => {
				const operation: OfflineOperation = {
					id: "op-4",
					type: "CREATE_PROJECT" as OfflineOperationType,
					data: { name: "Cross-org Project", organisation_id: "org-2" },
					user_id: projectAdminUser.id,
					organisation_id: "org-2",
					timestamp: new Date(),
					retry_count: 0,
				}

				expect(
					offlineService.canUserPerformOperation(projectAdminUser, operation),
				).toBe(false)
			})
		})

		describe("Project Member Role", () => {
			const projectMemberUser = {
				...mockUser,
				role: "project_member" as UserRole,
			}

			it("should sync only accessible project data for project_member", async () => {
				const operations = await offlineService.getOperationsForSync(
					projectMemberUser,
				)
				expect(
					mockDatabaseService.getQueueItemsByOrganisation,
				).toHaveBeenCalledWith(projectMemberUser.organisation_id)
			})

			it("should deny organisation-level operations for project_member", () => {
				const operation: OfflineOperation = {
					id: "op-5",
					type: "DELETE_PROJECT" as OfflineOperationType,
					data: { id: "project-1" },
					user_id: projectMemberUser.id,
					organisation_id: projectMemberUser.organisation_id,
					timestamp: new Date(),
					retry_count: 0,
				}

				expect(
					offlineService.canUserPerformOperation(projectMemberUser, operation),
				).toBe(false)
			})
		})
	})

	describe("LoRaWAN Integration", () => {
		beforeEach(async () => {
			await offlineService.initialize()
		})

		it("should cache LoRaWAN device status offline", async () => {
			const deviceStatus: LoRaWANStatus = {
				battery_level: 85,
				sd_card_usage: 45,
				device_status: "online",
				last_seen: new Date().toISOString(),
			}

			await offlineService.updateDeviceLoRaWANStatus(
				"device-1",
				deviceStatus,
				"deployment-1",
			)
			expect(
				mockDatabaseService.updateDeploymentLoRaWANStatus,
			).toHaveBeenCalledWith("deployment-1", deviceStatus)
		})

		it("should queue LoRaWAN status updates when offline", async () => {
			offlineService.setNetworkStatus({ isConnected: false, type: "none" })

			const deviceStatus: LoRaWANStatus = {
				battery_level: 20,
				sd_card_usage: 95,
				device_status: "error",
				last_seen: new Date().toISOString(),
			}

			await offlineService.updateDeviceLoRaWANStatus("device-2", deviceStatus)

			expect(mockDatabaseService.addToOfflineQueue).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "UPDATE_DEVICE_LORAWAN_STATUS",
					data: JSON.stringify({ device_id: "device-2", status: deviceStatus }),
				}),
			)
		})

		it("should sync LoRaWAN status when coming online", async () => {
			const mockQueueItems: OfflineQueueItem[] = [
				{
					id: "op-6",
					operation_type: "UPDATE_DEVICE_LORAWAN_STATUS",
					data: JSON.stringify({
						device_id: "device-3",
						status: { battery_level: 60 },
					}),
					user_id: "user-1",
					organisation_id: "org-1",
					priority: "medium" as const,
					retry_count: 0,
					max_retries: 3,
					status: "pending" as const,
				},
			]

			mockDatabaseService.getPendingQueueItems.mockResolvedValue(mockQueueItems)
			const executeSpy = jest
				.spyOn(offlineService, "executeOperation")
				.mockResolvedValue(true)

			await offlineService.syncPendingOperations()
			expect(executeSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					id: "op-6",
					type: "UPDATE_DEVICE_LORAWAN_STATUS",
					data: { device_id: "device-3", status: { battery_level: 60 } },
				}),
			)
		})
	})

	describe("Conflict Detection Foundation", () => {
		beforeEach(async () => {
			await offlineService.initialize()
		})

		it("should detect potential conflicts based on timestamps", () => {
			const serverData = {
				id: "item-1",
				updated_at: new Date("2025-01-01T12:00:00Z"),
			}
			const localData = {
				id: "item-1",
				updated_at: new Date("2025-01-01T11:00:00Z"),
			}

			const hasConflict = offlineService.detectPotentialConflict(
				serverData,
				localData,
			)
			expect(hasConflict).toBe(true)
		})

		it("should not detect conflicts for same timestamps", () => {
			const timestamp = new Date("2025-01-01T12:00:00Z")
			const serverData = { id: "item-2", updated_at: timestamp }
			const localData = { id: "item-2", updated_at: timestamp }

			const hasConflict = offlineService.detectPotentialConflict(
				serverData,
				localData,
			)
			expect(hasConflict).toBe(false)
		})

		it("should prepare conflict data for resolution", () => {
			const serverData = {
				id: "item-3",
				name: "Server Name",
				updated_at: new Date("2025-01-01T12:00:00Z"),
			}
			const localData = {
				id: "item-3",
				name: "Local Name",
				updated_at: new Date("2025-01-01T11:00:00Z"),
			}

			const conflictData = offlineService.prepareConflictResolution(
				serverData,
				localData,
			)

			expect(conflictData).toEqual({
				id: "item-3",
				server_version: serverData,
				local_version: localData,
				conflict_type: "data_modification",
				needs_user_resolution: true,
			})
		})
	})

	describe("Retry Logic with Exponential Backoff", () => {
		beforeEach(async () => {
			await offlineService.initialize()
		})

		it("should retry failed operations with exponential backoff", async () => {
			const operation: OfflineOperation = {
				id: "op-7",
				type: "CREATE_PROJECT" as OfflineOperationType,
				data: { name: "Retry Project" },
				user_id: "user-1",
				organisation_id: "org-1",
				timestamp: new Date(),
				retry_count: 2,
			}

			const delay = offlineService.calculateRetryDelay(operation.retry_count)
			expect(delay).toBe(4000) // 2^2 * 1000 = 4000ms
		})

		it("should give up after maximum retry attempts", async () => {
			const operation: OfflineOperation = {
				id: "op-8",
				type: "UPDATE_DEPLOYMENT" as OfflineOperationType,
				data: { id: "deployment-2" },
				user_id: "user-1",
				organisation_id: "org-1",
				timestamp: new Date(),
				retry_count: 5, // Max retries exceeded
			}

			const shouldRetry = offlineService.shouldRetryOperation(operation)
			expect(shouldRetry).toBe(false)
		})
	})

	describe("Organisation Data Isolation", () => {
		beforeEach(async () => {
			await offlineService.initialize()
		})

		it("should enforce organisation boundaries in offline operations", async () => {
			const user = { ...mockUser, organisation_id: "org-1" }
			const operation: OfflineOperation = {
				id: "op-9",
				type: "CREATE_PROJECT" as OfflineOperationType,
				data: { name: "Isolated Project", organisation_id: "org-2" },
				user_id: user.id,
				organisation_id: "org-2", // Different org
				timestamp: new Date(),
				retry_count: 0,
			}

			// Should deny cross-org access for non-admin users
			expect(offlineService.canUserPerformOperation(user, operation)).toBe(
				false,
			)
		})

		it("should allow same organisation operations", async () => {
			const user = { ...mockUser, organisation_id: "org-1" }
			const operation: OfflineOperation = {
				id: "op-10",
				type: "CREATE_PROJECT" as OfflineOperationType,
				data: { name: "Same Org Project", organisation_id: "org-1" },
				user_id: user.id,
				organisation_id: "org-1", // Same org
				timestamp: new Date(),
				retry_count: 0,
			}

			expect(offlineService.canUserPerformOperation(user, operation)).toBe(true)
		})
	})

	describe("Service Cleanup", () => {
		it("should cleanup resources on destroy", async () => {
			const unsubscribeMock = jest.fn()
			;(mockNetInfo.addEventListener as jest.Mock).mockReturnValue(
				unsubscribeMock,
			)

			await offlineService.initialize()
			await offlineService.destroy()

			expect(unsubscribeMock).toHaveBeenCalled()
		})
	})
})
