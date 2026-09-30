import { createTimeoutFetch, isTimeLimited, SUPABASE_REQUEST_TIMEOUT_MS } from '../supabaseFetch'

/**
 * #310. React Native's fetch has no timeout, so on a network with no route a
 * Supabase request could wait for minutes, and auth-js makes every other call
 * wait behind a token refresh. The limit covers auth and PostgREST reads, and
 * leaves writes, storage and edge functions alone.
 */

const BASE = 'https://abc.supabase.co'

/** A fetch that never answers unless aborted, like a request on a dead network. */
const hangingFetch = () => jest.fn((_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('Aborted')))
    }))

const outcome = (p: Promise<unknown>) => {
    const state: { settled: boolean; error?: unknown } = { settled: false }
    p.then(() => { state.settled = true }, (error) => { state.settled = true; state.error = error })
    return state
}

beforeEach(() => {
    jest.useFakeTimers()
})

afterEach(() => {
    jest.useRealTimers()
})

describe('createTimeoutFetch', () => {
    it.each([
        ['a token refresh', `${BASE}/auth/v1/token?grant_type=refresh_token`, 'POST'],
        ['a user lookup', `${BASE}/auth/v1/user`, 'GET'],
        ['a PostgREST read', `${BASE}/rest/v1/user_roles?select=role`, 'GET'],
    ])('gives up on %s after the limit, as a network failure', async (_label, url, method) => {
        const base = hangingFetch()
        const request = outcome(createTimeoutFetch(base)(url, { method }))

        await jest.advanceTimersByTimeAsync(SUPABASE_REQUEST_TIMEOUT_MS - 1)
        expect(request.settled).toBe(false)
        await jest.advanceTimersByTimeAsync(1)

        expect(request.error).toBeInstanceOf(TypeError)
        expect(String(request.error)).toMatch(/timed out/i)
    })

    it.each([
        ['the outbox push', `${BASE}/rest/v1/rpc/push_changes`, 'POST'],
        ['a PostgREST write', `${BASE}/rest/v1/projects?id=eq.1`, 'PATCH'],
        ['a storage upload', `${BASE}/storage/v1/object/deployment-photos/a.jpg`, 'POST'],
        ['a storage download', `${BASE}/storage/v1/object/models/1V1.TFL`, 'GET'],
        ['an edge function', `${BASE}/functions/v1/anything`, 'POST'],
    ])('leaves %s alone', async (_label, url, method) => {
        const base = hangingFetch()
        const request = outcome(createTimeoutFetch(base)(url, { method }))

        await jest.advanceTimersByTimeAsync(SUPABASE_REQUEST_TIMEOUT_MS * 10)

        expect(request.settled).toBe(false)
        expect(base.mock.calls[0][1]?.signal).toBeUndefined()
    })

    it('passes a prompt answer through and leaves no timer behind', async () => {
        const response = { ok: true, status: 200 } as Response
        const base = jest.fn(async () => response)

        await expect(createTimeoutFetch(base)(`${BASE}/rest/v1/projects`, {})).resolves.toBe(response)
        expect(jest.getTimerCount()).toBe(0)
    })

    it("still lets the caller's own signal cancel the request", async () => {
        const base = hangingFetch()
        const caller = new AbortController()
        const request = outcome(createTimeoutFetch(base)(`${BASE}/rest/v1/projects`, { signal: caller.signal }))

        caller.abort()
        await jest.advanceTimersByTimeAsync(0)

        expect(request.settled).toBe(true)
        expect(String(request.error)).not.toMatch(/timed out/i)
    })
})

describe('isTimeLimited', () => {
    it('limits auth of any kind and PostgREST reads only', () => {
        expect(isTimeLimited(`${BASE}/auth/v1/token`, 'POST')).toBe(true)
        expect(isTimeLimited(`${BASE}/rest/v1/projects`, 'GET')).toBe(true)
        expect(isTimeLimited(`${BASE}/rest/v1/projects`, 'HEAD')).toBe(true)
        expect(isTimeLimited(`${BASE}/rest/v1/rpc/pull_changes`, 'POST')).toBe(false)
        expect(isTimeLimited(`${BASE}/storage/v1/object/a`, 'GET')).toBe(false)
    })
})
