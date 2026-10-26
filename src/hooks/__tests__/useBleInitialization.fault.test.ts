import { renderHook } from '@testing-library/react-native'

import { useBleInitialization } from '../useBleInitialization'
import { createBleSession } from '../../ble/session/createBleSession'
import { log, logWarn } from '../../utils/logger'

jest.mock('../../ble/session/createBleSession')
jest.mock('../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))

const device = { id: 'dev-1', name: 'WILD-TEST', connected: true } as any

/** A device whose `selftest` answers `bits` and whose `fault` answers `faultLine`. Returns the lines sent. */
const mockDevice = (bits: string, faultLine = 'fault none') => {
    const sent: string[] = []
    ;(createBleSession as jest.Mock).mockReturnValue({
        execute: jest.fn(async (build: () => any) => {
            const cmd = build()
            sent.push(cmd.build())
            if (cmd.name === 'selftest') return `Error bits = ${bits}`
            if (cmd.name === 'fault') {
                cmd.collect(faultLine)
                return cmd.getResult()
            }
            return true
        }),
    })
    return sent
}

/** Runs the initialisation through its 300 ms settle delay. */
const initialize = async () => {
    const pending = renderHook(() => useBleInitialization()).result.current.initialize(device)
    await jest.advanceTimersByTimeAsync(400)
    return pending
}

/**
 * Bit 5 means the BLE processor reset itself after a fault and kept a record
 * (ww-hardware PR #73). The app reads it with `fault` and logs it; firmware
 * without the record never sets the bit, so nothing else sends it (#482).
 */
describe('useBleInitialization fault record', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.useFakeTimers()
    })
    afterEach(() => jest.useRealTimers())

    it('reads and logs the fault record when bit 5 is set', async () => {
        const sent = mockDevice('0x0020', 'fault error 0x00000004 ble_commands.c:991 0x00027151 0x00000000 1')

        const result = await initialize()

        expect(sent).toContain('fault')
        expect(result.errors.deviceHealth).toEqual(['The device restarted after a firmware fault (Bit 5)'])
        expect(logWarn).toHaveBeenCalledWith(
            '[BLE Init] WILD-TEST restarted after a firmware fault: fault error 0x00000004 ble_commands.c:991 0x00027151 0x00000000 1',
        )
    })

    it('says so when the record is gone', async () => {
        mockDevice('0x0020')

        await initialize()

        expect(log).toHaveBeenCalledWith('[BLE Init] Bit 5 is set, but the fault record is gone (fault none)')
    })

    it.each(['0x0000', '0x0008'])('sends no fault command for %s', async (bits) => {
        const sent = mockDevice(bits)

        await initialize()

        expect(sent).not.toContain('fault')
    })
})
