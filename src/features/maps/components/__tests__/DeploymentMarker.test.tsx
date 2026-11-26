import { act, render, screen } from '@testing-library/react-native'

import { DeploymentMarker } from '../DeploymentMarker'
import type Deployment from '../../../../database/models/Deployment'

const deployment = { id: 'd1', latitude: -41.29, longitude: 174.78, deploymentStatusId: 2 } as unknown as Deployment

/**
 * #518. A camera whose last check-in needs attention (Warning, Fault or Silent) has a ring round
 * its marker. The check-ins arrive after the map's first render, and Android keeps an untracked
 * marker's old bitmap, so the marker tracks its view again while the ring changes.
 */
describe('DeploymentMarker', () => {
    it('has no ring when the camera needs no attention', () => {
        render(<DeploymentMarker deployment={deployment} onPress={jest.fn()} />)

        expect(screen.queryByTestId('marker-ring')).toBeNull()
    })

    it('draws the ring in the state colour', () => {
        render(<DeploymentMarker deployment={deployment} onPress={jest.fn()} ring="#EF4444" />)

        expect(screen.getByTestId('marker-ring')).toHaveStyle({ borderColor: '#EF4444' })
    })

    it('redraws when a ring arrives after the marker stopped tracking', () => {
        const { rerender } = render(<DeploymentMarker deployment={deployment} onPress={jest.fn()} />)
        act(() => { jest.advanceTimersByTime(600) })
        expect(screen.getByTestId('mock-map-marker').props.tracksViewChanges).toBe(false)

        rerender(<DeploymentMarker deployment={deployment} onPress={jest.fn()} ring="#F59E0B" />)

        expect(screen.getByTestId('mock-map-marker').props.tracksViewChanges).toBe(true)
        expect(screen.getByTestId('marker-ring')).toBeOnTheScreen()
        act(() => { jest.advanceTimersByTime(600) })
        expect(screen.getByTestId('mock-map-marker').props.tracksViewChanges).toBe(false)
    })
})
