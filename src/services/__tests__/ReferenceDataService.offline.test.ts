/**
 * Offline, the reference pull asked the server for the user three times, and
 * each failure was a red error in the dev build's LogBox, twice per start.
 * Without a connection it now does not start; the reconnect pulls instead.
 */
const mockGetUser = jest.fn()

jest.mock('../supabase', () => ({
    getSupabaseClient: () => ({ auth: { getUser: mockGetUser } }),
}))
jest.mock('../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))

const netInfo = require('@react-native-community/netinfo')

describe('ReferenceDataService.syncReferenceData', () => {
    afterEach(() => netInfo.__resetNetworkState())

    it('does not start without a connection', async () => {
        netInfo.__setNetworkState({ isConnected: false })
        const ReferenceDataService = require('../ReferenceDataService').default

        await ReferenceDataService.syncReferenceData()

        expect(mockGetUser).not.toHaveBeenCalled()
    })
})
