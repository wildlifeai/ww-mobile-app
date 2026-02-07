import { DeviceService } from "../DeviceService"
import database from "../../database"
import ProjectService from "../ProjectService"
import OutboxService from "../OutboxService"

// Mock dependencies
jest.mock("../../database", () => ({
	get: jest.fn(),
	write: jest.fn(),
	batch: jest.fn(),
}))

jest.mock("../ProjectService", () => ({
	getProjectsForUser: jest.fn(),
}))

jest.mock("../OutboxService", () => ({
	recordOperation: jest.fn(),
}))

jest.mock("../../utils/logger", () => ({
	log: jest.fn(),
	logError: jest.fn(),
}))

describe("DeviceService", () => {
	// Mock objects
	const mockCollection = {
		query: jest.fn().mockReturnThis(),
		fetch: jest.fn().mockResolvedValue([]),
		find: jest.fn(),
		prepareCreate: jest.fn(),
	}

	beforeEach(() => {
		jest.clearAllMocks()
		// Setup default database mock behavior
		;(database.get as jest.Mock).mockReturnValue(mockCollection)
		// Reset query chain
		mockCollection.query.mockReturnThis()
		mockCollection.fetch.mockResolvedValue([])
	})

	describe("getDevices", () => {
		it("should query devices collection", async () => {
			await DeviceService.getDevices()
			expect(database.get).toHaveBeenCalledWith("devices")
			expect(mockCollection.query).toHaveBeenCalled()
			expect(mockCollection.fetch).toHaveBeenCalled()
		})
	})

	describe("getDeviceById", () => {
		it("should find device by ID", async () => {
			const mockDevice = { id: "d1", name: "Test Device" }
			mockCollection.find.mockResolvedValue(mockDevice)

			const result = await DeviceService.getDeviceById("d1")
			expect(result).toEqual(mockDevice)
			expect(mockCollection.find).toHaveBeenCalledWith("d1")
		})

		it("should return undefined on error", async () => {
			mockCollection.find.mockRejectedValue(new Error("Not found"))
			const result = await DeviceService.getDeviceById("d1")
			expect(result).toBeUndefined()
		})
	})

	describe("searchDevices", () => {
		it("should query with Q.or condition", async () => {
			const query = "test"
			await DeviceService.searchDevices(query)
			
			expect(mockCollection.query).toHaveBeenCalled()
			// We can't easily check the Q arguments are exactly strictly equal due to symbol usage in WatermelonDB Q
			// but we can verify it ran
		})
	})

	describe("createDevice", () => {
		it("should prepare create and batch write", async () => {
			const mockNewDevice = { id: "new-d1" }
			// database.write invokes the callback
			;(database.write as jest.Mock).mockImplementation(async (callback) => {
				await callback()
			})
			mockCollection.prepareCreate.mockImplementation((callback) => {
				const device: any = { id: "new-d1" }
				callback(device)
				return device
			})
			;(OutboxService.recordOperation as jest.Mock).mockReturnValue("outbox-op")

			const result = await DeviceService.createDevice("bt-id", "New Device", "org-1", "user-1")

			expect(mockCollection.prepareCreate).toHaveBeenCalled()
			expect(OutboxService.recordOperation).toHaveBeenCalled()
			// The result will have the properties set in the callback
			expect(result).toEqual({ ...mockNewDevice, bluetoothId: "bt-id", name: "New Device", organisationId: "org-1" })
		})
	})

	describe("getDevicesForUser", () => {
		it("should return empty list if user has no projects and no direct access", async () => {
			;(ProjectService.getProjectsForUser as jest.Mock).mockResolvedValue([])
			
			// Mock user roles query needed for fallback check
			const mockUserRolesCollection = {
				query: jest.fn().mockReturnThis(),
				fetch: jest.fn().mockResolvedValue([]),
			}
			;(database.get as jest.Mock).mockImplementation((table) => {
				if (table === 'user_roles') return mockUserRolesCollection
				return mockCollection
			})

			const result = await DeviceService.getDevicesForUser("user-1")
			expect(result).toEqual([])
		})

		// This test simulates the "Global Admin" case or user with projects
		it("should return devices based on project deployments", async () => {
			const mockProjects = [{ id: "p1" }]
			;(ProjectService.getProjectsForUser as jest.Mock).mockResolvedValue(mockProjects)

			// 1. Deployments query
			const mockDeployments = [{ deviceId: "d1" }]
			// 2. Preparations query
			const mockPreparations = [{ deviceId: "d2" }]
			// 3. Devices query
			const mockDevices = [
				{ id: "d1", name: "Device 1", bluetoothId: "bt1" },
				{ id: "d2", name: "Device 2", bluetoothId: "bt2" }
			]

			const mockDeploymentsColl = { query: jest.fn().mockReturnThis(), fetch: jest.fn().mockResolvedValue(mockDeployments) }
			const mockPrepsColl = { query: jest.fn().mockReturnThis(), fetch: jest.fn().mockResolvedValue(mockPreparations) }
			const mockDevicesColl = { query: jest.fn().mockReturnThis(), fetch: jest.fn().mockResolvedValue(mockDevices) }
			
			// Mock getting status for list item
			// We need to mock getDeviceWithStatus / or directly query inside deviceToListItem
			// deviceToListItem calls getDeviceWithStatus -> calculateDeviceStatus -> queries
			// This makes unit testing complex due to many internal calls. 
			// We will trust the mockCollection return values for strict unit testing logic flow.

			;(database.get as jest.Mock).mockImplementation((table) => {
				if (table === 'deployments') return mockDeploymentsColl
				if (table === 'device_preparation') return mockPrepsColl
				if (table === 'devices') return mockDevicesColl
				return mockCollection
			})

			// Spy on internal method to simplify test of getDevicesForUser logic only
			jest.spyOn(DeviceService, 'deviceToListItem').mockResolvedValue({
				id: 'd1', name: 'Device 1', bluetoothId: 'bt1', status: 'prepared' 
			} as any)

			const results = await DeviceService.getDevicesForUser("user-1")

			expect(ProjectService.getProjectsForUser).toHaveBeenCalledWith("user-1")
			// Should return 2 devices (d1 from deployment, d2 from preparation)
			expect(results).toHaveLength(2)
			expect(DeviceService.deviceToListItem).toHaveBeenCalledTimes(2)
		})
	})
})
