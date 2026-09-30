/**
 * The fetch the Supabase client uses, with a time limit on the requests that
 * can hold the app up (#310).
 *
 * React Native's own fetch never gives up: its OkHttp client is built with no
 * connect, read or write timeout. In airplane mode a request fails at once, but
 * on a network with no route to the internet (a dead hotspot, a captive portal)
 * it can wait for minutes. auth-js retries a failed token refresh for up to
 * 30 s, and every PostgREST call first waits for that refresh, so one request
 * that never ends stalls everything behind it.
 */

/**
 * 30 s, for two reasons. It matches auth-js's own refresh budget
 * (AUTO_REFRESH_TICK_DURATION_MS): a refresh that hangs is given up once per
 * cycle instead of stacking attempts. And it is generous for what it covers:
 * React Native's fetch resolves only once the whole body has arrived, so this
 * bounds the full exchange, and 30 s on a slow rural link (EDGE, roughly 100 to
 * 200 kbit/s) still carries a TLS handshake and several hundred kilobytes. The
 * reads it applies to are a few kilobytes each.
 */
export const SUPABASE_REQUEST_TIMEOUT_MS = 30_000

const requestUrl = (input: RequestInfo | URL): string => {
    if (typeof input === 'string') return input
    if (input instanceof URL) return input.toString()
    return (input as Request).url
}

const requestMethod = (input: RequestInfo | URL, init?: RequestInit): string =>
    (init?.method ?? (typeof input === 'object' && 'method' in input ? (input as Request).method : 'GET')).toUpperCase()

/**
 * Whether a request gets the time limit.
 *
 * - **Auth** (`/auth/v1/`): the token refresh and the user lookup that every
 *   other call waits behind.
 * - **PostgREST reads** (`GET` and `HEAD` on `/rest/v1/`): the queries screens
 *   and the sync pull with.
 *
 * Exempt, deliberately:
 * - **PostgREST writes and RPCs** (`POST`, `PATCH`, `PUT`, `DELETE`), the
 *   outbox's `push_changes` above all. Abandoning a write the server may already
 *   have applied is worse than waiting for it, and they run in the background.
 * - **Storage** (`/storage/v1/`): photo uploads, and model and firmware files,
 *   which legitimately take minutes on a slow link.
 * - **Edge functions** (`/functions/v1/`), whose duration is theirs to decide.
 */
export const isTimeLimited = (url: string, method: string): boolean => {
    if (url.includes('/auth/v1/')) return true
    if (url.includes('/rest/v1/')) return method === 'GET' || method === 'HEAD'
    return false
}

/**
 * `baseFetch` with `timeoutMs` on the requests `isTimeLimited` picks. A request
 * that runs out fails as a network failure would, a `TypeError`, so supabase-js
 * handles it the same way: auth-js treats it as retryable and keeps the stored
 * session, and PostgREST returns `status: 0`.
 */
export const createTimeoutFetch = (
    baseFetch: typeof fetch = (...args) => fetch(...args),
    timeoutMs: number = SUPABASE_REQUEST_TIMEOUT_MS,
): typeof fetch => async (input, init) => {
    const url = requestUrl(input)
    if (!isTimeLimited(url, requestMethod(input, init))) {
        return baseFetch(input, init)
    }

    const controller = new AbortController()
    let timedOut = false
    const timer = setTimeout(() => {
        timedOut = true
        controller.abort()
    }, timeoutMs)

    // The caller's own signal still cancels the request.
    const callerSignal = init?.signal
    const onCallerAbort = () => controller.abort()
    if (callerSignal) {
        if (callerSignal.aborted) controller.abort()
        else callerSignal.addEventListener('abort', onCallerAbort)
    }

    try {
        return await baseFetch(input, { ...init, signal: controller.signal })
    } catch (error) {
        if (timedOut) {
            throw new TypeError(`Network request timed out after ${timeoutMs / 1000} s`)
        }
        throw error
    } finally {
        clearTimeout(timer)
        callerSignal?.removeEventListener('abort', onCallerAbort)
    }
}
