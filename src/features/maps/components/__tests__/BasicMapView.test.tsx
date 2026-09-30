import { render } from '@testing-library/react-native'

import { BasicMapView } from '../BasicMapView'

jest.mock('../../../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))

const region = { latitude: -36.85, longitude: 174.76, latitudeDelta: 0.05, longitudeDelta: 0.05 }

/**
 * #332. Offline, the Map showed no deployment markers although they come from
 * the local database. On Android react-native-maps' loading overlay is an
 * opaque view over the whole map, markers included, and it is removed only
 * when Google Maps reports every tile loaded, which it does not while the tiles
 * cannot be fetched.
 */
describe('BasicMapView', () => {
    it('draws no loading overlay, so markers show without tiles', () => {
        const { getByTestId } = render(<BasicMapView region={region} />)

        expect(getByTestId('mock-map-view').props.loadingEnabled).toBe(false)
    })
})
