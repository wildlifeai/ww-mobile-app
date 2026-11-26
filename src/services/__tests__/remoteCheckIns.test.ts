import { fetchLatestCheckIns } from '../remoteCheckIns'

const mockIn = jest.fn()
const mockSelect = jest.fn(() => ({ in: mockIn }))
const mockFrom = jest.fn((_table: string) => ({ select: mockSelect }))
jest.mock('../supabase', () => ({ getSupabaseClient: () => ({ from: mockFrom }) }))

const row = (over: Record<string, unknown> = {}) => ({
    deployment_id: 'd1', received_at: '2026-11-27T10:00:00Z', battery_level: 80, battery_mv: 5600,
    sd_free_pct: 41, health_state: 'fault', health_reasons: ['self_test_bit_9'], ...over,
})

/** #518. The card and the map rings read each deployment's newest check-in from ww-backend's view. */
describe('fetchLatestCheckIns', () => {
    beforeEach(() => jest.clearAllMocks())

    it('reads deployment_latest_lorawan and keys each check-in by deployment', async () => {
        mockIn.mockResolvedValue({ data: [row(), row({ deployment_id: 'd2', health_state: null, health_reasons: null })], error: null })

        const out = await fetchLatestCheckIns(['d1', 'd2'])

        expect(mockFrom).toHaveBeenCalledWith('deployment_latest_lorawan')
        expect(mockIn).toHaveBeenCalledWith('deployment_id', ['d1', 'd2'])
        expect(out.d1).toEqual({
            lastSeen: '2026-11-27T10:00:00Z', batteryMv: 5600, batteryPct: 80, sdFreePct: 41,
            health: 'fault', healthReasons: ['self_test_bit_9'],
        })
        expect(out.d2).toMatchObject({ health: null, healthReasons: [] })
    })

    it('asks in chunks of 100 ids, so the URL stays short however many cameras are out', async () => {
        mockIn.mockResolvedValue({ data: [], error: null })
        const ids = Array.from({ length: 250 }, (_, i) => `d${i}`)

        await fetchLatestCheckIns(ids)

        expect(mockIn.mock.calls.map(([, chunk]) => chunk.length)).toEqual([100, 100, 50])
    })

    it('asks nothing for no deployments', async () => {
        expect(await fetchLatestCheckIns([])).toEqual({})
        expect(mockFrom).not.toHaveBeenCalled()
    })

    it('throws the read error', async () => {
        mockIn.mockResolvedValue({ data: null, error: { message: 'permission denied' } })

        await expect(fetchLatestCheckIns(['d1'])).rejects.toThrow('permission denied')
    })
})
