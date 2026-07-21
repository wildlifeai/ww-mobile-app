describe("DeploymentService Unit Test", () => {
    let DeploymentService: any
    let database: any
    let OutboxService: any
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

        // Re-require modules
        DeploymentService = require("../../src/services/DeploymentService").DeploymentService
        database = require("../../src/database").default
        OutboxService = require("../../src/services/OutboxService").default
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
})
