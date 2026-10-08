describe("DeploymentService Unit Test", () => {
    let DeploymentService: any
    let database: any
    let OutboxService: any
    let SupabaseSyncService: any
    let mockDeploymentModel: any
    let mockCollection: any
    let mockDatabase: any

    beforeEach(() => {
        jest.resetModules()

        mockDeploymentModel = {
            id: "test-deployment-id",
            name: "Test Deployment",
            projectId: "project-1",
            deviceId: "device-1",
            setupBy: "user-1",
            locationName: "Location A",
            cameraModel: "Model X",
            cameraHeight: 1.5,
            startComments: "Deployment start notes",
            createdAt: 1620000000000,
            updatedAt: 1620000000000,
            prepareUpdate: jest.fn(),
            prepareMarkAsDeleted: jest.fn(),
            _isEditing: true,
        }

        mockCollection = {
            prepareCreate: jest.fn((cb) => {
                if (cb) cb(mockDeploymentModel)
                return mockDeploymentModel
            }),
            prepareUpdate: jest.fn(),
            find: jest.fn(),
            query: jest.fn(() => ({ fetch: jest.fn().mockResolvedValue([]) })),
        }

        mockDatabase = {
            write: jest.fn(async (cb) => {
                return await cb()
            }),
            batch: jest.fn(),
            get: jest.fn(() => mockCollection),
            collections: {
                get: jest.fn(() => mockCollection),
            },
        }

        jest.mock("../../src/database", () => ({
            __esModule: true,
            default: mockDatabase,
        }))

        jest.mock("../../src/services/ProjectService", () => ({
            __esModule: true,
            default: {
                getProjectById: jest.fn().mockResolvedValue({
                    id: "project-1",
                    activity_detection_sensitivity_id: 1,
                    timelapse_interval_seconds: 60,
                }),
            },
        }))

        jest.mock("../../src/services/OutboxService", () => ({
            __esModule: true,
            default: {
                recordOperation: jest.fn(() => ({ id: "outbox-id", _isEditing: true })),
            },
        }))

        jest.mock("../../src/services/SupabaseSyncService", () => ({
            __esModule: true,
            default: {
                requestSync: jest.fn(),
                debouncedSync: jest.fn(),
            },
        }))

        // Re-require modules
        DeploymentService = require("../../src/services/DeploymentService").DeploymentService
        database = require("../../src/database").default
        OutboxService = require("../../src/services/OutboxService").default
        SupabaseSyncService = require("../../src/services/SupabaseSyncService").default
    })

    it("should successfully create a deployment without throwing configFirmwareId error", async () => {
        const deploymentData = {
            name: "Test Deployment",
            projectId: "project-1",
            deviceId: "device-1",
            setupBy: "user-1",
            locationName: "Location A",
            cameraModel: "Model X",
            cameraHeight: 150,
            cameraImagePaths: [],
            startComments: "Deployment start notes",
        }

        const newDeployment = await DeploymentService.createDeployment(deploymentData as any)

        expect(newDeployment).toBeDefined()
        expect(newDeployment.id).toBe("test-deployment-id")
        expect(database.write).toHaveBeenCalled()
        expect(database.batch).toHaveBeenCalled()
        expect(OutboxService.recordOperation).toHaveBeenCalledWith(expect.objectContaining({
            operation: "CREATE",
            tableName: "deployments",
            recordId: "test-deployment-id",
        }))
    })

    // 8 October 2026: the camera stamped 2580 photos with a deployment id the
    // website did not have. A new or ended deployment asks for a sync at once,
    // once it is written, so it reaches the server while the app is open.
    it("requests a sync once the new deployment is written", async () => {
        await DeploymentService.createDeployment({
            name: "Test Deployment",
            projectId: "project-1",
            deviceId: "device-1",
            setupBy: "user-1",
            locationName: "Location A",
        })

        expect(SupabaseSyncService.requestSync).toHaveBeenCalledTimes(1)
        expect(SupabaseSyncService.debouncedSync).not.toHaveBeenCalled()
        expect(database.batch.mock.invocationCallOrder[0])
            .toBeLessThan(SupabaseSyncService.requestSync.mock.invocationCallOrder[0])
    })

    it("requests a sync once the end is written, outside the write", async () => {
        mockDeploymentModel.deploymentStart = new Date("2026-10-01T00:00:00Z")
        mockCollection.find.mockResolvedValue(mockDeploymentModel)
        let writing = false
        mockDatabase.write.mockImplementation(async (cb: () => Promise<unknown>) => {
            writing = true
            try {
                return await cb()
            } finally {
                writing = false
            }
        })
        let requestedWhileWriting: boolean | null = null
        SupabaseSyncService.requestSync.mockImplementation(() => { requestedWhileWriting = writing })

        const ended = await DeploymentService.endDeployment("test-deployment-id", "user-1", "Retrieved")

        expect(ended).toBe(mockDeploymentModel)
        expect(database.batch).toHaveBeenCalled()
        expect(SupabaseSyncService.requestSync).toHaveBeenCalledTimes(1)
        expect(requestedWhileWriting).toBe(false)
    })

    it("requests no sync when the end could not be written", async () => {
        mockCollection.find.mockRejectedValue(new Error("not found"))

        await expect(DeploymentService.endDeployment("missing", "user-1")).rejects.toThrow("not found")

        expect(SupabaseSyncService.requestSync).not.toHaveBeenCalled()
    })
})
