import { renderHook } from '@testing-library/react-native'

import { useDevicePreDeploymentChecks } from '../useDevicePreDeploymentChecks'
import { bleEventBus } from '../../ble/protocol/eventBus'
import { DeviceSignal } from '../../ble/protocol/deviceSignals'
import { selfTestCache } from '../../ble/protocol/selfTestCache'
import { SD_CARD_NOT_CHECKED_WARNING } from '../../utils/deviceSelfTest'

/**
 * #521: on a warm wake the camera's first self-test goes out before its SD card
 * is mounted, with bit 15 set, and the final one follows unasked (Seeed issue
 * #290). Start Monitoring took the first reading, so a camera with no card was
 * not blocked and the banner showed "Unknown hardware issue (Code: 0x8000)".
 * These run the real self-test cache, fed the lines in the order the bench saw
 * them on 7 November 2026.
 */

const DEVICE = { id: 'CA:AC:79:CE:D9:70', name: 'WILD-JEI5', connected: true } as any

/** What `AI info` answers, and what the device sends around it. */
let mockAiInfo: () => any = () => ({ total: 100, free: 50 })
let mockSelftestReply = 'Error bits = 0x0000'

const mockExecute = jest.fn(async (command: string): Promise<any> => {
    switch (command) {
        case 'battery': return 80
        case 'aiinfo': return mockAiInfo()
        case 'selftest': return mockSelftestReply
        case 'version': return 'V0.30.60'
        case 'aiver': return 'WW500_C02 10:56:08 Nov 07 2026'
        default: return null
    }
})

jest.mock('../useBleInitialization', () => ({ useBleInitialization: () => ({ initialize: jest.fn(async () => ({ errors: {} })) }) }))
jest.mock('../../ble/session/createBleSession', () => ({ createBleSession: () => ({ execute: mockExecute }) }))
jest.mock('../../ble/protocol/commandRegistry', () => ({
    commandRegistry: { battery: 'battery', aiinfo: 'aiinfo', selftest: 'selftest', version: 'version', aiver: 'aiver' },
}))
jest.mock('../../services/ReferenceDataService', () => ({
    __esModule: true,
    default: {
        getLatestFirmware: jest.fn(async () => null),
        getLatestHimaxByVariant: jest.fn(async () => null),
    },
}))
jest.mock('../../services/himaxUpdateRecord', () => ({ himaxUpdateRecord: { load: jest.fn(async () => null), clear: jest.fn() } }))
jest.mock('../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))

const wake = () =>
    bleEventBus.emitEvent({ type: 'DEVICE_SIGNAL', signal: DeviceSignal.WAKE, deviceId: DEVICE.id, ts: Date.now() })
const line = (text: string) =>
    bleEventBus.emitEvent({ type: 'TEXT_LINE', line: text, ts: Date.now(), deviceId: DEVICE.id })

const run = async () => {
    const { result } = renderHook(() => useDevicePreDeploymentChecks())
    return result.current.runChecks(DEVICE, () => {})
}

describe('Start Monitoring checks with a provisional self-test (#521)', () => {
    beforeEach(() => {
        // The suite setup turns fake timers on; the cache's wait is real here,
        // so the two cases that sit out the 1500 ms take that long.
        jest.useRealTimers()
        selfTestCache.clear()
        mockExecute.mockClear()
        mockSelftestReply = 'Error bits = 0x0000'
    })

    it('waits for the final reading and blocks on the missing card it reports', async () => {
        // `AI info` wakes the camera: Wake, the early reading, then the final
        // one about 0.7 s later, as with no card on the bench.
        mockAiInfo = () => {
            wake()
            line('Error bits = 0x8000')
            setTimeout(() => line('Error bits = 0x0800'), 300)
            return { total: 100, free: 50 }
        }

        const payload = await run()

        expect(payload.aiProcessorFailed).toBe(true)
        expect((payload.initErrors.deviceHealth ?? []).some(w => /no sd card/i.test(w))).toBe(true)
        expect((payload.initErrors.deviceHealth ?? []).some(w => /Unknown hardware issue/.test(w))).toBe(false)
        expect(mockExecute).not.toHaveBeenCalledWith('selftest')
    })

    it('passes a camera whose final reading is clean, with no unknown code', async () => {
        mockAiInfo = () => {
            wake()
            line('Error bits = 0x8000')
            setTimeout(() => line('Error bits = 0x0000'), 100)
            return { total: 100, free: 50 }
        }

        const payload = await run()

        expect(payload.aiProcessorFailed).toBe(false)
        expect(payload.initErrors.deviceHealth).toEqual([])
    })

    it('never passes the card on a provisional reading alone, but does not block', async () => {
        // An older BLE processor never relays the final reading, so the
        // `selftest` asked for after the wait still carries bit 15. `AI info`
        // failed here, so nothing else has read the card.
        mockAiInfo = () => {
            wake()
            line('Error bits = 0x8000')
            return { error: 'TIMEOUT' }
        }
        mockSelftestReply = 'Error bits = 0x8000'

        const payload = await run()

        expect(mockExecute).toHaveBeenCalledWith('selftest')
        expect(payload.aiProcessorFailed).toBe(false)
        expect(payload.initErrors.deviceHealth).toContain(SD_CARD_NOT_CHECKED_WARNING)
        expect((payload.initErrors.deviceHealth ?? []).some(w => /Unknown hardware issue/.test(w))).toBe(false)
    })

    it('says nothing about the card when `AI info` has read it, though only the provisional reading came', async () => {
        mockAiInfo = () => {
            wake()
            line('Error bits = 0x8000')
            return { total: 100, free: 50 }
        }
        mockSelftestReply = 'Error bits = 0x8000'

        const payload = await run()

        expect(payload.aiProcessorFailed).toBe(false)
        expect(payload.initErrors.deviceHealth).toEqual([])
    })

    it('still blocks on a camera fault the provisional reading carries', async () => {
        mockAiInfo = () => {
            wake()
            line('Error bits = 0x8100')
            return { total: 100, free: 50 }
        }
        mockSelftestReply = 'Error bits = 0x8100'

        const payload = await run()

        expect(payload.aiProcessorFailed).toBe(true)
        expect(payload.initErrors.deviceHealth).toContain('Main Camera Error (Bit 8)')
    })
})
