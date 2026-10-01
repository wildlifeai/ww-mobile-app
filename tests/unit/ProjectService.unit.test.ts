

describe('ProjectService Unit Test', () => {
    let ProjectService: any;
    let database: any;
    let OutboxService: any;
    let InvitationService: any;
    let mockGetUser: jest.Mock;
    let mockFrom: jest.Mock;
    let mockCollection: any;
    let mockRolesCollection: any;

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

        mockRolesCollection = {
            prepareCreate: jest.fn((cb) => {
                const role: any = { id: 'role-id', _isEditing: true };
                cb(role);
                return role;
            }),
            query: jest.fn(() => ({ fetch: jest.fn().mockResolvedValue([]) })),
        };

        const mockDatabase = {
            write: jest.fn(async (cb) => {
                return await cb();
            }),
            batch: jest.fn(),
            collections: {
                get: jest.fn((table: string) => table === 'user_roles' ? mockRolesCollection : mockCollection),
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

        // 4. Mock InvitationService
        jest.mock('../../src/services/InvitationService', () => ({
            __esModule: true,
            default: {
                sendInvitation: jest.fn(() => Promise.resolve('invitation-id')),
            },
        }));

        // 5. Mock Supabase Client
        // ProjectService reads the user from the stored session (#310), under the
        // client's own storage key, rather than asking auth-js for one.
        mockGetUser = jest.fn();
        mockFrom = jest.fn();
        jest.mock('../../src/services/supabase', () => ({
            getSupabaseClient: jest.fn(() => ({
                from: mockFrom,
                auth: {
                    getUser: mockGetUser,
                    getSession: jest.fn(() => Promise.resolve({ data: { session: { user: { id: 'test-user' } } }, error: null })),
                    storageKey: 'sb-test-auth-token',
                    storage: {
                        getItem: jest.fn(async () => JSON.stringify({ refresh_token: 'refresh', user: { id: 'test-user' } })),
                    },
                },
            })),
            initializeSupabaseClient: jest.fn(),
            reconnectSupabase: jest.fn(),
            onSupabaseClientChange: jest.fn(),
            resetSupabaseClient: jest.fn(),
            getCurrentEnvironment: jest.fn(),
        }));

        // Re-require modules
        ProjectService = require('../../src/services/ProjectService').default;
        database = require('../../src/database').default;
        OutboxService = require('../../src/services/OutboxService').default;
        InvitationService = require('../../src/services/InvitationService').default;

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

        // Verify batch arguments: the project, its outbox record, and the
        // creator's admin role that the server trigger will also grant
        const batchArgs = (database.batch as jest.Mock).mock.calls[0];
        expect(batchArgs).toHaveLength(3);
        expect(batchArgs[0].id).toBe('test-project-id');
        expect(batchArgs[1].id).toBe('outbox-id');
        expect(batchArgs[2]).toEqual(expect.objectContaining({
            userId: 'test-user',
            role: 'project_admin',
            scopeType: 'project',
            scopeId: 'test-project-id',
            isActive: true,
        }));

        // The role is local only: nothing is queued for user_roles
        expect(OutboxService.recordOperation).toHaveBeenCalledTimes(1);
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

    // #330 bench: an unrelated Sinbad edit sent the phone's stale model_id and
    // GPS setting and reverted what had just been set on the website
    it('should send only the fields an edit changed', async () => {
        const mockProject: any = {
            id: 'test-project-id',
            name: 'Sinbad',
            organisationId: 'org-1',
            createdAt: 1620000000000,
            updatedAt: 1620000000000,
            modelId: null,
            recordGpsInImages: false,
            modifiedBy: 'test-user',
            _isEditing: true,
        };
        mockProject.prepareUpdate = jest.fn((cb) => {
            cb(mockProject);
            return mockProject;
        });
        mockCollection.find.mockResolvedValue(mockProject);

        // The edit form sends every field, changed or not
        await ProjectService.updateProject('test-project-id', { name: 'Sinbad Skink Survey', model_id: null });

        const payload = OutboxService.recordOperation.mock.calls[0][0].payload;
        expect(payload).toEqual(expect.objectContaining({
            id: 'test-project-id',
            name: 'Sinbad Skink Survey',
            modified_by: 'test-user',
        }));
        expect(payload).not.toHaveProperty('model_id');
        expect(payload).not.toHaveProperty('record_gps_in_images');
        expect(payload).not.toHaveProperty('organisation_id');
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

    // #308: looking the address up in public.users told the caller whether an account existed
    it('should add a member by invitation, without looking the email up', async () => {
        await ProjectService.addProjectMember('test-project-id', 'tama@ww.org', 'project_member');

        expect(InvitationService.sendInvitation).toHaveBeenCalledWith('test-project-id', 'tama@ww.org', 'project_member');
        expect(mockFrom).not.toHaveBeenCalled();
    });
});
