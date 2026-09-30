import { createReconnectSync, RECONNECT_SETTLE_MS } from '../reconnectSync'
import { watchConnectivity } from '../connectivityWatch'

jest.mock('../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))

// The NetInfo mock (tests/__mocks__) lets a test move the connection.
const netInfo = require('@react-native-community/netinfo')
const goOffline = () => netInfo.__setNetworkState({ isConnected: false })
const goOnline = () => netInfo.__setNetworkState({ isConnected: true })

/**
 * Bench, 29 September 2026: a deployment started and stopped offline left 4
 * operations in the outbox, and when the Wi-Fi came back nothing uploaded for
 * over a minute. Nothing listened for the reconnect.
 */
describe('the reconnect sync', () => {
    let sync: jest.Mock
    let ensureValidSession: jest.Mock
    let signedIn: boolean
    let stop: () => void
    let reconnect: ReturnType<typeof createReconnectSync>

    beforeEach(() => {
        jest.useFakeTimers()
        netInfo.__clearListeners()
        netInfo.__resetNetworkState()
        sync = jest.fn(async () => {})
        ensureValidSession = jest.fn(async () => true)
        signedIn = true
        reconnect = createReconnectSync({ isSignedIn: () => signedIn, ensureValidSession, sync })
        stop = watchConnectivity({ onOffline: reconnect.onOffline, onReconnect: reconnect.onReconnect })
        goOnline()   // the first state only sets the baseline
    })

    afterEach(() => {
        stop()
        reconnect.dispose()
        netInfo.__clearListeners()
        netInfo.__resetNetworkState()
        jest.useRealTimers()
    })

    it('uploads once when the connection comes back', async () => {
        goOffline()
        goOnline()
        await jest.advanceTimersByTimeAsync(RECONNECT_SETTLE_MS)

        expect(sync).toHaveBeenCalledTimes(1)
    })

    it('a flapping connection still gives one sync', async () => {
        goOffline()
        goOnline()
        await jest.advanceTimersByTimeAsync(RECONNECT_SETTLE_MS / 2)
        goOffline()
        goOnline()
        await jest.advanceTimersByTimeAsync(RECONNECT_SETTLE_MS / 2)
        goOffline()
        goOnline()
        await jest.advanceTimersByTimeAsync(RECONNECT_SETTLE_MS * 3)

        expect(sync).toHaveBeenCalledTimes(1)
    })

    it('does not start a second sync while one is running', async () => {
        let finish!: () => void
        sync.mockImplementation(() => new Promise<void>(resolve => { finish = resolve }))

        goOffline()
        goOnline()
        await jest.advanceTimersByTimeAsync(RECONNECT_SETTLE_MS)
        goOffline()
        goOnline()
        await jest.advanceTimersByTimeAsync(RECONNECT_SETTLE_MS)

        expect(sync).toHaveBeenCalledTimes(1)
        finish()
    })

    it('does nothing while signed out', async () => {
        signedIn = false
        goOffline()
        goOnline()
        await jest.advanceTimersByTimeAsync(RECONNECT_SETTLE_MS)

        expect(sync).not.toHaveBeenCalled()
    })

    // #310: a token that expired offline is refreshed first. Until that gets
    // through, nothing is sent; the refresh landing is what starts the upload.
    it('waits for the token refresh before uploading', async () => {
        ensureValidSession.mockResolvedValueOnce(false)
        goOffline()
        goOnline()
        await jest.advanceTimersByTimeAsync(RECONNECT_SETTLE_MS)
        expect(sync).not.toHaveBeenCalled()

        reconnect.onSessionChanged()   // TOKEN_REFRESHED reached Redux
        await jest.advanceTimersByTimeAsync(RECONNECT_SETTLE_MS)
        expect(sync).toHaveBeenCalledTimes(1)
    })

    it('a session change with nothing waiting does not sync', async () => {
        reconnect.onSessionChanged()
        await jest.advanceTimersByTimeAsync(RECONNECT_SETTLE_MS * 2)

        expect(sync).not.toHaveBeenCalled()
    })
})
