import ReferenceDataService from '../ReferenceDataService'
import OfflinePrefetchService from '../OfflinePrefetchService'
import { getSupabaseClient } from '../supabase'

jest.mock('../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))
jest.mock('../../database', () => ({ __esModule: true, default: { write: jest.fn() } }))
jest.mock('../OfflinePrefetchService', () => ({ __esModule: true, default: { request: jest.fn() } }))

/** A query that answers every chain with no rows. */
function emptyQuery(): any {
    const query: any = {}
    for (const method of ['from', 'select', 'is', 'eq', 'in', 'order']) query[method] = jest.fn(() => query)
    query.then = (resolve: (v: unknown) => void) => resolve({ data: [], error: null })
    return query
}

/**
 * The pre-download (#333) runs after the reference data lands, since that is
 * when the model and firmware rows it reads have changed. The call is a lazy
 * require, to keep the two modules from requiring each other at load, so this
 * also checks that it resolves. (A dynamic `import()` would not: Jest here
 * runs without the VM modules flag and rejects it.)
 */
describe('reference data sync and the offline pre-download', () => {
    it('asks for a pre-download once the tables are in', async () => {
        const client = emptyQuery()
        client.auth = { getUser: jest.fn(async () => ({ data: { user: { id: 'u1' } } })) }
        ;(getSupabaseClient as jest.Mock).mockReturnValue(client)

        await ReferenceDataService.syncReferenceData()

        expect(OfflinePrefetchService.request).toHaveBeenCalledWith('reference data')
    })
})
