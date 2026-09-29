import ReferenceDataService from '../ReferenceDataService'
import { getSupabaseClient } from '../supabase'

jest.mock('../../utils/logger', () => ({ log: jest.fn(), logError: jest.fn() }))
jest.mock('../../database', () => ({ __esModule: true, default: { write: jest.fn() } }))
// '../supabase' is mocked globally in tests/setup/sanitySetup.ts; the test
// swaps in a query that records its calls.

/**
 * The ai_models pull asks for both statuses a project can be assigned. It
 * asked for `validated` alone, so a project whose model was `deployed` found
 * nothing on the phone and started monitoring without it (#290).
 */
describe('ReferenceDataService ai_models pull', () => {
    it('asks for validated and deployed models, and nothing else', async () => {
        const calls: Array<[string, unknown[]]> = []
        const query: any = {}
        for (const method of ['from', 'select', 'is', 'eq', 'in', 'order']) {
            query[method] = jest.fn((...args: unknown[]) => {
                calls.push([method, args])
                return method === 'order' ? Promise.resolve({ data: [], error: null }) : query
            })
        }
        ;(getSupabaseClient as jest.Mock).mockReturnValue(query)

        await (ReferenceDataService as any).syncAiModels()

        expect(calls).toContainEqual(['from', ['ai_models']])
        expect(calls).toContainEqual(['in', ['status', ['validated', 'deployed']]])
        expect(calls.filter(([method, args]) => method === 'eq' && args[0] === 'status')).toHaveLength(0)
    })
})
