import SupabaseSyncService from '../SupabaseSyncService'
import { getSupabaseClient } from '../supabase'

jest.mock('../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))
jest.mock('../../utils/networkErrors', () => ({ logCloudFailure: jest.fn() }))

const mockCollection = { find: jest.fn(), create: jest.fn() }
let mockRows: any[] = []

jest.mock('../../database', () => ({
    __esModule: true,
    default: {
        collections: { get: jest.fn(() => mockCollection) },
        write: jest.fn(async (work: () => Promise<void>) => work()),
    },
}))

jest.mock('../SyncStateService', () => ({
    __esModule: true,
    default: { get: jest.fn(async () => null), set: jest.fn(async () => {}) },
    SYNC_STATE_KEYS: { PROJECTS_LAST_PULLED_AT: 'projects_last_pulled_at' },
}))

/**
 * The project pull copies the burst columns onto the local record (#317): the
 * deployment writes them to the device as op5 and op6, so a project that never
 * pulls them deploys on the defaults whatever the website says.
 * `syncProjects.columns.test.ts` checks every column is named; this one checks
 * the values land, and what a row without them becomes.
 */
describe('SupabaseSyncService.syncProjects burst columns', () => {
    const row = (burst: Record<string, number | null>) => ({
        id: 'project-1',
        name: 'P',
        organisation_id: 'org-1',
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-01T00:00:00Z',
        deleted_at: null,
        ...burst,
    })

    // After the shared setup's beforeEach, which points the client at a blank mock
    beforeEach(() => {
        ;(getSupabaseClient as jest.Mock).mockImplementation(() => ({
            auth: { getUser: jest.fn(async () => ({ data: { user: { id: 'user-1' } } })) },
            from: jest.fn(() => ({
                select: jest.fn(() => ({
                    gt: jest.fn(async () => ({ data: mockRows, error: null })),
                })),
            })),
        }))
    })

    const syncProjects = () => (SupabaseSyncService as any).syncProjects()

    /** Runs the pull against no local record, returning the record it created. */
    const pullNew = async (burst: Record<string, number | null>) => {
        mockRows = [row(burst)]
        mockCollection.find.mockRejectedValue(new Error('not found'))
        const created: any = { _raw: {} }
        mockCollection.create.mockImplementation(async (build: (rec: any) => void) => build(created))
        await syncProjects()
        return created
    }

    /** Runs the pull against an existing local record, returning it. */
    const pullExisting = async (burst: Record<string, number | null>) => {
        mockRows = [row(burst)]
        const existing: any = { _raw: { _status: 'synced' }, photosPerTrigger: 7, photoIntervalMilliseconds: 300 }
        existing.update = jest.fn(async (change: (rec: any) => void) => change(existing))
        mockCollection.find.mockResolvedValue(existing)
        await syncProjects()
        return existing
    }

    it('copies both onto a new local project', async () => {
        const created = await pullNew({ photos_per_trigger: 5, photo_interval_milliseconds: 750 })

        expect(created.photosPerTrigger).toBe(5)
        expect(created.photoIntervalMilliseconds).toBe(750)
    })

    it('copies both onto an existing local project', async () => {
        const existing = await pullExisting({ photos_per_trigger: 2, photo_interval_milliseconds: 1500 })

        expect(existing.photosPerTrigger).toBe(2)
        expect(existing.photoIntervalMilliseconds).toBe(1500)
    })

    it('falls back to the column defaults for a row without them', async () => {
        const created = await pullNew({ photos_per_trigger: null, photo_interval_milliseconds: null })
        expect(created.photosPerTrigger).toBe(3)
        expect(created.photoIntervalMilliseconds).toBe(1000)

        const existing = await pullExisting({})
        expect(existing.photosPerTrigger).toBe(3)
        expect(existing.photoIntervalMilliseconds).toBe(1000)
    })
})
