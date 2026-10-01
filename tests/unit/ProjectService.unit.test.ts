

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
        // ProjectService reads the user from the stored session (#310), under the
        // client's own storage key, rather than asking auth-js for one.
        mockGetUser = jest.fn();
        jest.mock('../../src/services/supabase', () => ({
            getSupabaseClient: jest.fn(() => ({
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

    // Pictures per trigger and their interval (#317). The website is their only
    // editor: the phone sends them when it inserts a project, where the
    // backend's CHECK constraints reject a value outside 1 to 10 and 200 to
    // 2000, and never on an update, where push_changes keeps the stored value
    // for a missing key.
    describe('burst columns in the push payload', () => {
        const payloadOf = () => (OutboxService.recordOperation as jest.Mock).mock.calls[0][0].payload

        it('creates a project with the table defaults and pushes them', async () => {
            const created = await ProjectService.createProject({ name: 'P', organisation_id: 'org-1' });

            expect(payloadOf()).toEqual(expect.objectContaining({
                photos_per_trigger: 3,
                photo_interval_milliseconds: 1000,
            }))
            expect(created.photos_per_trigger).toBe(3)
            expect(created.photo_interval_milliseconds).toBe(1000)
        });

        it('never pushes a create value the CHECK constraints would reject', async () => {
            // 0 is what WatermelonDB keeps in a number column nobody wrote
            mockCollection.prepareCreate.mockImplementation((cb: any) => {
                const model: any = { id: 'p0', name: 'P', createdAt: 1, updatedAt: 1, _isEditing: true };
                cb(model);
                model.photosPerTrigger = 0;
                model.photoIntervalMilliseconds = 0;
                return model;
            });

            await ProjectService.createProject({ name: 'P', organisation_id: 'org-1' });

            expect(payloadOf()).toEqual(expect.objectContaining({
                photos_per_trigger: 3,
                photo_interval_milliseconds: 1000,
            }))
        });

        const projectHolding = (photosPerTrigger: number, photoIntervalMilliseconds: number) => {
            const project: any = {
                id: 'test-project-id',
                name: 'Test Project',
                createdAt: 1620000000000,
                updatedAt: 1620000000000,
                photosPerTrigger,
                photoIntervalMilliseconds,
                _isEditing: true,
            };
            project.prepareUpdate = jest.fn((cb) => {
                cb(project);
                return project;
            });
            mockCollection.find.mockResolvedValue(project);
            return project;
        };

        it('leaves both out of an update payload, so a stale phone cannot overwrite the website', async () => {
            const project = projectHolding(5, 800);

            const updated = await ProjectService.updateProject('test-project-id', { name: 'Renamed' });

            const payload = payloadOf()
            expect(payload.name).toBe('Renamed')
            expect(payload).not.toHaveProperty('photos_per_trigger')
            expect(payload).not.toHaveProperty('photo_interval_milliseconds')
            // The local record and what the caller gets back still carry them
            expect(project.photosPerTrigger).toBe(5)
            expect(updated.photos_per_trigger).toBe(5)
            expect(updated.photo_interval_milliseconds).toBe(800)
        });

        it('does not apply them locally from an update either, the website being their only editor', async () => {
            const project = projectHolding(5, 800);

            await ProjectService.updateProject('test-project-id', { photos_per_trigger: 2, photo_interval_milliseconds: 1500 });

            expect(project.photosPerTrigger).toBe(5)
            expect(project.photoIntervalMilliseconds).toBe(800)
            expect(payloadOf()).not.toHaveProperty('photos_per_trigger')
            expect(payloadOf()).not.toHaveProperty('photo_interval_milliseconds')
        });
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
