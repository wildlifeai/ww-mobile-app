import type { Session } from '@supabase/supabase-js'

/**
 * #332. Offline, the app signed in but the Projects tab stayed empty: the
 * user's organisations came only from the cloud, and a request that never left
 * the phone returned none, so there was no current organisation to read
 * projects for. Reproduced on the bench on 29 September 2026 in airplane mode.
 */

// ── A local database holding what the last sync left ─────────────────
type Row = Record<string, any>
const mockTables: Record<string, Row[]> = { user_roles: [], organisations: [] }

const mockMatches = (row: Row, clause: any): boolean => {
    if (clause?.type !== 'where') return true
    const value = row[clause.left]
    const { operator, right } = clause.comparison
    if (operator === 'eq') return value === right.value
    if (operator === 'oneOf') return right.values.includes(value)
    return true
}

const mockCollection = (table: string) => ({
    query: (...clauses: any[]) => ({
        fetch: async () => mockTables[table].filter(row => clauses.every(c => mockMatches(row, c))),
    }),
    prepareCreate: (build: (rec: any) => void) => {
        const rec: any = { _raw: {} }
        build(rec)
        return () => mockTables[table].push({ id: rec._raw.id, name: rec.name, slug: rec.slug })
    },
})

jest.mock('../../database', () => ({
    __esModule: true,
    default: {
        get: (table: string) => mockCollection(table),
        write: async (work: () => Promise<unknown>) => work(),
        batch: async (operations: Array<() => void>) => operations.forEach(apply => apply()),
    },
}))

// ── A cloud that answers whatever each test says ─────────────────────
const mockResponses: Record<string, unknown> = {}
const mockBuilder = (table: string) => {
    const builder: any = {
        select: () => builder,
        eq: () => builder,
        in: () => builder,
        then: (resolve: (r: unknown) => unknown, reject: (e: unknown) => unknown) =>
            Promise.resolve(mockResponses[table]).then(resolve, reject),
    }
    return builder
}

