import { renderHook } from '@testing-library/react-native'

import { useDevicePreDeploymentChecks } from '../useDevicePreDeploymentChecks'

/**
 * Connecting reads the AI version for Start Monitoring's firmware check and
 * lists no firmware line among the warnings: the page says Update software
 * once, in its banner (#529). Until then it listed "Newer AI firmware
 * available", which #464 had made judge each camera against its own build.
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
jest.mock('../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))

const device = { id: 'CA:AC:79:CE:D9:70', name: 'WILD-DJZQ', connected: true } as any

const run = async () => {
    const { result } = renderHook(() => useDevicePreDeploymentChecks())
    return result.current.runChecks(device, () => {})
}

const firmwareLines = (payload: Awaited<ReturnType<typeof run>>) =>
    (payload.initErrors.deviceHealth ?? []).filter(w => /firmware/i.test(w))

describe('the AI firmware check on connect', () => {
    it.each([
        ["its own camera's latest build", RP3_LATEST],
        ["neither camera's latest build", OLD],
    ])('reads a camera on %s and lists no firmware line', async (_label, version) => {
        mockAiVersion = version

        const payload = await run()

        expect(payload.himaxFirmwareVersion).toBe(version)
        expect(firmwareLines(payload)).toEqual([])
    })
})
