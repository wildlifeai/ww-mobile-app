const mockPlatform = { OS: 'android' }
jest.mock('react-native', () => ({ get Platform() { return mockPlatform } }))
jest.mock('react-native-ble-manager', () => ({
    __esModule: true,
    default: { requestConnectionPriority: jest.fn() },
}))
jest.mock('../../../utils/logger', () => ({ log: jest.fn() }))

import BleManager from 'react-native-ble-manager'
import { requestFastInterval, releaseFastInterval } from '../connectionPriority'

const request = BleManager.requestConnectionPriority as jest.Mock

beforeEach(() => {
    request.mockReset()
    request.mockResolvedValue(true)
    mockPlatform.OS = 'android'
})

describe('connectionPriority', () => {
    it('asks Android for high priority, then gives it back as balanced', async () => {
        await requestFastInterval('dev_a')
        releaseFastInterval('dev_a')
        expect(request.mock.calls).toEqual([['dev_a', 1], ['dev_a', 0]])
    })

    it('carries on when Android refuses the request', async () => {
        request.mockRejectedValueOnce(new Error('not connected'))
        await expect(requestFastInterval('dev_a')).resolves.toBeUndefined()
    })

    it('swallows a release after the device has gone', async () => {
        request.mockRejectedValueOnce(new Error('not connected'))
        expect(() => releaseFastInterval('dev_a')).not.toThrow()
        await Promise.resolve()
    })

    it('does nothing on iOS, where the camera sets the interval', async () => {
        mockPlatform.OS = 'ios'
        await requestFastInterval('dev_a')
        releaseFastInterval('dev_a')
        expect(request).not.toHaveBeenCalled()
    })
})
