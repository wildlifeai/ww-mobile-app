import { renderHook } from '@testing-library/react-native'

import { useDevicePreDeploymentChecks } from '../useDevicePreDeploymentChecks'
import { himaxUpdateRecord } from '../../services/himaxUpdateRecord'

/**
 * #464: the AI firmware warning Start Monitoring shows on connect is the
 * judgement Firmware Status gives, each camera against its own latest build.
 * It compared the camera with the newest build of either camera, so a camera
 * on its own camera's latest build was told of newer AI firmware whenever the
 * other camera's build was newer.
 */

const RP3_LATEST = 'WW500_C02 04:33:16 Oct 10 2026'
const HM0360_LATEST = 'WW500_C02 10:56:08 Oct 11 2026'
const OLD = 'WW500_C02 10:02:35 Oct  8 2026'

let mockAiVersion = RP3_LATEST
const mockExecute = jest.fn(async (command: string): Promise<any> => {
    switch (command) {
        case 'battery': return 80
        case 'aiinfo': return { total: 100, free: 50 }
        case 'version': return 'V0.30.57'
        case 'aiver': return mockAiVersion
        default: return null
    }
})
const build = (version: string) => ({ id: version, version })

jest.mock('../useBleInitialization', () => ({ useBleInitialization: () => ({ initialize: jest.fn(async () => ({ errors: {} })) }) }))
jest.mock('../../ble/session/createBleSession', () => ({ createBleSession: () => ({ execute: mockExecute }) }))
jest.mock('../../ble/protocol/commandRegistry', () => ({
    commandRegistry: { battery: 'battery', aiinfo: 'aiinfo', selftest: 'selftest', version: 'version', aiver: 'aiver' },
}))
jest.mock('../../ble/protocol/selfTestCache', () => ({ selfTestCache: { waitForFresh: jest.fn(async () => ({ bits: 0 })) } }))
jest.mock('../../services/ReferenceDataService', () => ({
    __esModule: true,
    default: {
        // The newest AI build of either camera is the HM0360's
        getLatestFirmware: jest.fn(async (type: string) => (type === 'himax' ? build(HM0360_LATEST) : null)),
        getLatestHimaxByVariant: jest.fn(async (variant: string) => build(variant === 'RP3' ? RP3_LATEST : HM0360_LATEST)),
    },
}))
jest.mock('../../services/himaxUpdateRecord', () => ({ himaxUpdateRecord: { load: jest.fn(async () => null), clear: jest.fn() } }))
jest.mock('../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))

const device = { id: 'CA:AC:79:CE:D9:70', name: 'WILD-DJZQ', connected: true } as any

const run = async () => {
    const { result } = renderHook(() => useDevicePreDeploymentChecks())
    return result.current.runChecks(device, () => {})
}

const aiWarnings = (payload: Awaited<ReturnType<typeof run>>) =>
    (payload.initErrors.deviceHealth ?? []).filter(w => /AI firmware/.test(w))

describe('the AI firmware check on connect (#464)', () => {
    beforeEach(() => {
        ;(himaxUpdateRecord.load as jest.Mock).mockResolvedValue(null)
    })

    it("says nothing for a camera on its own camera's latest build, though the other camera's is newer", async () => {
        mockAiVersion = RP3_LATEST

        const payload = await run()

        expect(payload.himaxFirmwareVersion).toBe(RP3_LATEST)
        expect(aiWarnings(payload)).toEqual([])
    })

    it('warns for a camera on neither camera\'s latest build', async () => {
        mockAiVersion = OLD

        expect(aiWarnings(await run())).toEqual(['Newer AI firmware available'])
    })

    it('leaves an unfinished update to its own card on Start Monitoring', async () => {
        // Cut after image 1: the camera came back on the other camera's image
        mockAiVersion = HM0360_LATEST
        ;(himaxUpdateRecord.load as jest.Mock).mockResolvedValue({
            startedAt: '2026-10-10T04:00:00Z', endVariant: 'RP3', startActiveSlot: 0, startVersion: OLD,
            images: [
                { variant: 'HM0360', version: HM0360_LATEST, filename: 'HM0360.IMG' },
                { variant: 'RP3', version: RP3_LATEST, filename: 'RP3.IMG' },
            ],
            sent: 1, flashed: 1,
        })

        expect(aiWarnings(await run())).toEqual([])
    })
})
