

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

    // The detection threshold (#342), handled as the burst columns are: the
    // website is its only editor, so the phone sends it when it inserts a
    // project, where the CHECK constraint rejects a value outside 50 to 99,
    // and never on an update, where push_changes keeps the stored value for a
    // missing key.
    describe('detection threshold in the push payload', () => {
        const payloadOf = () => (OutboxService.recordOperation as jest.Mock).mock.calls[0][0].payload

        it('creates a project with the table default, 57, and pushes it', async () => {
            const created = await ProjectService.createProject({ name: 'P', organisation_id: 'org-1' });

            expect(payloadOf()).toEqual(expect.objectContaining({ detection_threshold_pct: 57 }))
            expect(created.detection_threshold_pct).toBe(57)
        });

        it('never pushes a create value the CHECK constraint would reject', async () => {
            // 0 is what WatermelonDB keeps in a number column nobody wrote
            mockCollection.prepareCreate.mockImplementation((cb: any) => {
                const model: any = { id: 'p0', name: 'P', createdAt: 1, updatedAt: 1, _isEditing: true };
                cb(model);
                model.detectionThresholdPct = 0;
                return model;
            });

            await ProjectService.createProject({ name: 'P', organisation_id: 'org-1' });

            expect(payloadOf()).toEqual(expect.objectContaining({ detection_threshold_pct: 57 }))
        });

        const projectHolding = (detectionThresholdPct: number) => {
            const project: any = {
                id: 'test-project-id',
                name: 'Test Project',
                createdAt: 1620000000000,
                updatedAt: 1620000000000,
                detectionThresholdPct,
                _isEditing: true,
            };
            project.prepareUpdate = jest.fn((cb) => {
                cb(project);
                return project;
            });
            mockCollection.find.mockResolvedValue(project);
            return project;
        };

        it('leaves it out of an update payload, so a stale phone cannot overwrite the website', async () => {
            const project = projectHolding(80);

            const updated = await ProjectService.updateProject('test-project-id', { name: 'Renamed' });

            const payload = payloadOf()
            expect(payload.name).toBe('Renamed')
            expect(payload).not.toHaveProperty('detection_threshold_pct')
            // The local record and what the caller gets back still carry it
            expect(project.detectionThresholdPct).toBe(80)
            expect(updated.detection_threshold_pct).toBe(80)
        });

        it('does not apply it locally from an update either, the website being its only editor', async () => {
            const project = projectHolding(80);

            await ProjectService.updateProject('test-project-id', { detection_threshold_pct: 95 });

            expect(project.detectionThresholdPct).toBe(80)
            expect(payloadOf()).not.toHaveProperty('detection_threshold_pct')
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

    // #308: looking the address up in public.users told the caller whether an account existed
    it('should add a member by invitation, without looking the email up', async () => {
        await ProjectService.addProjectMember('test-project-id', 'tama@ww.org', 'project_member');

        expect(InvitationService.sendInvitation).toHaveBeenCalledWith('test-project-id', 'tama@ww.org', 'project_member');
        expect(mockFrom).not.toHaveBeenCalled();
    });
});
