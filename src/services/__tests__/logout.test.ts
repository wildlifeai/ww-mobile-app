import { logout, readStoredSession, setupAuthListener } from '../auth'

/**
 * #360. The side menu's Sign out showed Login, and after a force stop the next
 * launch opened as the same account, from the session still in storage.
 * Reproduced on the bench on 1 October 2026 with the phone offline. Signing out
 * through auth-js alone keeps that session whenever the server cannot be
 * reached, so `logout` removes it first.
 */

const { __setNetworkState, __resetNetworkState } = require('@react-native-community/netinfo') as {
    __setNetworkState: (state: { isConnected: boolean }) => void
    __resetNetworkState: () => void
}

const USER = 'user-1'
const STORAGE_KEY = 'sb-test-auth-token'

const storedSession = {
    access_token: 'access-token',
    refresh_token: 'refresh-token',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: USER, email: 'tama@ww.org', created_at: '2026-01-01T00:00:00Z' },
}

// ── The client: its storage, the server's /logout, and auth-js's signOut ──
const mockStorage: Record<string, string> = {}
const mockEvents: string[] = []
let mockServerReachable = true

// The server's /logout, as auth-js's `admin.signOut(jwt, scope)` calls it
const mockServerSignOut = jest.fn(async (_jwt: string, _scope: string) =>
    mockServerReachable
        ? { data: null, error: null }
        : { data: null, error: Object.assign(new Error('Network request failed'), { name: 'AuthRetryableFetchError', status: 0 }) },
)

// auth-js 2.89's `signOut`: with a stored session it asks the server first, and
// a failure that is not the server refusing the token returns the error with
// the session left in storage. It removes the session and announces
// SIGNED_OUT only after the server has answered, or when nothing is stored.
const mockSignOut = jest.fn(async ({ scope }: { scope?: string } = {}) => {
    const raw = mockStorage[STORAGE_KEY]
    if (raw) {
        const { error } = await mockServerSignOut(JSON.parse(raw).access_token, scope ?? 'global')
        if (error) return { error }
    }
    delete mockStorage[STORAGE_KEY]
    mockEvents.push('SIGNED_OUT')
    return { error: null }
})

jest.mock('../supabase', () => ({
    getSupabaseClient: () => ({
        auth: {
            storageKey: 'sb-test-auth-token',
            storage: {
                getItem: async (key: string) => mockStorage[key] ?? null,
                removeItem: async (key: string) => { delete mockStorage[key] },
            },
            signOut: mockSignOut,
            admin: { signOut: mockServerSignOut },
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: jest.fn() } } }),
        },
    }),
}))
jest.mock('../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))

const settle = () => new Promise(resolve => setTimeout(resolve, 20))

beforeEach(() => {
    jest.useRealTimers()   // the shared setup turns fake timers on for every test
    for (const key of Object.keys(mockStorage)) delete mockStorage[key]
    mockEvents.length = 0
    mockServerReachable = true
    mockStorage[STORAGE_KEY] = JSON.stringify(storedSession)
    __resetNetworkState()
})

describe('logout', () => {
    it('ends the session on the phone offline, so the next launch opens on Login', async () => {
        __setNetworkState({ isConnected: false })
        mockServerReachable = false

        await expect(logout()).resolves.toBeUndefined()
        await settle()

        expect(await readStoredSession()).toBeNull()
        expect(mockEvents).toContain('SIGNED_OUT')
        expect(mockServerSignOut).not.toHaveBeenCalled()

        // The next launch: nothing stored, so nothing to open from
        const onAuthStateChange = jest.fn()
        setupAuthListener(onAuthStateChange)
        await settle()
        expect(onAuthStateChange).not.toHaveBeenCalled()
    })

    it('ends it on the phone when the phone says connected but the server cannot be reached', async () => {
        mockServerReachable = false

        await expect(logout()).resolves.toBeUndefined()
        await settle()

        expect(await readStoredSession()).toBeNull()
        expect(mockServerSignOut).toHaveBeenCalledWith('access-token', 'local')
    })

    it('ends this session on the server too when it can be reached, and only this one', async () => {
        await logout()
        await settle()

        expect(await readStoredSession()).toBeNull()
        expect(mockEvents).toContain('SIGNED_OUT')
        expect(mockServerSignOut).toHaveBeenCalledTimes(1)
        expect(mockServerSignOut).toHaveBeenCalledWith('access-token', 'local')
    })

    it('does not wait for auth-js, which can sit behind a token refresh', async () => {
        mockSignOut.mockImplementationOnce(() => new Promise(() => {}))

        await expect(logout()).resolves.toBeUndefined()

        expect(await readStoredSession()).toBeNull()
    })
})