jest.mock('../supabase', () => ({
    getSupabaseClient: () => ({ from: (table: string) => mockBuilder(table) }),
}))
jest.mock('../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))
// The shared setup stubs AsyncStorage with empty functions; this test needs it to remember.
jest.mock('@react-native-async-storage/async-storage', () =>
    require('@react-native-async-storage/async-storage/jest/async-storage-mock'))

const USER = 'user-1'
const session = { user: { id: USER }, access_token: 'token' } as unknown as Session

// What supabase-js resolves with when the request never leaves the phone.
const OFFLINE = {
    data: null,
    error: { message: 'TypeError: Network request failed', details: '', hint: '', code: '' },
    status: 0,
}

const localRole = (user_id: string, scope_id: string, role: string, is_active = true) => ({
    id: `${user_id}-${scope_id}`,
    user_id, is_active, role,
    scope_type: 'organisation', scope_id,
    scopeType: 'organisation', scopeId: scope_id,
})

/** A fresh module each time: auth.ts caches a cloud answer per user for 30 s. */
const load = () => {
    jest.resetModules()
    const storage = require('@react-native-async-storage/async-storage')
    const AsyncStorage = storage.default ?? storage
    const { fetchUserOrganisations } = require('../auth')
    return { AsyncStorage, fetchUserOrganisations }
}

beforeEach(() => {
    jest.useRealTimers()   // the shared setup turns fake timers on for every test
    mockTables.user_roles = [
        localRole(USER, 'org-a', 'project_admin'),
        localRole(USER, 'org-b', 'project_member'),
        localRole(USER, 'org-old', 'project_admin', false),   // no longer active
        localRole('someone-else', 'org-z', 'project_admin'),  // synced, not ours
    ]
    mockTables.organisations = [
        { id: 'org-a', name: 'Alpha' },
        { id: 'org-b', name: 'Beta' },
        { id: 'org-z', name: 'Zulu' },
    ]
    for (const key of Object.keys(mockResponses)) delete mockResponses[key]
})

describe('fetchUserOrganisations offline', () => {
    it('builds the organisations from the local roles when the cloud cannot be reached', async () => {
        const { fetchUserOrganisations } = load()
        mockResponses.user_roles = OFFLINE

        const result = await fetchUserOrganisations(USER, session)

        expect(result).toEqual({
            organisations: [
                { id: 'org-a', name: 'Alpha', role: 'project_admin' },
                { id: 'org-b', name: 'Beta', role: 'project_member' },
            ],
            role: 'project_admin',
            organisationId: 'org-a',
        })
    })

    it('uses the roles the cloud did return when only the organisations query fails', async () => {
        const { fetchUserOrganisations } = load()
        mockResponses.user_roles = {
            data: [{ role: 'project_member', scope_type: 'organisation', scope_id: 'org-b' }],
            error: null, status: 200,
        }
        mockResponses.organisations = { ...OFFLINE, error: { message: 'Service Unavailable' }, status: 503 }

        const result = await fetchUserOrganisations(USER, session)

        expect(result.organisations).toEqual([{ id: 'org-b', name: 'Beta', role: 'project_member' }])
        expect(result.organisationId).toBe('org-b')
    })

    // The server's truth, for example a user removed from every organisation.
    it('keeps an empty answer from the cloud, local roles or not', async () => {
        const { fetchUserOrganisations } = load()
        mockResponses.user_roles = { data: [], error: null, status: 200 }

        const result = await fetchUserOrganisations(USER, session)

        expect(result).toEqual({ organisations: [], role: 'project_member', organisationId: null })
    })

    it('treats a refusal as an answer, not as being offline', async () => {
        const { fetchUserOrganisations } = load()
        mockResponses.user_roles = {
            data: null, error: { message: 'JWT expired', code: 'PGRST301' }, status: 401,
        }

        const result = await fetchUserOrganisations(USER, session)

        expect(result.organisations).toEqual([])
    })
})

describe('the current organisation across restarts', () => {
    it('reopens the organisation the user last had open, offline', async () => {
        const { AsyncStorage, fetchUserOrganisations } = load()
        await AsyncStorage.setItem(`currentOrganisation:${USER}`, JSON.stringify('org-b'))
        mockResponses.user_roles = OFFLINE

        const result = await fetchUserOrganisations(USER, session)

        expect(result.organisationId).toBe('org-b')
    })

    it('reopens it online too', async () => {
        const { AsyncStorage, fetchUserOrganisations } = load()
        await AsyncStorage.setItem(`currentOrganisation:${USER}`, JSON.stringify('org-b'))
        mockResponses.user_roles = {
            data: [
                { role: 'project_admin', scope_type: 'organisation', scope_id: 'org-a' },
                { role: 'project_member', scope_type: 'organisation', scope_id: 'org-b' },
            ],
            error: null, status: 200,
        }
        mockResponses.organisations = { data: [{ id: 'org-a', name: 'Alpha' }, { id: 'org-b', name: 'Beta' }], error: null, status: 200 }

        const result = await fetchUserOrganisations(USER, session)

        expect(result.organisationId).toBe('org-b')
    })

    it('does not reopen an organisation the roles no longer allow', async () => {
        const { AsyncStorage, fetchUserOrganisations } = load()
        await AsyncStorage.setItem(`currentOrganisation:${USER}`, JSON.stringify('org-z'))
        mockResponses.user_roles = OFFLINE

        const result = await fetchUserOrganisations(USER, session)

        expect(result.organisationId).toBe('org-a')
        expect(JSON.parse(await AsyncStorage.getItem(`currentOrganisation:${USER}`))).toBe('org-a')
    })
})

describe('keeping the names for the next offline start', () => {
    it('stores the organisations the cloud returns in the local table', async () => {
        mockTables.organisations = []
        const online = load()
        mockResponses.user_roles = {
            data: [{ role: 'project_admin', scope_type: 'organisation', scope_id: 'org-a' }],
            error: null, status: 200,
        }
        mockResponses.organisations = { data: [{ id: 'org-a', name: 'Alpha', slug: 'alpha' }], error: null, status: 200 }
        await online.fetchUserOrganisations(USER, session)
        await new Promise(resolve => setTimeout(resolve, 20))   // the save does not hold up the answer

        expect(mockTables.organisations).toEqual([{ id: 'org-a', name: 'Alpha', slug: 'alpha' }])

        // Next start, offline: the name is there.
        const offline = load()
        mockResponses.user_roles = OFFLINE
        const result = await offline.fetchUserOrganisations(USER, session)
        expect(result.organisations[0]).toEqual({ id: 'org-a', name: 'Alpha', role: 'project_admin' })
    })
})

describe('isNetworkOrRetryable', () => {
    const { isNetworkOrRetryable } = jest.requireActual('../organisationMembership')

    it.each([
        [0, 'TypeError: Network request failed', true],
        [503, 'Service Unavailable', true],
        [429, 'Too Many Requests', true],
        [408, 'Request Timeout', true],
        [undefined, 'Network request failed', true],
        [401, 'JWT expired', false],
        [403, 'permission denied for table user_roles', false],
        [400, 'invalid input syntax', false],
    ])('status %s, "%s" -> %s', (status, message, expected) => {
        expect(isNetworkOrRetryable({ message }, status)).toBe(expected)
    })
})
