import { act, render, screen } from '@testing-library/react-native'

import { RemoteCheckInCard } from '../RemoteCheckInCard'
import type Deployment from '../../../../database/models/Deployment'

const netInfo = require('@react-native-community/netinfo')

const mockFetch = jest.fn()
jest.mock('../../../../services/remoteCheckIns', () => ({
    fetchLatestCheckIns: (ids: string[]) => mockFetch(ids),
}))
const mockFirmwareRows = jest.fn()
jest.mock('../../../../database', () => ({
    __esModule: true,
    default: { get: () => ({ query: () => ({ fetch: () => mockFirmwareRows() }) }) },
}))
jest.mock('../../../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))

const HOUR = 3_600_000
const NOW = Date.parse('2026-11-27T12:00:00Z')
const ago = (hours: number) => new Date(NOW - hours * HOUR).toISOString()

/** Lets the connection check and the read settle */
const flush = () => act(async () => { for (let i = 0; i < 5; i++) await Promise.resolve() })

const deployment = (over: Partial<Deployment> = {}) => ({
    id: 'd1',
    deploymentStart: new Date(NOW - 48 * HOUR),
    deploymentEnd: null,
    lorawanPingMinutes: 240,
    bleFirmwareId: 'fw-ble',
    himaxFirmwareId: null,
    ...over,
}) as unknown as Deployment

const checkIn = (over: Record<string, unknown> = {}) => ({
    lastSeen: ago(2), batteryMv: 5600, batteryPct: 80, sdFreePct: 41, health: 'ok', healthReasons: [], ...over,
})

/**
 * #518. Someone looking at a deployed camera sees its last LoRaWAN check-in without visiting it,
 * read live, with the health in the backend's words. Offline the card is not there.
 */
describe('the Remote check-in card', () => {
    beforeEach(() => {
        jest.setSystemTime(NOW)
        mockFirmwareRows.mockResolvedValue([{ version: '00.30.62' }])
    })
    afterEach(() => netInfo.__resetNetworkState())

    it('shows the last check-in: when, battery, SD card, firmware and health', async () => {
        mockFetch.mockResolvedValue({ d1: checkIn() })

        render(<RemoteCheckInCard deployment={deployment()} />)

        expect(await screen.findByText('Remote check-in')).toBeOnTheScreen()
        expect(mockFetch).toHaveBeenCalledWith(['d1'])
        expect(screen.getByText('2 h ago')).toBeOnTheScreen()
        expect(screen.getByText('5.6 V')).toBeOnTheScreen()
        expect(screen.getByText('41% free')).toBeOnTheScreen()
        expect(await screen.findByText('Bluetooth 0.30.62')).toBeOnTheScreen()
        expect(screen.getByText('OK')).toBeOnTheScreen()
    })

    it('leaves the firmware out when it is missing from the phone catalogue', async () => {
        mockFetch.mockResolvedValue({ d1: checkIn() })
        mockFirmwareRows.mockResolvedValue([])

        render(<RemoteCheckInCard deployment={deployment()} />)

        expect(await screen.findByText('OK')).toBeOnTheScreen()
        await flush()
        expect(screen.queryByText('Firmware')).toBeNull()
    })

    it('names each fault in the backend words, once', async () => {
        mockFetch.mockResolvedValue({ d1: checkIn({
            health: 'fault', healthReasons: ['self_test_bit_9', 'self_test_bit_3', 'unexpected_restart_6'],
        }) })

        render(<RemoteCheckInCard deployment={deployment()} />)

        expect(await screen.findByText('HM0360 camera failed')).toBeOnTheScreen()
        expect(screen.getAllByText('Restarted by its watchdog')).toHaveLength(1)
        expect(screen.queryByText('Fault')).toBeNull()
    })

    it('says a camera unheard for three ping periods is Silent', async () => {
        mockFetch.mockResolvedValue({ d1: checkIn({ lastSeen: ago(13) }) })

        render(<RemoteCheckInCard deployment={deployment()} />)

        expect(await screen.findByText('Silent')).toBeOnTheScreen()
        expect(screen.getByText('No message for over 12 h')).toBeOnTheScreen()
    })

    it('shows a camera that never checked in only once it is Silent', async () => {
        mockFetch.mockResolvedValue({})

        const { rerender } = render(<RemoteCheckInCard deployment={deployment({ deploymentStart: new Date(NOW - 2 * HOUR) })} />)
        await flush()
        expect(mockFetch).toHaveBeenCalled()
        expect(screen.queryByTestId('remote-check-in')).toBeNull()

        rerender(<RemoteCheckInCard deployment={deployment({ deploymentStart: new Date(NOW - 13 * HOUR) })} />)
        expect(await screen.findByText('None')).toBeOnTheScreen()
        expect(screen.getByText('Silent')).toBeOnTheScreen()
    })

    it('is hidden offline, and reads nothing', async () => {
        netInfo.__setNetworkState({ isConnected: false })

        render(<RemoteCheckInCard deployment={deployment()} />)
        await flush()

        expect(screen.queryByTestId('remote-check-in')).toBeNull()
        expect(mockFetch).not.toHaveBeenCalled()
    })

    it('goes when the connection goes, and reads again when it comes back', async () => {
        mockFetch.mockResolvedValue({ d1: checkIn() })
        render(<RemoteCheckInCard deployment={deployment()} />)
        expect(await screen.findByTestId('remote-check-in')).toBeOnTheScreen()

        act(() => netInfo.__setNetworkState({ isConnected: false }))
        expect(screen.queryByTestId('remote-check-in')).toBeNull()

        mockFetch.mockResolvedValue({ d1: checkIn({ health: 'warning', healthReasons: ['sd_low'] }) })
        act(() => netInfo.__setNetworkState({ isConnected: true }))
        expect(await screen.findByText('SD card nearly full')).toBeOnTheScreen()
        expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('is hidden, and nothing errors, when the read fails', async () => {
        mockFetch.mockRejectedValue(new Error('Network request failed'))

        render(<RemoteCheckInCard deployment={deployment()} />)
        await flush()

        expect(mockFetch).toHaveBeenCalled()
        expect(screen.queryByTestId('remote-check-in')).toBeNull()
    })
})
