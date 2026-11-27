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
 * The project pull copies the LoRaWAN check-in period onto the local record
 * (#551): the deployment writes it to the device as op32, so a project that
 * never pulls it deploys at 4 hours whatever the website says.
 * `syncProjects.columns.test.ts` checks the column is named; this one checks
 * the value lands, and what a row without it becomes.
 */
describe('SupabaseSyncService.syncProjects LoRaWAN check-in period', () => {
    const row = (period: Record<string, number | null>) => ({
        id: 'project-1',
        name: 'P',
        organisation_id: 'org-1',
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-01T00:00:00Z',
        deleted_at: null,
        ...period,
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
    const pullNew = async (period: Record<string, number | null>) => {
        mockRows = [row(period)]
        mockCollection.find.mockRejectedValue(new Error('not found'))
        const created: any = { _raw: {} }
        mockCollection.create.mockImplementation(async (build: (rec: any) => void) => build(created))
        await syncProjects()
        return created
    }

    /** Runs the pull against an existing local record, returning it. */
    const pullExisting = async (period: Record<string, number | null>) => {
        mockRows = [row(period)]
        const existing: any = { _raw: { _status: 'synced' }, lorawanPingMinutes: 720 }
        existing.update = jest.fn(async (change: (rec: any) => void) => change(existing))
        mockCollection.find.mockResolvedValue(existing)
        await syncProjects()
        return existing
    }

    it('copies it onto a new local project', async () => {
        const created = await pullNew({ lorawan_ping_minutes: 360 })

        expect(created.lorawanPingMinutes).toBe(360)
    })

    it('copies it onto an existing local project', async () => {
        const existing = await pullExisting({ lorawan_ping_minutes: 480 })

        expect(existing.lorawanPingMinutes).toBe(480)
    })

    it('falls back to the column default for a row without it', async () => {
        const created = await pullNew({ lorawan_ping_minutes: null })
        expect(created.lorawanPingMinutes).toBe(240)

        const existing = await pullExisting({})
        expect(existing.lorawanPingMinutes).toBe(240)
    })
})
