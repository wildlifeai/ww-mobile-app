import { DeviceService } from "../DeviceService"
import database from "../../database"
import OutboxService from "../OutboxService"

// Mock dependencies
jest.mock("../../database", () => ({
	get: jest.fn(),
	write: jest.fn(),
	batch: jest.fn(),
}))

// DeploymentService, which DeviceService imports, pulls in ProjectService and
// with it InvitationService, which needs a real database at load
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
		// A camera belongs to no organisation since ww-backend #346 (#501)
		it("should prepare create and batch write, with no organisation", async () => {
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

			const result = await DeviceService.createDevice("bt-id", "New Device", "user-1")

			expect(mockCollection.prepareCreate).toHaveBeenCalled()
			expect(OutboxService.recordOperation).toHaveBeenCalledWith(expect.objectContaining({
				payload: { id: "new-d1", bluetooth_id: "bt-id", name: "New Device", modified_by: "user-1" },
			}))
			// The result will have the properties set in the callback
			expect(result).toEqual({ ...mockNewDevice, bluetoothId: "bt-id", name: "New Device" })
		})
	})
})
