import AsyncStorage from '@react-native-async-storage/async-storage'

import { himaxUpdateRecord } from '../himaxUpdateRecord'
import type { HimaxUpdateRecord } from '../../utils/himaxFirmwareState'

// A real in-memory store rather than the global jest.fn() mock, as the hold
// tests use: `restoreMocks: true` strips the global mock's implementations
jest.mock('@react-native-async-storage/async-storage', () => {
    const store = new Map<string, string>()
    return {
        __esModule: true,
        default: {
            setItem: async (key: string, value: string) => { store.set(key, value) },
            getItem: async (key: string) => store.get(key) ?? null,
            removeItem: async (key: string) => { store.delete(key) },
            clear: async () => { store.clear() },
        },
    }
})
jest.mock('../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))

const RECORD: HimaxUpdateRecord = {
    startedAt: '2026-10-09T10:49:00.000Z',
    endVariant: 'HM0360',
    startActiveSlot: 1,
    startVersion: 'WW500_C02 10:02:35 Oct  8 2026',
    images: [
        { variant: 'RP3', version: 'WW500_C02 10:09:08 Oct  9 2026', filename: 'R6A09A09.IMG' },
        { variant: 'HM0360', version: 'WW500_C02 10:09:02 Oct  9 2026', filename: 'H6A09A09.IMG' },
    ],
    sent: 1,
    flashed: 1,
}

/** #374: the record an AI pair update keeps on this phone, one per device */
describe('himaxUpdateRecord', () => {
    beforeEach(async () => {
        await AsyncStorage.clear()
    })

    it('keeps a record per device until it is cleared', async () => {
        await himaxUpdateRecord.save('AA:BB', RECORD)

        expect(await himaxUpdateRecord.load('AA:BB')).toEqual(RECORD)
        expect(await himaxUpdateRecord.load('CC:DD')).toBeNull()

        await himaxUpdateRecord.clear('AA:BB')
        expect(await himaxUpdateRecord.load('AA:BB')).toBeNull()
    })

    it('ignores a stored value it cannot read as a record', async () => {
        await AsyncStorage.setItem('himaxUpdate:pending:AA:BB', JSON.stringify({ endVariant: 'colour', sent: 1 }))

        expect(await himaxUpdateRecord.load('AA:BB')).toBeNull()
    })
})
