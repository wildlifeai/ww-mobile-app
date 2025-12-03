import { getSupabaseClient } from '../../src/services/supabase';

describe('ProjectService Unit Test', () => {
    let ProjectService: any;
    let database: any;
    let OutboxService: any;
    let mockGetUser: jest.Mock;
    let mockCollection: any;

    beforeEach(() => {
        jest.resetModules(); // CRITICAL: Reset modules to ensure mocks are applied

        // 1. Mock database
        const mockProjectModel = {
            id: 'test-project-id',
            name: 'Test Project',
            description: 'Test Description',
            organisationId: 'org-1',
            createdAt: 1620000000000,
            updatedAt: 1620000000000,
            deletedAt: null,
            samplingDesignId: null,
            website: null,
            createdBy: 'test-user',
            modifiedBy: 'test-user',
            isActive: true,
            timelapseIntervalSeconds: null,
            activityDetectionSensitivityId: null,
            captureMethodId: null,
            modelId: null,
            isBaited: false,
            isMonitoringMarkedIndividuals: false,
            projectImage: null,
            prepareUpdate: jest.fn(),
            prepareMarkAsDeleted: jest.fn(),
            _isEditing: true,
        };

        mockCollection = {
            prepareCreate: jest.fn((cb) => {
                if (cb) cb(mockProjectModel);
                return mockProjectModel;
            }),
            prepareUpdate: jest.fn(),
            find: jest.fn(),
            query: jest.fn(() => ({ fetch: jest.fn().mockResolvedValue([]) })),
        };

        const mockDatabase = {
            write: jest.fn(async (cb) => {
                return await cb();
            }),
            batch: jest.fn(),
            collections: {
                get: jest.fn(() => mockCollection),
            },
        };

        jest.mock('../../src/database', () => ({
            __esModule: true,
            default: mockDatabase,
        }));

        // 2. Mock OutboxService
        jest.mock('../../src/services/OutboxService', () => ({
            __esModule: true,
            default: {
                recordOperation: jest.fn(() => ({ id: 'outbox-id', _isEditing: true })),
            },
        }));

        // 3. Mock SupabaseSyncService
        jest.mock('../../src/services/SupabaseSyncService', () => ({
            __esModule: true,
            default: {
                debouncedSync: jest.fn(),
            },
        }));

        // 4. Mock Supabase Client
        mockGetUser = jest.fn();
        jest.mock('../../src/services/supabase', () => ({
            getSupabaseClient: jest.fn(() => ({
                auth: {
                    getUser: mockGetUser,
                },
            })),
        }));

        // Re-require modules
        ProjectService = require('../../src/services/ProjectService').default;
        database = require('../../src/database').default;
        OutboxService = require('../../src/services/OutboxService').default;

        // Setup default mock responses
        mockGetUser.mockResolvedValue({
            data: { user: { id: 'test-user' } }
        });
    });

    it('should verify mocks are active', () => {
        expect(database.write.getMockName).toBeDefined(); // Check if it's a jest mock
    });

    it('should batch createProject operations', async () => {
        const input = {
            name: 'Test Project',
            organisation_id: 'org-1',
            description: 'Test Description'
        };

        await ProjectService.createProject(input);

        // Verify database.batch was called
        expect(database.batch).toHaveBeenCalled();

        // Verify OutboxService.recordOperation was called
        expect(OutboxService.recordOperation).toHaveBeenCalledWith(expect.objectContaining({
            operation: 'CREATE',
            tableName: 'projects',
            recordId: 'test-project-id',
        }));

        // Verify batch arguments
        const batchArgs = (database.batch as jest.Mock).mock.calls[0];
        expect(batchArgs).toHaveLength(2);
        expect(batchArgs[0].id).toBe('test-project-id');
        expect(batchArgs[1].id).toBe('outbox-id');
    });

    it('should batch updateProject operations', async () => {
        const updates = { name: 'Updated Project' };

        // Mock find to return a project
        const mockProject: any = {
            id: 'test-project-id',
            name: 'Test Project',
            createdAt: 1620000000000,
            updatedAt: 1620000000000,
            _isEditing: true,
        };
        mockProject.prepareUpdate = jest.fn((cb) => {
            cb(mockProject);
            return mockProject;
        });

        mockCollection.find.mockResolvedValue(mockProject);

        await ProjectService.updateProject('test-project-id', updates);

        expect(database.batch).toHaveBeenCalled();
        expect(OutboxService.recordOperation).toHaveBeenCalledWith(expect.objectContaining({
            operation: 'UPDATE',
            tableName: 'projects',
            recordId: 'test-project-id',
        }));
    });

    it('should batch deleteProject operations', async () => {
        // Mock find to return a project
        const mockProject: any = {
            id: 'test-project-id',
            name: 'Test Project',
            createdAt: 1620000000000,
            updatedAt: 1620000000000,
            _isEditing: true,
        };
        mockProject.prepareMarkAsDeleted = jest.fn(() => mockProject);

        mockCollection.find.mockResolvedValue(mockProject);

        await ProjectService.deleteProject('test-project-id');

        expect(database.batch).toHaveBeenCalled();
        expect(OutboxService.recordOperation).toHaveBeenCalledWith(expect.objectContaining({
            operation: 'DELETE',
            tableName: 'projects',
            recordId: 'test-project-id',
        }));
    });
});
