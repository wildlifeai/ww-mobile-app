import { installNetworkErrorFilter, isNetworkFailure, logCloudFailure } from '../networkErrors'
import { log, logError } from '../logger'

jest.mock('../logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))

/**
 * Offline, the dev build's LogBox showed a red "TypeError: Network request
 * failed" bar counting up to 7 on a cold start in airplane mode. Being offline
 * is the field's normal state; the "Offline Mode" banner says so, and a failed
 * request is not a fault. Real faults must still come through.
 */
describe('isNetworkFailure', () => {
    it.each([
        [new TypeError('Network request failed'), true],
        [new TypeError('Network request timed out after 30 s'), true],
        [{ message: 'TypeError: Network request failed', details: '', hint: '', code: '' }, true],   // PostgREST's error
        [Object.assign(new Error('Network request failed'), { name: 'AuthRetryableFetchError' }), true],
        ['TypeError: Network request failed', true],
        // Real faults stay faults. BLE commands fail with TIMEOUT, and that is not the network.
        [new Error('TIMEOUT'), false],
        [new Error('Session Reset'), false],
        [{ message: 'JWT expired', code: 'PGRST301' }, false],
        ['❌ Error fetching user_roles:', false],
        [undefined, false],
    ])('%p -> %p', (value, expected) => {
        expect(isNetworkFailure(value)).toBe(expected)
    })
})

describe('logCloudFailure', () => {
    beforeEach(() => jest.clearAllMocks())

    it('logs a network failure as a plain line', () => {
        logCloudFailure('Failed to sync projects:', { message: 'TypeError: Network request failed' })
        expect(log).toHaveBeenCalledTimes(1)
        expect(logError).not.toHaveBeenCalled()
    })

    it('keeps anything else an error', () => {
        logCloudFailure('Failed to sync projects:', { message: 'permission denied for table projects', code: '42501' })
        expect(logError).toHaveBeenCalledTimes(1)
        expect(log).not.toHaveBeenCalled()
    })
})

describe('installNetworkErrorFilter', () => {
    it("routes supabase-js's network errors to console.log and passes everything else", () => {
        const target = { error: jest.fn(), log: jest.fn() } as unknown as Console
        const originalError = target.error
        const uninstall = installNetworkErrorFilter(target)

        // What auth-js prints for every failed attempt (lib/fetch.js)
        target.error(new TypeError('Network request failed'))
        target.error('Auto refresh tick failed with error. This is likely a transient error.',
            Object.assign(new Error('Network request failed'), { name: 'AuthRetryableFetchError' }))
        expect(originalError).not.toHaveBeenCalled()
        expect(target.log).toHaveBeenCalledTimes(2)

        target.error('[BLE] capture failed', new Error('TIMEOUT'))
        expect(originalError).toHaveBeenCalledWith('[BLE] capture failed', new Error('TIMEOUT'))

        uninstall()
        expect(target.error).toBe(originalError)
    })
})
