import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

/**
 * #310. Offline with a token over an hour old, the app sat on a spinner for
 * 75 s and then showed Login: auth-js retried the token refresh twice, about
 * 26 s each, announced INITIAL_SESSION with no session although the stored one
 * was intact, and the app took that as a sign-out. Reproduced on the bench on
 * 29 September 2026 in airplane mode with the phone clock two hours ahead.
 */

const USER = 'user-1'
const STORAGE_KEY = 'sb-test-auth-token'

// The session auth-js keeps on disk. `expires_at` in the past: the token needs a refresh.
const storedSession = {
    access_token: 'expired-access-token',
    refresh_token: 'refresh-token',
    expires_at: Math.floor(Date.now() / 1000) - 3600,
    user: { id: USER, email: 'tama@ww.org', created_at: '2026-01-01T00:00:00Z' },
}

// ── The client: its storage, its listener, and a cloud that never answers ──
const mockStorage: Record<string, string> = {}
let mockAuthCallback: ((event: AuthChangeEvent, session: Session | null) => Promise<void>) | undefined
const mockGetSession = jest.fn()
const mockHangingQuery = () => {
    const builder: any = {
        select: () => builder, eq: () => builder, in: () => builder,
        then: () => new Promise(() => {}),   // a network with no route
    }
    return builder
}

jest.mock('../supabase', () => ({
    getSupabaseClient: () => ({
        auth: {
            storageKey: 'sb-test-auth-token',
            storage: { getItem: async (key: string) => mockStorage[key] ?? null },
            getSession: mockGetSession,
            onAuthStateChange: (callback: any) => {
                mockAuthCallback = callback
                return { data: { subscription: { unsubscribe: jest.fn() } } }
            },
        },
        from: () => mockHangingQuery(),
    }),
}))

// The local database, with the user's role and organisation from the last sync.
jest.mock('../../database', () => {
    const rows: Record<string, any[]> = {
        user_roles: [{ user_id: 'user-1', is_active: true, role: 'project_admin', scopeType: 'organisation', scopeId: 'org-a' }],
        organisations: [{ id: 'org-a', name: 'Alpha' }],
    }
    return {
        __esModule: true,
        default: {
            get: (table: string) => ({ query: () => ({ fetch: async () => rows[table] }) }),
            write: async (work: () => Promise<unknown>) => work(),
            batch: async () => {},
        },
    }
})
jest.mock('../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))

const settle = () => new Promise(resolve => setTimeout(resolve, 20))

const loadAuth = () => {
    jest.resetModules()
    return require('../auth') as typeof import('../auth')
}

beforeEach(() => {
    jest.useRealTimers()   // the shared setup turns fake timers on for every test
    for (const key of Object.keys(mockStorage)) delete mockStorage[key]
    mockAuthCallback = undefined
    mockGetSession.mockReset()
})

describe('setupAuthListener offline', () => {
    it('opens from the stored session without waiting for INITIAL_SESSION', async () => {
        mockStorage[STORAGE_KEY] = JSON.stringify(storedSession)
        const { setupAuthListener } = loadAuth()
        const onAuthStateChange = jest.fn()

        setupAuthListener(onAuthStateChange)
        await settle()

        expect(onAuthStateChange).toHaveBeenCalledWith(
            expect.objectContaining({ user: expect.objectContaining({ id: USER }) }),
        )
    })

    it('keeps the user signed in when INITIAL_SESSION comes without a session but the stored one is intact', async () => {
        mockStorage[STORAGE_KEY] = JSON.stringify(storedSession)
        const { setupAuthListener } = loadAuth()
        const onAuthStateChange = jest.fn()

        setupAuthListener(onAuthStateChange)
        await mockAuthCallback!('INITIAL_SESSION', null)
        await settle()

        expect(onAuthStateChange).not.toHaveBeenCalledWith(null)
        expect(onAuthStateChange).toHaveBeenCalledWith(
            expect.objectContaining({ user: expect.objectContaining({ id: USER }) }),
        )
    })

    // auth-js removes the stored session only when the server rejects the
    // refresh, and then announces SIGNED_OUT.
    it('still signs out when the server rejected the session', async () => {
        const { setupAuthListener } = loadAuth()
        const onAuthStateChange = jest.fn()

        setupAuthListener(onAuthStateChange)
        await mockAuthCallback!('INITIAL_SESSION', null)
        expect(onAuthStateChange).toHaveBeenLastCalledWith(null)

        mockStorage[STORAGE_KEY] = JSON.stringify(storedSession)
        await mockAuthCallback!('SIGNED_OUT', null)
        expect(onAuthStateChange).toHaveBeenLastCalledWith(null)
    })

    it('gives the organisations from the local database while the cloud does not answer', async () => {
        mockStorage[STORAGE_KEY] = JSON.stringify(storedSession)
        const { setupAuthListener } = loadAuth()
        const onProfileData = jest.fn()

        setupAuthListener(jest.fn(), onProfileData)
        await settle()

        expect(onProfileData).toHaveBeenCalledWith({
            organisations: [{ id: 'org-a', name: 'Alpha', role: 'project_admin' }],
            role: 'project_admin',
            organisationId: 'org-a',
        })
    })
})

describe('the current user offline', () => {
    it('getCurrentSession falls back to the stored session when the refresh fails', async () => {
        mockStorage[STORAGE_KEY] = JSON.stringify(storedSession)
        mockGetSession.mockResolvedValue({ data: { session: null }, error: new Error('Network request failed') })
        const { getCurrentSession } = loadAuth()

        expect(await getCurrentSession()).toEqual(
            expect.objectContaining({ user: expect.objectContaining({ id: USER }) }),
        )
    })

    it('getCurrentSession is null when nothing is stored', async () => {
        mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
        const { getCurrentSession } = loadAuth()

        expect(await getCurrentSession()).toBeNull()
    })

    it('getStoredUserId reads the user without asking auth-js to refresh', async () => {
        mockStorage[STORAGE_KEY] = JSON.stringify(storedSession)
        const { getStoredUserId } = loadAuth()

        expect(await getStoredUserId()).toBe(USER)
        expect(mockGetSession).not.toHaveBeenCalled()
    })
})
