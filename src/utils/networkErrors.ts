/**
 * Telling "the phone could not reach the server" apart from a fault.
 *
 * Offline is the normal condition in the field, and the "Offline Mode" banner
 * is how the app says so. A failed request is not a fault then, so it must not
 * reach `console.error`, which the dev build shows as a red LogBox bar: in
 * airplane mode a cold start used to count up to 7 of them. Real faults still
 * go to `logError`.
 */
import { log, logError } from './logger'

// Deliberately narrow. A bare "timeout" is not here: BLE commands fail with
// `TIMEOUT`, and those are real faults that must stay red.
const NETWORK_MESSAGE = /network request failed|network request timed out|failed to fetch|networkerror/i

/**
 * Whether a failed cloud call means "could not ask", as opposed to an answer.
 *
 * supabase-js does not throw when the request never leaves the phone: it
 * resolves with `status: 0` and the fetch error as the message, `TypeError:
 * Network request failed` in airplane mode. A 5xx, 408 or 429 is the server
 * failing to answer, which is the same thing from the field. Anything else,
 * such as an expired token or a policy refusal, is an answer, and so is an
 * empty result.
 */
export function isNetworkOrRetryable(
    error: { message?: string; name?: string } | null | undefined,
    status?: number | null,
): boolean {
    if (status === 0) return true
    if (typeof status === 'number' && (status >= 500 || status === 408 || status === 429)) return true
    if (error?.name === 'AuthRetryableFetchError') return true
    return NETWORK_MESSAGE.test(error?.message ?? '')
}

/** Whether anything handed to a logger is, or carries, a network failure. */
export function isNetworkFailure(value: unknown): boolean {
    if (!value) return false
    if (typeof value === 'string') return NETWORK_MESSAGE.test(value)
    if (typeof value === 'object') {
        const v = value as { name?: string; message?: unknown; status?: unknown }
        const status = typeof v.status === 'number' ? v.status : undefined
        return isNetworkOrRetryable(
            { name: v.name, message: typeof v.message === 'string' ? v.message : undefined },
            // Only a network status counts here; a 500 inside some other object is not ours to judge
            status === 0 ? 0 : undefined,
        )
    }
    return false
}

/**
 * Log a failed cloud call: as a plain line when the network is the reason, as
 * an error otherwise.
 */
export function logCloudFailure(message: string, error: unknown, status?: number | null): void {
    const e = error as { message?: string; name?: string } | null | undefined
    if (isNetworkOrRetryable(e, status) || isNetworkFailure(error)) {
        log(`🔌 ${message} (no network: ${e?.message ?? String(error)})`)
    } else {
        logError(message, error)
    }
}

/**
 * supabase-js reports its own network failures with `console.error`, once per
 * attempt: auth-js prints every failed fetch (lib/fetch.js), every failed
 * refresh and every failed auto-refresh tick. Offline with a token to refresh
 * that is dozens of bare `TypeError: Network request failed` lines. Route
 * `console.error` calls whose arguments carry a network failure to the plain
 * log (`target.log`) instead, prefixed, so they stay in logcat and leave LogBox
 * alone. Everything else passes through untouched.
 */
export function installNetworkErrorFilter(target: Console = console): () => void {
    const original = target.error
    target.error = (...args: unknown[]) => {
        if (args.some(isNetworkFailure)) {
            target.log('[network]', ...args)
            return
        }
        original.apply(target, args as [])
    }
    return () => { target.error = original }
}
